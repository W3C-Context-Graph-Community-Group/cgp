export class FiberBundleControl {
  /**
   * @param {object} opts
   * @param {(active: boolean) => void} opts.onToggle — called with true/false
   * @param {(spikeIndex: number) => void} [opts.onSlide] — called with spike index
   * @param {(count: number) => void} [opts.onPairsChange] — called with pair count
   * @param {(source: {nodeId:number,spikeIndex:number}, target: {nodeId:number,spikeIndex:number}) => void} [opts.onAddConnection]
   * @param {(id: string) => void} [opts.onRemoveConnection]
   * @param {boolean} [opts.initial=false]
   */
  constructor({ onToggle, onSlide, onPairsChange, onAddConnection, onRemoveConnection, onAnimateConnection, initial = false }) {
    this._onToggle              = onToggle;
    this._onSlide               = onSlide ?? null;
    this._onPairsChange         = onPairsChange ?? null;
    this._onAddConnection       = onAddConnection ?? null;
    this._onRemoveConnection    = onRemoveConnection ?? null;
    this._onAnimateConnection   = onAnimateConnection ?? null;
    this._active = initial;
    this._spikeCount = 2; // default
    this._pairCount  = 1;
    this._spikeIndex = 0;
    this._el = null;
    this._toggle = null;
    this._slider = null;
    this._sliderValue = null;
    this._sliderRow = null;
    this._pairsSlider = null;
    this._pairsValue  = null;
    this._pairsRow    = null;

    // Network mode state
    this._mode = 'single';
    this._nodeCount = 1;
    this._getSpikeCount = null;
    this._sourceNode = 0;
    this._sourceSpike = 0;
    this._targetNode = 0;
    this._targetSpike = 0;

    // Network mode DOM refs — 4 separate rows (srcNode, srcSpike, tgtNode, tgtSpike)
    this._networkRows = null;       // container div
    this._srcNodeSlider = null;
    this._srcNodeValue = null;
    this._srcSpikeSlider = null;
    this._srcSpikeValue = null;
    this._tgtNodeSlider = null;
    this._tgtNodeValue = null;
    this._tgtSpikeSlider = null;
    this._tgtSpikeValue = null;
    this._connectBtn = null;
    this._connectionsList = null;

    this._boundClick      = this._handleClick.bind(this);
    this._boundSlide      = this._handleSlide.bind(this);
    this._boundPairsSlide = this._handlePairsSlide.bind(this);
  }

  get cssURL() {
    return new URL('fiber-bundle-control.css', import.meta.url).href;
  }

  get spikeIndex() { return this._spikeIndex; }
  get pairCount()  { return this._pairCount; }
  get mode()       { return this._mode; }

  setSpikeCount(n) {
    this._spikeCount = n;
    // Reset spike slider
    if (this._slider) {
      this._slider.max = '1';
      this._slider.value = '0';
      this._spikeIndex = 0;
      this._updateSliderDisplay(0);
    }
    // Reset pairs slider
    this._pairCount = 1;
    if (this._pairsSlider) {
      const maxPairs = Math.max(1, n - 1);
      this._pairsSlider.max = String(maxPairs);
      this._pairsSlider.value = '1';
      this._updatePairsDisplay(1);
    }
  }

  /**
   * Switch between 'single' and 'network' mode.
   * @param {number} nodeCount — number of nodes in the network
   * @param {(nodeId: number) => number} getSpikeCount — returns spike count for a given node
   */
  setMode(nodeCount, getSpikeCount) {
    this._nodeCount = nodeCount;
    this._getSpikeCount = getSpikeCount;

    if (nodeCount <= 1) {
      this._mode = 'single';
      if (this._sliderRow) this._sliderRow.style.display = this._active ? '' : 'none';
      if (this._pairsRow) this._pairsRow.style.display = this._active ? '' : 'none';
      if (this._networkRows) this._networkRows.style.display = 'none';
    } else {
      this._mode = 'network';
      if (this._sliderRow) this._sliderRow.style.display = 'none';
      if (this._pairsRow) this._pairsRow.style.display = 'none';
      if (this._networkRows) {
        this._networkRows.style.display = this._active ? 'flex' : 'none';
        this._updateNetworkSliderRanges();
      }
    }
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'fiber-bundle-control';

    // Row 1: label + toggle
    const row = document.createElement('div');
    row.className = 'fiber-bundle-control__row';

    const label = document.createElement('span');
    label.className = 'fiber-bundle-control__label';
    label.textContent = 'Ring';
    row.appendChild(label);

    this._toggle = document.createElement('button');
    this._toggle.className = 'fiber-bundle-control__toggle';
    this._syncState();
    this._toggle.addEventListener('click', this._boundClick);
    row.appendChild(this._toggle);

    this._el.appendChild(row);

    // Row 2: spike slider (single mode)
    this._sliderRow = document.createElement('div');
    this._sliderRow.className = 'fiber-bundle-control__slider-row';

    const sliderLabel = document.createElement('span');
    sliderLabel.className = 'fiber-bundle-control__slider-label';
    sliderLabel.textContent = 'Spike';
    this._sliderRow.appendChild(sliderLabel);

    this._sliderValue = document.createElement('span');
    this._sliderValue.className = 'fiber-bundle-control__slider-value';
    this._sliderValue.textContent = '0';
    this._sliderRow.appendChild(this._sliderValue);

    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'fiber-bundle-control__slider';
    this._slider.min = '0';
    this._slider.max = '1';
    this._slider.step = 'any';
    this._slider.value = '0';
    this._slider.addEventListener('input', this._boundSlide);
    this._sliderRow.appendChild(this._slider);

    this._sliderRow.style.display = this._active ? '' : 'none';
    this._el.appendChild(this._sliderRow);

    // Row 3: pairs slider (single mode)
    this._pairsRow = document.createElement('div');
    this._pairsRow.className = 'fiber-bundle-control__slider-row';

    const pairsLabel = document.createElement('span');
    pairsLabel.className = 'fiber-bundle-control__slider-label';
    pairsLabel.textContent = 'Pairs';
    this._pairsRow.appendChild(pairsLabel);

    this._pairsValue = document.createElement('span');
    this._pairsValue.className = 'fiber-bundle-control__slider-value';
    this._pairsValue.textContent = '1';
    this._pairsRow.appendChild(this._pairsValue);

    this._pairsSlider = document.createElement('input');
    this._pairsSlider.type = 'range';
    this._pairsSlider.className = 'fiber-bundle-control__slider';
    this._pairsSlider.min = '1';
    this._pairsSlider.max = String(Math.max(1, this._spikeCount - 1));
    this._pairsSlider.step = '1';
    this._pairsSlider.value = '1';
    this._pairsSlider.addEventListener('input', this._boundPairsSlide);
    this._pairsRow.appendChild(this._pairsSlider);

    this._pairsRow.style.display = this._active ? '' : 'none';
    this._el.appendChild(this._pairsRow);

    // ── Network mode rows (hidden by default) ──
    this._networkRows = document.createElement('div');
    this._networkRows.style.cssText = 'display:none; flex-direction:column; gap:6px';

    // Source: Node row
    const { row: srcNodeRow, slider: srcNS, value: srcNV } =
      this._buildSliderRow('Src Node', '0', '0', '0', '1');
    this._srcNodeSlider = srcNS;
    this._srcNodeValue  = srcNV;
    srcNS.addEventListener('input', () => {
      this._sourceNode = parseInt(srcNS.value, 10);
      srcNV.textContent = String(this._sourceNode);
      this._updateSpikeRange('src', this._sourceNode);
    });
    this._networkRows.appendChild(srcNodeRow);

    // Source: Spike row
    const { row: srcSpikeRow, slider: srcSS, value: srcSV } =
      this._buildSliderRow('Src Spike', '0', '0', '0', '1');
    this._srcSpikeSlider = srcSS;
    this._srcSpikeValue  = srcSV;
    srcSS.addEventListener('input', () => {
      this._sourceSpike = parseInt(srcSS.value, 10);
      srcSV.textContent = String(this._sourceSpike);
    });
    this._networkRows.appendChild(srcSpikeRow);

    // Target: Node row (with top padding to separate from source group)
    const { row: tgtNodeRow, slider: tgtNS, value: tgtNV } =
      this._buildSliderRow('Tgt Node', '0', '0', '0', '1');
    tgtNodeRow.style.marginTop = '6px';
    this._tgtNodeSlider = tgtNS;
    this._tgtNodeValue  = tgtNV;
    tgtNS.addEventListener('input', () => {
      this._targetNode = parseInt(tgtNS.value, 10);
      tgtNV.textContent = String(this._targetNode);
      this._updateSpikeRange('tgt', this._targetNode);
    });
    this._networkRows.appendChild(tgtNodeRow);

    // Target: Spike row
    const { row: tgtSpikeRow, slider: tgtSS, value: tgtSV } =
      this._buildSliderRow('Tgt Spike', '0', '0', '0', '1');
    this._tgtSpikeSlider = tgtSS;
    this._tgtSpikeValue  = tgtSV;
    tgtSS.addEventListener('input', () => {
      this._targetSpike = parseInt(tgtSS.value, 10);
      tgtSV.textContent = String(this._targetSpike);
    });
    this._networkRows.appendChild(tgtSpikeRow);

    // Connect button row (with top padding)
    const connectRow = document.createElement('div');
    connectRow.className = 'fiber-bundle-control__slider-row';
    connectRow.style.marginTop = '6px';
    this._connectBtn = document.createElement('button');
    this._connectBtn.className = 'fiber-bundle-control__toggle';
    this._connectBtn.textContent = 'Connect';
    this._connectBtn.addEventListener('click', () => this._handleConnect());
    connectRow.appendChild(this._connectBtn);
    this._networkRows.appendChild(connectRow);

    // Active connections list
    this._connectionsList = document.createElement('div');
    this._networkRows.appendChild(this._connectionsList);

    this._el.appendChild(this._networkRows);

    return this._el;
  }

  /** Update the active connections list display. */
  updateConnectionsList(connections) {
    if (!this._connectionsList) return;
    this._connectionsList.innerHTML = '';
    for (const conn of connections) {
      const entry = document.createElement('div');
      entry.className = 'fiber-bundle-control__slider-row';
      const text = document.createElement('span');
      text.className = 'fiber-bundle-control__slider-label';
      text.textContent = `${conn.source.nodeId}:${conn.source.spikeIndex} \u2192 ${conn.target.nodeId}:${conn.target.spikeIndex}`;
      entry.appendChild(text);

      const animBtn = document.createElement('button');
      animBtn.className = 'fiber-bundle-control__toggle';
      animBtn.textContent = '\u25B6';
      animBtn.addEventListener('click', () => {
        if (this._onAnimateConnection) this._onAnimateConnection(conn.id);
      });
      entry.appendChild(animBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'fiber-bundle-control__toggle';
      removeBtn.textContent = '\u2715';
      removeBtn.addEventListener('click', () => {
        if (this._onRemoveConnection) this._onRemoveConnection(conn.id);
      });
      entry.appendChild(removeBtn);
      this._connectionsList.appendChild(entry);
    }
  }

  dispose() {
    if (this._toggle) this._toggle.removeEventListener('click', this._boundClick);
    if (this._slider) this._slider.removeEventListener('input', this._boundSlide);
    if (this._pairsSlider) this._pairsSlider.removeEventListener('input', this._boundPairsSlide);
    this._el = null;
    this._toggle = null;
    this._slider = null;
    this._sliderValue = null;
    this._sliderRow = null;
    this._pairsSlider = null;
    this._pairsValue = null;
    this._pairsRow = null;
    this._networkRows = null;
    this._srcNodeSlider = null;
    this._srcNodeValue = null;
    this._srcSpikeSlider = null;
    this._srcSpikeValue = null;
    this._tgtNodeSlider = null;
    this._tgtNodeValue = null;
    this._tgtSpikeSlider = null;
    this._tgtSpikeValue = null;
    this._connectBtn = null;
    this._connectionsList = null;
  }

  // ── Internal: single mode handlers ────────────

  _handleClick() {
    this._active = !this._active;
    this._syncState();
    if (this._mode === 'single') {
      if (this._sliderRow) this._sliderRow.style.display = this._active ? '' : 'none';
      if (this._pairsRow) this._pairsRow.style.display = this._active ? '' : 'none';
    } else {
      if (this._networkRows) this._networkRows.style.display = this._active ? 'flex' : 'none';
    }
    this._onToggle(this._active);
  }

  _handleSlide() {
    const raw = parseFloat(this._slider.value);
    const n = Math.max(1, this._spikeCount);
    let index = Math.round(raw * (n - 1));

    // Clamp so startIndex + pairCount doesn't exceed available spikes
    const maxStart = Math.max(0, this._spikeCount - 1 - this._pairCount);
    index = Math.min(index, maxStart);

    this._spikeIndex = index;
    this._updateSliderDisplay(index);
    if (this._onSlide) this._onSlide(index);
  }

  _handlePairsSlide() {
    const count = parseInt(this._pairsSlider.value, 10);
    this._pairCount = count;
    this._updatePairsDisplay(count);

    // Auto-clamp spike index if it would overflow
    const maxStart = Math.max(0, this._spikeCount - 1 - count);
    if (this._spikeIndex > maxStart) {
      this._spikeIndex = maxStart;
      // Update the spike slider position to reflect the clamp
      const n = Math.max(1, this._spikeCount);
      this._slider.value = String(n > 1 ? maxStart / (n - 1) : 0);
      this._updateSliderDisplay(maxStart);
    }

    if (this._onPairsChange) this._onPairsChange(count);
  }

  _updateSliderDisplay(index) {
    if (this._sliderValue) this._sliderValue.textContent = String(index);
  }

  _updatePairsDisplay(count) {
    if (this._pairsValue) this._pairsValue.textContent = String(count);
  }

  _syncState() {
    if (!this._toggle) return;
    this._toggle.classList.toggle('fiber-bundle-control__toggle--on', this._active);
    this._toggle.textContent = this._active ? 'On' : 'Off';
    this._toggle.title = this._active ? 'Hide ring' : 'Show ring';
  }

  // ── Internal: network mode ────────────────────

  /** Build a standard label + value + slider row (matches Spike/Pairs pattern). */
  _buildSliderRow(labelText, initialValue, min, max, step) {
    const row = document.createElement('div');
    row.className = 'fiber-bundle-control__slider-row';

    const lbl = document.createElement('span');
    lbl.className = 'fiber-bundle-control__slider-label';
    lbl.textContent = labelText;
    row.appendChild(lbl);

    const value = document.createElement('span');
    value.className = 'fiber-bundle-control__slider-value';
    value.textContent = initialValue;
    row.appendChild(value);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'fiber-bundle-control__slider';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initialValue;
    row.appendChild(slider);

    return { row, slider, value };
  }

  _updateSpikeRange(prefix, nodeId) {
    if (!this._getSpikeCount) return;
    const count = this._getSpikeCount(nodeId);
    const max = Math.max(0, count - 1);

    if (prefix === 'src') {
      this._srcSpikeSlider.max = String(max);
      if (this._sourceSpike > max) {
        this._sourceSpike = max;
        this._srcSpikeSlider.value = String(max);
        this._srcSpikeValue.textContent = String(max);
      }
    } else {
      this._tgtSpikeSlider.max = String(max);
      if (this._targetSpike > max) {
        this._targetSpike = max;
        this._tgtSpikeSlider.value = String(max);
        this._tgtSpikeValue.textContent = String(max);
      }
    }
  }

  _updateNetworkSliderRanges() {
    const maxNode = Math.max(0, this._nodeCount - 1);

    if (this._srcNodeSlider) {
      this._srcNodeSlider.max = String(maxNode);
      this._srcNodeSlider.value = String(Math.min(this._sourceNode, maxNode));
      this._srcNodeValue.textContent = this._srcNodeSlider.value;
      this._sourceNode = parseInt(this._srcNodeSlider.value, 10);
    }
    if (this._tgtNodeSlider) {
      this._tgtNodeSlider.max = String(maxNode);
      // Default target to node 1 if source is 0 and target hasn't been set yet
      const tgtDefault = (this._targetNode === 0 && maxNode > 0) ? Math.min(1, maxNode) : this._targetNode;
      this._tgtNodeSlider.value = String(Math.min(tgtDefault, maxNode));
      this._tgtNodeValue.textContent = this._tgtNodeSlider.value;
      this._targetNode = parseInt(this._tgtNodeSlider.value, 10);
    }

    this._updateSpikeRange('src', this._sourceNode);
    this._updateSpikeRange('tgt', this._targetNode);
  }

  _handleConnect() {
    if (!this._onAddConnection) return;
    const source = { nodeId: this._sourceNode, spikeIndex: this._sourceSpike };
    const target = { nodeId: this._targetNode, spikeIndex: this._targetSpike };
    this._onAddConnection(source, target);
  }
}

/**
 * LayersPanel — left sidebar with Figma-style layer tree.
 * Observatrons are expandable frames; spikes are child layers.
 * Resizable via drag handle on right edge.
 */
export class LayersPanel {
  get cssURL() { return new URL('layers-panel.css', import.meta.url).href; }

  /**
   * @param {object} opts
   * @param {function} [opts.onResize] — called with current width after drag
   * @param {function} [opts.onItemClick] — called with (obsId) when observatron row clicked
   * @param {function} [opts.onSpikeClick] — called with (obsId, spikeIndex) when spike row clicked
   * @param {number}   [opts.initialWidth=350]
   * @param {number}   [opts.minWidth=200]
   * @param {number}   [opts.maxWidth=600]
   */
  constructor({ onResize, onItemClick, onSpikeClick, initialWidth = 350, minWidth = 200, maxWidth = 600 } = {}) {
    this._onResize = onResize || null;
    this._onItemClick = onItemClick || null;
    this._onSpikeClick = onSpikeClick || null;
    this._width = initialWidth;
    this._minWidth = minWidth;
    this._maxWidth = maxWidth;
    this._el = null;
    this._listEl = null;
    this._resizer = null;
    this._selectedId = null;
    this._selectedSpikeKey = null; // "obsId:spikeIndex"
    this._expandedObs = new Set();
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'layers-panel';

    // header
    const header = document.createElement('div');
    header.className = 'layers-panel__header';
    header.textContent = 'Layers';
    this._el.appendChild(header);

    // list
    this._listEl = document.createElement('div');
    this._listEl.className = 'layers-panel__list';
    this._el.appendChild(this._listEl);

    // resizer
    this._resizer = document.createElement('div');
    this._resizer.className = 'layers-panel__resizer';
    this._el.appendChild(this._resizer);

    this._setWidth(this._width);
    this._initResize();

    return this._el;
  }

  /**
   * Rebuild the tree.
   * @param {Array<{ id: string, url: string, spikes?: Array<{ index: number, url: string }> }>} entries
   */
  setEntries(entries) {
    if (!this._listEl) return;
    this._listEl.innerHTML = '';
    this._selectedId = null;
    this._selectedSpikeKey = null;

    for (const entry of entries) {
      const isExpanded = this._expandedObs.has(entry.id);

      // observatron row (frame)
      const obsRow = document.createElement('div');
      obsRow.className = 'layers-panel__obs';
      obsRow.setAttribute('data-cgp-observatron_id', entry.id);

      const toggle = document.createElement('span');
      toggle.className = 'layers-panel__toggle';
      toggle.textContent = isExpanded ? '\u25BC' : '\u25B6';
      const hasSpikes = entry.spikes && entry.spikes.length > 0;
      if (!hasSpikes) toggle.style.visibility = 'hidden';
      obsRow.appendChild(toggle);

      const label = document.createElement('span');
      label.className = 'layers-panel__obs-label';
      label.textContent = entry.url;
      obsRow.appendChild(label);

      // click on toggle → expand/collapse
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isExpanded) {
          this._expandedObs.delete(entry.id);
        } else {
          this._expandedObs.add(entry.id);
        }
        // re-render preserving expand state
        this.setEntries(this._lastEntries);
      });

      // click on obs row → select observatron
      obsRow.addEventListener('click', () => {
        if (this._onItemClick) this._onItemClick(entry.id);
      });

      this._listEl.appendChild(obsRow);

      // spike children (visible only when expanded)
      if (hasSpikes && isExpanded) {
        const childContainer = document.createElement('div');
        childContainer.className = 'layers-panel__children';

        for (const spike of entry.spikes) {
          const spikeRow = document.createElement('div');
          spikeRow.className = 'layers-panel__spike';
          const key = `${entry.id}:${spike.index}`;
          spikeRow.setAttribute('data-spike-key', key);
          spikeRow.textContent = spike.url;

          spikeRow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._onSpikeClick) this._onSpikeClick(entry.id, spike.index);
          });

          childContainer.appendChild(spikeRow);
        }
        this._listEl.appendChild(childContainer);
      }
    }

    this._lastEntries = entries;
  }

  /**
   * Visually select an observatron by id (or deselect if null).
   * @param {string|null} id
   */
  selectItem(id) {
    // clear previous obs selection
    if (this._selectedId !== null && this._listEl) {
      const prev = this._listEl.querySelector(`.layers-panel__obs[data-cgp-observatron_id="${this._selectedId}"]`);
      if (prev) prev.classList.remove('layers-panel__obs--selected');
    }
    this._selectedId = id;
    if (id !== null && this._listEl) {
      const el = this._listEl.querySelector(`.layers-panel__obs[data-cgp-observatron_id="${id}"]`);
      if (el) {
        el.classList.add('layers-panel__obs--selected');
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /**
   * Visually select a spike row (or deselect if null).
   * @param {string|null} obsId
   * @param {number|null} spikeIndex
   */
  selectSpike(obsId, spikeIndex) {
    // clear previous spike selection
    if (this._selectedSpikeKey !== null && this._listEl) {
      const prev = this._listEl.querySelector(`[data-spike-key="${this._selectedSpikeKey}"]`);
      if (prev) prev.classList.remove('layers-panel__spike--selected');
    }
    if (obsId !== null && spikeIndex !== null) {
      this._selectedSpikeKey = `${obsId}:${spikeIndex}`;
      const el = this._listEl.querySelector(`[data-spike-key="${this._selectedSpikeKey}"]`);
      if (el) {
        el.classList.add('layers-panel__spike--selected');
        el.scrollIntoView({ block: 'nearest' });
      }
    } else {
      this._selectedSpikeKey = null;
    }
  }

  get selectedId() { return this._selectedId; }
  get selectedSpikeKey() { return this._selectedSpikeKey; }

  dispose() {
    if (this._el) this._el.remove();
  }

  // ── private ──

  _setWidth(w) {
    this._width = Math.max(this._minWidth, Math.min(this._maxWidth, w));
    document.documentElement.style.setProperty('--lp-width', this._width + 'px');
  }

  _initResize() {
    const resizer = this._resizer;

    const onPointerDown = (e) => {
      e.preventDefault();
      resizer.setPointerCapture(e.pointerId);
      resizer.classList.add('layers-panel__resizer--active');

      const onPointerMove = (e2) => {
        this._setWidth(e2.clientX);
        if (this._onResize) this._onResize(this._width);
      };

      const onPointerUp = () => {
        resizer.classList.remove('layers-panel__resizer--active');
        resizer.removeEventListener('pointermove', onPointerMove);
        resizer.removeEventListener('pointerup', onPointerUp);
      };

      resizer.addEventListener('pointermove', onPointerMove);
      resizer.addEventListener('pointerup', onPointerUp);
    };

    resizer.addEventListener('pointerdown', onPointerDown);
  }
}

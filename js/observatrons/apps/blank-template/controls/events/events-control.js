export class EventsControl {
  /**
   * @param {object} opts
   * @param {(connectionIds: string[], duration: number) => void} opts.onCompare — called with all listed connection ids and duration in seconds
   */
  constructor({ onCompare }) {
    this._onCompare = onCompare;
    this._connections = [];    // { id, source, target }
    this._duration = 0.5;      // seconds (default)
    this._el = null;
    this._list = null;
    this._compareBtn = null;
    this._emptyMsg = null;
    this._speedSlider = null;
    this._speedValue = null;
  }

  get cssURL() {
    return new URL('events-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'events-control';

    // Connection list container
    this._list = document.createElement('div');
    this._list.style.cssText = 'display:flex; flex-direction:column; gap:4px';
    this._el.appendChild(this._list);

    // Empty state message
    this._emptyMsg = document.createElement('span');
    this._emptyMsg.className = 'events-control__empty';
    this._emptyMsg.textContent = 'No connections';
    this._list.appendChild(this._emptyMsg);

    // Speed slider row
    const speedRow = document.createElement('div');
    speedRow.className = 'events-control__row';

    const speedLabel = document.createElement('span');
    speedLabel.className = 'events-control__label';
    speedLabel.textContent = 'Speed';
    speedRow.appendChild(speedLabel);

    this._speedValue = document.createElement('span');
    this._speedValue.className = 'events-control__slider-value';
    this._speedValue.textContent = '0.50s';
    speedRow.appendChild(this._speedValue);

    this._speedSlider = document.createElement('input');
    this._speedSlider.type = 'range';
    this._speedSlider.className = 'events-control__slider';
    this._speedSlider.min = '0.25';
    this._speedSlider.max = '4';
    this._speedSlider.step = '0.05';
    this._speedSlider.value = '0.5';
    this._speedSlider.addEventListener('input', () => this._handleSpeedChange());
    speedRow.appendChild(this._speedSlider);

    this._el.appendChild(speedRow);

    // Compare button row
    const btnRow = document.createElement('div');
    btnRow.className = 'events-control__row';

    this._compareBtn = document.createElement('button');
    this._compareBtn.className = 'events-control__btn';
    this._compareBtn.textContent = 'Compare';
    this._compareBtn.addEventListener('click', () => this._handleCompare());
    btnRow.appendChild(this._compareBtn);

    this._el.appendChild(btnRow);

    return this._el;
  }

  /**
   * Update the displayed connections list.
   * @param {{ id: string, source: { nodeId: number, spikeIndex: number }, target: { nodeId: number, spikeIndex: number } }[]} connections
   */
  updateConnectionsList(connections) {
    this._connections = connections;
    if (!this._list) return;

    this._list.innerHTML = '';

    if (connections.length === 0) {
      this._emptyMsg = document.createElement('span');
      this._emptyMsg.className = 'events-control__empty';
      this._emptyMsg.textContent = 'No connections';
      this._list.appendChild(this._emptyMsg);
      return;
    }

    for (const conn of connections) {
      const row = document.createElement('div');
      row.className = 'events-control__row';

      const label = document.createElement('span');
      label.className = 'events-control__label';
      label.textContent = `${conn.source.nodeId}:${conn.source.spikeIndex} \u2192 ${conn.target.nodeId}:${conn.target.spikeIndex}`;
      row.appendChild(label);

      this._list.appendChild(row);
    }
  }

  dispose() {
    this._el = null;
    this._list = null;
    this._compareBtn = null;
    this._emptyMsg = null;
    this._speedSlider = null;
    this._speedValue = null;
  }

  _handleSpeedChange() {
    this._duration = parseFloat(this._speedSlider.value);
    this._speedValue.textContent = this._duration.toFixed(2) + 's';
  }

  _handleCompare() {
    if (this._connections.length === 0) return;
    const ids = this._connections.map(c => c.id);
    this._onCompare(ids, this._duration);
  }
}

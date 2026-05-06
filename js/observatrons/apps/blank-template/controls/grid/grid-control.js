export class GridControl {
  /**
   * @param {object} opts
   * @param {(active: boolean) => void} opts.onDotsToggle
   * @param {(active: boolean) => void} opts.onBoxToggle
   */
  constructor({ onDotsToggle, onBoxToggle }) {
    this._onDotsToggle = onDotsToggle;
    this._onBoxToggle = onBoxToggle;
    this._dotsActive = false;
    this._boxActive = false;
    this._el = null;
    this._dotsBtn = null;
    this._boxBtn = null;
  }

  get cssURL() {
    return new URL('grid-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'grid-panel';

    this._dotsBtn = this._buildRow('Dots', (active) => {
      this._dotsActive = active;
      this._onDotsToggle(active);
    });

    this._boxBtn = this._buildRow('Box', (active) => {
      this._boxActive = active;
      this._onBoxToggle(active);
    });

    return this._el;
  }

  dispose() {
    this._el = null;
    this._dotsBtn = null;
    this._boxBtn = null;
  }

  _buildRow(label, onChange) {
    const row = document.createElement('div');
    row.className = 'grid-panel__row';

    const lbl = document.createElement('span');
    lbl.className = 'grid-panel__label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const btn = document.createElement('button');
    btn.className = 'grid-panel__toggle';
    btn.textContent = 'Off';
    btn.addEventListener('click', () => {
      const active = !btn.classList.contains('grid-panel__toggle--active');
      btn.classList.toggle('grid-panel__toggle--active', active);
      btn.textContent = active ? 'On' : 'Off';
      onChange(active);
    });
    row.appendChild(btn);

    this._el.appendChild(row);
    return btn;
  }
}

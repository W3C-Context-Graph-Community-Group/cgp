export class ResetControl {
  /**
   * @param {object} opts
   * @param {() => void} opts.onReset - callback to trigger reset of all sliders
   */
  constructor({ onReset }) {
    this._onReset = onReset;
    this._el = null;
    this._btn = null;
    this._boundClick = this._handleClick.bind(this);
  }

  get cssURL() {
    return new URL('reset-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'reset-control';

    this._btn = document.createElement('button');
    this._btn.className = 'reset-control__btn';
    this._btn.title = 'Reset all sliders';
    this._btn.innerHTML =
      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M2 8a6 6 0 0111.47-2.4"/>` +
        `<path d="M14 8a6 6 0 01-11.47 2.4"/>` +
        `<polyline points="2 3 2 6 5 6"/>` +
        `<polyline points="14 13 14 10 11 10"/>` +
      `</svg>`;
    this._btn.addEventListener('click', this._boundClick);
    this._el.appendChild(this._btn);

    const lbl = document.createElement('span');
    lbl.className = 'reset-control__label';
    lbl.textContent = 'Reset';
    this._el.appendChild(lbl);

    return this._el;
  }

  dispose() {
    if (this._btn) this._btn.removeEventListener('click', this._boundClick);
    this._el = null;
    this._btn = null;
  }

  _handleClick() {
    this._onReset();
  }
}

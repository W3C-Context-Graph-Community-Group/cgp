export class SaveImageControl {
  /**
   * @param {object} opts
   * @param {() => void} opts.onSave - callback to trigger save
   */
  constructor({ onSave }) {
    this._onSave = onSave;
    this._el = null;
    this._btn = null;
    this._boundClick = this._handleClick.bind(this);
  }

  get cssURL() {
    return new URL('save-image-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'save-image-control';

    this._btn = document.createElement('button');
    this._btn.className = 'save-image-control__btn';
    this._btn.title = 'Save image';
    this._btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3"/><path d="M8 2v8M8 10l-3-3M8 10l3-3"/></svg>`;
    this._btn.addEventListener('click', this._boundClick);
    this._el.appendChild(this._btn);

    return this._el;
  }

  dispose() {
    if (this._btn) this._btn.removeEventListener('click', this._boundClick);
    this._el = null;
    this._btn = null;
  }

  _handleClick() {
    this._onSave();
  }
}

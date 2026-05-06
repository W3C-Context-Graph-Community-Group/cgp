export class CardToggleControl {
  /**
   * @param {object} opts
   * @param {string} opts.label — button text
   * @param {string} [opts.icon] — SVG markup for the icon
   * @param {(active: boolean) => void} opts.onToggle
   * @param {boolean} [opts.initial=true]
   */
  constructor({ label, icon = '', onToggle, initial = true }) {
    this._label = label;
    this._icon = icon;
    this._onToggle = onToggle;
    this._active = initial;
    this._el = null;
    this._btn = null;
    this._boundClick = this._handleClick.bind(this);
  }

  get cssURL() {
    return new URL('card-toggle-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'card-toggle';

    this._btn = document.createElement('button');
    this._btn.className = 'card-toggle__btn';
    this._btn.title = `Toggle ${this._label}`;
    this._btn.innerHTML = this._icon;
    if (this._active) this._btn.classList.add('card-toggle__btn--active');
    this._btn.addEventListener('click', this._boundClick);
    this._el.appendChild(this._btn);

    const lbl = document.createElement('span');
    lbl.className = 'card-toggle__label';
    lbl.textContent = this._label;
    this._el.appendChild(lbl);

    return this._el;
  }

  dispose() {
    if (this._btn) this._btn.removeEventListener('click', this._boundClick);
    this._el = null;
    this._btn = null;
  }

  setActive(active) {
    this._active = active;
    if (this._btn) this._btn.classList.toggle('card-toggle__btn--active', this._active);
    this._onToggle(this._active);
  }

  _handleClick() {
    this.setActive(!this._active);
  }
}

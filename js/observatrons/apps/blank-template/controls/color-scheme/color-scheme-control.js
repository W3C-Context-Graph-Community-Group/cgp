export class ColorSchemeControl {
  /**
   * @param {object} opts
   * @param {string[]} opts.schemes  - list of preset names
   * @param {string}   opts.initial  - initially active scheme
   * @param {(name: string) => void} opts.onScheme - callback when scheme changes
   */
  constructor({ schemes, initial, onScheme }) {
    this._schemes = schemes;
    this._active = initial;
    this._onScheme = onScheme;
    this._el = null;
    this._buttons = [];
    this._boundClick = this._handleClick.bind(this);
  }

  get cssURL() {
    return new URL('color-scheme-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'cs-control';

    const label = document.createElement('div');
    label.className = 'control-panel__label';
    label.textContent = 'Color scheme';
    this._el.appendChild(label);

    const row = document.createElement('div');
    row.className = 'cs-control__row';

    for (const name of this._schemes) {
      const btn = document.createElement('button');
      btn.className = 'cs-control__btn';
      btn.textContent = name;
      btn.dataset.scheme = name;
      if (name === this._active) btn.classList.add('cs-control__btn--active');
      btn.addEventListener('click', this._boundClick);
      row.appendChild(btn);
      this._buttons.push(btn);
    }

    this._el.appendChild(row);
    return this._el;
  }

  dispose() {
    for (const btn of this._buttons) {
      btn.removeEventListener('click', this._boundClick);
    }
    this._buttons = [];
    this._el = null;
  }

  _handleClick(e) {
    const name = e.currentTarget.dataset.scheme;
    if (name === this._active) return;
    this._active = name;
    for (const btn of this._buttons) {
      btn.classList.toggle('cs-control__btn--active', btn.dataset.scheme === name);
    }
    this._onScheme(name);
  }
}

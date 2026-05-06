export class NetworkControl {
  /**
   * @param {object} opts
   * @param {(count: number) => void} opts.onChange — called with new count
   * @param {number} [opts.min=1]
   * @param {number} [opts.max=9]
   * @param {number} [opts.initial=1]
   */
  constructor({ onChange, min = 1, max = 9, initial = 1 }) {
    this._onChange = onChange;
    this._min = min;
    this._max = max;
    this._value = initial;
    this._initial = initial;
    this._el = null;
    this._slider = null;
    this._display = null;
    this._boundInput = this._handleInput.bind(this);
  }

  get value() { return this._value; }

  get cssURL() {
    return new URL('network-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'network-control';

    // label row
    const labelRow = document.createElement('div');
    labelRow.className = 'network-control__row';

    const label = document.createElement('div');
    label.className = 'network-control__axis-label';
    label.style.cssText = 'font-family:var(--cp-font);font-size:10px;color:var(--cp-text-muted)';
    label.textContent = 'Observatrons';
    labelRow.appendChild(label);

    this._display = document.createElement('span');
    this._display.className = 'network-control__value';
    this._updateDisplay();
    labelRow.appendChild(this._display);

    this._el.appendChild(labelRow);

    // slider
    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'network-control__slider';
    this._slider.min = String(this._min);
    this._slider.max = String(this._max);
    this._slider.step = '1';
    this._slider.value = String(this._value);
    this._slider.addEventListener('input', this._boundInput);
    this._el.appendChild(this._slider);

    return this._el;
  }

  dispose() {
    if (this._slider) this._slider.removeEventListener('input', this._boundInput);
    this._el = null;
    this._slider = null;
    this._display = null;
  }

  reset() {
    this._value = this._initial;
    if (this._slider) this._slider.value = String(this._initial);
    this._updateDisplay();
    this._onChange(this._value);
  }

  _handleInput() {
    this._value = parseInt(this._slider.value, 10);
    this._updateDisplay();
    this._onChange(this._value);
  }

  _updateDisplay() {
    if (this._display) {
      this._display.textContent = String(this._value);
    }
  }
}

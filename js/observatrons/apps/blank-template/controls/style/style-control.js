export class StyleControl {
  constructor({ label = 'Value', suffix = '%', onChange, initial = 100, min = 0, max = 100, step = 1 }) {
    this._label = label;
    this._suffix = suffix;
    this._onChange = onChange;
    this._min = min;
    this._max = max;
    this._step = step;
    this._value = initial;
    this._el = null;
    this._slider = null;
    this._display = null;
    this._boundInput = this._handleInput.bind(this);
  }

  get value() { return this._value; }

  get cssURL() {
    return new URL('style-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'style-control';

    const labelRow = document.createElement('div');
    labelRow.className = 'style-control__row';

    const label = document.createElement('div');
    label.className = 'style-control__label';
    label.textContent = this._label;
    labelRow.appendChild(label);

    this._display = document.createElement('span');
    this._display.className = 'style-control__value';
    this._updateDisplay();
    labelRow.appendChild(this._display);

    this._el.appendChild(labelRow);

    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'style-control__slider';
    this._slider.min = String(this._min);
    this._slider.max = String(this._max);
    this._slider.step = String(this._step);
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

  _handleInput() {
    this._value = parseFloat(this._slider.value);
    this._updateDisplay();
    this._onChange(this._value / 100);
  }

  _updateDisplay() {
    if (this._display) {
      this._display.textContent = this._value + this._suffix;
    }
  }
}

export class DatasetsControl {
  /**
   * @param {object} opts
   * @param {(n: number) => void} opts.onDatasets - callback when dataset count changes
   * @param {number} [opts.min=1]
   * @param {number} [opts.max=10]
   * @param {number} [opts.initial=2]
   * @param {number} [opts.step=1]
   */
  constructor({ onDatasets, min = 1, max = 10, initial = 2, step = 1 }) {
    this._onDatasets = onDatasets;
    this._min = min;
    this._max = max;
    this._step = step;
    this._initial = initial;
    this._value = initial;
    this._el = null;
    this._slider = null;
    this._display = null;
    this._resetBtn = null;
    this._boundInput = this._handleInput.bind(this);
    this._boundReset = this._handleReset.bind(this);
  }

  get value() { return this._value; }

  get cssURL() {
    return new URL('datasets-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'datasets-control';

    // label row
    const labelRow = document.createElement('div');
    labelRow.className = 'datasets-control__row';

    const label = document.createElement('div');
    label.className = 'control-panel__label';
    label.textContent = 'Datasets';
    label.style.marginBottom = '0';
    labelRow.appendChild(label);

    this._display = document.createElement('span');
    this._display.className = 'datasets-control__value';
    this._updateDisplay();
    labelRow.appendChild(this._display);

    this._el.appendChild(labelRow);

    // slider
    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'datasets-control__slider';
    this._slider.min = String(this._min);
    this._slider.max = String(this._max);
    this._slider.step = String(this._step);
    this._slider.value = String(this._value);
    this._slider.addEventListener('input', this._boundInput);
    this._el.appendChild(this._slider);

    // reset button
    this._resetBtn = document.createElement('button');
    this._resetBtn.className = 'datasets-control__reset';
    this._resetBtn.textContent = 'reset';
    this._resetBtn.addEventListener('click', this._boundReset);
    this._el.appendChild(this._resetBtn);

    return this._el;
  }

  dispose() {
    if (this._slider) this._slider.removeEventListener('input', this._boundInput);
    if (this._resetBtn) this._resetBtn.removeEventListener('click', this._boundReset);
    this._el = null;
    this._slider = null;
    this._display = null;
    this._resetBtn = null;
  }

  _handleInput() {
    this._value = parseInt(this._slider.value, 10);
    this._updateDisplay();
    this._onDatasets(this._value);
  }

  _handleReset() {
    this._value = this._initial;
    this._slider.value = String(this._initial);
    this._updateDisplay();
    this._onDatasets(this._value);
  }

  _updateDisplay() {
    if (this._display) {
      this._display.textContent = String(this._value);
    }
  }
}

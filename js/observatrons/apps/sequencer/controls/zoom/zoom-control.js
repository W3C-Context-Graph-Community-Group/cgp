export class ZoomControl {
  /**
   * @param {object} opts
   * @param {() => void} opts.onZoom  - callback after zoom changes
   * @param {number} [opts.min=0.25]  - min zoom multiplier (zoom in)
   * @param {number} [opts.max=3.0]   - max zoom multiplier (zoom out)
   * @param {number} [opts.initial=1.0]
   * @param {number} [opts.step=0.05]
   */
  constructor({ onZoom, min = 0.25, max = 3.0, initial = 1.0, step = 0.05 }) {
    this._onZoom = onZoom;
    this._min = min;
    this._max = max;
    this._step = step;
    this._value = initial;
    this._el = null;
    this._slider = null;
    this._display = null;
    this._resetBtn = null;
    this._boundInput = this._handleInput.bind(this);
    this._boundReset = this._handleReset.bind(this);
    this._boundWheel = this._handleWheel.bind(this);
  }

  /** Current zoom multiplier */
  get value() { return this._value; }

  get cssURL() {
    return new URL('zoom-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'zoom-control';

    // label row
    const labelRow = document.createElement('div');
    labelRow.className = 'zoom-control__row';

    const label = document.createElement('div');
    label.className = 'control-panel__label';
    label.textContent = 'Zoom';
    label.style.marginBottom = '0';
    labelRow.appendChild(label);

    this._display = document.createElement('span');
    this._display.className = 'zoom-control__value';
    this._updateDisplay();
    labelRow.appendChild(this._display);

    this._el.appendChild(labelRow);

    // slider
    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'zoom-control__slider';
    this._slider.min = String(this._min);
    this._slider.max = String(this._max);
    this._slider.step = String(this._step);
    this._slider.value = String(this._value);
    this._slider.addEventListener('input', this._boundInput);
    this._el.appendChild(this._slider);

    // reset button
    this._resetBtn = document.createElement('button');
    this._resetBtn.className = 'zoom-control__reset';
    this._resetBtn.textContent = 'reset';
    this._resetBtn.addEventListener('click', this._boundReset);
    this._el.appendChild(this._resetBtn);

    addEventListener('wheel', this._boundWheel, { passive: false });

    return this._el;
  }

  dispose() {
    if (this._slider) this._slider.removeEventListener('input', this._boundInput);
    if (this._resetBtn) this._resetBtn.removeEventListener('click', this._boundReset);
    removeEventListener('wheel', this._boundWheel);
    this._el = null;
    this._slider = null;
    this._display = null;
    this._resetBtn = null;
  }

  _handleInput() {
    this._value = parseFloat(this._slider.value);
    this._updateDisplay();
    this._onZoom();
  }

  _handleReset() {
    this._value = 1.0;
    this._slider.value = '1';
    this._updateDisplay();
    this._onZoom();
  }

  _handleWheel(e) {
    const delta = Math.sign(e.deltaY) * this._step * 3;
    const clamped = Math.min(this._max, Math.max(this._min, this._value + delta));
    if (clamped !== this._value) {
      e.preventDefault();
      this._value = clamped;
      if (this._slider) this._slider.value = String(this._value);
      this._updateDisplay();
      this._onZoom();
    }
  }

  _updateDisplay() {
    if (this._display) {
      const displayZoom = 1 / this._value;
      this._display.textContent = displayZoom.toFixed(1) + 'x';
    }
  }
}

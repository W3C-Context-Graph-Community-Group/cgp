export class ZoomControl {
  /**
   * @param {object} opts
   * @param {() => void} opts.onZoom  - callback after zoom changes
   * @param {number} [opts.min=0.125] - min zoom multiplier (zoom in)
   * @param {number} [opts.max=3.0]   - max zoom multiplier (zoom out)
   * @param {number} [opts.initial=1.0]
   * @param {number} [opts.step=0.05]
   */
  constructor({ onZoom, min = 0.125, max = 3.0, initial = 1.0, step = 0.05 }) {
    this._onZoom = onZoom;
    this._min = min;
    this._max = max;
    this._step = step;
    this._value = initial;
    this._initial = initial;
    this._el = null;
    this._slider = null;
    this._display = null;
    this._boundInput = this._handleInput.bind(this);
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
    label.className = 'zoom-control__axis-label';
    label.style.cssText = 'font-family:var(--cp-font);font-size:10px;color:var(--cp-text-muted)';
    label.textContent = 'Zoom';
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

    addEventListener('wheel', this._boundWheel, { passive: false });

    return this._el;
  }

  dispose() {
    if (this._slider) this._slider.removeEventListener('input', this._boundInput);
    removeEventListener('wheel', this._boundWheel);
    this._el = null;
    this._slider = null;
    this._display = null;
  }

  reset() {
    this._value = this._initial;
    if (this._slider) this._slider.value = String(this._initial);
    this._updateDisplay();
    this._onZoom();
  }

  _handleInput() {
    this._value = parseFloat(this._slider.value);
    this._updateDisplay();
    this._onZoom();
  }

  _handleWheel(e) {
    // Scroll down (positive deltaY) → zoom out (increase value)
    // Scroll up (negative deltaY) → zoom in (decrease value)
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

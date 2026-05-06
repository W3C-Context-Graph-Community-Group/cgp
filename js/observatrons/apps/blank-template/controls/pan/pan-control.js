export class PanControl {
  /**
   * @param {object} opts
   * @param {() => void} opts.onPan    - callback after either axis changes
   * @param {number} [opts.min=-1.5]
   * @param {number} [opts.max=1.5]
   * @param {number} [opts.initial=0]
   * @param {number} [opts.step=0.01]
   */
  constructor({ onPan, min = -1.5, max = 1.5, initial = 0, step = 0.01 }) {
    this._onPan = onPan;
    this._min = min;
    this._max = max;
    this._step = step;
    this._valueX = initial;
    this._valueY = initial;
    this._el = null;
    this._sliderX = null;
    this._sliderY = null;
    this._displayX = null;
    this._displayY = null;
    this._boundInputX = () => this._handleInput('x');
    this._boundInputY = () => this._handleInput('y');
  }

  get valueX() { return this._valueX; }
  get valueY() { return this._valueY; }

  get cssURL() {
    return new URL('pan-control.css', import.meta.url).href;
  }

  /** Sync sliders from external source (e.g. spacebar+drag). */
  update(x, y) {
    this._valueX = Math.max(this._min, Math.min(this._max, x));
    this._valueY = Math.max(this._min, Math.min(this._max, y));
    if (this._sliderX) this._sliderX.value = String(this._valueX);
    if (this._sliderY) this._sliderY.value = String(this._valueY);
    this._updateDisplay();
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'pan-control';

    // ── X-Axis Pan ──
    const rowX = document.createElement('div');
    rowX.className = 'pan-control__row';

    const lblX = document.createElement('div');
    lblX.className = 'pan-control__axis-label';
    lblX.style.cssText = 'font-family:var(--cp-font);font-size:10px;color:var(--cp-text-muted)';
    lblX.textContent = 'X-Axis Pan';
    rowX.appendChild(lblX);

    this._displayX = document.createElement('span');
    this._displayX.className = 'pan-control__value';
    rowX.appendChild(this._displayX);
    this._el.appendChild(rowX);

    this._sliderX = this._makeSlider(this._valueX, this._boundInputX);
    this._el.appendChild(this._sliderX);

    // ── Y-Axis Pan ──
    const rowY = document.createElement('div');
    rowY.className = 'pan-control__row';

    const lblY = document.createElement('div');
    lblY.className = 'pan-control__axis-label';
    lblY.style.cssText = 'font-family:var(--cp-font);font-size:10px;color:var(--cp-text-muted)';
    lblY.textContent = 'Y-Axis Pan';
    rowY.appendChild(lblY);

    this._displayY = document.createElement('span');
    this._displayY.className = 'pan-control__value';
    rowY.appendChild(this._displayY);
    this._el.appendChild(rowY);

    this._sliderY = this._makeSlider(this._valueY, this._boundInputY);
    this._el.appendChild(this._sliderY);

    this._updateDisplay();
    return this._el;
  }

  dispose() {
    if (this._sliderX) this._sliderX.removeEventListener('input', this._boundInputX);
    if (this._sliderY) this._sliderY.removeEventListener('input', this._boundInputY);
    this._el = null;
    this._sliderX = null;
    this._sliderY = null;
    this._displayX = null;
    this._displayY = null;
  }

  reset() {
    this._valueX = 0;
    this._valueY = 0;
    if (this._sliderX) this._sliderX.value = '0';
    if (this._sliderY) this._sliderY.value = '0';
    this._updateDisplay();
    this._onPan();
  }

  /* ── internal ── */

  _makeSlider(initial, onInput) {
    const s = document.createElement('input');
    s.type = 'range';
    s.className = 'pan-control__slider';
    s.min = String(this._min);
    s.max = String(this._max);
    s.step = String(this._step);
    s.value = String(initial);
    s.addEventListener('input', onInput);
    return s;
  }

  _handleInput(axis) {
    if (axis === 'x') this._valueX = parseFloat(this._sliderX.value);
    else              this._valueY = parseFloat(this._sliderY.value);
    this._updateDisplay();
    this._onPan();
  }

  _updateDisplay() {
    if (this._displayX) this._displayX.textContent = this._valueX.toFixed(2);
    if (this._displayY) this._displayY.textContent = this._valueY.toFixed(2);
  }
}

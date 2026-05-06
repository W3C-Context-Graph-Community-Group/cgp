/**
 * RangeControl — dual-thumb min/max slider.
 *
 * Renders two native <input type="range"> elements stacked on top of each other.
 * The lower thumb sets the minimum, the upper thumb sets the maximum.
 * The display shows "min – max".
 */
export class RangeControl {
  /**
   * @param {object} opts
   * @param {string}            opts.label      — control label text
   * @param {(range: {min:number, max:number}) => void} opts.onChange
   * @param {number}            [opts.min=1]    — slider floor
   * @param {number}            [opts.max=30]   — slider ceiling
   * @param {number}            [opts.initialMin] — starting low value
   * @param {number}            [opts.initialMax] — starting high value
   * @param {number}            [opts.step=1]
   */
  constructor({ label, onChange, min = 1, max = 30, initialMin, initialMax, step = 1 }) {
    this._label = label;
    this._onChange = onChange;
    this._floor = min;
    this._ceiling = max;
    this._step = step;
    this._lo = initialMin ?? min;
    this._hi = initialMax ?? max;
    this._initialLo = this._lo;
    this._initialHi = this._hi;
    this._el = null;
    this._loSlider = null;
    this._hiSlider = null;
    this._display = null;
    this._resetBtn = null;
    this._boundLoInput = this._handleLoInput.bind(this);
    this._boundHiInput = this._handleHiInput.bind(this);
    this._boundReset = this._handleReset.bind(this);
    this._boundPointerDown = this._handlePointerDown.bind(this);
  }

  get range() { return { min: this._lo, max: this._hi }; }

  get cssURL() {
    return new URL('range-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'range-control';

    // label row
    const labelRow = document.createElement('div');
    labelRow.className = 'range-control__row';

    const lbl = document.createElement('div');
    lbl.className = 'range-control__label';
    lbl.textContent = this._label;
    lbl.style.marginBottom = '0';
    labelRow.appendChild(lbl);

    this._display = document.createElement('span');
    this._display.className = 'range-control__value';
    this._updateDisplay();
    labelRow.appendChild(this._display);

    this._el.appendChild(labelRow);

    // slider container (two sliders overlaid)
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'range-control__slider-wrap';

    this._loSlider = this._makeSlider('range-control__slider range-control__slider--lo');
    this._loSlider.value = String(this._lo);
    this._loSlider.addEventListener('input', this._boundLoInput);
    sliderWrap.appendChild(this._loSlider);

    this._hiSlider = this._makeSlider('range-control__slider range-control__slider--hi');
    this._hiSlider.value = String(this._hi);
    this._hiSlider.addEventListener('input', this._boundHiInput);
    sliderWrap.appendChild(this._hiSlider);

    sliderWrap.addEventListener('pointerdown', this._boundPointerDown);
    this._sliderWrap = sliderWrap;

    this._el.appendChild(sliderWrap);

    // reset button
    this._resetBtn = document.createElement('button');
    this._resetBtn.className = 'range-control__reset';
    this._resetBtn.textContent = 'reset';
    this._resetBtn.addEventListener('click', this._boundReset);
    this._el.appendChild(this._resetBtn);

    this._updateTrack();
    this._updateThumbVisibility();
    return this._el;
  }

  dispose() {
    if (this._loSlider) this._loSlider.removeEventListener('input', this._boundLoInput);
    if (this._hiSlider) this._hiSlider.removeEventListener('input', this._boundHiInput);
    if (this._sliderWrap) this._sliderWrap.removeEventListener('pointerdown', this._boundPointerDown);
    if (this._resetBtn) this._resetBtn.removeEventListener('click', this._boundReset);
    this._el = null;
    this._loSlider = null;
    this._hiSlider = null;
    this._sliderWrap = null;
    this._display = null;
    this._resetBtn = null;
  }

  // ── internal ──

  _makeSlider(className) {
    const s = document.createElement('input');
    s.type = 'range';
    s.className = className;
    s.min = String(this._floor);
    s.max = String(this._ceiling);
    s.step = String(this._step);
    return s;
  }

  _handleLoInput() {
    let v = parseInt(this._loSlider.value, 10);
    if (v > this._hi) v = this._hi;
    this._lo = v;
    this._loSlider.value = String(v);
    this._updateDisplay();
    this._updateTrack();
    this._updateThumbVisibility();
    this._onChange({ min: this._lo, max: this._hi });
  }

  _handleHiInput() {
    let v = parseInt(this._hiSlider.value, 10);
    if (v < this._lo) v = this._lo;
    this._hi = v;
    this._hiSlider.value = String(v);
    this._updateDisplay();
    this._updateTrack();
    this._updateThumbVisibility();
    this._onChange({ min: this._lo, max: this._hi });
  }

  _handleReset() {
    this._lo = this._initialLo;
    this._hi = this._initialHi;
    this._loSlider.value = String(this._lo);
    this._hiSlider.value = String(this._hi);
    this._updateDisplay();
    this._updateTrack();
    this._updateThumbVisibility();
    this._onChange({ min: this._lo, max: this._hi });
  }

  _updateDisplay() {
    if (this._display) {
      this._display.textContent = this._lo === this._hi
        ? String(this._lo)
        : `${this._lo} – ${this._hi}`;
    }
  }

  /** Bring the nearest thumb to the top so it can always be grabbed. */
  _handlePointerDown(e) {
    // When both thumbs overlap, always prefer hi so it can be dragged apart
    if (this._lo === this._hi) {
      this._loSlider.style.zIndex = '1';
      this._hiSlider.style.zIndex = '2';
      return;
    }
    const rect = this._sliderWrap.getBoundingClientRect();
    const clickFrac = (e.clientX - rect.left) / rect.width;
    const span = this._ceiling - this._floor;
    const loFrac = (this._lo - this._floor) / span;
    const hiFrac = (this._hi - this._floor) / span;
    const distLo = Math.abs(clickFrac - loFrac);
    const distHi = Math.abs(clickFrac - hiFrac);
    if (distLo < distHi) {
      this._loSlider.style.zIndex = '2';
      this._hiSlider.style.zIndex = '1';
    } else {
      this._loSlider.style.zIndex = '1';
      this._hiSlider.style.zIndex = '2';
    }
  }

  /** Hide lo thumb when it overlaps hi so hi is always reachable. */
  _updateThumbVisibility() {
    if (!this._loSlider) return;
    this._loSlider.classList.toggle('range-control__slider--collapsed', this._lo === this._hi);
  }

  /** Colour the track between the two thumbs. */
  _updateTrack() {
    if (!this._el) return;
    const span = this._ceiling - this._floor;
    const loFrac = ((this._lo - this._floor) / span) * 100;
    const hiFrac = ((this._hi - this._floor) / span) * 100;
    this._el.style.setProperty('--lo-pct', loFrac + '%');
    this._el.style.setProperty('--hi-pct', hiFrac + '%');
  }
}

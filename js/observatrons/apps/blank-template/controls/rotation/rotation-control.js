const DEG = Math.PI / 180;

export class RotationControl {
  /**
   * @param {object} opts
   * @param {(axis: 'x'|'y'|'z', radians: number) => void} opts.onRotate
   * @param {boolean} [opts.showTitle=true] — set false when wrapped in a CollapsibleCard
   */
  constructor({ onRotate, showTitle = true }) {
    this._onRotate = onRotate;
    this._showTitle = showTitle;
    this._el = null;
    this._sliderX = null;
    this._sliderY = null;
    this._sliderZ = null;
    this._displayX = null;
    this._displayY = null;
    this._displayZ = null;
  }

  get cssURL() {
    return new URL('rotation-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'rotation-control';

    if (this._showTitle) {
      const title = document.createElement('div');
      title.className = 'control-panel__label';
      title.textContent = 'Rotation';
      title.style.marginBottom = '0';
      this._el.appendChild(title);
    }

    const { slider: sy, display: dy } = this._buildAxis('Yaw (Y)', (v) => {
      this._onRotate('y', v * DEG);
    });
    this._sliderY = sy;
    this._displayY = dy;

    const { slider: sx, display: dx } = this._buildAxis('Pitch (X)', (v) => {
      this._onRotate('x', v * DEG);
    });
    this._sliderX = sx;
    this._displayX = dx;

    const { slider: sz, display: dz } = this._buildAxis('Roll (Z)', (v) => {
      this._onRotate('z', v * DEG);
    });
    this._sliderZ = sz;
    this._displayZ = dz;

    return this._el;
  }

  reset() {
    if (!this._sliderX) return;
    this._sliderX.value = '0';
    this._sliderY.value = '0';
    this._sliderZ.value = '0';
    this._updateDisplay();
    this._onRotate('x', 0);
    this._onRotate('y', 0);
    this._onRotate('z', 0);
  }

  /** Called externally to sync sliders with current rotation (e.g. during drag). */
  update(xRad, yRad, zRad) {
    if (!this._sliderX) return;
    this._sliderX.value = String(this._normDeg(xRad / DEG));
    this._sliderY.value = String(this._normDeg(yRad / DEG));
    this._sliderZ.value = String(this._normDeg(zRad / DEG));
    this._updateDisplay();
  }

  dispose() {
    this._el = null;
    this._sliderX = null;
    this._sliderY = null;
    this._sliderZ = null;
    this._displayX = null;
    this._displayY = null;
    this._displayZ = null;
  }

  _buildAxis(label, onChange) {
    const axis = document.createElement('div');
    axis.className = 'rotation-control__axis';

    const row = document.createElement('div');
    row.className = 'rotation-control__row';

    const lbl = document.createElement('div');
    lbl.className = 'rotation-control__axis-label';
    lbl.style.cssText = 'font-family:var(--cp-font);font-size:10px;color:var(--cp-text-muted)';
    lbl.textContent = label;
    row.appendChild(lbl);

    const display = document.createElement('span');
    display.className = 'rotation-control__value';
    display.textContent = '0°';
    row.appendChild(display);

    axis.appendChild(row);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'rotation-control__slider';
    slider.min = '-180';
    slider.max = '180';
    slider.step = '1';
    slider.value = '0';
    slider.addEventListener('input', () => {
      this._updateDisplay();
      onChange(parseFloat(slider.value));
    });
    axis.appendChild(slider);

    this._el.appendChild(axis);
    return { slider, display };
  }

  _updateDisplay() {
    if (this._displayX) this._displayX.textContent = this._sliderX.value + '°';
    if (this._displayY) this._displayY.textContent = this._sliderY.value + '°';
    if (this._displayZ) this._displayZ.textContent = this._sliderZ.value + '°';
  }

  /** Normalize degrees to [-180, 180]. */
  _normDeg(d) {
    d = ((d % 360) + 540) % 360 - 180;
    return Math.round(d);
  }
}

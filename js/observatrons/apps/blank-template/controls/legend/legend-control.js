export class LegendControl {
  constructor() {
    this._el = null;
  }

  get cssURL() {
    return new URL('legend-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'legend-control';
    this._el.innerHTML =
      '<small class="legend-control__delta">\u03B4</small>' +
      '<span class="legend-control__label">0 verified</span>' +
      '<span class="legend-control__bar"></span>' +
      '<span class="legend-control__label">1 dark</span>';
    return this._el;
  }

  dispose() {
    this._el = null;
  }
}

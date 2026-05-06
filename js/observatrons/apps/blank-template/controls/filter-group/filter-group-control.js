/**
 * FilterGroupControl — wraps multiple RangeControls in a single collapsible card.
 *
 * Expanded:  horizontal row of range controls with a minimize (−) button.
 * Collapsed: a single "Filters" button that re-expands the row.
 */
export class FilterGroupControl {
  /**
   * @param {object} opts
   * @param {import('../range/range-control.js').RangeControl[]} opts.controls
   */
  constructor({ controls }) {
    this._controls = controls;
    this._expanded = true;
    this._el = null;
    this._row = null;
    this._toggleBtn = null;
  }

  get cssURL() {
    return new URL('filter-group-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'filter-group';

    // header with label + toggle
    const header = document.createElement('div');
    header.className = 'filter-group__header';

    const label = document.createElement('span');
    label.className = 'control-panel__label';
    label.style.marginBottom = '0';
    label.textContent = 'Filters';
    header.appendChild(label);

    this._toggleBtn = document.createElement('button');
    this._toggleBtn.className = 'filter-group__toggle';
    this._toggleBtn.textContent = '\u2212'; // minus sign
    this._toggleBtn.title = 'Minimize filters';
    this._toggleBtn.addEventListener('click', () => this._toggle());
    header.appendChild(this._toggleBtn);

    this._el.appendChild(header);

    // row of controls
    this._row = document.createElement('div');
    this._row.className = 'filter-group__row';

    for (const ctrl of this._controls) {
      const cell = document.createElement('div');
      cell.className = 'filter-group__cell';
      cell.appendChild(ctrl.mount());
      this._row.appendChild(cell);
    }

    this._el.appendChild(this._row);
    return this._el;
  }

  dispose() {
    for (const ctrl of this._controls) ctrl.dispose();
    this._el = null;
    this._row = null;
    this._toggleBtn = null;
  }

  _toggle() {
    this._expanded = !this._expanded;
    this._el.classList.toggle('filter-group--collapsed', !this._expanded);
    this._toggleBtn.textContent = this._expanded ? '\u2212' : '\u002B'; // − or +
    this._toggleBtn.title = this._expanded ? 'Minimize filters' : 'Expand filters';
  }
}

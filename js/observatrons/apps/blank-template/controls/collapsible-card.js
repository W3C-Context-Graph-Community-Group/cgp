/**
 * CollapsibleCard — reusable card wrapper with named sections and
 * collapse / expand.  Implements the control-panel control interface
 * (cssURL, mount, dispose) so it can be registered directly.
 *
 * Usage:
 *   const card = new CollapsibleCard({ label: 'Filters', id: 'filters', layout: 'row' });
 *   card.addControl('channels', channelRangeCtrl);   // loads CSS + mounts
 *   card.addSection('custom',   someElement);         // raw DOM
 *   panel.register(card);
 */
export class CollapsibleCard {
  /**
   * @param {object}  opts
   * @param {string}  opts.label           — header text (also shown when collapsed)
   * @param {string}  [opts.id]            — optional id attribute on the outer element
   * @param {boolean} [opts.expanded=true] — initial state
   * @param {'stack'|'row'} [opts.layout='stack'] — flex direction of the body
   */
  constructor({ label, id, expanded = true, layout = 'stack', onClose }) {
    this._label = label;
    this._id = id;
    this._expanded = expanded;
    this._layout = layout;
    this._onClose = onClose || null;
    this._sections = new Map();     // id → { el, control? }
    this._childCSS = [];            // URLs from child controls
    this._el = null;
    this._body = null;
    this._toggleBtn = null;
  }

  get cssURL() {
    return new URL('collapsible-card.css', import.meta.url).href;
  }

  /* ── Section API ── */

  /** Add a raw DOM element as a named section. */
  addSection(id, element) {
    this._sections.set(id, { el: element, control: null });
    if (this._body) this._appendSection(id, element);
    return this;
  }

  /** Add a control (loads its CSS, mounts, stores). */
  addControl(id, control) {
    this._childCSS.push(control.cssURL);
    const el = control.mount();
    this._sections.set(id, { el, control });
    if (this._body) this._appendSection(id, el);
    return this;
  }

  /** Retrieve section wrapper by id. */
  getSection(id) {
    const entry = this._sections.get(id);
    return entry ? entry.el.parentElement || entry.el : null;
  }

  /* ── Control interface ── */

  mount() {
    // load child-control CSS
    for (const href of this._childCSS) this._loadCSS(href);

    this._el = document.createElement('div');
    this._el.className = 'collapsible-card';
    if (this._id) this._el.id = this._id;
    if (this._layout === 'row') this._el.classList.add('collapsible-card--row');
    if (!this._expanded) this._el.classList.add('collapsible-card--collapsed');

    // header
    const header = document.createElement('div');
    header.className = 'collapsible-card__header';

    const label = document.createElement('span');
    label.className = 'collapsible-card__label';
    label.textContent = this._label;
    header.appendChild(label);

    this._toggleBtn = document.createElement('button');
    this._toggleBtn.className = 'collapsible-card__toggle';
    this._syncToggle();
    this._toggleBtn.addEventListener('click', () => this._toggle());
    header.appendChild(this._toggleBtn);

    this._el.appendChild(header);

    // body
    this._body = document.createElement('div');
    this._body.className = 'collapsible-card__body';
    for (const [id, { el }] of this._sections) this._appendSection(id, el);
    this._el.appendChild(this._body);

    return this._el;
  }

  dispose() {
    for (const { control } of this._sections.values()) {
      if (control) control.dispose();
    }
    this._sections.clear();
    this._el = null;
    this._body = null;
    this._toggleBtn = null;
  }

  /* ── internal ── */

  _appendSection(id, el) {
    const wrap = document.createElement('div');
    wrap.className = 'collapsible-card__section';
    wrap.dataset.section = id;
    wrap.appendChild(el);
    this._body.appendChild(wrap);
  }

  _toggle() {
    if (this._onClose) {
      this._onClose();
      return;
    }
    this._expanded = !this._expanded;
    this._el.classList.toggle('collapsible-card--collapsed', !this._expanded);
    this._syncToggle();
  }

  _syncToggle() {
    if (!this._toggleBtn) return;
    this._toggleBtn.textContent = this._expanded ? '\u2212' : '\u002B'; // − or +
    this._toggleBtn.title = this._expanded
      ? `Minimize ${this._label}`
      : `Expand ${this._label}`;
  }

  _loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

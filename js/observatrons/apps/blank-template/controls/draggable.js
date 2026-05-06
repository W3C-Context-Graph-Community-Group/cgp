/**
 * Draggable — pass any DOM element to make it freely draggable on screen.
 * Uses the collapsible-card header as the drag handle by default.
 *
 * Usage:
 *   import { Draggable } from './controls/draggable.js';
 *
 *   const section = panel.register(card);
 *   new Draggable(section);                          // auto-finds header handle
 *   new Draggable(section, { handle: myHandle });    // explicit handle
 */
export class Draggable {
  /**
   * @param {HTMLElement}  el             — element to make draggable
   * @param {object}       [opts]
   * @param {HTMLElement}  [opts.handle]  — drag handle (defaults to
   *        .collapsible-card__header inside el, then el itself)
   */
  constructor(el, { handle } = {}) {
    this._el = el;
    this._handle = handle
      || el.querySelector('.collapsible-card__header')
      || el;

    this._dragging = false;
    this._offsetX  = 0;
    this._offsetY  = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp   = this._onPointerUp.bind(this);

    this._loadCSS();
    this._handle.classList.add('draggable-handle');
    this._handle.addEventListener('pointerdown', this._onPointerDown);
  }

  /* ── pointer events ── */

  _onPointerDown(e) {
    // don't hijack clicks on interactive children
    if (e.target.closest('button, input, select, textarea')) return;

    e.preventDefault();
    this._dragging = true;

    // snapshot position and break out of flex flow
    const rect = this._el.getBoundingClientRect();
    this._el.style.position = 'fixed';
    this._el.style.left     = rect.left + 'px';
    this._el.style.top      = rect.top  + 'px';
    this._el.style.margin   = '0';

    this._offsetX = e.clientX - rect.left;
    this._offsetY = e.clientY - rect.top;

    this._el.classList.add('draggable--active');
    this._handle.setPointerCapture(e.pointerId);

    this._handle.addEventListener('pointermove', this._onPointerMove);
    this._handle.addEventListener('pointerup',   this._onPointerUp);
  }

  _onPointerMove(e) {
    if (!this._dragging) return;
    this._el.style.left = (e.clientX - this._offsetX) + 'px';
    this._el.style.top  = (e.clientY - this._offsetY) + 'px';
  }

  _onPointerUp() {
    if (!this._dragging) return;
    this._dragging = false;
    this._el.classList.remove('draggable--active');

    this._handle.removeEventListener('pointermove', this._onPointerMove);
    this._handle.removeEventListener('pointerup',   this._onPointerUp);
  }

  /* ── cleanup ── */

  dispose() {
    this._handle.removeEventListener('pointerdown', this._onPointerDown);
    this._handle.removeEventListener('pointermove', this._onPointerMove);
    this._handle.removeEventListener('pointerup',   this._onPointerUp);
    this._handle.classList.remove('draggable-handle');
  }

  /* ── CSS loader (same pattern as other controls) ── */

  _loadCSS() {
    const href = new URL('draggable.css', import.meta.url).href;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link  = document.createElement('link');
    link.rel    = 'stylesheet';
    link.href   = href;
    document.head.appendChild(link);
  }
}

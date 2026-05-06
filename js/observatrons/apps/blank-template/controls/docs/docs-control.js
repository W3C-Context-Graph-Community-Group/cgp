/**
 * DocsControl — button that opens a full-screen docs modal.
 */
export class DocsControl {
  /**
   * @param {object} [opts]
   * @param {string} [opts.content] — HTML string for the modal body
   */
  constructor({ content = '' } = {}) {
    this._content = content;
    this._btn = null;
    this._modal = null;
  }

  get cssURL() {
    return new URL('docs-control.css', import.meta.url).href;
  }

  /** Replace modal body content at any time. */
  set content(html) {
    this._content = html;
    if (this._modalBody) this._modalBody.innerHTML = html;
  }

  mount() {
    this._btn = document.createElement('button');
    this._btn.className = 'docs-control__btn';
    this._btn.textContent = 'DOCS';
    this._btn.addEventListener('click', () => this._open());
    return this._btn;
  }

  dispose() {
    this._close();
    this._btn = null;
  }

  _open() {
    if (this._modal) return;

    this._modal = document.createElement('div');
    this._modal.className = 'docs-modal';

    // header
    const header = document.createElement('div');
    header.className = 'docs-modal__header';

    const title = document.createElement('span');
    title.className = 'docs-modal__title';
    title.textContent = 'Documentation';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'docs-modal__close';
    closeBtn.textContent = '\u00D7'; // ×
    closeBtn.addEventListener('click', () => this._close());
    header.appendChild(closeBtn);

    this._modal.appendChild(header);

    // body
    this._modalBody = document.createElement('div');
    this._modalBody.className = 'docs-modal__body';
    this._modalBody.innerHTML = this._content || '<p style="color:var(--cp-text-muted)">No documentation loaded yet.</p>';
    this._modal.appendChild(this._modalBody);

    // close on Escape
    this._boundKey = (e) => { if (e.key === 'Escape') this._close(); };
    document.addEventListener('keydown', this._boundKey);

    document.body.appendChild(this._modal);
  }

  _close() {
    if (!this._modal) return;
    if (this._boundKey) {
      document.removeEventListener('keydown', this._boundKey);
      this._boundKey = null;
    }
    this._modal.remove();
    this._modal = null;
    this._modalBody = null;
  }
}

export class ControlPanel {
  /** @param {HTMLElement} [parent=document.body] */
  constructor(parent = document.body) {
    this._controls = [];
    this._el = document.createElement('div');
    this._el.className = 'control-panel';
    parent.appendChild(this._el);
    this._loadCSS(new URL('control-panel.css', import.meta.url).href);
  }

  /**
   * Register a control instance.
   * Control must expose:
   *   cssURL   : string
   *   mount()  : HTMLElement
   *   dispose(): void
   */
  register(control) {
    this._loadCSS(control.cssURL);
    const section = document.createElement('div');
    section.className = 'control-panel__section';
    section.appendChild(control.mount());
    this._el.appendChild(section);
    this._controls.push({ control, section });
  }

  destroy() {
    for (const { control, section } of this._controls) {
      control.dispose();
      section.remove();
    }
    this._controls = [];
    this._el.remove();
  }

  /** Idempotent CSS loader */
  _loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

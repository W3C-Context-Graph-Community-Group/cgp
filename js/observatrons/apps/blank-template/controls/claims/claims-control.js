export class ClaimsControl {
  constructor() {
    this._el = null;
    this._list = null;
    this._emptyMsg = null;
  }

  get cssURL() {
    return new URL('claims-control.css', import.meta.url).href;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'claims-control';

    this._list = document.createElement('div');
    this._list.style.cssText = 'display:flex; flex-direction:column; gap:4px';
    this._el.appendChild(this._list);

    this._emptyMsg = document.createElement('span');
    this._emptyMsg.className = 'claims-control__empty';
    this._emptyMsg.textContent = 'No claims';
    this._list.appendChild(this._emptyMsg);

    return this._el;
  }

  dispose() {
    this._el = null;
    this._list = null;
    this._emptyMsg = null;
  }
}

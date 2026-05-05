export class EventBus {
  constructor(url = 'ws://localhost:8080') {
    this._url = url;
    this._handlers = new Map();     // url → Set<callback>
    this._ws = null;
    this._reconnectMs = 1000;
    this.clientId = null;
    this._connect();
  }

  _connect() {
    this._ws = new WebSocket(this._url);

    this._ws.onopen = () => {
      this._reconnectMs = 1000;
      // re-subscribe after reconnect
      for (const url of this._handlers.keys()) {
        this._ws.send(JSON.stringify({ action: 'subscribe', url }));
      }
    };

    this._ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.action === 'welcome' && msg.clientId) { this.clientId = msg.clientId; return; }
      if (this.clientId && msg.from === this.clientId) return;
      const cbs = this._handlers.get(msg.event);
      if (cbs) for (const cb of cbs) cb(msg);
    };

    this._ws.onclose = () => {
      setTimeout(() => this._connect(), this._reconnectMs);
      this._reconnectMs = Math.min(this._reconnectMs * 2, 30000);
    };
  }

  on(url, cb) {
    if (!this._handlers.has(url)) {
      this._handlers.set(url, new Set());
      if (this._ws?.readyState === 1) {
        this._ws.send(JSON.stringify({ action: 'subscribe', url }));
      }
    }
    this._handlers.get(url).add(cb);
  }

  off(url, cb) {
    const cbs = this._handlers.get(url);
    if (!cbs) return;
    if (cb) {
      cbs.delete(cb);
      if (cbs.size === 0) {
        this._handlers.delete(url);
        if (this._ws?.readyState === 1) {
          this._ws.send(JSON.stringify({ action: 'unsubscribe', url }));
        }
      }
    } else {
      this._handlers.delete(url);
      if (this._ws?.readyState === 1) {
        this._ws.send(JSON.stringify({ action: 'unsubscribe', url }));
      }
    }
  }

  emit(url, payload) {
    if (this._ws?.readyState === 1) {
      const msg = { action: 'emit', url };
      if (payload !== undefined) msg.payload = payload;
      this._ws.send(JSON.stringify(msg));
    }
  }
}

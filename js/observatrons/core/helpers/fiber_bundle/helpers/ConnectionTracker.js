// FiberEndpoint = { nodeId: number, spikeIndex: number }
// Connection    = { id: string, source: FiberEndpoint, target: FiberEndpoint, wireTypes: string[] }

export class ConnectionTracker {
  constructor(observatronAddress) {
    this._address = observatronAddress;
    this._connections = [];
  }

  get address() { return this._address; }

  get state() {
    return {
      observatronAddress: this._address,
      connections: this._connections,
    };
  }

  /**
   * @param {{ nodeId: number, spikeIndex: number }} source
   * @param {{ nodeId: number, spikeIndex: number }} target
   * @param {string[]} wireTypes
   * @returns {string} connection id
   */
  connect(source, target, wireTypes) {
    const id = `${source.nodeId}:${source.spikeIndex}->${target.nodeId}:${target.spikeIndex}`;
    this.disconnect(id);
    this._connections.push({
      id,
      source: { ...source },
      target: { ...target },
      wireTypes: [...wireTypes],
    });
    return id;
  }

  /** Remove a connection by its id string. */
  disconnect(id) {
    this._connections = this._connections.filter(c => c.id !== id);
  }

  /** Find a connection by its id string. */
  getConnection(id) {
    return this._connections.find(c => c.id === id) ?? null;
  }

  clear() {
    this._connections = [];
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.state));
  }
}

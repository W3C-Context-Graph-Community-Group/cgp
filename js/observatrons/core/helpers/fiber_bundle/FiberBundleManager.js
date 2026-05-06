import { RingRenderer } from './helpers/RingRenderer.js';
import { WireRenderer, WIRE_TYPES } from './helpers/WireRenderer.js';
import { ConnectionTracker } from './helpers/ConnectionTracker.js';

// ============================================================
// FiberBundleManager — facade for all fiber-bundle visuals
//
// The app shell talks only to this class; helper classes inside
// ./helpers/ do the actual rendering work.
// ============================================================

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const blue = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | blue;
}

export class FiberBundleManager {
  /**
   * @param {object}   opts
   * @param {THREE.Group} opts.pivot — the observatron pivot group
   * @param {function(number, number): object|null} opts.resolveEndpoint — (nodeId, spikeIndex) => { direction, apex, base } | null
   * @param {string}   [opts.observatronAddress=''] — CGP address for tracking
   */
  constructor({ pivot, resolveEndpoint, observatronAddress = '' }) {
    this._pivot           = pivot;
    this._resolveEndpoint = resolveEndpoint;
    this._connections     = new Map(); // id → { source, target, rings: RingRenderer[], wires: WireRenderer[] }
    this._tracker         = new ConnectionTracker(observatronAddress);
  }

  get tracker() { return this._tracker; }

  // ── Individual connection management ─────────────

  /**
   * Add a single connection between two endpoints.
   * @param {{ nodeId: number, spikeIndex: number }} source
   * @param {{ nodeId: number, spikeIndex: number }} target
   * @param {string[]} [wireTypes] — defaults to all 5 WIRE_TYPES
   * @returns {string|null} connection id, or null if endpoints can't be resolved
   */
  addConnection(source, target, wireTypes) {
    const wt = wireTypes ?? WIRE_TYPES.map(w => w.type);

    const infoA = this._resolveEndpoint(source.nodeId, source.spikeIndex);
    const infoB = this._resolveEndpoint(target.nodeId, target.spikeIndex);
    if (!infoA || !infoB) return null;

    // Source ring: white/emissive (t=0)
    const ringA = new RingRenderer({
      position: infoA.apex,
      normal: infoA.direction,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
      shininess: 60,
    });
    this._pivot.add(ringA.build());

    // Target ring: dark/matte (t=1)
    const ringB = new RingRenderer({
      position: infoB.apex,
      normal: infoB.direction,
      color: 0x222222,
      emissive: 0x000000,
      emissiveIntensity: 0,
      shininess: 5,
    });
    this._pivot.add(ringB.build());

    // Bridge wires
    const wires = this._createBridgeWires(infoA, ringA, infoB, ringB, 1.0, 0.7);

    const id = this._tracker.connect(source, target, wt);

    this._connections.set(id, {
      source: { ...source },
      target: { ...target },
      rings: [ringA, ringB],
      wires,
    });

    return id;
  }

  /**
   * Remove a single connection by id.
   */
  removeConnection(id) {
    const entry = this._connections.get(id);
    if (!entry) return;

    for (const ring of entry.rings) {
      this._pivot.remove(ring.mesh);
      ring.dispose();
    }
    for (const wr of entry.wires) {
      this._pivot.remove(wr.mesh);
      wr.dispose();
    }

    this._connections.delete(id);
    this._tracker.disconnect(id);
  }

  /**
   * Remove all connections.
   */
  clearAll() {
    const ids = [...this._connections.keys()];
    for (const id of ids) {
      this.removeConnection(id);
    }
  }

  /** Array of { id, source, target } for UI listing. */
  get connections() {
    const result = [];
    for (const [id, entry] of this._connections) {
      result.push({ id, source: entry.source, target: entry.target });
    }
    return result;
  }

  // ── Backward-compat convenience ──────────────────

  /**
   * Show a chain of paired connections within a single node.
   * Clears all existing connections first, then creates a chain:
   *   (nodeId, startSpike) → (nodeId, startSpike+1) → ... → (nodeId, startSpike+pairCount)
   * with interpolated color gradient across the chain.
   */
  showPairs(nodeId, startSpike, pairCount = 1) {
    this.clearAll();

    const wireTypes = WIRE_TYPES.map(w => w.type);

    // Phase 1: resolve all spike infos and create rings with gradient coloring
    const infos = [];
    for (let i = startSpike; i <= startSpike + pairCount; i++) {
      const info = this._resolveEndpoint(nodeId, i);
      if (!info) break;

      const j = i - startSpike;
      const t = pairCount > 0 ? j / pairCount : 0;

      const color             = lerpColor(0xffffff, 0x222222, t);
      const emissive          = lerpColor(0xffffff, 0x000000, t);
      const emissiveIntensity = lerp(0.15, 0, t);
      const shininess         = lerp(60, 5, t);

      const ring = new RingRenderer({
        position: info.apex,
        normal: info.direction,
        color,
        emissive,
        emissiveIntensity,
        shininess,
      });
      this._pivot.add(ring.build());
      infos.push({ info, ring, spikeIndex: i });
    }

    // Phase 2: bridge wires between consecutive rings with luminosity fade
    for (let j = 0; j < infos.length - 1; j++) {
      const { info: infoA, ring: ringA, spikeIndex: idxA } = infos[j];
      const { info: infoB, ring: ringB, spikeIndex: idxB } = infos[j + 1];

      const lumStart = 1.0 - 0.3 * (j / pairCount);
      const lumEnd   = 1.0 - 0.3 * ((j + 1) / pairCount);

      const wires = this._createBridgeWires(infoA, ringA, infoB, ringB, lumStart, lumEnd);

      const source = { nodeId, spikeIndex: idxA };
      const target = { nodeId, spikeIndex: idxB };
      const id = this._tracker.connect(source, target, wireTypes);

      this._connections.set(id, {
        source,
        target,
        rings: j === 0 ? [ringA, ringB] : [ringB], // first pair owns both rings, rest own only their new ring
        wires,
      });
    }

    // If only one spike resolved (no pairs), still track the lone ring
    if (infos.length === 1) {
      const { ring, spikeIndex } = infos[0];
      const source = { nodeId, spikeIndex };
      const target = { nodeId, spikeIndex };
      const id = this._tracker.connect(source, target, wireTypes);
      this._connections.set(id, {
        source,
        target,
        rings: [ring],
        wires: [],
      });
    }
  }

  hidePairs() { this.clearAll(); }

  get pairVisible() { return this._connections.size > 0; }

  // ── Backward-compat pass-throughs ──────────────

  showRing(spikeIndex = 0) { this.showPairs(0, spikeIndex); }
  hideRing()               { this.hidePairs(); }
  get ringVisible()        { return this.pairVisible; }
  showWires()              { /* wires are now created automatically by showPairs */ }
  hideWires()              { this._hideAllWires(); }
  get wiresVisible()       { return this._connections.size > 0; }

  // ── Internal ───────────────────────────────────

  _createBridgeWires(infoA, ringA, infoB, ringB, lumStart, lumEnd) {
    const radiusA = ringA._radius;
    const radiusB = ringB._radius;
    const wires = [];

    for (let i = 0; i < WIRE_TYPES.length; i++) {
      const wr = new WireRenderer({
        type:               WIRE_TYPES[i].type,
        slotIndex:          i,
        ringPosition:       infoA.apex.clone(),
        ringNormal:         infoA.direction.clone(),
        ringRadius:         radiusA,
        targetRingPosition: infoB.apex.clone(),
        targetRingNormal:   infoB.direction.clone(),
        targetRingRadius:   radiusB,
        luminosityStart:    lumStart,
        luminosityEnd:      lumEnd,
      });
      wr.build();
      this._pivot.add(wr.mesh);
      wires.push(wr);
    }

    return wires;
  }

  /**
   * Rebuild the visuals (rings + wires) for a single connection entry.
   * Does NOT touch the tracker.
   */
  _refreshConnection(id, entry) {
    for (const ring of entry.rings) { this._pivot.remove(ring.mesh); ring.dispose(); }
    for (const wr of entry.wires) { this._pivot.remove(wr.mesh); wr.dispose(); }

    const infoA = this._resolveEndpoint(entry.source.nodeId, entry.source.spikeIndex);
    const infoB = this._resolveEndpoint(entry.target.nodeId, entry.target.spikeIndex);
    if (!infoA || !infoB) { entry.rings = []; entry.wires = []; return; }

    const ringA = new RingRenderer({
      position: infoA.apex, normal: infoA.direction,
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, shininess: 60,
    });
    this._pivot.add(ringA.build());

    const ringB = new RingRenderer({
      position: infoB.apex, normal: infoB.direction,
      color: 0x222222, emissive: 0x000000, emissiveIntensity: 0, shininess: 5,
    });
    this._pivot.add(ringB.build());

    const wires = this._createBridgeWires(infoA, ringA, infoB, ringB, 1.0, 0.7);
    entry.rings = [ringA, ringB];
    entry.wires = wires;
  }

  /** Rebuild only connections involving a specific node. */
  refreshConnectionsForNode(nodeId) {
    for (const [id, entry] of this._connections) {
      if (entry.source.nodeId === nodeId || entry.target.nodeId === nodeId) {
        this._refreshConnection(id, entry);
      }
    }
  }

  /** Rebuild all connections. */
  refreshAll() {
    for (const [id, entry] of this._connections) this._refreshConnection(id, entry);
  }

  _hideAllWires() {
    for (const [, entry] of this._connections) {
      for (const wr of entry.wires) {
        this._pivot.remove(wr.mesh);
        wr.dispose();
      }
      entry.wires = [];
    }
  }

  // ── Lifecycle ─────────────────────────────────

  dispose() {
    this.clearAll();
  }
}

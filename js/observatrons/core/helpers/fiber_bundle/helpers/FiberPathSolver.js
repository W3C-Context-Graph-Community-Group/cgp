// ============================================================
// FiberPathSolver — math-only facade for fiber path queries
//
// Computes positions along individual fibers (wires) between
// a source ring and a target ring. No THREE.js dependency —
// works with plain {x,y,z} objects. A manager can call
// getPosition(t) on a resolved fiber to drive a light ball
// or any other animation.
//
// Coordinate conventions match WireRenderer / RingRenderer:
//  - Rings are tori oriented so their normal points along the
//    spike direction. Default torus lies in the XY plane with
//    normal +Z; a quaternion rotates it to the spike normal.
//  - Plug points sit on the ring perimeter in local XY, then
//    are rotated + translated to world (pivot-local) space.
//  - Bridge curves are Catmull-Rom through [plugA, mid, plugB].
// ============================================================

import { WIRE_TYPES } from './WireRenderer.js';

// ── Vector math (no THREE dependency) ──────────────────────

/** @typedef {{ x: number, y: number, z: number }} Vec3 */

function vec(x, y, z) { return { x, y, z }; }

function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return vec(a.x - b.x, a.y - b.y, a.z - b.z); }
function scale(v, s) { return vec(v.x * s, v.y * s, v.z * s); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}
function length(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
function normalize(v) {
  const len = length(v);
  return len > 1e-12 ? scale(v, 1 / len) : vec(0, 0, 0);
}
function lerp3(a, b, t) {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}
function dist(a, b) { return length(sub(a, b)); }

// ── Quaternion (axis-angle from unit vectors) ──────────────

/**
 * Compute the quaternion that rotates unit vector `from` to unit vector `to`.
 * Returns [x, y, z, w].
 */
function quatFromUnitVectors(from, to) {
  const d = dot(from, to);
  if (d >= 1.0 - 1e-12) return [0, 0, 0, 1]; // identity
  if (d <= -1.0 + 1e-12) {
    // 180-degree rotation — pick an arbitrary perpendicular axis
    let perp = cross(from, vec(1, 0, 0));
    if (length(perp) < 1e-6) perp = cross(from, vec(0, 1, 0));
    perp = normalize(perp);
    return [perp.x, perp.y, perp.z, 0]; // 180 degrees
  }
  const c = cross(from, to);
  const w = 1 + d;
  const len = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z + w * w);
  return [c.x / len, c.y / len, c.z / len, w / len];
}

/** Apply quaternion [qx,qy,qz,qw] to a Vec3. */
function applyQuat(q, v) {
  const [qx, qy, qz, qw] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);
  return vec(
    v.x + qw * tx + (qy * tz - qz * ty),
    v.y + qw * ty + (qz * tx - qx * tz),
    v.z + qw * tz + (qx * ty - qy * tx),
  );
}

// ── Catmull-Rom spline evaluation ──────────────────────────

/**
 * Evaluate a Catmull-Rom spline at parameter t ∈ [0, 1].
 * @param {Vec3[]} points — control points (3+)
 * @param {number}  t     — parameter [0, 1]
 * @param {boolean} closed
 * @returns {Vec3}
 *
 * Uses the centripetal parameterization (alpha = 0.5) that
 * THREE.CatmullRomCurve3 defaults to for non-closed curves.
 * For the 3-point bridge case [plugA, mid, plugB] this gives
 * identical geometry to the WireRenderer bridge path.
 */
function catmullRomPoint(points, t, closed = false) {
  const n = points.length;
  if (n < 2) return points[0] ?? vec(0, 0, 0);

  // Map t to a segment index + local parameter
  const segCount = closed ? n : n - 1;
  const tf = t * segCount;
  let seg = Math.floor(tf);
  let u = tf - seg;
  if (seg >= segCount) { seg = segCount - 1; u = 1; }

  // Four control points around the segment (with clamped/wrapped endpoints)
  function idx(i) {
    if (closed) return ((i % n) + n) % n;
    return Math.max(0, Math.min(n - 1, i));
  }
  const p0 = points[idx(seg - 1)];
  const p1 = points[idx(seg)];
  const p2 = points[idx(seg + 1)];
  const p3 = points[idx(seg + 2)];

  // Uniform Catmull-Rom basis matrix coefficients
  const u2 = u * u, u3 = u2 * u;
  const b0 = -0.5 * u3 + u2 - 0.5 * u;
  const b1 =  1.5 * u3 - 2.5 * u2 + 1;
  const b2 = -1.5 * u3 + 2 * u2 + 0.5 * u;
  const b3 =  0.5 * u3 - 0.5 * u2;

  return vec(
    b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
    b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z,
  );
}

/**
 * First derivative of the Catmull-Rom spline at parameter t.
 * Returns the (unnormalized) tangent vector.
 */
function catmullRomTangent(points, t, closed = false) {
  const n = points.length;
  if (n < 2) return vec(0, 0, 1);

  const segCount = closed ? n : n - 1;
  const tf = t * segCount;
  let seg = Math.floor(tf);
  let u = tf - seg;
  if (seg >= segCount) { seg = segCount - 1; u = 1; }

  function idx(i) {
    if (closed) return ((i % n) + n) % n;
    return Math.max(0, Math.min(n - 1, i));
  }
  const p0 = points[idx(seg - 1)];
  const p1 = points[idx(seg)];
  const p2 = points[idx(seg + 1)];
  const p3 = points[idx(seg + 2)];

  const u2 = u * u;
  const d0 = -1.5 * u2 + 2 * u - 0.5;
  const d1 =  4.5 * u2 - 5 * u;
  const d2 = -4.5 * u2 + 4 * u + 0.5;
  const d3 =  1.5 * u2 - u;

  // Scale by segCount to convert from dP/du to dP/dt
  const s = segCount;
  return vec(
    s * (d0 * p0.x + d1 * p1.x + d2 * p2.x + d3 * p3.x),
    s * (d0 * p0.y + d1 * p1.y + d2 * p2.y + d3 * p3.y),
    s * (d0 * p0.z + d1 * p1.z + d2 * p2.z + d3 * p3.z),
  );
}

// ── Arc-length table (for constant-speed traversal) ────────

/**
 * Build a cumulative arc-length table for a spline.
 * @param {Vec3[]}  controlPoints
 * @param {boolean} closed
 * @param {number}  samples — number of segments for numerical integration
 * @returns {{ lengths: number[], totalLength: number }}
 */
function buildArcLengthTable(controlPoints, closed, samples = 256) {
  const lengths = new Float64Array(samples + 1);
  lengths[0] = 0;
  let prev = catmullRomPoint(controlPoints, 0, closed);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = catmullRomPoint(controlPoints, t, closed);
    lengths[i] = lengths[i - 1] + dist(prev, pt);
    prev = pt;
  }
  return { lengths, totalLength: lengths[samples] };
}

/**
 * Given a distance s along the curve, return the corresponding
 * parameter t ∈ [0, 1] via inverse arc-length lookup (binary search).
 */
function arcLengthToT(s, table) {
  const { lengths, totalLength } = table;
  const target = Math.max(0, Math.min(totalLength, s));
  const n = lengths.length - 1;
  let lo = 0, hi = n;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] < target) lo = mid;
    else hi = mid;
  }
  const segLen = lengths[hi] - lengths[lo];
  const frac = segLen > 1e-12 ? (target - lengths[lo]) / segLen : 0;
  return (lo + frac) / n;
}

// ── Plug-point computation (mirrors WireRenderer) ──────────

const _Z_VEC = vec(0, 0, 1);

/**
 * Compute the world-space plug point for a given slot on a ring.
 * Exactly mirrors WireRenderer._buildBridge() plug computation.
 *
 * @param {number} slotIndex  — 0..4
 * @param {Vec3}   ringPos    — ring center in world (pivot-local)
 * @param {Vec3}   ringNormal — ring normal (spike direction)
 * @param {number} ringRadius — ring major radius
 * @returns {Vec3}
 */
function computePlugPoint(slotIndex, ringPos, ringNormal, ringRadius) {
  const theta = slotIndex * (2 * Math.PI / WIRE_TYPES.length);
  const radialLocal = vec(Math.cos(theta), Math.sin(theta), 0);
  const plugLocal = scale(radialLocal, ringRadius);
  const quat = quatFromUnitVectors(_Z_VEC, normalize(ringNormal));
  const plugWorld = add(applyQuat(quat, plugLocal), ringPos);
  return plugWorld;
}

/**
 * Compute the bridge midpoint (mirrors WireRenderer._buildBridge).
 * Midpoint of plugA & plugB, then pushed outward from the origin
 * by 30% of the distance between them.
 */
function computeBridgeMidpoint(plugA, plugB) {
  const mid = scale(add(plugA, plugB), 0.5);
  const outward = normalize(mid);
  const d = dist(plugA, plugB);
  return add(mid, scale(outward, d * 0.3));
}

// ============================================================
// FiberPath — a resolved, parametric path along one fiber
// ============================================================

export class FiberPath {
  /**
   * @param {Vec3[]}  controlPoints — Catmull-Rom control points
   * @param {boolean} closed        — whether the spline loops
   * @param {number}  wireColor     — 0xRRGGBB
   * @param {string}  wireType      — e.g. 'channel'
   */
  constructor(controlPoints, closed, wireColor, wireType) {
    this._points = controlPoints;
    this._closed = closed;
    this._color = wireColor;
    this._type = wireType;
    this._arcTable = null; // lazy
  }

  /** Wire type name (channel, source, timestamp, key, value). */
  get type() { return this._type; }

  /** Wire color as 0xRRGGBB integer. */
  get color() { return this._color; }

  /** The Catmull-Rom control points (read-only). */
  get controlPoints() { return this._points; }

  /** Whether this is a closed (loop) path. */
  get closed() { return this._closed; }

  // ── Parametric queries ──────────────────────────────────

  /**
   * Position on the fiber at parameter t ∈ [0, 1].
   * t=0 is the source plug, t=1 is the target plug.
   * Uses raw spline parameter (non-uniform speed).
   * @param {number} t
   * @returns {Vec3}
   */
  getPoint(t) {
    return catmullRomPoint(this._points, clamp01(t), this._closed);
  }

  /**
   * Tangent vector at parameter t ∈ [0, 1] (unnormalized).
   * @param {number} t
   * @returns {Vec3}
   */
  getTangent(t) {
    return catmullRomTangent(this._points, clamp01(t), this._closed);
  }

  /**
   * Unit tangent at parameter t.
   * @param {number} t
   * @returns {Vec3}
   */
  getDirection(t) {
    return normalize(this.getTangent(t));
  }

  // ── Constant-speed (arc-length) queries ─────────────────

  /**
   * Position at a fraction of the total arc length.
   * u=0 is the start, u=1 is the end.
   * Unlike getPoint(t), this moves at constant speed.
   * @param {number} u — arc-length fraction [0, 1]
   * @returns {Vec3}
   */
  getPointAtArcLength(u) {
    const table = this._ensureArcTable();
    const s = clamp01(u) * table.totalLength;
    const t = arcLengthToT(s, table);
    return this.getPoint(t);
  }

  /**
   * Unit tangent at a fraction of the total arc length.
   * @param {number} u — arc-length fraction [0, 1]
   * @returns {Vec3}
   */
  getDirectionAtArcLength(u) {
    const table = this._ensureArcTable();
    const s = clamp01(u) * table.totalLength;
    const t = arcLengthToT(s, table);
    return this.getDirection(t);
  }

  /**
   * Total arc length of the fiber, in world units.
   * @returns {number}
   */
  get totalLength() {
    return this._ensureArcTable().totalLength;
  }

  // ── Sampling helpers ────────────────────────────────────

  /**
   * Return N evenly-spaced (by arc length) sample points.
   * Useful for particle trail effects.
   * @param {number} count
   * @returns {Vec3[]}
   */
  sampleUniform(count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const u = count > 1 ? i / (count - 1) : 0;
      pts.push(this.getPointAtArcLength(u));
    }
    return pts;
  }

  /**
   * Return the Frenet-Serret frame at arc-length fraction u.
   * Gives { position, tangent, normal, binormal } for
   * orienting a light sprite / mesh along the curve.
   *
   * @param {number} u — arc-length fraction [0, 1]
   * @returns {{ position: Vec3, tangent: Vec3, normal: Vec3, binormal: Vec3 }}
   */
  getFrame(u) {
    const table = this._ensureArcTable();
    const s = clamp01(u) * table.totalLength;
    const t = arcLengthToT(s, table);

    const position = this.getPoint(t);
    const tangent = this.getDirection(t);

    // Approximate normal via finite difference of tangent
    const dt = 0.001;
    const t2 = Math.min(1, t + dt);
    const tangent2 = this.getDirection(t2);
    let dT = sub(tangent2, tangent);
    const dTlen = length(dT);
    let normal;
    if (dTlen > 1e-10) {
      normal = normalize(dT);
    } else {
      // Fallback: pick an arbitrary perpendicular
      const ref = Math.abs(tangent.x) < 0.9 ? vec(1, 0, 0) : vec(0, 1, 0);
      normal = normalize(cross(tangent, ref));
    }

    const binormal = normalize(cross(tangent, normal));

    return { position, tangent, normal, binormal };
  }

  // ── Internal ────────────────────────────────────────────

  _ensureArcTable() {
    if (!this._arcTable) {
      this._arcTable = buildArcLengthTable(this._points, this._closed, 256);
    }
    return this._arcTable;
  }
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// ============================================================
// FiberPathSolver — facade that resolves connection endpoints
//                   into FiberPath objects
// ============================================================

export class FiberPathSolver {

  /**
   * Resolve all five fiber paths for a bridge connection.
   *
   * @param {object} source
   * @param {Vec3}   source.position  — ring center (spike apex)
   * @param {Vec3}   source.normal    — ring normal (spike direction)
   * @param {number} [source.radius=0.03] — ring major radius
   *
   * @param {object} target
   * @param {Vec3}   target.position  — ring center (spike apex)
   * @param {Vec3}   target.normal    — ring normal (spike direction)
   * @param {number} [target.radius=0.03] — ring major radius
   *
   * @returns {FiberPath[]} — one per WIRE_TYPE, in order
   */
  static resolveBridge(source, target) {
    const rA = source.radius ?? 0.03;
    const rB = target.radius ?? 0.03;

    return WIRE_TYPES.map((wt, slotIndex) => {
      const plugA = computePlugPoint(slotIndex, source.position, source.normal, rA);
      const plugB = computePlugPoint(slotIndex, target.position, target.normal, rB);
      const mid   = computeBridgeMidpoint(plugA, plugB);

      return new FiberPath([plugA, mid, plugB], false, wt.color, wt.type);
    });
  }

  /**
   * Resolve a single named fiber for a bridge connection.
   *
   * @param {string} wireType — 'channel' | 'source' | 'timestamp' | 'key' | 'value'
   * @param {object} source   — { position, normal, radius? }
   * @param {object} target   — { position, normal, radius? }
   * @returns {FiberPath|null}
   */
  static resolveSingleFiber(wireType, source, target) {
    const idx = WIRE_TYPES.findIndex(w => w.type === wireType);
    if (idx < 0) return null;

    const rA = source.radius ?? 0.03;
    const rB = target.radius ?? 0.03;

    const plugA = computePlugPoint(idx, source.position, source.normal, rA);
    const plugB = computePlugPoint(idx, target.position, target.normal, rB);
    const mid   = computeBridgeMidpoint(plugA, plugB);

    const wt = WIRE_TYPES[idx];
    return new FiberPath([plugA, mid, plugB], false, wt.color, wt.type);
  }

  /**
   * Resolve a full chain of fiber paths across a sequence of rings.
   * Each consecutive pair of rings gets 5 fibers (one per wire type).
   *
   * @param {{ position: Vec3, normal: Vec3, radius?: number }[]} rings
   * @returns {FiberPath[][]} — outer: one entry per pair, inner: 5 fibers
   */
  static resolveChain(rings) {
    const result = [];
    for (let i = 0; i < rings.length - 1; i++) {
      result.push(FiberPathSolver.resolveBridge(rings[i], rings[i + 1]));
    }
    return result;
  }

  /**
   * Compute a composite path for one wire type across an entire chain.
   * Joins the per-segment curves into a single FiberPath, maintaining
   * C1 continuity at each ring junction.
   *
   * @param {string} wireType
   * @param {{ position: Vec3, normal: Vec3, radius?: number }[]} rings
   * @returns {FiberPath|null}
   */
  static resolveChainFiber(wireType, rings) {
    const idx = WIRE_TYPES.findIndex(w => w.type === wireType);
    if (idx < 0 || rings.length < 2) return null;

    // Collect all plug + mid points across the chain
    const allPoints = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const rA = rings[i].radius ?? 0.03;
      const rB = rings[i + 1].radius ?? 0.03;

      const plugA = computePlugPoint(idx, rings[i].position, rings[i].normal, rA);
      const mid   = computeBridgeMidpoint(
        plugA,
        computePlugPoint(idx, rings[i + 1].position, rings[i + 1].normal, rB),
      );
      const plugB = computePlugPoint(idx, rings[i + 1].position, rings[i + 1].normal, rB);

      if (i === 0) allPoints.push(plugA);
      allPoints.push(mid);
      allPoints.push(plugB);
    }

    const wt = WIRE_TYPES[idx];
    return new FiberPath(allPoints, false, wt.color, wt.type);
  }

  // ── Utility ────────────────────────────────────────────

  /** Ordered list of wire type names. */
  static get wireTypeNames() {
    return WIRE_TYPES.map(w => w.type);
  }

  /** Full wire type definitions. */
  static get wireTypes() {
    return WIRE_TYPES;
  }
}

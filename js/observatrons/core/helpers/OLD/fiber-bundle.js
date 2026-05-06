import * as THREE from 'three';

// ============================================================
// FiberBundle — reusable five-strand cable between two endpoints
// ============================================================
//
// Each strand corresponds to a canonical claim-form column:
//   0 Channel   #7BA4CC  soft blue
//   1 Source    #7BBF7B  soft green
//   2 Timestamp #CCBF66  soft yellow
//   3 Key       #CC9966  soft orange
//   4 Value     #CC7BA4  soft pink

const NUM_STRANDS = 5;
const STRAND_COLORS = [
  0x7BA4CC,
  0x7BBF7B,
  0xCCBF66,
  0xCC9966,
  0xCC7BA4,
];
const CURVE_STEPS = 64;
const GEODESIC_LIFT = 1.03;   // centerline radius multiplier — lifts cable above sphere surface

export class FiberBundle {

  /**
   * @param {object} opts
   * @param {THREE.Vector3} opts.startPoint   — where the bundle starts
   * @param {THREE.Vector3} opts.startNormal  — outward direction at start
   * @param {THREE.Vector3} opts.endPoint     — where the bundle ends
   * @param {THREE.Vector3} opts.endNormal    — outward direction at end
   * @param {'geodesic'|'external'|'straight'} [opts.curveProfile='geodesic']
   * @param {THREE.Vector3} [opts.sphereCenter] — only for geodesic
   * @param {number}        [opts.sphereRadius] — only for geodesic
   * @param {number}        [opts.strandOffset=0.02]  — fraction of endpoint separation
   * @param {boolean}       [opts.showRings=true]
   * @param {number}        [opts.ringRadius=0.02]    — fraction of endpoint separation
   * @param {number}        [opts.strandOpacity=0.6]
   */
  constructor({
    startPoint,
    startNormal,
    endPoint,
    endNormal,
    curveProfile = 'geodesic',
    sphereCenter,
    sphereRadius,
    strandOffset = 0.02,
    showRings    = true,
    ringRadius   = 0.02,
    strandOpacity = 0.6,
  }) {
    this._startPoint  = startPoint.clone();
    this._startNormal = startNormal.clone().normalize();
    this._endPoint    = endPoint.clone();
    this._endNormal   = endNormal.clone().normalize();
    this._curveProfile = curveProfile;
    this._sphereCenter = sphereCenter ? sphereCenter.clone() : new THREE.Vector3();
    this._sphereRadius = sphereRadius ?? 0.5;
    this._strandOffset  = strandOffset;
    this._showRings     = showRings;
    this._ringRadius    = ringRadius;
    this._strandOpacity = strandOpacity;

    this._group = null;
  }

  // ────────────────────────────────────────────
  // PUBLIC
  // ────────────────────────────────────────────

  /** Build and return a THREE.Group containing strands + rings. */
  build() {
    this._group = new THREE.Group();

    const separation = this._startPoint.distanceTo(this._endPoint);
    if (separation < 1e-6) return this._group;        // degenerate — nothing to draw

    const bundleR = this._strandOffset * separation;
    const ringR   = this._ringRadius   * separation;

    // 1) centerline
    const pts = this._computeCenterline();

    // 2) local frames along the centerline
    const { normals, binormals } = this._computeFrames(pts);

    // 3) five strands
    for (let k = 0; k < NUM_STRANDS; k++) {
      this._group.add(this._buildStrand(k, pts, normals, binormals, bundleR));
    }

    // 4) endpoint rings
    if (this._showRings) {
      this._group.add(this._buildRing(this._startPoint, this._startNormal, ringR));
      this._group.add(this._buildRing(this._endPoint,   this._endNormal,   ringR));
    }

    return this._group;
  }

  /** Return CURVE_STEPS sample points along the smoothed centerline. */
  getCenterlineSamples() {
    return this._computeCenterline();
  }

  /** Dispose all geometries and materials owned by this bundle. */
  dispose() {
    if (!this._group) return;
    this._group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this._group = null;
  }

  // ────────────────────────────────────────────
  // CENTERLINE
  // ────────────────────────────────────────────

  _computeCenterline() {
    switch (this._curveProfile) {
      case 'geodesic': return this._geodesicCenterline();
      case 'external': return this._externalCenterline();
      case 'straight': return this._straightCenterline();
      default:
        throw new Error(`FiberBundle: unknown curveProfile "${this._curveProfile}"`);
    }
  }

  /**
   * Slerp between startNormal and endNormal on a sphere, then smooth
   * with CatmullRomCurve3 (matches existing intra-sphere behaviour).
   */
  _geodesicCenterline() {
    const up = new THREE.Vector3(0, 1, 0);
    const qStart = new THREE.Quaternion().setFromUnitVectors(up, this._startNormal);
    const qEnd   = new THREE.Quaternion().setFromUnitVectors(up, this._endNormal);
    const qt = new THREE.Quaternion();
    const r  = this._sphereRadius * GEODESIC_LIFT;

    const raw = [];
    for (let s = 0; s <= CURVE_STEPS; s++) {
      qt.slerpQuaternions(qStart, qEnd, s / CURVE_STEPS);
      const p = up.clone().applyQuaternion(qt).multiplyScalar(r);
      p.add(this._sphereCenter);
      raw.push(p);
    }

    return new THREE.CatmullRomCurve3(raw).getPoints(CURVE_STEPS - 1);
  }

  /**
   * Cubic Bézier that departs along startNormal and arrives along endNormal,
   * with control-point offset = 0.5 × endpoint separation for a natural arc.
   */
  _externalCenterline() {
    const dist = this._startPoint.distanceTo(this._endPoint);
    const cp1 = this._startPoint.clone().addScaledVector(this._startNormal, dist * 0.5);
    const cp2 = this._endPoint.clone().addScaledVector(this._endNormal,     dist * 0.5);

    return new THREE.CubicBezierCurve3(
      this._startPoint.clone(), cp1, cp2, this._endPoint.clone(),
    ).getPoints(CURVE_STEPS - 1);
  }

  /** Straight line between endpoints (for testing / short connections). */
  _straightCenterline() {
    const pts = [];
    for (let s = 0; s < CURVE_STEPS; s++) {
      const t = s / (CURVE_STEPS - 1);
      pts.push(new THREE.Vector3().lerpVectors(this._startPoint, this._endPoint, t));
    }
    return pts;
  }

  // ────────────────────────────────────────────
  // LOCAL FRAMES
  // ────────────────────────────────────────────

  _computeFrames(pts) {
    const normals   = [];
    const binormals = [];
    const tmpT   = new THREE.Vector3();
    const tmpN   = new THREE.Vector3();
    const tmpB   = new THREE.Vector3();
    const tmpRef = new THREE.Vector3();

    for (let p = 0; p < pts.length; p++) {
      // tangent
      if (p < pts.length - 1) {
        tmpT.subVectors(pts[p + 1], pts[p]).normalize();
      } else {
        tmpT.subVectors(pts[p], pts[p - 1]).normalize();
      }

      // normal: reject a reference vector from the tangent
      tmpRef.copy(pts[p]).normalize();
      tmpN.copy(tmpRef).addScaledVector(tmpT, -tmpRef.dot(tmpT)).normalize();
      if (tmpN.lengthSq() < 0.001) {
        tmpRef.set(1, 0, 0);
        tmpN.copy(tmpRef).addScaledVector(tmpT, -tmpRef.dot(tmpT)).normalize();
      }
      normals.push(tmpN.clone());

      // binormal
      tmpB.crossVectors(tmpT, tmpN).normalize();
      binormals.push(tmpB.clone());
    }

    return { normals, binormals };
  }

  // ────────────────────────────────────────────
  // STRAND GEOMETRY
  // ────────────────────────────────────────────

  _buildStrand(index, pts, normals, binormals, bundleR) {
    const angle = (index / NUM_STRANDS) * Math.PI * 2;
    const cosA  = Math.cos(angle);
    const sinA  = Math.sin(angle);
    const verts = [];

    for (let p = 0; p < pts.length - 1; p++) {
      const nx  = normals[p].x   * cosA + binormals[p].x   * sinA;
      const ny  = normals[p].y   * cosA + binormals[p].y   * sinA;
      const nz  = normals[p].z   * cosA + binormals[p].z   * sinA;
      const nx2 = normals[p+1].x * cosA + binormals[p+1].x * sinA;
      const ny2 = normals[p+1].y * cosA + binormals[p+1].y * sinA;
      const nz2 = normals[p+1].z * cosA + binormals[p+1].z * sinA;

      verts.push(
        pts[p].x   + nx  * bundleR, pts[p].y   + ny  * bundleR, pts[p].z   + nz  * bundleR,
        pts[p+1].x + nx2 * bundleR, pts[p+1].y + ny2 * bundleR, pts[p+1].z + nz2 * bundleR,
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: STRAND_COLORS[index],
      transparent: true,
      opacity: this._strandOpacity,
      depthWrite: false,
    }));
  }

  // ────────────────────────────────────────────
  // RING GEOMETRY
  // ────────────────────────────────────────────

  _buildRing(position, normal, ringR) {
    // TorusGeometry lies in XY plane; its default normal is +Z.
    const geo  = new THREE.TorusGeometry(ringR, ringR * 0.15, 8, 24);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }));
    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return mesh;
  }
}

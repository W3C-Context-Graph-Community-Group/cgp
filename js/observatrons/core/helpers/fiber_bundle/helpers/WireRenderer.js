import * as THREE from 'three';

const _Z = new THREE.Vector3(0, 0, 1);

export const WIRE_TYPES = [
  { type: 'channel',   color: 0x4a90d9, label: 'Channel'   },
  { type: 'source',    color: 0x50c878, label: 'Source'     },
  { type: 'timestamp', color: 0xf5a623, label: 'Timestamp'  },
  { type: 'key',       color: 0xe74c3c, label: 'Key'        },
  { type: 'value',     color: 0xc084fc, label: 'Value'      },
  { type: 'anchor',    color: 0x00bcd4, label: 'Anchor'     },
];

export class WireRenderer {
  /**
   * @param {Object} opts
   * @param {string} opts.type         — wire type name (e.g. 'channel')
   * @param {number} opts.slotIndex    — 0–4, determines plug position on ring
   * @param {THREE.Vector3} opts.ringPosition — ring center in pivot-local space
   * @param {THREE.Vector3} opts.ringNormal   — ring normal (spike direction)
   * @param {number} opts.ringRadius   — radius of the ring
   * @param {THREE.Vector3} [opts.targetRingPosition] — target ring center (bridge mode)
   * @param {THREE.Vector3} [opts.targetRingNormal]   — target ring normal (bridge mode)
   * @param {number}        [opts.targetRingRadius]   — target ring radius (bridge mode)
   * @param {number} [opts.color]      — override default color
   * @param {number} [opts.loopRadius=0.04]
   * @param {number} [opts.tubeRadius=0.002]
   * @param {number} [opts.opacity=0.9]
   * @param {number} [opts.luminosityStart=1.0] — brightness multiplier at source plug
   * @param {number} [opts.luminosityEnd=1.0]   — brightness multiplier at target plug
   */
  constructor({ type, slotIndex, ringPosition, ringNormal, ringRadius,
                targetRingPosition, targetRingNormal, targetRingRadius,
                color, loopRadius = 0.04, tubeRadius = 0.004, opacity = 0.9,
                luminosityStart = 1.0, luminosityEnd = 1.0 }) {
    const def = WIRE_TYPES.find(w => w.type === type) || WIRE_TYPES[slotIndex] || WIRE_TYPES[0];
    this._type       = def.type;
    this._label      = def.label;
    this._slotIndex  = slotIndex;
    this._ringPos    = ringPosition;
    this._ringNormal = ringNormal;
    this._ringRadius = ringRadius;
    this._targetPos    = targetRingPosition ?? null;
    this._targetNormal = targetRingNormal ?? null;
    this._targetRadius = targetRingRadius ?? null;
    this._color      = color ?? def.color;
    this._loopRadius = loopRadius;
    this._tubeRadius = tubeRadius;
    this._opacity    = opacity;
    this._luminosityStart = luminosityStart;
    this._luminosityEnd   = luminosityEnd;
    this._mesh       = null;
  }

  get mesh()  { return this._mesh; }
  get type()  { return this._type; }
  get label() { return this._label; }

  build() {
    if (this._targetPos) {
      return this._buildBridge();
    }
    return this._buildLoop();
  }

  _buildLoop() {
    const theta = this._slotIndex * (2 * Math.PI / WIRE_TYPES.length);

    // Radial direction at plug point (in ring-local frame, ring lies in XY)
    const radialDir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
    // Axial direction is Z in ring-local frame
    const axialDir = new THREE.Vector3(0, 0, 1);

    // Plug point in ring-local frame
    const plugLocal = radialDir.clone().multiplyScalar(this._ringRadius);

    // Build loop points in ring-local frame
    const numPts = 64;
    const localPts = [];
    for (let i = 0; i < numPts; i++) {
      const t = (i / numPts) * 2 * Math.PI;
      const radialOffset  = this._loopRadius * Math.sin(t) * 0.4;
      const axialOffset   = this._loopRadius * (1 - Math.cos(t)) * 0.5;

      const pt = plugLocal.clone()
        .addScaledVector(radialDir, radialOffset)
        .addScaledVector(axialDir, axialOffset);
      localPts.push(pt);
    }

    // Transform local points to world (pivot-local) space via ring quaternion + position
    const quat = new THREE.Quaternion().setFromUnitVectors(_Z, this._ringNormal);
    const worldPts = localPts.map(p => p.applyQuaternion(quat).add(this._ringPos));

    const curve = new THREE.CatmullRomCurve3(worldPts, true);
    const geo = new THREE.TubeGeometry(curve, 128, this._tubeRadius, 8, true);
    const mat = new THREE.MeshBasicMaterial({
      color:       this._color,
      transparent: this._opacity < 1,
      opacity:     this._opacity,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    return this._mesh;
  }

  _buildBridge() {
    const theta = this._slotIndex * (2 * Math.PI / WIRE_TYPES.length);

    // Plug A on source ring
    const radialA = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
    const plugALocal = radialA.clone().multiplyScalar(this._ringRadius);
    const quatA = new THREE.Quaternion().setFromUnitVectors(_Z, this._ringNormal);
    const plugA = plugALocal.applyQuaternion(quatA).add(this._ringPos);

    // Plug B on target ring
    const radialB = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
    const plugBLocal = radialB.clone().multiplyScalar(this._targetRadius);
    const quatB = new THREE.Quaternion().setFromUnitVectors(_Z, this._targetNormal);
    const plugB = plugBLocal.applyQuaternion(quatB).add(this._targetPos);

    // Midpoint offset outward from origin for visual clearance
    const mid = plugA.clone().add(plugB).multiplyScalar(0.5);
    const outward = mid.clone().normalize();
    const dist = plugA.distanceTo(plugB);
    mid.addScaledVector(outward, dist * 0.3);

    const tubularSegments = 64;
    const radialSegments = 8;
    const curve = new THREE.CatmullRomCurve3([plugA, mid, plugB], false);
    const geo = new THREE.TubeGeometry(curve, tubularSegments, this._tubeRadius, radialSegments, false);

    // Apply per-vertex color for luminosity gradient
    const baseColor = new THREE.Color(this._color);
    const vertCount = (tubularSegments + 1) * (radialSegments + 1);
    const colors = new Float32Array(vertCount * 3);

    for (let seg = 0; seg <= tubularSegments; seg++) {
      const t = seg / tubularSegments;
      const lum = this._luminosityStart + (this._luminosityEnd - this._luminosityStart) * t;
      const r = baseColor.r * lum;
      const g = baseColor.g * lum;
      const b = baseColor.b * lum;

      for (let rad = 0; rad <= radialSegments; rad++) {
        const idx = (seg * (radialSegments + 1) + rad) * 3;
        colors[idx]     = r;
        colors[idx + 1] = g;
        colors[idx + 2] = b;
      }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent:  this._opacity < 1,
      opacity:      this._opacity,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    return this._mesh;
  }

  dispose() {
    if (!this._mesh) return;
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
    this._mesh = null;
  }
}

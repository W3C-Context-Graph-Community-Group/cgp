import * as THREE from 'three';

const _Z = new THREE.Vector3(0, 0, 1);

export class RingRenderer {
  /**
   * @param {Object} opts
   * @param {THREE.Vector3} opts.position  — ring center (e.g. spike apex)
   * @param {THREE.Vector3} opts.normal    — direction the ring is perpendicular to
   * @param {number}        [opts.radius=0.03]     — ring radius
   * @param {number}        [opts.tubeRadius=0.004] — tube thickness
   * @param {number}        [opts.color=0xffffff]
   * @param {number}        [opts.opacity=0.8]
   * @param {number}        [opts.emissive=0x000000]
   * @param {number}        [opts.emissiveIntensity=0]
   * @param {number}        [opts.shininess=30]
   */
  constructor({ position, normal, radius = 0.03, tubeRadius = 0.004, color = 0xffffff, opacity = 0.8,
                emissive = 0x000000, emissiveIntensity = 0, shininess = 30 }) {
    this._position          = position;
    this._normal            = normal;
    this._radius            = radius;
    this._tubeRadius        = tubeRadius;
    this._color             = color;
    this._opacity           = opacity;
    this._emissive          = emissive;
    this._emissiveIntensity = emissiveIntensity;
    this._shininess         = shininess;
    this._mesh              = null;
  }

  get mesh() { return this._mesh; }

  build() {
    const geo = new THREE.TorusGeometry(this._radius, this._tubeRadius, 16, 48);
    const mat = new THREE.MeshPhongMaterial({
      color:             this._color,
      emissive:          this._emissive,
      emissiveIntensity: this._emissiveIntensity,
      shininess:         this._shininess,
      transparent:       this._opacity < 1,
      opacity:           this._opacity,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.quaternion.setFromUnitVectors(_Z, this._normal);
    this._mesh.position.copy(this._position);
    return this._mesh;
  }

  dispose() {
    if (!this._mesh) return;
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
    this._mesh = null;
  }
}

import * as THREE from 'three';

/**
 * Manages HTML overlay labels that display stats beneath the observatron.
 */
export class LabelManager {
  constructor(camera, container) {
    this._camera = camera;
    this._container = container;
    this._overlay = document.getElementById('overlay');
    this._labelEl = null;
    this._metaEl  = null;
  }

  /** Project a 3D point to screen coordinates. */
  projectToScreen(v3) {
    const p = v3.clone().project(this._camera);
    return {
      x: (p.x * 0.5 + 0.5) * this._container.clientWidth,
      y: (1 - (p.y * 0.5 + 0.5)) * this._container.clientHeight,
    };
  }

  /** Update label positions and stats text. */
  update(channelMgr, mesh, connectionStats) {
    if (!this._labelEl && !this._metaEl) return;

    const topEdge = this.projectToScreen(new THREE.Vector3(0, 0.75, 0));
    const botEdge = this.projectToScreen(new THREE.Vector3(0, -0.75, 0));

    if (this._labelEl) {
      this._labelEl.style.left  = `${topEdge.x - 90}px`;
      this._labelEl.style.top   = `${topEdge.y - 22}px`;
      this._labelEl.style.width = '180px';
      this._labelEl.style.textAlign = 'center';
    }

    if (this._metaEl) {
      const ch = channelMgr.channelCount;
      const ev = channelMgr.eventCount;
      const paths = channelMgr.columnCount;
      let totalDelta = 0, totM = 0;
      if (mesh) {
        for (const s of mesh.regionStats) {
          totalDelta += s.delta * s.m;
          totM += s.m;
        }
      }
      const avgDelta = totM > 0 ? totalDelta / totM : 0;

      let metaText = `${ch} ch · ${ev} ev · ${paths} pa · δ̄ ${avgDelta.toFixed(3)}`;
      if (connectionStats) {
        const { shown, total } = connectionStats;
        metaText += shown < total ? ` · ${shown}/${total} conn` : ` · ${shown} conn`;
      }
      this._metaEl.textContent = metaText;
      this._metaEl.style.left  = `${botEdge.x - 110}px`;
      this._metaEl.style.top   = `${botEdge.y + 4}px`;
      this._metaEl.style.width = '220px';
      this._metaEl.style.textAlign = 'center';
    }
  }

  dispose() {
    if (this._labelEl) this._labelEl.remove();
    if (this._metaEl)  this._metaEl.remove();
  }
}

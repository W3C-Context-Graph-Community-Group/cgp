import * as THREE from 'three';
import { ObservatronChannelManager } from './channel-manager.js';
import { disposeGroup, OBS_RADIUS } from './helpers/math-utils.js';
import { SceneManager } from './helpers/scene-manager.js';
import { SpikeBuilder } from './helpers/spike-builder.js';
import { ConnectionBuilder } from './helpers/connection-builder.js';
import { DragHandler } from './helpers/drag-handler.js';
import { LabelManager } from './helpers/label-manager.js';
import { FacetHeight } from './facet-height.js';

// ============================================================
// Observatron — manager class composing modular helpers
// ============================================================

export class Observatron {
  /**
   * @param {HTMLElement} containerEl — element to mount the renderer into
   */
  constructor(containerEl) {
    this._container = containerEl;

    // ── state ──
    this._channelMgr = new ObservatronChannelManager({ systemId: '0', observatronId: '0' });
    this._channelsRange = null;
    this._eventsRange   = null;
    this._anchorsRange  = null;
    this._pathsRange    = null;
    this._visibleChannels = { min: 0, max: 0 };
    this._connectionStats = null;
    this._seed = undefined;

    // ── color scheme ──
    this._colorScheme = null;

    // ── rotation callback ──
    this._onRotationChange = null;

    // ── pan state ──
    this._panX = 0;
    this._panY = 0;
    this._onPanChange = null;

    // ── rebuild callback ──
    this._onRebuild = null;
    this._highlightedSpike = null;

    // ── scene ──
    this._sceneMgr = new SceneManager(containerEl);
    this._sceneMgr.onResize = () => this._labels.update(this._channelMgr, this._mesh, this._connectionStats);
    this._mesh = null;

    // ── labels ──
    this._labels = new LabelManager(this._sceneMgr.camera, containerEl);

    // ── drag ──
    this._drag = new DragHandler(
      containerEl,
      this._sceneMgr.pivot,
      this._sceneMgr.camera,
      () => this._notifyRotation(),
      (dx, dy) => this._handlePan(dx, dy),
    );
  }

  // ────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────

  exec(command, data) {
    const handler = this._commands[command];
    if (!handler) throw new Error(`Observatron: unknown command "${command}"`);
    handler.call(this, data);
  }

  saveImage(filename = 'observatron.png') {
    this._sceneMgr.renderer.render(this._sceneMgr.scene, this._sceneMgr.camera);
    const link = document.createElement('a');
    link.download = filename;
    link.href = this._sceneMgr.renderer.domElement.toDataURL('image/png');
    link.click();
  }

  fitCamera() {
    this._sceneMgr.fitCamera();
  }

  set zoomCtrl(ctrl) {
    this._sceneMgr.zoomCtrl = ctrl;
  }

  set onRotationChange(fn) {
    this._onRotationChange = fn;
  }

  setRotation(axis, radians) {
    this._sceneMgr.pivot.rotation[axis] = radians;
    this._notifyRotation();
  }

  set onPanChange(fn) {
    this._onPanChange = fn;
  }

  set onRebuild(fn) {
    this._onRebuild = fn;
  }

  setPan(x, y) {
    this._panX = x;
    this._panY = y;
    this._applyPan();
  }

  set colorScheme(cs) {
    this._colorScheme = cs;
    cs.onChange = () => this._rebuild();
  }

  set channelsRange(range) {
    this._channelsRange = range;
    if (this._seed !== undefined) this._cmd_seed({ seed: this._seed });
  }

  set eventsRange(range) {
    this._eventsRange = range;
    if (this._seed !== undefined) this._cmd_seed({ seed: this._seed });
  }

  set anchorsRange(range) {
    this._anchorsRange = range;
    if (this._seed !== undefined) this._cmd_seed({ seed: this._seed });
  }

  set pathsRange(range) {
    this._pathsRange = range;
    if (this._seed !== undefined) this._cmd_seed({ seed: this._seed });
  }

  set visibleChannels(range) {
    this._visibleChannels = range;
    this._rebuild();
  }

  set facetOpacity(v) {
    if (!this._mesh) return;
    this._mesh.group.traverse(o => {
      if (o.isMesh && o.userData.facetSide) {
        o.material.opacity = v;
      }
    });
  }

  set dotScale(s) {
    if (!this._mesh) return;
    this._mesh.group.traverse(o => {
      if (o.isMesh && o.userData.dotDisc) {
        o.scale.set(s, s, s);
      }
    });
  }

  dispose() {
    this._drag.dispose();
    this._labels.dispose();

    if (this._mesh) {
      this._sceneMgr.pivot.remove(this._mesh.group);
      disposeGroup(this._mesh.group);
    }

    this._sceneMgr.dispose();
  }

  // ── expose internals needed by the app shell ──

  get spikeCount() { return this._mesh ? this._mesh.spikes.length : 0; }
  get spikeData() { return this._mesh ? this._mesh.spikes : []; }
  get observatronAddress() { return this._channelMgr.observatronUrl; }

  highlightSpike(index) {
    this.clearSpikeHighlight();
    if (!this._mesh) return;
    this._mesh.group.traverse(o => {
      if (o.isMesh && o.userData.facetSide && o.userData.spikeIndex === index) {
        o.userData._origColor = o.material.color.clone();
        o.userData._origEmissive = o.material.emissive.clone();
        o.material.color.set(0x4a90ff);
        o.material.emissive.set(0x1a3a80);
      }
    });
    this._highlightedSpike = index;
  }

  clearSpikeHighlight() {
    if (this._highlightedSpike == null || !this._mesh) return;
    this._mesh.group.traverse(o => {
      if (o.isMesh && o.userData.facetSide && o.userData.spikeIndex === this._highlightedSpike) {
        if (o.userData._origColor) o.material.color.copy(o.userData._origColor);
        if (o.userData._origEmissive) o.material.emissive.copy(o.userData._origEmissive);
        delete o.userData._origColor;
        delete o.userData._origEmissive;
      }
    });
    this._highlightedSpike = null;
  }

  get _bgCube()   { return this._sceneMgr.bgCube; }
  get _bgCorner() { return this._sceneMgr.bgCorner; }
  get _pivot()    { return this._sceneMgr.pivot; }
  get _scene()    { return this._sceneMgr.scene; }
  get _camera()   { return this._sceneMgr.camera; }
  set viewExtent(ext) { this._sceneMgr.viewExtent = ext; }

  _projectToScreen(v3) {
    return this._labels.projectToScreen(v3);
  }

  _updateLabels() {
    this._labels.update(this._channelMgr, this._mesh, this._connectionStats);
  }

  getSpikeInfo(index) {
    if (!this._mesh || !this._mesh.dirs || index < 0 || index >= this._mesh.dirs.length) return null;
    const dir = this._mesh.dirs[index];
    const sp  = this._mesh.spikes[index];
    const n   = this._mesh.spikes.length;
    const baseEdge      = FacetHeight.baseEdge(n, OBS_RADIUS);
    const baseHeightRef = baseEdge * Math.sqrt(2 / 3);
    const hTetra        = FacetHeight.spikeHeight(baseHeightRef, sp.v, OBS_RADIUS);
    return {
      direction: dir.clone(),
      base:      dir.clone().multiplyScalar(OBS_RADIUS * 1.003),
      apex:      dir.clone().multiplyScalar(OBS_RADIUS + hTetra),
    };
  }

  // ────────────────────────────────────────────
  // COMMAND MAP
  // ────────────────────────────────────────────

  get _commands() {
    return {
      seed:   this._cmd_seed,
      emit:   this._cmd_emit,
      reset:  this._cmd_reset,
      rotate: this._cmd_rotate,
    };
  }

  _cmd_seed(data) {
    const seed = data.seed ?? 0;
    this._seed = seed;
    this._channelMgr.seed(seed, {
      channelsRange: data.channelsRange ?? this._channelsRange ?? null,
      eventsRange:   data.eventsRange   ?? this._eventsRange   ?? null,
      anchorsRange:  data.anchorsRange  ?? this._anchorsRange  ?? null,
      pathsRange:    data.pathsRange    ?? this._pathsRange    ?? null,
    });
    this._rebuild();
  }

  _cmd_emit() {
    this._rebuild();
  }

  _cmd_reset() {
    this._channelMgr.reset();
    this._rebuild();
  }

  _cmd_rotate(data) {
    this._sceneMgr.pivot.rotation.x += (data.x ?? 0);
    this._sceneMgr.pivot.rotation.y += (data.y ?? 0);
    this._notifyRotation();
  }

  _notifyRotation() {
    if (this._onRotationChange) {
      const r = this._sceneMgr.pivot.rotation;
      this._onRotationChange(r.x, r.y, r.z);
    }
  }

  _handlePan(dx, dy) {
    const cam = this._sceneMgr.camera;
    const worldPerPixelX = (cam.right - cam.left) / this._container.clientWidth;
    const worldPerPixelY = (cam.top - cam.bottom) / this._container.clientHeight;
    this._panX -= dx * worldPerPixelX;
    this._panY += dy * worldPerPixelY;
    this._applyPan();
    if (this._onPanChange) this._onPanChange(this._panX, this._panY);
  }

  _applyPan() {
    this._sceneMgr.camera.position.x = this._panX;
    this._sceneMgr.camera.position.y = this._panY;
  }

  // ────────────────────────────────────────────
  // INTERNAL — build
  // ────────────────────────────────────────────

  _rebuild() {
    if (this._mesh) {
      this._sceneMgr.pivot.remove(this._mesh.group);
      disposeGroup(this._mesh.group);
    }
    const built = this._buildMesh();
    this._sceneMgr.pivot.add(built.group);
    this._mesh = built;
    this._highlightedSpike = null;
    this._labels.update(this._channelMgr, this._mesh, this._connectionStats);
    if (this._onRebuild) this._onRebuild();
  }

  _buildMesh() {
    const group = new THREE.Group();
    const { spikes, regionStats } = SpikeBuilder.deriveSpikes(this._channelMgr);
    const n = spikes.length;

    if (n === 0) {
      SpikeBuilder.buildGeometry(group, spikes, regionStats, [], [], this._colorScheme);
      return { group, n: 0, regionStats, dirs: [], spikes };
    }

    const { channels, dirs, channelSpikeIndices } = SpikeBuilder.computeLayout(spikes, regionStats);

    SpikeBuilder.buildGeometry(group, spikes, regionStats, dirs, channels, this._colorScheme);

    this._connectionStats = ConnectionBuilder.build(
      group, spikes, dirs, channelSpikeIndices, this._visibleChannels,
    );

    return { group, n, regionStats, dirs, spikes };
  }
}

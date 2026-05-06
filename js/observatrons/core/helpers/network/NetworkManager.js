import * as THREE from 'three';
import { ObservatronChannelManager } from '../../channel-manager.js';
import { SpikeBuilder } from '../spike-builder.js';
import { FacetHeight } from '../../facet-height.js';
import { disposeGroup, OBS_RADIUS } from '../math-utils.js';

const CELL_SPACING = OBS_RADIUS * 4.0 + 0.3; // 2.3 units

const BOX_DEFAULT_COLOR     = 0xcccccc;
const BOX_DEFAULT_OPACITY   = 0.5;
const BOX_HIGHLIGHT_COLOR   = 0x9b87ff;
const BOX_HIGHLIGHT_OPACITY = 0.85;

/**
 * NetworkManager — manages N observatron mesh groups inside the existing pivot.
 * Each node gets its own channel manager, geometry, bounding box, and HTML label.
 */
export class NetworkManager {
  /**
   * @param {object} opts
   * @param {THREE.Group} opts.pivot
   * @param {THREE.Camera} opts.camera
   * @param {object} opts.colorScheme
   * @param {number} opts.baseSeed
   */
  constructor({ pivot, camera, colorScheme, baseSeed }) {
    this._pivot = pivot;
    this._camera = camera;
    this._colorScheme = colorScheme;
    this._baseSeed = baseSeed;

    /** @type {{ group: THREE.Group, box: THREE.LineSegments, label: HTMLDivElement, dirs: THREE.Vector3[], spikes: object[], regionStats: object }[]} */
    this._nodes = [];
    this._gridActive = false;
    this._count = 0;
    this._canvasContainer = null;
    this._selectedIndex = -1;
  }

  set canvasContainer(el) { this._canvasContainer = el; }

  /**
   * Build or remove node groups to reach count `n`.
   * When n === 0 (or 1 from blank-template perspective), disposes everything.
   * @param {number} n
   * @param {object} [ranges] — { channelsRange, eventsRange, anchorsRange, pathsRange }
   */
  setCount(n, ranges = {}) {
    // tear down existing nodes
    this._disposeNodes();

    this._count = n;
    if (n <= 0) return;

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const overlay = document.getElementById('overlay');

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      // center grid at origin
      const x = (col - (cols - 1) / 2) * CELL_SPACING;
      const y = ((rows - 1) / 2 - row) * CELL_SPACING;

      // build channel manager + geometry for this node
      const chMgr = new ObservatronChannelManager({ systemId: '0', observatronId: String(i) });
      chMgr.seed(this._baseSeed + i, {
        channelsRange: ranges.channelsRange ?? null,
        eventsRange:   ranges.eventsRange   ?? null,
        anchorsRange:  ranges.anchorsRange  ?? null,
        pathsRange:    ranges.pathsRange    ?? null,
      });

      const { spikes, regionStats } = SpikeBuilder.deriveSpikes(chMgr);
      const meshGroup = new THREE.Group();

      let nodeDirs = [];
      if (spikes.length > 0) {
        const { channels, dirs, channelSpikeIndices } = SpikeBuilder.computeLayout(spikes, regionStats);
        SpikeBuilder.buildGeometry(meshGroup, spikes, regionStats, dirs, channels, this._colorScheme);
        nodeDirs = dirs;
      } else {
        SpikeBuilder.buildGeometry(meshGroup, spikes, regionStats, [], [], this._colorScheme);
      }

      // wrap in positioned group
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(x, y, 0);
      nodeGroup.add(meshGroup);

      // bounding box (same style as SceneManager.bgCube)
      const BOX_SIZE = OBS_RADIUS * 4.0;
      const cubeGeo = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
      const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
      const box = new THREE.LineSegments(cubeEdges,
        new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 })
      );
      box.visible = this._gridActive && n > 1;
      nodeGroup.add(box);
      cubeGeo.dispose();

      this._pivot.add(nodeGroup);

      // HTML label
      const label = document.createElement('div');
      label.className = 'network-label';
      label.textContent = String(i);
      if (overlay) overlay.appendChild(label);

      this._nodes.push({ group: nodeGroup, box, label, dirs: nodeDirs, spikes, regionStats });
    }
  }

  /** Number of active nodes. */
  get count() { return this._count; }

  /**
   * Resolve spike geometry for a given node and spike index.
   * Returns { direction, base, apex } in world-offset coords, or null.
   */
  getSpikeInfo(nodeId, spikeIndex) {
    const node = this._nodes[nodeId];
    if (!node || !node.dirs || spikeIndex < 0 || spikeIndex >= node.dirs.length) return null;
    const dir = node.dirs[spikeIndex];
    const sp  = node.spikes[spikeIndex];
    const n   = node.spikes.length;
    const baseEdge      = FacetHeight.baseEdge(n, OBS_RADIUS);
    const baseHeightRef = baseEdge * Math.sqrt(2 / 3);
    const hTetra        = FacetHeight.spikeHeight(baseHeightRef, sp.v, OBS_RADIUS);
    // Apply per-node rotation
    const rotDir = dir.clone().applyQuaternion(node.group.quaternion);
    const offset = node.group.position;
    return {
      direction: rotDir,
      base:      rotDir.clone().multiplyScalar(OBS_RADIUS * 1.003).add(offset),
      apex:      rotDir.clone().multiplyScalar(OBS_RADIUS + hTetra).add(offset),
    };
  }

  /**
   * Return the number of spikes on a given node.
   */
  getSpikeCount(nodeId) {
    const node = this._nodes[nodeId];
    return node ? node.spikes.length : 0;
  }

  /** Toggle bounding-box visibility (only shown when count > 1). */
  set gridActive(v) {
    this._gridActive = v;
    for (let i = 0; i < this._nodes.length; i++) {
      const node = this._nodes[i];
      node.box.visible = (v && this._count > 1) || i === this._selectedIndex;
    }
  }

  get gridActive() { return this._gridActive; }

  /** Project each node's position to screen coords and update label positions. */
  updateLabels() {
    for (const node of this._nodes) {
      const pos = new THREE.Vector3();
      node.group.getWorldPosition(pos);
      // offset label to top-left corner of bounding box
      pos.x -= OBS_RADIUS * 2.0;
      pos.y += OBS_RADIUS * 2.0;

      pos.project(this._camera);
      const cw = this._canvasContainer ? this._canvasContainer.clientWidth : innerWidth;
      const ch = this._canvasContainer ? this._canvasContainer.clientHeight : innerHeight;
      const x = (pos.x * 0.5 + 0.5) * cw;
      const y = (-pos.y * 0.5 + 0.5) * ch;
      node.label.style.left = x + 'px';
      node.label.style.top = y + 'px';
      node.label.style.transform = 'translate(0, -100%)';
    }
  }

  /** Returns { worldW, worldH } large enough to fit all nodes. */
  computeViewExtent() {
    if (this._count <= 1) return { worldW: 2.5, worldH: 2.2 };

    const cols = Math.ceil(Math.sqrt(this._count));
    const rows = Math.ceil(this._count / cols);

    const worldW = cols * CELL_SPACING + 1.0;
    const worldH = rows * CELL_SPACING + 1.0;
    return { worldW, worldH };
  }

  /** Return array of node THREE.Group objects. */
  getNodeGroups() { return this._nodes.map(n => n.group); }

  /** Return the index of the node whose group matches the given group, or -1. */
  getNodeIndex(group) { return this._nodes.findIndex(n => n.group === group); }

  /** Reset all node rotations to identity. */
  resetNodeRotations() {
    for (const node of this._nodes) node.group.rotation.set(0, 0, 0);
  }

  /** Highlight a node's bounding box (or unhighlight if index === -1). */
  highlightNode(index) {
    // unhighlight previous
    if (this._selectedIndex >= 0 && this._selectedIndex < this._nodes.length) {
      const prev = this._nodes[this._selectedIndex];
      prev.box.material.color.setHex(BOX_DEFAULT_COLOR);
      prev.box.material.opacity = BOX_DEFAULT_OPACITY;
      prev.box.visible = this._gridActive && this._count > 1;
    }
    this._selectedIndex = index;
    // highlight new
    if (index >= 0 && index < this._nodes.length) {
      const node = this._nodes[index];
      node.box.material.color.setHex(BOX_HIGHLIGHT_COLOR);
      node.box.material.opacity = BOX_HIGHLIGHT_OPACITY;
      node.box.visible = true;
    }
  }

  get selectedIndex() { return this._selectedIndex; }

  /** Clean up all nodes. */
  dispose() {
    this._disposeNodes();
  }

  _disposeNodes() {
    for (const node of this._nodes) {
      this._pivot.remove(node.group);
      disposeGroup(node.group);
      if (node.label.parentNode) node.label.parentNode.removeChild(node.label);
    }
    this._nodes = [];
    this._count = 0;
    this._selectedIndex = -1;
  }
}

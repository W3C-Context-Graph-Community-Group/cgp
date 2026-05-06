import * as THREE              from 'three';
import { Observatron }         from '../../core/observatron.js';
import { ColorScheme }         from './color-scheme.js';
import { ControlPanel }        from './controls/control-panel.js';
import { ZoomControl }         from './controls/zoom/zoom-control.js';
import { PanControl }          from './controls/pan/pan-control.js';
import { SaveImageControl }    from './controls/save-image/save-image-control.js';
import { ColorSchemeControl }  from './controls/color-scheme/color-scheme-control.js';
import { GridControl }         from './controls/grid/grid-control.js';
import { RangeControl }         from './controls/range/range-control.js';
import { RotationControl }     from './controls/rotation/rotation-control.js';
import { CollapsibleCard }     from './controls/collapsible-card.js';
import { ResetControl }        from './controls/reset/reset-control.js';
import { CardToggleControl }   from './controls/card-toggle/card-toggle-control.js';
import { FiberBundleControl }  from './controls/fiber-bundle/fiber-bundle-control.js';
import { StyleControl }        from './controls/style/style-control.js';
import { Draggable }          from './controls/draggable.js';
import { FiberBundleManager } from '../../core/helpers/fiber_bundle/FiberBundleManager.js';
import { LightBallAnimator } from '../../core/helpers/fiber_bundle/helpers/LightBallAnimator.js';
import { NetworkManager }     from '../../core/helpers/network/NetworkManager.js';
import { NetworkControl }     from './controls/network/network-control.js';
import { EventsControl }     from './controls/events/events-control.js';
import { ClaimsControl }     from './controls/claims/claims-control.js';
import { LayersPanel }       from './controls/layers-panel/layers-panel.js';
import { CompareClaims }     from '../../core/helpers/verification/CompareClaims.js';
import { DecisionGate }      from '../../core/helpers/verification/DecisionGate.js';
import { InspectorPanel }   from './controls/inspector/inspector-panel.js';
const scheme = new ColorScheme('default');
const obs = new Observatron(document.getElementById('canvas-wrap'));
obs.colorScheme = scheme;
obs.exec('seed', { seed: 0xC6A107 });

/* ── Inspector panel (right sidebar) ── */
const inspectorPanel = new InspectorPanel({
  onResize: () => {
    obs._sceneMgr.triggerResize();
    fitGridCamera();
    networkMgr.updateLabels();
  },
});
const ipCSS = inspectorPanel.cssURL;
if (!document.querySelector(`link[href="${ipCSS}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ipCSS;
  document.head.appendChild(link);
}
document.body.appendChild(inspectorPanel.mount());

/* ── Layers panel (left sidebar) ── */
let selectedObsIndex = -1;
let selectedSpikeIndex = null;

function selectObservatron(index) {
  selectedObsIndex = index;
  networkMgr.highlightNode(index);
  layersPanel.selectItem(index >= 0 ? String(index) : null);
  // clear spike selection when selecting an observatron
  if (selectedSpikeIndex !== null) {
    obs.clearSpikeHighlight();
    layersPanel.selectSpike(null, null);
    selectedSpikeIndex = null;
    inspectorPanel.clear();
  }
}

function selectSpike(obsId, spikeIndex) {
  const key = `${obsId}:${spikeIndex}`;
  const prevKey = selectedSpikeIndex !== null ? `${obsId}:${selectedSpikeIndex}` : null;
  if (key === prevKey) {
    // deselect
    obs.clearSpikeHighlight();
    layersPanel.selectSpike(null, null);
    selectedSpikeIndex = null;
    inspectorPanel.clear();
  } else {
    obs.clearSpikeHighlight();
    obs.highlightSpike(spikeIndex);
    layersPanel.selectSpike(obsId, spikeIndex);
    selectedSpikeIndex = spikeIndex;
    // show four facets in inspector
    const spikes = obs.spikeData;
    if (spikes[spikeIndex]) {
      const sp = spikes[spikeIndex];
      inspectorPanel.showSpike(sp.col.url, sp.col.facets);
    }
  }
}

/** Build layer entries with spike children for the single-observatron case. */
function buildSingleObsEntries() {
  const spikes = obs.spikeData;
  const spikeEntries = spikes.map((sp, i) => ({
    index: i,
    url: sp.col.url,
  }));
  return [{ id: '0', url: 'cgp:/s/0/o/0', spikes: spikeEntries }];
}

const layersPanel = new LayersPanel({
  onResize: () => {
    obs._sceneMgr.triggerResize();
    fitGridCamera();
    networkMgr.updateLabels();
  },
  onItemClick: (id) => {
    const idx = parseInt(id, 10);
    selectObservatron(idx === selectedObsIndex ? -1 : idx);
  },
  onSpikeClick: (obsId, spikeIndex) => {
    selectSpike(obsId, spikeIndex);
  },
});
// Load CSS and mount
const lpCSS = layersPanel.cssURL;
if (!document.querySelector(`link[href="${lpCSS}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = lpCSS;
  document.head.appendChild(link);
}
document.body.appendChild(layersPanel.mount());
layersPanel.setEntries(buildSingleObsEntries());

// refresh layers panel when observatron rebuilds (filter changes, color scheme, etc.)
obs.onRebuild = () => {
  selectedSpikeIndex = null;
  inspectorPanel.clear();
  if (networkMgr.count <= 0) {
    layersPanel.setEntries(buildSingleObsEntries());
  }
};

const panel = new ControlPanel();

/* ── Tools card ── */
const toolsCard = new CollapsibleCard({ label: 'Tools', id: 'tools', layout: 'row' });
toolsCard.addControl('download', new SaveImageControl({
  onSave: () => obs.saveImage('observatron.png'),
}));

/* ── Grid (dots + box, decoupled) ── */
let dotsActive = false;
let boxActive = false;

const gridScene = new THREE.Scene();
gridScene.background = new THREE.Color(0x0a0a12);

const gridCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
gridCamera.position.set(0, 0, 5);

const GRID_SPACING = 0.1;
const GRID_DOT_PX  = 24;
const GRID_EXTENT  = 8;

(function buildGrid() {
  const verts = [];
  for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SPACING) {
    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_SPACING) {
      verts.push(x, y, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  gridScene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x4a90d9, size: 3, sizeAttenuation: false,
    transparent: true, opacity: 0.35, depthWrite: false,
  })));
})();

function fitGridCamera() {
  const canvasWrap = document.getElementById('canvas-wrap');
  const h = (canvasWrap.clientHeight * GRID_SPACING) / GRID_DOT_PX;
  const w = (canvasWrap.clientWidth  * GRID_SPACING) / GRID_DOT_PX;
  gridCamera.left   = -w / 2;
  gridCamera.right  =  w / 2;
  gridCamera.top    =  h / 2;
  gridCamera.bottom = -h / 2;
  gridCamera.updateProjectionMatrix();
}
fitGridCamera();
addEventListener('resize', fitGridCamera);

const gridCtrl = new GridControl({
  onDotsToggle: (active) => {
    dotsActive = active;
    if (active) {
      obs._sceneMgr.setBgScene(gridScene, gridCamera);
    } else {
      obs._sceneMgr.clearBgScene();
    }
  },
  onBoxToggle: (active) => {
    boxActive = active;
    obs._bgCube.visible = active;
    obs._bgCorner.visible = active;
    networkMgr.gridActive = active;
  },
});

toolsCard.addControl('reset', new ResetControl({
  onReset: () => { zoomCtrl.reset(); panCtrl.reset(); rotCtrl.reset(); networkCtrl.reset(); },
}));

/* ── Card toggle buttons (all start hidden) ── */
const ico16 = 'width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const toggleGrid = new CardToggleControl({
  label: 'Grid',
  icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none"><circle cx="3" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/><circle cx="13" cy="3" r="1.2"/><circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/><circle cx="3" cy="13" r="1.2"/><circle cx="8" cy="13" r="1.2"/><circle cx="13" cy="13" r="1.2"/></svg>`,
  initial: false,
  onToggle: (active) => { gridSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-grid', toggleGrid);
const toggleView = new CardToggleControl({
  label: 'View',
  icon: `<svg ${ico16}><ellipse cx="8" cy="8" rx="6" ry="3.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  initial: false,
  onToggle: (active) => { viewSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-view', toggleView);
const toggleRot = new CardToggleControl({
  label: 'Rot',
  icon: `<svg ${ico16}><path d="M2 8a6 6 0 0110.5-4"/><polyline points="12 1 13 4 10 5"/><path d="M14 8a6 6 0 01-10.5 4"/><polyline points="4 15 3 12 6 11"/></svg>`,
  initial: false,
  onToggle: (active) => { rotSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-rot', toggleRot);
const toggleFilters = new CardToggleControl({
  label: 'Filters',
  icon: `<svg ${ico16}><path d="M2 3h12l-4.5 5v4l-3 1.5V8z"/></svg>`,
  initial: false,
  onToggle: (active) => { filtersSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-filters', toggleFilters);
const toggleColor = new CardToggleControl({
  label: 'Color',
  icon: `<svg ${ico16}><path d="M8 1.5a5.5 5.5 0 00-1 10.9c1 .2 1-.5 1-.9v-.3c0-.6-.4-.8-.8-1-.5-.2-1.1-.4-1.1-1.4A4 4 0 018 3.5a4 4 0 012.9 5.3c0 1-.6 1.2-1.1 1.4-.4.2-.8.4-.8 1v.3c0 .4 0 1.1 1 .9A5.5 5.5 0 008 1.5z"/><circle cx="6" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  initial: false,
  onToggle: (active) => { colorSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-color', toggleColor);
const toggleFiber = new CardToggleControl({
  label: 'Fiber',
  icon: `<svg ${ico16}><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="8" cy="12" r="1.5"/><line x1="5.2" y1="5" x2="7" y2="10.8"/><line x1="10.8" y1="5" x2="9" y2="10.8"/><line x1="5.5" y1="4" x2="10.5" y2="4"/></svg>`,
  initial: false,
  onToggle: (active) => { fiberSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-fiber', toggleFiber);
const toggleStyle = new CardToggleControl({
  label: 'Style',
  icon: `<svg ${ico16}><circle cx="8" cy="8" r="6"/><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>`,
  initial: false,
  onToggle: (active) => { styleSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-style', toggleStyle);
const toggleNet = new CardToggleControl({
  label: 'Net',
  icon: `<svg ${ico16}><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><line x1="5.5" y1="4" x2="10.5" y2="4"/><line x1="4" y1="5.5" x2="4" y2="10.5"/><line x1="12" y1="5.5" x2="12" y2="10.5"/><line x1="5.5" y1="12" x2="10.5" y2="12"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/></svg>`,
  initial: false,
  onToggle: (active) => { networkSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-net', toggleNet);
const toggleEvents = new CardToggleControl({
  label: 'Events',
  icon: `<svg ${ico16}><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="5"/><path d="M13 8h2M1 8h2M8 1v2M8 13v2"/></svg>`,
  initial: false,
  onToggle: (active) => { eventsSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-events', toggleEvents);
const toggleClaims = new CardToggleControl({
  label: 'Claims',
  icon: `<svg ${ico16}><rect x="3" y="2" width="10" height="12" rx="1"/><line x1="5.5" y1="5" x2="10.5" y2="5"/><line x1="5.5" y1="8" x2="10.5" y2="8"/><line x1="5.5" y1="11" x2="8.5" y2="11"/></svg>`,
  initial: false,
  onToggle: (active) => { claimsSection.style.display = active ? '' : 'none'; },
});
toolsCard.addControl('toggle-claims', toggleClaims);

const toolsSection = panel.register(toolsCard);
new Draggable(toolsSection);

/* ── Zoom + Pan card ── */
const zoomCtrl = new ZoomControl({
  onZoom: () => { obs.fitCamera(); obs._updateLabels(); networkMgr.updateLabels(); },
  initial: 1.65,
});
obs.zoomCtrl = zoomCtrl;
obs.fitCamera();

const panCtrl = new PanControl({
  onPan: () => { obs.setPan(panCtrl.valueX, panCtrl.valueY); obs._updateLabels(); networkMgr.updateLabels(); },
});
obs.onPanChange = (x, y) => { panCtrl.update(x, y); networkMgr.updateLabels(); };

const zoomCard = new CollapsibleCard({ label: 'View', id: 'view', onClose: () => toggleView.setActive(false) });
zoomCard.addControl('zoom', zoomCtrl);
zoomCard.addControl('pan', panCtrl);
const viewSection = panel.register(zoomCard);
viewSection.style.display = 'none';
new Draggable(viewSection);

/* ── Grid card ── */
const gridCard = new CollapsibleCard({ label: 'Grid', id: 'grid', onClose: () => toggleGrid.setActive(false) });
gridCard.addControl('grid', gridCtrl);
const gridSection = panel.register(gridCard);
gridSection.style.display = 'none';
new Draggable(gridSection);

/* ── Rotation card ── */
const rotCtrl = new RotationControl({
  onRotate: (axis, radians) => obs.setRotation(axis, radians),
  showTitle: false,
});
obs.onRotationChange = (x, y, z) => { rotCtrl.update(x, y, z); networkMgr.updateLabels(); };

const rotCard = new CollapsibleCard({ label: 'Rotation', id: 'rotation', onClose: () => toggleRot.setActive(false) });
rotCard.addControl('axes', rotCtrl);
const rotSection = panel.register(rotCard);
rotSection.style.display = 'none';
new Draggable(rotSection);

/* ── Filters card ── */
const filtersCard = new CollapsibleCard({ label: 'Filters', id: 'filters', onClose: () => toggleFilters.setActive(false) });
filtersCard.addControl('channels', new RangeControl({
  label: 'Channels',
  onChange: (range) => { obs.channelsRange = range; },
  min: 1, max: 6, initialMin: 1, initialMax: 1,
}));
filtersCard.addControl('events', new RangeControl({
  label: 'Events',
  onChange: (range) => { obs.eventsRange = range; },
  min: 1, max: 10, initialMin: 1, initialMax: 3,
}));
filtersCard.addControl('anchors', new RangeControl({
  label: 'Anchors',
  onChange: (range) => { obs.anchorsRange = range; },
  min: 1, max: 5, initialMin: 1, initialMax: 1,
}));
filtersCard.addControl('paths', new RangeControl({
  label: 'Paths',
  onChange: (range) => { obs.pathsRange = range; },
  min: 1, max: 20, initialMin: 1, initialMax: 5,
}));
filtersCard.addControl('visible-ch', new RangeControl({
  label: 'Visible Ch.',
  onChange: (range) => { obs.visibleChannels = range; },
  min: 0, max: 5, initialMin: 0, initialMax: 0,
}));
const filtersSection = panel.register(filtersCard);
filtersSection.style.display = 'none';
new Draggable(filtersSection);

const colorSection = panel.register(new ColorSchemeControl({
  schemes: ColorScheme.presets,
  initial: 'default',
  onScheme: (name) => scheme.set(name),
}));
colorSection.style.display = 'none';
new Draggable(colorSection);

/* ── Fiber bundles ── */
function resolveEndpoint(nodeId, spikeIndex) {
  if (networkMgr.count <= 0) {
    return obs.getSpikeInfo(spikeIndex);
  }
  return networkMgr.getSpikeInfo(nodeId, spikeIndex);
}

const fiberMgr = new FiberBundleManager({
  pivot: obs._pivot,
  resolveEndpoint,
  observatronAddress: obs.observatronAddress,
});

const animator = new LightBallAnimator({
  pivot: obs._pivot,
  connections: fiberMgr._connections,
  resolveEndpoint,
  onArrival: (connectionId, conn) => {
    CompareClaims.run(connectionId, conn.source, conn.target);
    DecisionGate.run(connectionId, conn.source, conn.target);
  },
});
obs._sceneMgr.onTick(dt => animator.tick(dt));

const fiberCtrl = new FiberBundleControl({
  onToggle: (active) => {
    if (active && fiberCtrl.mode === 'single') {
      fiberCtrl.setSpikeCount(obs.spikeCount);
      fiberMgr.showPairs(0, 0, 1);
    } else if (!active) {
      animator.stopAll();
      fiberMgr.clearAll();
      fiberCtrl.updateConnectionsList([]);
      syncEventsPanel();
    }
  },
  onSlide: (spikeIndex) => {
    if (fiberMgr.pairVisible) fiberMgr.showPairs(0, spikeIndex, fiberCtrl.pairCount);
  },
  onPairsChange: (count) => {
    if (fiberMgr.pairVisible) fiberMgr.showPairs(0, fiberCtrl.spikeIndex, count);
  },
  onAddConnection: (source, target) => {
    fiberMgr.addConnection(source, target);
    fiberCtrl.updateConnectionsList(fiberMgr.connections);
    syncEventsPanel();
  },
  onRemoveConnection: (id) => {
    animator.stopOnConnection(id);
    fiberMgr.removeConnection(id);
    fiberCtrl.updateConnectionsList(fiberMgr.connections);
    syncEventsPanel();
  },
  onAnimateConnection: (id) => animator.toggle(id),
});

const fiberCard = new CollapsibleCard({ label: 'Fiber Bundles', id: 'fiber-bundles', onClose: () => toggleFiber.setActive(false) });
fiberCard.addControl('ring', fiberCtrl);
const fiberSection = panel.register(fiberCard);
fiberSection.style.display = 'none';
new Draggable(fiberSection);

/* ── Events card ── */
const eventsCtrl = new EventsControl({
  onCompare: (ids, duration) => {
    animator.stopAll();
    for (const id of ids) animator.startOnConnection(id, duration);
  },
});

function syncEventsPanel() {
  eventsCtrl.updateConnectionsList(fiberMgr.connections);
}

const eventsCard = new CollapsibleCard({ label: 'Events', id: 'events', onClose: () => toggleEvents.setActive(false) });
eventsCard.addControl('events', eventsCtrl);
const eventsSection = panel.register(eventsCard);
eventsSection.style.display = 'none';
new Draggable(eventsSection);

/* ── Claims card ── */
const claimsCtrl = new ClaimsControl();
const claimsCard = new CollapsibleCard({ label: 'Claims', id: 'claims', onClose: () => toggleClaims.setActive(false) });
claimsCard.addControl('claims', claimsCtrl);
const claimsSection = panel.register(claimsCard);
claimsSection.style.display = 'none';
new Draggable(claimsSection);

/* ── Style card ── */
const styleCtrl = new StyleControl({
  label: 'Facet opacity',
  initial: 90,
  onChange: (opacity) => { obs.facetOpacity = opacity; },
});

const dotRadiusCtrl = new StyleControl({
  label: 'Channel timestamp radius',
  suffix: '%',
  initial: 0,
  onChange: (frac) => { obs.dotScale = 1.0 + frac * 1.5; },
});

const styleCard = new CollapsibleCard({ label: 'Style', id: 'style', onClose: () => toggleStyle.setActive(false) });
styleCard.addControl('facet-opacity', styleCtrl);
styleCard.addControl('dot-radius', dotRadiusCtrl);
const styleSection = panel.register(styleCard);
styleSection.style.display = 'none';
new Draggable(styleSection);

/* ── Network ── */
const networkMgr = new NetworkManager({
  pivot: obs._pivot,
  camera: obs._camera,
  colorScheme: scheme,
  baseSeed: 0xC6A107,
});
networkMgr.canvasContainer = document.getElementById('canvas-wrap');

obs._drag.onNodeClick = (groupOrNull) => {
  if (groupOrNull === null) {
    // clicked empty space → deselect
    selectObservatron(-1);
  } else if (groupOrNull === 'single') {
    // single observatron mode click
    selectObservatron(selectedObsIndex === 0 ? -1 : 0);
  } else {
    // network mode: group is a THREE.Group
    const idx = networkMgr.getNodeIndex(groupOrNull);
    selectObservatron(idx === selectedObsIndex ? -1 : idx);
  }
};

function currentRanges() {
  return {
    channelsRange: obs._channelsRange,
    eventsRange:   obs._eventsRange,
    anchorsRange:  obs._anchorsRange,
    pathsRange:    obs._pathsRange,
  };
}

const networkCtrl = new NetworkControl({
  onChange: (count) => {
    selectObservatron(-1);
    if (count > 1) {
      obs._mesh.group.visible = false;
      obs._bgCube.visible = false;
      obs._bgCorner.visible = false;
      networkMgr.setCount(count, currentRanges());
      networkMgr.gridActive = boxActive;
      obs.viewExtent = networkMgr.computeViewExtent();
      obs.fitCamera();
      networkMgr.updateLabels();
      // Activate per-node drag rotation
      animator.stopAll();
      fiberMgr.clearAll();
      fiberCtrl.updateConnectionsList([]);
      syncEventsPanel();
      obs._drag.setNetworkMode(
        networkMgr.getNodeGroups(),
        (rotatedGroup) => {
          const nodeId = networkMgr.getNodeIndex(rotatedGroup);
          if (nodeId >= 0 && fiberMgr.pairVisible) {
            fiberMgr.refreshConnectionsForNode(nodeId);
            animator.refreshAnimationsForNode(nodeId);
            fiberCtrl.updateConnectionsList(fiberMgr.connections);
            syncEventsPanel();
          }
          networkMgr.updateLabels();
        }
      );
      // Update layers panel for N observatrons (no spike children in network mode for now)
      const entries = [];
      for (let i = 0; i < count; i++) {
        entries.push({ id: String(i), url: `cgp:/s/0/o/${i}`, spikes: [] });
      }
      layersPanel.setEntries(entries);
    } else {
      networkMgr.setCount(0);
      obs._drag.clearNetworkMode();
      obs._mesh.group.visible = true;
      if (boxActive) {
        obs._bgCube.visible = true;
        obs._bgCorner.visible = true;
      }
      obs.viewExtent = { worldW: 2.5, worldH: 2.2 };
      obs.fitCamera();
      layersPanel.setEntries(buildSingleObsEntries());
    }
    // Update fiber bundle mode
    fiberCtrl.setMode(count, (nodeId) => {
      if (count <= 1) return obs.spikeCount;
      return networkMgr.getSpikeCount(nodeId);
    });
    if (count <= 1 && fiberMgr.pairVisible) {
      animator.stopAll();
      fiberMgr.clearAll();
      fiberCtrl.updateConnectionsList([]);
      syncEventsPanel();
    }
  },
});

const networkCard = new CollapsibleCard({ label: 'Network', id: 'network', onClose: () => toggleNet.setActive(false) });
networkCard.addControl('observatrons', networkCtrl);
const networkSection = panel.register(networkCard);
networkSection.style.display = 'none';
new Draggable(networkSection);

addEventListener('resize', () => networkMgr.updateLabels());

/* ── Corner-dot click → animate rotation reset ── */
let resetAnim = null;

const cornerWorld = new THREE.Vector3();
const wrap = document.getElementById('canvas-wrap');

function projectCorner(cx, cy) {
  const h = 1.0;
  cornerWorld.set(-h, h, h);
  obs._bgCorner.localToWorld(cornerWorld);
  const screen = obs._projectToScreen(cornerWorld);
  const dx = cx - screen.x;
  const dy = cy - screen.y;
  return Math.sqrt(dx * dx + dy * dy);
}

let downX = 0, downY = 0;
wrap.addEventListener('mousedown', (e) => { downX = e.clientX; downY = e.clientY; });
wrap.addEventListener('mouseup', (e) => {
  if (!boxActive || !obs._bgCorner.visible) return;
  if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) return;
  if (projectCorner(e.clientX, e.clientY) < 20) animateReset();
});

function animateReset() {
  if (resetAnim) cancelAnimationFrame(resetAnim);
  const r = obs._pivot.rotation;
  r.x = ((r.x % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  r.y = ((r.y % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  r.z = ((r.z % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  function step() {
    r.x *= 0.85;
    r.y *= 0.85;
    r.z *= 0.85;
    rotCtrl.update(r.x, r.y, r.z);
    if (Math.abs(r.x) < 0.001 && Math.abs(r.y) < 0.001 && Math.abs(r.z) < 0.001) {
      r.x = 0; r.y = 0; r.z = 0;
      rotCtrl.update(0, 0, 0);
      resetAnim = null;
      return;
    }
    resetAnim = requestAnimationFrame(step);
  }
  step();
}

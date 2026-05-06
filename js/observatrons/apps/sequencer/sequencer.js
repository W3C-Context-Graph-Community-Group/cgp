import * as THREE from 'three';
import { ControlPanel }    from './controls/control-panel.js';
import { ZoomControl }     from './controls/zoom/zoom-control.js';
import { SaveImageControl } from './controls/save-image/save-image-control.js';
import { LegendControl }    from './controls/legend/legend-control.js';

// ============================================================
// STATE — single source of truth. CGPL-shaped.
// ------------------------------------------------------------
// Everything the renderer shows is derived from STATE.
// Mutations happen only through emitMessageEvent().
// This is the tiny instance of the protocol: the node.
// ============================================================

const STATE = {
  "observatron-1": { "message-events": [] },
  "observatron-2": { "message-events": [] },
};

// deterministic pseudo-random (mulberry32) so initial seed is reproducible
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randIntIn(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

// Build a column object in CGPL shape. Data URL is always present
// (identity of the column). Meaning gets /foo with p=0.5; Structure
// gets /bar with p=0.5. Context stays null for now.
function makeColumn(rand, obsId, msgId, datasetPath, colName) {
  const base = `cgp://${obsId}/events/${msgId}/${datasetPath}#${colName}`;
  const hasMeaning   = rand() < 0.5;
  const hasStructure = rand() < 0.5;
  return {
    name: colName,
    facets: {
      data:      { url: base },
      meaning:   { url: hasMeaning   ? base + "/foo" : null },
      structure: { url: hasStructure ? base + "/bar" : null },
      context:   { url: null },
    },
  };
}

// A single message event: random number of CSVs (1–3), each with
// random number of columns (1–5 here to keep things legible).
function makeMessageEvent(rand, obsId, msgIndex) {
  const msgId = `msg-${String(msgIndex + 1).padStart(3, '0')}`;
  const numCsvs = randIntIn(rand, 1, 3);
  const attachments = [];
  for (let i = 0; i < numCsvs; i++) {
    const datasetPath = `dataset-${i + 1}.csv`;
    const numCols = randIntIn(rand, 1, 5);
    const columns = [];
    for (let k = 0; k < numCols; k++) {
      columns.push(makeColumn(rand, obsId, msgId, datasetPath, `col-${k + 1}`));
    }
    attachments.push({ path: datasetPath, columns });
  }
  return {
    "message-id": msgId,
    timestamp: new Date().toISOString(),
    attachments,
  };
}

// emit a fresh message-event onto an observatron (mutates STATE)
function emitMessageEvent(rand, obsId) {
  const obs = STATE[obsId];
  const idx = obs["message-events"].length;
  obs["message-events"].push(makeMessageEvent(rand, obsId, idx));
}

// seed: 1–3 messages per observatron, each with 1–3 csvs, etc.
function seedState(seed) {
  STATE["observatron-1"]["message-events"] = [];
  STATE["observatron-2"]["message-events"] = [];
  const rand = prng(seed);
  for (const obsId of ["observatron-1", "observatron-2"]) {
    const numMsgs = randIntIn(rand, 1, 3);
    for (let i = 0; i < numMsgs; i++) emitMessageEvent(rand, obsId);
  }
}

// clear both observatrons
function resetState() {
  STATE["observatron-1"]["message-events"] = [];
  STATE["observatron-2"]["message-events"] = [];
}

// ============================================================
// DERIVE — flatten STATE into a list of spikes per observatron,
//          with region IDs and 4-vectors ready for rendering.
// ------------------------------------------------------------
//   spike_i ↔ one column
//   region  ↔ message-event (shared arrival context)
//   v       = [1, meaning?1:0, structure?1:0, context?1:0]
// ============================================================

function deriveSpikes(obsId) {
  const obs = STATE[obsId];
  const spikes = [];
  const regionStats = [];       // per message-event

  obs["message-events"].forEach((ev, regionIdx) => {
    let m = 0, r = 0;
    ev.attachments.forEach(att => {
      att.columns.forEach(col => {
        const f = col.facets;
        const mBit = f.meaning.url   ? 1 : 0;
        const sBit = f.structure.url ? 1 : 0;
        const cBit = f.context.url   ? 1 : 0;
        const v = [1, mBit, sBit, cBit];
        spikes.push({
          region: regionIdx,
          v,
          col,
          messageId: ev["message-id"],
          datasetPath: att.path,
        });
        m += 1;
        r += mBit + sBit + cBit;   // verified registered facets
      });
    });
    regionStats.push({ m, r, n: 3 * m, delta: darkFraction(3 * m, r) });
  });

  return { spikes, regionStats };
}

// dark fraction δ(n, r) = 1 − (1/2ⁿ) · Σ_{k=0..r} C(n,k)
function darkFraction(n, r) {
  if (n <= 0) return 0;
  if (r < 0)  return 1;
  if (r >= n) return 0;
  let q = Math.pow(2, -n);
  let sum = q;
  for (let k = 1; k <= r; k++) {
    q = q * (n - k + 1) / k;
    sum += q;
  }
  return Math.max(0, Math.min(1, 1 - sum));
}

// ============================================================
// RENDER — pure function of STATE → scene
// ============================================================

const OBS_RADIUS = 0.5;
const OBS_POSITIONS = {
  "observatron-1": new THREE.Vector3(-1.6, 0, 0),
  "observatron-2": new THREE.Vector3( 1.6, 0, 0),
};

function colorFromDelta(delta) {
  const d = Math.max(0, Math.min(1, delta));
  return new THREE.Color(d, 0, 1 - d);
}

function vecMag(v) {
  let s = 0; for (const x of v) s += x * x; return Math.sqrt(s);
}

function buildObservatronMesh(obsId) {
  const group = new THREE.Group();
  const { spikes, regionStats } = deriveSpikes(obsId);
  const n = spikes.length;

  // If empty, just draw a dark sphere — an observatron watching but nothing seen yet.
  if (n === 0) {
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(OBS_RADIUS, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0x202035, shininess: 20 })
    ));
    return { group, n: 0, regionStats };
  }

  // spike directions on unit sphere via Fibonacci distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const dirs = [];
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y*y));
    const theta = i * goldenAngle;
    dirs.push(new THREE.Vector3(Math.cos(theta)*r, y, Math.sin(theta)*r));
  }

  // region-colored sphere (Voronoi partition by nearest spike)
  const paletteDelta = regionStats.map(s => colorFromDelta(s.delta));
  const sphereGeo = new THREE.SphereGeometry(OBS_RADIUS * 0.99, 60, 60);
  const pos = sphereGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const L = Math.sqrt(vx*vx + vy*vy + vz*vz);
    const nx = vx/L, ny = vy/L, nz = vz/L;
    let bestDot = -Infinity, bestRegion = 0;
    for (let s = 0; s < n; s++) {
      const d = nx*dirs[s].x + ny*dirs[s].y + nz*dirs[s].z;
      if (d > bestDot) { bestDot = d; bestRegion = spikes[s].region; }
    }
    const c = paletteDelta[bestRegion] || new THREE.Color(0x202035);
    cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
  }
  sphereGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  group.add(new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 20
  })));

  // spikes: one tetrahedron per column
  const baseEdge = 2.8 * OBS_RADIUS / Math.sqrt(n);
  const rBase = baseEdge / Math.sqrt(3);
  const baseHeightRef = baseEdge * Math.sqrt(2 / 3);

  const tmpRef = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v3 = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const normal = dirs[i];
    const sp = spikes[i];
    const mag = vecMag(sp.v);                         // ∈ {1, √2, √3, 2}
    const hTetra = baseHeightRef * mag * 1.15;        // gentle gain so 1 stays visible

    // Spike hue from its own registration state (independent of region δ):
    //  fully unverified (v = [1,0,0,0])  → red
    //  fully verified   (v = [1,1,1,1])  → blue
    const verifiedFrac = (mag*mag - 1) / 3;           // (‖v‖² − 1)/3 ∈ [0,1]
    const spikeColor = new THREE.Color(1 - verifiedFrac, 0.05, verifiedFrac);

    const regionColor = paletteDelta[sp.region] || new THREE.Color(0x202035);

    const basePt = normal.clone().multiplyScalar(OBS_RADIUS * 1.003);
    const apex   = normal.clone().multiplyScalar(OBS_RADIUS + hTetra);

    tmpRef.set(0, 1, 0);
    if (Math.abs(normal.y) > 0.98) tmpRef.set(1, 0, 0);
    u.crossVectors(normal, tmpRef).normalize();
    v3.crossVectors(normal, u).normalize();

    const bv = [];
    for (let k = 0; k < 3; k++) {
      const phi = (2 * Math.PI * k) / 3;
      bv.push(
        basePt.clone()
          .addScaledVector(u, rBase * Math.cos(phi))
          .addScaledVector(v3, rBase * Math.sin(phi))
      );
    }

    // tetrahedron base (region color — matches sphere patch)
    const baseGeom = new THREE.BufferGeometry();
    baseGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      bv[0].x, bv[0].y, bv[0].z,
      bv[2].x, bv[2].y, bv[2].z,
      bv[1].x, bv[1].y, bv[1].z,
    ]), 3));
    baseGeom.computeVertexNormals();
    group.add(new THREE.Mesh(baseGeom, new THREE.MeshPhongMaterial({
      color: regionColor, shininess: 25, flatShading: true
    })));

    // three side faces (spike color)
    const sideGeom = new THREE.BufferGeometry();
    sideGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      bv[0].x, bv[0].y, bv[0].z,  bv[1].x, bv[1].y, bv[1].z,  apex.x, apex.y, apex.z,
      bv[1].x, bv[1].y, bv[1].z,  bv[2].x, bv[2].y, bv[2].z,  apex.x, apex.y, apex.z,
      bv[2].x, bv[2].y, bv[2].z,  bv[0].x, bv[0].y, bv[0].z,  apex.x, apex.y, apex.z,
    ]), 3));
    sideGeom.computeVertexNormals();
    group.add(new THREE.Mesh(sideGeom, new THREE.MeshPhongMaterial({
      color: spikeColor, shininess: 60, flatShading: true
    })));
  }

  return { group, n, regionStats };
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

// ============================================================
// SCENE
// ============================================================

const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.pointerEvents = 'none';
wrap.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(4, 5, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
rim.position.set(-5, -3, 4); scene.add(rim);

const obsPivots = {};
const obsMeshes = {};
const BOX_SIZE = OBS_RADIUS * 3.0;  // fixed cube/square size around each observatron

for (const id of ["observatron-1", "observatron-2"]) {
  const pivot = new THREE.Group();
  pivot.position.copy(OBS_POSITIONS[id]);
  scene.add(pivot);
  obsPivots[id] = pivot;
  obsMeshes[id] = null;

  // 2D background square — fixed in scene (does NOT rotate)
  const squareGeo = new THREE.PlaneGeometry(BOX_SIZE, BOX_SIZE);
  const squareMat = new THREE.MeshBasicMaterial({
    color: 0x9b87ff, transparent: true, opacity: 0.04, side: THREE.DoubleSide,
  });
  const square = new THREE.Mesh(squareGeo, squareMat);
  square.position.copy(OBS_POSITIONS[id]);
  square.position.z = -0.5;  // slightly behind the observatron
  scene.add(square);

  // 2D square border outline — fixed in scene (does NOT rotate)
  const squareEdges = new THREE.EdgesGeometry(squareGeo);
  const squareLine = new THREE.LineSegments(squareEdges,
    new THREE.LineBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.6 })
  );
  squareLine.position.copy(square.position);
  scene.add(squareLine);

  // 3D wireframe cube — inside pivot (rotates with the observatron)
  const cubeGeo = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
  const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
  const cubeLine = new THREE.LineSegments(cubeEdges,
    new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 })
  );
  pivot.add(cubeLine);
  cubeGeo.dispose();
}

function render() {
  for (const id of ["observatron-1", "observatron-2"]) {
    if (obsMeshes[id]) {
      obsPivots[id].remove(obsMeshes[id].group);
      disposeGroup(obsMeshes[id].group);
    }
    const built = buildObservatronMesh(id);
    obsPivots[id].add(built.group);
    obsMeshes[id] = built;
  }
  updateHTMLLabels();
}

// ============================================================
// HTML LABELS — tell the user what they're looking at
// ============================================================
const overlay = document.getElementById('overlay');
const labelEls = {};
const metaEls = {};
for (const id of ["observatron-1", "observatron-2"]) {
  const lbl = document.createElement('div');
  lbl.className = 'obs-label';
  lbl.textContent = id;
  overlay.appendChild(lbl);
  labelEls[id] = lbl;

  const meta = document.createElement('div');
  meta.className = 'obs-meta';
  overlay.appendChild(meta);
  metaEls[id] = meta;
}

function projectToScreen(v3) {
  const p = v3.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * innerWidth,
    y: (1 - (p.y * 0.5 + 0.5)) * innerHeight,
  };
}

function updateHTMLLabels() {
  for (const id of ["observatron-1", "observatron-2"]) {
    const worldPos = OBS_POSITIONS[id].clone();
    const topEdge  = projectToScreen(new THREE.Vector3(worldPos.x, worldPos.y + 0.75, 0));
    const botEdge  = projectToScreen(new THREE.Vector3(worldPos.x, worldPos.y - 0.75, 0));

    const lbl = labelEls[id];
    lbl.style.left = `${topEdge.x - 90}px`;
    lbl.style.top  = `${topEdge.y - 22}px`;
    lbl.style.width = '180px';
    lbl.style.textAlign = 'center';

    // show live counts
    const obs = STATE[id];
    const events = obs["message-events"].length;
    let cols = 0;
    for (const ev of obs["message-events"]) {
      for (const a of ev.attachments) cols += a.columns.length;
    }
    let totalDelta = 0, totM = 0;
    if (obsMeshes[id]) {
      for (const s of obsMeshes[id].regionStats) {
        totalDelta += s.delta * s.m;
        totM += s.m;
      }
    }
    const avgDelta = totM > 0 ? totalDelta / totM : 0;

    const meta = metaEls[id];
    meta.textContent = `${events} events · ${cols} columns · δ̄ ${avgDelta.toFixed(3)}`;
    meta.style.left = `${botEdge.x - 110}px`;
    meta.style.top  = `${botEdge.y + 4}px`;
    meta.style.width = '220px';
    meta.style.textAlign = 'center';
  }
}

// ============================================================
// CAMERA FIT
// ============================================================
let zoomCtrl = null;

function fitCamera() {
  const worldW = 5.0;   // covers both observatrons plus cord with padding
  const worldH = 2.2;
  const aspect = innerWidth / innerHeight;
  let viewW, viewH;
  if (aspect > worldW / worldH) {
    viewH = worldH;
    viewW = viewH * aspect;
  } else {
    viewW = worldW;
    viewH = viewW / aspect;
  }
  // apply zoom
  const z = zoomCtrl ? zoomCtrl.value : 1;
  viewW *= z;
  viewH *= z;

  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
fitCamera();

// ============================================================
// CONTROL PANEL
// ============================================================
const panel = new ControlPanel();

const saveCtrl = new SaveImageControl({
  onSave: () => {
    renderer.render(scene, camera);
    const link = document.createElement('a');
    link.download = 'observatron.png';
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  },
});
const legendCtrl = new LegendControl();
panel.register(legendCtrl);
panel.register(saveCtrl);

zoomCtrl = new ZoomControl({
  onZoom: () => { fitCamera(); updateHTMLLabels(); },
  initial: 2,
});
fitCamera();
panel.register(zoomCtrl);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
  updateHTMLLabels();
});


// ============================================================
// INIT
// ============================================================
seedState(0xC6A107);   // deterministic initial demo
render();

// ============================================================
// FIBER BUNDLE — cross-observatron, 4 strands with parallel-
// transported frame (Bishop rotation-minimizing frame).
// ------------------------------------------------------------
// Base space  : {observatron-1, observatron-2}, each an S²
// Fiber       : ℝ⁴ (D, M, S, C) rendered as 4 strands offset
//               around the cord axis
// Connection  : Bishop frame along the cord curve.
//               Attachment frame at each endpoint is pinned to
//               the spike's tetrahedron-face orientation, so
//               rotating the observatron carries the frame with
//               it (horizontal lift). The frame is then parallel-
//               transported along the cord; holonomy appears as
//               a smooth twist in the 4 strands, never a tangle.
// Structure   : one bundle from observatron-1 spike[0] to
//               observatron-2 spike[0]. Extends to N bundles
//               without changing the math.
// ============================================================

const fiberGroup = new THREE.Group();
scene.add(fiberGroup);

const CORD_RADIUS      = 0.04;   // radial offset of strands from cord axis
const CORD_SAMPLES     = 48;     // samples along the cord curve
const STRAND_SEGMENTS  = 8;      // tube radial resolution

// Facet colors: D = yellow (binding), M = blue, S = green, C = orange-red
const FACET_COLORS = [
  new THREE.Color(0xffcc55),  // Data
  new THREE.Color(0x66a8ff),  // Meaning
  new THREE.Color(0x5fd37f),  // Structure
  new THREE.Color(0xff7a5c),  // Context
];

// Where on a spike does the fiber attach, and in what frame?
// We return: attach point (world), face normal (world), and
// a tangent basis (u, v) in the face plane. The 4 strands sit
// at angles 0°, 90°, 180°, 270° in that basis.
function spikeAttachmentFrame(obsId, spikeIndex) {
  const mesh = obsMeshes[obsId];
  if (!mesh || mesh.n === 0 || spikeIndex >= mesh.n) return null;

  // recompute spike direction deterministically from index
  const n = mesh.n;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = n === 1 ? 0 : 1 - (spikeIndex / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y*y));
  const theta = spikeIndex * goldenAngle;
  const nLocal = new THREE.Vector3(Math.cos(theta)*r, y, Math.sin(theta)*r).normalize();

  // attach a bit above the apex — the tip of the tetrahedron
  const pivot = obsPivots[obsId];
  pivot.updateMatrixWorld(true);

  // spike apex height for this observatron
  const baseEdge = 2.8 * OBS_RADIUS / Math.sqrt(n);
  const baseHeightRef = baseEdge * Math.sqrt(2 / 3);
  const spikes = deriveSpikes(obsId).spikes;
  const mag = vecMag(spikes[spikeIndex].v);
  const hTetra = baseHeightRef * mag * 1.15;
  const apexLocal = nLocal.clone().multiplyScalar(OBS_RADIUS + hTetra);

  // face normal (local) — the cord leaves along the outward radial
  const normalLocal = nLocal.clone();

  // tangent basis in the plane perpendicular to the face normal
  const refLocal = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normalLocal.y) > 0.98) refLocal.set(1, 0, 0);
  const uLocal = new THREE.Vector3().crossVectors(normalLocal, refLocal).normalize();
  const vLocal = new THREE.Vector3().crossVectors(normalLocal, uLocal).normalize();

  // transform to world via pivot rotation
  const M = pivot.matrixWorld;
  const apexWorld   = apexLocal.clone().applyMatrix4(M);
  const normalWorld = normalLocal.clone().transformDirection(M).normalize();
  const uWorld      = uLocal.clone().transformDirection(M).normalize();
  const vWorld      = vLocal.clone().transformDirection(M).normalize();

  return { point: apexWorld, normal: normalWorld, u: uWorld, v: vWorld };
}

// Cubic Bezier tangent-aware curve between the two attachments.
// Departure direction at each end equals the face normal (the
// natural boundary condition for the connection).
function cordCurve(a, b) {
  const dist = a.point.distanceTo(b.point);
  const handle = dist * 0.45;
  const p0 = a.point.clone();
  const p1 = a.point.clone().addScaledVector(a.normal, handle);
  const p2 = b.point.clone().addScaledVector(b.normal, handle);
  const p3 = b.point.clone();
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
}

// Bishop frame: parallel-transport an initial frame along a
// curve's samples. At each step, rotate the previous frame by
// the minimal rotation that aligns its tangent with the current
// tangent — yields a rotation-minimizing, twist-free transport.
// This is the correct parallel transport for curves in ℝ³.
function bishopFrames(curve, samples, startU, startV) {
  const pts   = new Array(samples);
  const tans  = new Array(samples);
  const us    = new Array(samples);
  const vs    = new Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    pts[i]  = curve.getPoint(t);
    tans[i] = curve.getTangent(t).normalize();
  }

  // initial frame at t=0: ensure startU ⟂ tangent[0]
  let u0 = startU.clone();
  u0.addScaledVector(tans[0], -u0.dot(tans[0])).normalize();
  let v0 = new THREE.Vector3().crossVectors(tans[0], u0).normalize();
  us[0] = u0; vs[0] = v0;

  for (let i = 1; i < samples; i++) {
    const T0 = tans[i - 1];
    const T1 = tans[i];
    const axis = new THREE.Vector3().crossVectors(T0, T1);
    const axisLen = axis.length();
    if (axisLen < 1e-8) {
      us[i] = us[i - 1].clone();
      vs[i] = vs[i - 1].clone();
    } else {
      axis.divideScalar(axisLen);
      const angle = Math.atan2(axisLen, T0.dot(T1));
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      us[i] = us[i - 1].clone().applyQuaternion(q).normalize();
      vs[i] = vs[i - 1].clone().applyQuaternion(q).normalize();
    }
  }
  return { pts, tans, us, vs };
}

// Generate a strand: a tube along the cord at angular position
// phi in the transported (u,v) frame. The strand is offset by
// CORD_RADIUS perpendicular to the cord axis.
function buildStrand(frame, phi, color) {
  const pts = [];
  const cos = Math.cos(phi), sin = Math.sin(phi);
  for (let i = 0; i < frame.pts.length; i++) {
    const p = frame.pts[i].clone()
      .addScaledVector(frame.us[i], CORD_RADIUS * cos)
      .addScaledVector(frame.vs[i], CORD_RADIUS * sin);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom  = new THREE.TubeGeometry(curve, CORD_SAMPLES, CORD_RADIUS * 0.25, STRAND_SEGMENTS, false);
  const mat   = new THREE.MeshPhongMaterial({ color, shininess: 60, flatShading: false });
  return new THREE.Mesh(geom, mat);
}

// interpolate endpoint attachment frame (u_A, v_A) parallel-
// transported to endpoint B. If the observatron hasn't been
// rotated at all, both endpoints have aligned frames; rotating
// either one produces holonomy = twist in the strand arrangement.
function addFiberBundle(aFrame, bFrame) {
  const curve = cordCurve(aFrame, bFrame);
  const frame = bishopFrames(curve, CORD_SAMPLES, aFrame.u, aFrame.v);

  // bF is the transported frame at the final sample;
  // compare to the intrinsic frame at B to detect holonomy.
  // We DO NOT rotate strands back to B's native frame — that
  // would hide the holonomy. Instead we leave strands in the
  // parallel-transported frame: the twist IS the point.

  for (let s = 0; s < 4; s++) {
    const phi = (s / 4) * 2 * Math.PI;
    fiberGroup.add(buildStrand(frame, phi, FACET_COLORS[s]));
  }

  // debug rings at endpoints so attachment points are visible
  const ringA = new THREE.Mesh(
    new THREE.TorusGeometry(CORD_RADIUS * 1.4, CORD_RADIUS * 0.18, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  ringA.position.copy(aFrame.point);
  ringA.lookAt(aFrame.point.clone().add(aFrame.normal));
  fiberGroup.add(ringA);

  const ringB = new THREE.Mesh(
    new THREE.TorusGeometry(CORD_RADIUS * 1.4, CORD_RADIUS * 0.18, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  ringB.position.copy(bFrame.point);
  ringB.lookAt(bFrame.point.clone().add(bFrame.normal));
  fiberGroup.add(ringB);
}

function rebuildFiberBundle() {
  // clear previous fibers
  fiberGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  fiberGroup.clear();

  const a = spikeAttachmentFrame("observatron-1", 0);
  const b = spikeAttachmentFrame("observatron-2", 0);
  if (!a || !b) return;
  addFiberBundle(a, b);
}

// ============================================================
// THUMB-DRAG ROTATION PER OBSERVATRON
// ------------------------------------------------------------
// Tap-drag on an observatron rotates only that one. A raycast
// hits either observatron's sphere; whichever is hit becomes the
// drag target. Releasing ends the drag.
// ============================================================

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let dragTarget = null;             // "observatron-1" | "observatron-2" | null
let lastPointer = { x: 0, y: 0 };
// velocity for a tiny bit of kinetic feel
const angularVel = { "observatron-1": { x: 0, y: 0 }, "observatron-2": { x: 0, y: 0 } };

function setPointerNDC(clientX, clientY) {
  pointerNDC.x = (clientX / innerWidth)  * 2 - 1;
  pointerNDC.y = -(clientY / innerHeight) * 2 + 1;
}

function pickObservatron(clientX, clientY) {
  setPointerNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  // intersect each observatron group
  for (const id of ["observatron-1", "observatron-2"]) {
    const hits = raycaster.intersectObject(obsPivots[id], true);
    if (hits.length > 0) return id;
  }
  return null;
}

function onPointerDown(clientX, clientY) {
  const id = pickObservatron(clientX, clientY);
  if (id) {
    dragTarget = id;
    lastPointer.x = clientX;
    lastPointer.y = clientY;
  }
}
function onPointerMove(clientX, clientY) {
  if (!dragTarget) return;
  const dx = clientX - lastPointer.x;
  const dy = clientY - lastPointer.y;
  lastPointer.x = clientX;
  lastPointer.y = clientY;
  const pivot = obsPivots[dragTarget];
  // screen-aligned rotation
  const speed = 0.008;
  pivot.rotation.y += dx * speed;
  pivot.rotation.x += dy * speed;
  angularVel[dragTarget].y = dx * speed;
  angularVel[dragTarget].x = dy * speed;
}
function onPointerUp() {
  dragTarget = null;
}

// mouse — attach to wrap (div), not canvas, so right-click shows normal browser menu
wrap.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  onPointerDown(e.clientX, e.clientY);
});
addEventListener('mousemove', e => onPointerMove(e.clientX, e.clientY));
addEventListener('mouseup', onPointerUp);

// touch (single finger; ignore multi-touch so we don't fight pinch)
wrap.addEventListener('touchstart', e => {
  if (e.touches.length === 1) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
wrap.addEventListener('touchmove', e => {
  if (e.touches.length === 1) {
    onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();  // block page scroll while rotating
  }
}, { passive: false });
wrap.addEventListener('touchend', onPointerUp);
wrap.addEventListener('touchcancel', onPointerUp);

// No auto-spin. Observatrons rotate only via thumb drag.
// Fiber bundle is rebuilt every frame so it tracks endpoint rotations
// via parallel-transported frames (Bishop rotation-minimizing frame).
function loop() {
  requestAnimationFrame(loop);
  rebuildFiberBundle();
  renderer.render(scene, camera);
}
loop();

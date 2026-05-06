import * as THREE from 'three';
import { OBS_RADIUS } from './math-utils.js';

/**
 * Manages the THREE.js scene, camera, renderer, lighting, pivot,
 * wireframe cube, corner marker, resize handling, and animation loop.
 */
export class SceneManager {
  constructor(containerEl) {
    this._container = containerEl;

    // ── scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    this.renderer.domElement.style.pointerEvents = 'none';
    containerEl.appendChild(this.renderer.domElement);

    // ── lights ──
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 5, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(-5, -3, 4);
    this.scene.add(rim);

    // ── pivot ──
    this.pivot = new THREE.Group();
    this.pivot.position.set(0, 0, 0);
    this.scene.add(this.pivot);

    // ── wireframe cube + corner marker ──
    const BOX_SIZE = OBS_RADIUS * 4.0;
    const cubeGeo = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
    this.bgCube = new THREE.LineSegments(cubeEdges,
      new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 })
    );
    this.bgCube.visible = false;
    this.pivot.add(this.bgCube);
    cubeGeo.dispose();

    const h = BOX_SIZE / 2;
    const markerGeo = new THREE.BufferGeometry();
    markerGeo.setAttribute('position', new THREE.Float32BufferAttribute([-h, h, h], 3));
    this.bgCorner = new THREE.Points(markerGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 6, sizeAttenuation: false,
    }));
    this.bgCorner.visible = false;
    this.pivot.add(this.bgCorner);

    // ── view extent overrides ──
    this._worldW = null;
    this._worldH = null;

    // ── zoom reference ──
    this._zoomCtrl = null;

    // ── resize ──
    this._onResize = null;
    this._boundResize = () => {
      this.renderer.setSize(this._container.clientWidth, this._container.clientHeight);
      this.fitCamera();
      if (this._onResize) this._onResize();
    };
    addEventListener('resize', this._boundResize);

    // ── tick callbacks ──
    this._tickCallbacks = [];
    this._prevTime = performance.now();

    // ── background scene (grid, etc.) ──
    this._bgScene = null;
    this._bgCamera = null;

    // ── animation loop ──
    this._running = true;
    this._loop();

    this.fitCamera();
  }

  set zoomCtrl(ctrl) { this._zoomCtrl = ctrl; }
  set onResize(fn) { this._onResize = fn; }
  set viewExtent({ worldW, worldH }) { this._worldW = worldW; this._worldH = worldH; }

  /** Programmatically trigger a resize (e.g. when the container changes size). */
  triggerResize() { this._boundResize(); }

  /** Set a background scene rendered before the main scene with its own camera. */
  setBgScene(scene, camera) { this._bgScene = scene; this._bgCamera = camera; }
  clearBgScene() { this._bgScene = null; this._bgCamera = null; }

  onTick(fn) {
    this._tickCallbacks.push(fn);
    return () => { this._tickCallbacks = this._tickCallbacks.filter(f => f !== fn); };
  }

  fitCamera() {
    const worldW = this._worldW ?? 2.5;
    const worldH = this._worldH ?? 2.2;
    const aspect = this._container.clientWidth / this._container.clientHeight;
    let viewW, viewH;
    if (aspect > worldW / worldH) {
      viewH = worldH;
      viewW = viewH * aspect;
    } else {
      viewW = worldW;
      viewH = viewW / aspect;
    }
    const z = this._zoomCtrl ? this._zoomCtrl.value : 1;
    viewW *= z;
    viewH *= z;

    this.camera.left   = -viewW / 2;
    this.camera.right  =  viewW / 2;
    this.camera.top    =  viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    const dt = (now - this._prevTime) / 1000;
    this._prevTime = now;
    for (const fn of this._tickCallbacks) fn(dt);
    if (this._bgScene && this._bgCamera) {
      this.renderer.autoClear = true;
      this.renderer.render(this._bgScene, this._bgCamera);
      const savedBg = this.scene.background;
      this.scene.background = null;
      this.renderer.autoClear = false;
      this.renderer.render(this.scene, this.camera);
      this.scene.background = savedBg;
      this.renderer.autoClear = true;
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this._running = false;
    removeEventListener('resize', this._boundResize);
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

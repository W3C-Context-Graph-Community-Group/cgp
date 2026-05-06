import * as THREE from 'three';

/**
 * Handles mouse and touch drag-to-rotate interaction on the pivot group.
 * Supports spacebar + drag for panning.
 */
export class DragHandler {
  /**
   * @param {HTMLElement} container — the element to listen on
   * @param {THREE.Group} pivot — the group to rotate
   * @param {THREE.Camera} camera — used for raycasting
   * @param {function} onRotation — called after each drag move
   * @param {function} [onPan] — called with (dx, dy) pixel deltas during pan
   */
  constructor(container, pivot, camera, onRotation, onPan) {
    this._container = container;
    this._pivot = pivot;
    this._camera = camera;
    this._onRotation = onRotation;
    this._onPan = onPan || null;

    this._dragActive = false;
    this._panActive = false;
    this._spaceDown = false;
    this._lastPointer = { x: 0, y: 0 };

    this._networkMode = false;
    this._nodeGroups = null;       // THREE.Group[]
    this._onNodeRotation = null;   // (group) => void
    this._activeNode = null;       // the group being dragged
    this._onNodeClick = null;      // (groupOrNull) => void
    this._downX = 0;
    this._downY = 0;

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();

    const setNDC = (cx, cy) => {
      const rect = this._container.getBoundingClientRect();
      pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
    };

    const pick = (cx, cy) => {
      setNDC(cx, cy);
      raycaster.setFromCamera(pointerNDC, this._camera);
      return raycaster.intersectObject(this._pivot, true).length > 0;
    };

    const onDown = (cx, cy) => {
      this._downX = cx;
      this._downY = cy;
      // spacebar held → start pan (no raycasting needed)
      if (this._spaceDown && this._onPan) {
        this._panActive = true;
        this._lastPointer.x = cx;
        this._lastPointer.y = cy;
        this._container.style.cursor = 'grabbing';
        return;
      }
      if (this._networkMode && this._nodeGroups) {
        setNDC(cx, cy);
        raycaster.setFromCamera(pointerNDC, this._camera);
        const hits = raycaster.intersectObjects(this._nodeGroups, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !this._nodeGroups.includes(obj)) obj = obj.parent;
          if (obj) {
            this._activeNode = obj;
            this._dragActive = true;
            this._lastPointer.x = cx;
            this._lastPointer.y = cy;
          }
        }
        return;
      }
      if (pick(cx, cy)) {
        this._dragActive = true;
        this._lastPointer.x = cx;
        this._lastPointer.y = cy;
      }
    };

    const onMove = (cx, cy, shiftKey = false) => {
      if (this._panActive) {
        const dx = cx - this._lastPointer.x;
        const dy = cy - this._lastPointer.y;
        this._lastPointer.x = cx;
        this._lastPointer.y = cy;
        this._onPan(dx, dy);
        return;
      }
      if (!this._dragActive) return;
      const dx = cx - this._lastPointer.x;
      const dy = cy - this._lastPointer.y;
      this._lastPointer.x = cx;
      this._lastPointer.y = cy;
      const speed = 0.008;
      if (this._networkMode && this._activeNode) {
        if (shiftKey) {
          this._activeNode.rotation.z += dx * speed;
        } else {
          this._activeNode.rotation.y += dx * speed;
          this._activeNode.rotation.x += dy * speed;
        }
        if (this._onNodeRotation) this._onNodeRotation(this._activeNode);
      } else {
        if (shiftKey) {
          this._pivot.rotation.z += dx * speed;
        } else {
          this._pivot.rotation.y += dx * speed;
          this._pivot.rotation.x += dy * speed;
        }
        this._onRotation();
      }
    };

    const onUp = (cx, cy) => {
      const wasNode = this._activeNode;
      this._dragActive = false;
      this._activeNode = null;
      if (this._panActive) {
        this._panActive = false;
        this._container.style.cursor = this._spaceDown ? 'grab' : '';
        return;
      }
      // detect click (movement < 6px)
      if (this._onNodeClick) {
        const dx = cx - this._downX;
        const dy = cy - this._downY;
        if (Math.sqrt(dx * dx + dy * dy) < 6) {
          if (this._networkMode && this._nodeGroups) {
            this._onNodeClick(wasNode || null);
          } else {
            // single observatron mode
            if (pick(cx, cy)) {
              this._onNodeClick('single');
            } else {
              this._onNodeClick(null);
            }
          }
        }
      }
    };

    // spacebar tracking
    this._boundKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        this._spaceDown = true;
        this._container.style.cursor = 'grab';
      }
    };
    this._boundKeyUp = (e) => {
      if (e.code === 'Space') {
        this._spaceDown = false;
        this._container.style.cursor = '';
        if (this._panActive) {
          this._panActive = false;
        }
      }
    };
    addEventListener('keydown', this._boundKeyDown);
    addEventListener('keyup', this._boundKeyUp);

    // mouse
    this._boundMouseDown = (e) => { if (e.button === 0) onDown(e.clientX, e.clientY); };
    this._boundMouseMove = (e) => onMove(e.clientX, e.clientY, e.shiftKey);
    this._boundMouseUp   = (e) => onUp(e.clientX, e.clientY);
    container.addEventListener('mousedown', this._boundMouseDown);
    addEventListener('mousemove', this._boundMouseMove);
    addEventListener('mouseup', this._boundMouseUp);

    // touch
    this._boundTouchStart = (e) => {
      if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
    };
    this._boundTouchMove = (e) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    };
    this._boundTouchEnd = (e) => {
      const t = e.changedTouches?.[0];
      onUp(t ? t.clientX : this._downX, t ? t.clientY : this._downY);
    };
    container.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    container.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    container.addEventListener('touchend', this._boundTouchEnd);
    container.addEventListener('touchcancel', this._boundTouchEnd);
  }

  setNetworkMode(nodeGroups, onNodeRotation) {
    this._networkMode = true;
    this._nodeGroups = nodeGroups;
    this._onNodeRotation = onNodeRotation;
    this._activeNode = null;
  }

  clearNetworkMode() {
    this._networkMode = false;
    this._nodeGroups = null;
    this._onNodeRotation = null;
    this._activeNode = null;
  }

  set onNodeClick(fn) { this._onNodeClick = fn; }

  dispose() {
    removeEventListener('keydown', this._boundKeyDown);
    removeEventListener('keyup', this._boundKeyUp);
    this._container.removeEventListener('mousedown', this._boundMouseDown);
    removeEventListener('mousemove', this._boundMouseMove);
    removeEventListener('mouseup', this._boundMouseUp);
    this._container.removeEventListener('touchstart', this._boundTouchStart);
    this._container.removeEventListener('touchmove', this._boundTouchMove);
    this._container.removeEventListener('touchend', this._boundTouchEnd);
    this._container.removeEventListener('touchcancel', this._boundTouchEnd);
    this._container.style.cursor = '';
  }
}

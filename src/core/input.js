export class Input {
  constructor(canvas, overlayElement) {
    this.canvas = canvas;
    this.overlayElement = overlayElement;
    this.pointerLocked = false;
    this.pointerLockEnabled = true;
    this.keysDown = new Set();
    this.pressedKeys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.errorLabel = document.getElementById('overlayError');
    this.overlaySuppressed = false;

    this.handlePointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.overlayElement) {
        const visible = this.pointerLocked ? false : !this.overlaySuppressed;
        this.overlayElement.style.display = visible ? 'grid' : 'none';
      }
      if (this.pointerLocked && this.errorLabel) {
        this.errorLabel.textContent = '';
      }
    };

    this.handlePointerLockError = (err) => {
      console.warn('Pointer lock error', err);
      this.pointerLocked = false;
      if (this.overlayElement) {
        this.overlayElement.style.display = 'grid';
      }
      if (this.errorLabel) {
        this.errorLabel.textContent = 'Pointer lock blocked. Click the canvas or try again.';
      }
    };

    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      if (!e.repeat) {
        this.pressedKeys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    window.addEventListener('mousedown', () => {
      if (!this.pointerLocked && this.pointerLockEnabled) {
        this.requestPointerLock();
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  attachStartButton(button) {
    if (!button) return;
    button.addEventListener('click', () => this.requestPointerLock());
  }

  requestPointerLock() {
    if (document.pointerLockElement === this.canvas) return;
    // Ensure the canvas can focus for pointer lock on some browsers
    if (typeof this.canvas.focus === 'function') {
      this.canvas.focus();
    }
    const req = this.canvas.requestPointerLock();
    if (req && typeof req.catch === 'function') {
      req.catch((err) => this.handlePointerLockError(err));
    }
  }

  consumePressed(code) {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      return true;
    }
    return false;
  }

  getLookDelta() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  isDown(code) {
    return this.keysDown.has(code);
  }

  setOverlaySuppressed(suppressed) {
    this.overlaySuppressed = suppressed;
    if (this.overlayElement && !this.pointerLocked) {
      this.overlayElement.style.display = suppressed ? 'none' : 'grid';
    }
  }

  getMovement2D() {
    const forward = (this.isDown('KeyS') ? 1 : 0) + (this.isDown('ArrowUp') ? 1 : 0) - (this.isDown('KeyW') ? 1 : 0) - (this.isDown('ArrowDown') ? 1 : 0);
    const strafe = (this.isDown('KeyD') ? 1 : 0) + (this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0) - (this.isDown('ArrowLeft') ? 1 : 0);
    return { forward, strafe };
  }

  setPointerLockEnabled(enabled) {
    this.pointerLockEnabled = enabled;
  }
}

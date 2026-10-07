// Keyboard + mouse input with pointer lock (and a fallback when the page is
// embedded somewhere that forbids pointer lock).

export const DEFAULT_BINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA'],
  right: ['KeyD'],
  turnLeft: ['ArrowLeft'],
  turnRight: ['ArrowRight'],
  jump: ['Space'],
  crouch: ['KeyC', 'AltLeft'],
  walk: ['ShiftLeft', 'ShiftRight'],
  use: ['KeyE'],
  reload: ['KeyR'],
  flashlight: ['KeyF'],
  kick: ['KeyQ', 'Mouse1'],
  grenade: ['KeyG'],
  view: ['KeyV'],
  attack: ['Mouse0'],
  attack2: ['Mouse2'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  nextWeapon: ['WheelDown', 'BracketRight'],
  prevWeapon: ['WheelUp', 'BracketLeft'],
  quicksave: ['F5'],
  quickload: ['F9'],
  pause: ['Escape', 'KeyP'],
  console: ['Backquote'],
  objectives: ['Tab'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mx = 0;
    this.my = 0;
    this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    this.locked = false;
    this.lockFailed = false;
    this.enabled = false; // game captures input only while playing
    this.textCapture = null; // console input callback
    this.onLockChange = null;
    this.sensitivity = 1;
    this.invertY = false;

    window.addEventListener('keydown', (e) => {
      if (this.textCapture) {
        this.textCapture(e);
        return;
      }
      if (e.code === 'Tab' || e.code === 'F5' || e.code === 'F9' || e.code === 'Space' || (e.code.startsWith('Arrow') && this.enabled)) e.preventDefault();
      if (e.ctrlKey && this.enabled && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyD')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      const c = 'Mouse' + e.button;
      if (!this.down.has(c)) this.pressed.add(c);
      this.down.add(c);
      if (this.enabled && !this.locked && !this.lockFailed) this.requestLock();
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      const c = 'Mouse' + e.button;
      this.down.delete(c);
      this.released.add(c);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.lockFailed) {
        this.mx += e.movementX || 0;
        this.my += e.movementY || 0;
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        const c = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
        this.pressed.add(c);
      },
      { passive: true }
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockFailed = true;
      this.canvas.style.cursor = 'none';
      if (this.onLockChange) this.onLockChange(false, true);
    });
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false });
      if (p && p.catch) p.catch(() => {
        try {
          const p2 = this.canvas.requestPointerLock();
          if (p2 && p2.catch) p2.catch(() => { this.lockFailed = true; this.canvas.style.cursor = 'none'; });
        } catch (e) {
          this.lockFailed = true;
        }
      });
    } catch (e) {
      this.lockFailed = true;
      this.canvas.style.cursor = 'none';
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  is(action) {
    const b = this.binds[action];
    if (!b) return false;
    for (const c of b) if (this.down.has(c)) return true;
    return false;
  }
  hit(action) {
    const b = this.binds[action];
    if (!b) return false;
    for (const c of b) if (this.pressed.has(c)) return true;
    return false;
  }
  up(action) {
    const b = this.binds[action];
    if (!b) return false;
    for (const c of b) if (this.released.has(c)) return true;
    return false;
  }
  consumeMouse() {
    const k = 0.0022 * this.sensitivity;
    const dx = this.mx * k, dy = this.my * k * (this.invertY ? -1 : 1);
    this.mx = 0;
    this.my = 0;
    return [dx, dy];
  }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
  clear() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
    this.mx = this.my = 0;
  }
}

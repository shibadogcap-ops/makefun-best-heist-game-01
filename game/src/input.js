// Keyboard and pointer input for MIDNIGHT VAULT. Held keys (WASD/arrows, Shift) steer
// the thief; one-shot presses (vent, toss, EMP, menu keys) go into a pressed-set. The
// edge getters (vent, tossClicked, emp) consume their flag on read so a press fires on
// exactly one simulation step; main clears whatever is left each frame with endFrame().
import { WORLD } from './config.js';

const HELD_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
};

const EDGE_KEYS = {
  KeyE: 'vent', KeyV: 'vent',
  KeyQ: 'toss',
  KeyF: 'emp',
  Enter: 'start', Space: 'start',
  KeyR: 'restart',
  KeyP: 'pause', Escape: 'pause',
  KeyH: 'help',
};

export function createInput(canvas) {
  const pressed = new Set();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    mouseX: WORLD.width / 2,
    mouseY: WORLD.height / 2,
    anyKey: false,
    get vent() { return take('vent'); },
    get tossClicked() { return take('toss'); },
    get emp() { return take('emp'); },
    wasPressed(name) { return pressed.has(name); },
    endFrame() {
      pressed.clear();
      input.anyKey = false;
    },
  };

  function take(name) {
    if (!pressed.has(name)) return false;
    pressed.delete(name);
    return true;
  }

  function toWorld(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * WORLD.width;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * WORLD.height;
  }

  window.addEventListener('keydown', (event) => {
    input.anyKey = true;
    const held = HELD_KEYS[event.code];
    if (held) {
      input[held] = true;
      event.preventDefault();
      return;
    }
    const edge = EDGE_KEYS[event.code];
    if (edge) {
      if (!event.repeat) pressed.add(edge);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const held = HELD_KEYS[event.code];
    if (held) input[held] = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.sneak = false;
  });

  canvas.addEventListener('pointermove', toWorld);
  canvas.addEventListener('pointerdown', (event) => {
    toWorld(event);
    if (event.button === 0) {
      pressed.add('toss');
      pressed.add('start');
      input.anyKey = true;
    }
  });

  return input;
}

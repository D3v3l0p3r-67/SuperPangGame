// Unified input state: keyboard and touch/pointer controls both write into
// the same plain object, so game.js never needs to know which one is used.

export const input = {
  left: false,
  right: false,
  shoot: false,
  pause: false,
};

let pauseWasDown = false;

export function consumePausePressed() {
  const justPressed = input.pause && !pauseWasDown;
  pauseWasDown = input.pause;
  return justPressed;
}

const KEY_MAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'shoot',
  ArrowUp: 'shoot',
  KeyW: 'shoot',
  Escape: 'pause',
  KeyP: 'pause',
};

function setKey(code, value) {
  const action = KEY_MAP[code];
  if (!action) return false;
  input[action] = value;
  return true;
}

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (setKey(e.code, true)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (setKey(e.code, false)) e.preventDefault();
  });
  window.addEventListener('blur', () => {
    input.left = false;
    input.right = false;
    input.shoot = false;
    input.pause = false;
  });
}

function bindTouchButton(id, action, { pulse = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const press = (e) => {
    e.preventDefault();
    input[action] = true;
    if (pulse) requestAnimationFrame(() => { input[action] = false; });
  };
  const release = (e) => {
    e.preventDefault();
    if (!pulse) input[action] = false;
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

function bindTouch() {
  bindTouchButton('btn-left', 'left');
  bindTouchButton('btn-right', 'right');
  bindTouchButton('btn-shoot', 'shoot');
  bindTouchButton('btn-pause-touch', 'pause', { pulse: true });
}

export function initInput() {
  bindKeyboard();
  bindTouch();
}

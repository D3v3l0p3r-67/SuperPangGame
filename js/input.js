// Keyboard input is handled natively by Phaser (see GameScene's cursors/
// keys). This module only bridges the DOM touch-control overlay into a
// small state object GameScene reads once per update() -- Phaser has no
// built-in virtual on-screen button system, so this thin, non-looping
// bridge is all that's left of the old manual input layer.

export const touchInput = {
  left: false,
  right: false,
  shoot: false,
  pause: false,
};

let pauseWasDown = false;

export function consumeTouchPausePressed() {
  const justPressed = touchInput.pause && !pauseWasDown;
  pauseWasDown = touchInput.pause;
  return justPressed;
}

function bindTouchButton(id, action, { pulse = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const press = (e) => {
    e.preventDefault();
    touchInput[action] = true;
    if (pulse) requestAnimationFrame(() => { touchInput[action] = false; });
  };
  const release = (e) => {
    e.preventDefault();
    if (!pulse) touchInput[action] = false;
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

let bound = false;

export function initTouchInput() {
  if (bound) return;
  bound = true;
  bindTouchButton('btn-left', 'left');
  bindTouchButton('btn-right', 'right');
  bindTouchButton('btn-shoot', 'shoot');
  bindTouchButton('btn-pause-touch', 'pause', { pulse: true });
}

// Keyboard input is handled natively by Phaser (see GameScene's cursors/
// keys). This module only bridges the DOM touch-control overlay into a
// small state object GameScene reads once per update() -- Phaser has no
// built-in virtual on-screen button system, so this thin, non-looping
// bridge is all that's left of the old manual input layer.

export const touchInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  shoot: false,
  pause: false,
};

let pauseWasDown = false;

export function consumeTouchPausePressed() {
  const justPressed = touchInput.pause && !pauseWasDown;
  pauseWasDown = touchInput.pause;
  return justPressed;
}

// Touch controls are for phones specifically, not for anything that
// merely reports a coarse pointer (touchscreen laptops, hybrids and
// desktops with a touch monitor all do, and there a keyboard is present
// and the on-screen overlay is just clutter covering the playfield).
// userAgentData.mobile is the modern, reliable signal where it exists;
// the UA regex is the fallback for browsers that don't expose it yet.
// Both are still AND-ed with an actual touch capability check, so a
// desktop browser spoofing a mobile UA string doesn't get the overlay.
export function isMobileDevice() {
  const hasTouch = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  if (!hasTouch) return false;
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }
  return /Android|iPhone|iPod|iPad|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
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

// Fraction of the stick's radius the thumb has to travel before it counts
// as a direction, so resting a thumb on the stick (or a tiny wobble while
// holding it centred) doesn't creep the player sideways.
const JOYSTICK_DEADZONE = 0.28;

// Turns the on-screen stick into the same four booleans the arrow keys
// set. Left/right walk; up/down are the ladder controls (see Player.js),
// and are what the vertical axis of the stick was always following
// visually anyway.
function bindJoystick() {
  const base = document.getElementById('touch-joystick');
  const knob = document.getElementById('touch-joystick-knob');
  if (!base || !knob) return;

  let activePointerId = null;

  const reset = () => {
    activePointerId = null;
    touchInput.left = false;
    touchInput.right = false;
    touchInput.up = false;
    touchInput.down = false;
    knob.style.transform = 'translate(0, 0)';
  };

  const track = (e) => {
    const rect = base.getBoundingClientRect();
    const radius = rect.width / 2;
    if (radius === 0) return;
    const dx = e.clientX - (rect.left + radius);
    const dy = e.clientY - (rect.top + radius);

    // Clamp the knob to the base's edge rather than letting it fly off
    // with the thumb, keeping the control readable at full deflection.
    const dist = Math.hypot(dx, dy);
    const scale = dist > radius ? radius / dist : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;

    const nx = dx / radius;
    const ny = dy / radius;
    touchInput.left = nx < -JOYSTICK_DEADZONE;
    touchInput.right = nx > JOYSTICK_DEADZONE;
    touchInput.up = ny < -JOYSTICK_DEADZONE;
    touchInput.down = ny > JOYSTICK_DEADZONE;
  };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointerId = e.pointerId;
    // Keeps receiving moves even once the thumb slides outside the base,
    // so a big swing doesn't silently drop the input mid-gesture.
    base.setPointerCapture?.(e.pointerId);
    track(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    track(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    base.addEventListener(type, (e) => {
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      reset();
    });
  }
}

let bound = false;

export function initTouchInput() {
  if (bound) return;
  bound = true;
  bindJoystick();
  bindTouchButton('btn-shoot', 'shoot');
  bindTouchButton('btn-pause-touch', 'pause', { pulse: true });
}

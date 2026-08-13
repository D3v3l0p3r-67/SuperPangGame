import * as storage from './storage.js';

// Every keyboard control in the game, and what each one is currently
// bound to. Keys are read here rather than through Phaser's keyboard
// plugin for one reason: they are rebindable (see the CONTROLS screen in
// ui.js), and a binding the player types is a KeyboardEvent.code -- the
// physical key, so a layout that puts Z where Y is still binds the key
// that was actually pressed. Phaser wants its own key constants, and
// translating between the two on every rebind buys nothing that this
// small listener doesn't already do.
//
// GameScene merges what this reports with the touch overlay's own state
// (see input.js) into the single object Player.update reads.

// In the order the CONTROLS screen lists them.
export const ACTIONS = [
  { id: 'left', label: 'MOVE LEFT' },
  { id: 'right', label: 'MOVE RIGHT' },
  { id: 'up', label: 'CLIMB UP' },
  { id: 'down', label: 'CLIMB DOWN' },
  { id: 'shoot', label: 'SHOOT' },
  { id: 'pause', label: 'PAUSE' },
];

// One key per action. Up climbs and ONLY climbs -- it used to shoot as
// well, which is why the scene had to work out which of the two a press
// was meant for; a ladder under the player made shooting unreliable, and
// there is a dedicated shoot key anyway.
export const DEFAULT_BINDINGS = Object.freeze({
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  shoot: 'Space',
  pause: 'Escape',
});

function defaultBindings() {
  return Object.fromEntries(ACTIONS.map(({ id }) => [id, DEFAULT_BINDINGS[id]]));
}

// Stored bindings are read back defensively, same as every other setting:
// an action missing from the saved object (one added in a later version),
// or a value of a shape this doesn't understand, falls back to that
// action's default rather than leaving the game with a control that
// cannot be pressed. An array is the shape a version with two keys per
// action wrote -- its first key is kept, so upgrading doesn't silently
// reset what the player had bound.
function sanitize(saved) {
  const bindings = defaultBindings();
  if (!saved || typeof saved !== 'object') return bindings;
  for (const { id } of ACTIONS) {
    const code = Array.isArray(saved[id]) ? saved[id].find(Boolean) : saved[id];
    if (typeof code === 'string') bindings[id] = code;
  }
  return bindings;
}

let bindings = null;

export function getBindings() {
  if (!bindings) bindings = sanitize(storage.loadSettings().keys);
  return bindings;
}

function persist() {
  storage.saveSettings({ keys: bindings });
}

// Binds `code` to an action, and takes it off whatever else held it --
// one key doing two things is never what the player meant, and silently
// leaving the old owner bound would make the screen lie about what is
// bound to what.
export function setBinding(action, code) {
  getBindings();
  for (const { id } of ACTIONS) {
    if (id !== action && bindings[id] === code) bindings[id] = '';
  }
  bindings[action] = code;
  persist();
}

export function resetBindings() {
  bindings = defaultBindings();
  persist();
}

// What the player sees on the CONTROLS screen. The menu font is letters,
// digits and three punctuation marks (see assets.js's INTRO_FONT_CHARS),
// so every label has to come out as a WORD -- there is no glyph for an
// arrow, a bracket or a slash to fall back on.
const KEY_LABELS = {
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSP',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  AltLeft: 'LALT', AltRight: 'RALT', CapsLock: 'CAPS',
};

export function keyLabel(code) {
  if (!code) return '...';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`.toUpperCase();
  // Anything else (punctuation, browser-specific names): strip it down to
  // what the font can actually draw rather than showing a blank button.
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '') || '...';
}

const pressed = new Set();
const pauseHandlers = [];
let captureHandler = null;

// True while the player is typing into something (the high-score initials
// box). Game keys must not steal those presses, and must not preventDefault
// on them either.
function typingInAField(target) {
  return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function actionFor(code) {
  const current = getBindings();
  for (const { id } of ACTIONS) {
    if (current[id] === code) return id;
  }
  return null;
}

export function isDown(action) {
  const code = getBindings()[action];
  return !!code && pressed.has(code);
}

// The four movement axes plus the trigger, in the shape GameScene merges
// with the touch overlay's. Pause is not here: it is an edge, not a state
// (see onPauseKey).
export function readKeyboard() {
  return {
    left: isDown('left'),
    right: isDown('right'),
    up: isDown('up'),
    down: isDown('down'),
    shoot: isDown('shoot'),
  };
}

// Called the instant a pause key goes down, rather than polled: pausing
// should not wait for the next frame of a game that may be busy.
export function onPauseKey(handler) {
  pauseHandlers.push(handler);
}

// Hands the NEXT key pressed to `handler` instead of the game -- how the
// CONTROLS screen asks for a key. Escape always cancels rather than being
// captured, so a rebind started by accident is never a trap. Returns a
// cancel function for leaving the screen mid-capture.
export function captureNextKey(handler) {
  captureHandler = handler;
  return () => { if (captureHandler === handler) captureHandler = null; };
}

export function isCapturing() {
  return captureHandler !== null;
}

let bound = false;

export function initKeyboard() {
  if (bound) return;
  bound = true;

  window.addEventListener('keydown', (event) => {
    if (typingInAField(event.target)) return;

    if (captureHandler) {
      event.preventDefault();
      const handler = captureHandler;
      captureHandler = null;
      handler(event.code === 'Escape' ? null : event.code);
      return;
    }

    const action = actionFor(event.code);
    if (!action) return;
    // Arrows and space scroll the page; every bound key belongs to the
    // game while it is being played.
    event.preventDefault();
    if (event.repeat) return;
    pressed.add(event.code);
    if (action === 'pause') for (const handler of pauseHandlers) handler();
  });

  window.addEventListener('keyup', (event) => {
    pressed.delete(event.code);
  });

  // A key held while the window goes away never sends its keyup, and the
  // player would come back walking into a wall (see GameScene's pause on
  // focus loss, which is the other half of this).
  window.addEventListener('blur', () => pressed.clear());
}

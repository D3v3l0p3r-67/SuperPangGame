import { VIRTUAL_W, VIRTUAL_H, ZOOM_LEVELS, DEFAULT_ZOOM } from './constants.js';
import * as storage from './storage.js';

// The game's own replacement for Phaser's Scale Manager (see GameConfig.js's
// scale.mode: NONE): the canvas is never continuously resized to fit the
// browser window, only ever set to VIRTUAL_W/VIRTUAL_H times one of exactly
// three fixed zoom levels. #game-container is resized to match exactly (see
// style.css) so #ui-layer's `inset: 0` lines up with the canvas with no
// letterboxing gap to correct for.

export function getZoom() {
  const { zoom } = storage.loadSettings();
  return ZOOM_LEVELS.includes(zoom) ? zoom : DEFAULT_ZOOM;
}

export function applyZoom(zoom) {
  const canvas = document.querySelector('#game-container > canvas');
  const container = document.getElementById('game-container');
  const width = `${VIRTUAL_W * zoom}px`;
  const height = `${VIRTUAL_H * zoom}px`;
  // The canvas's rendered size, published for the two developer toolbars
  // (see style.css's .panel-* rules): they span its width and size every
  // control against its height, so both scale with the game exactly as
  // the in-canvas UI does. Set here rather than left as container query
  // units because only ONE of the two panels is inside #game-container --
  // the debug one sits above the canvas entirely, where cq units would
  // resolve against something else and the two would stop matching.
  const root = document.documentElement.style;
  root.setProperty('--canvas-w', width);
  root.setProperty('--canvas-h', height);
  if (canvas) {
    canvas.style.width = width;
    canvas.style.height = height;
  }
  if (container) {
    container.style.width = width;
    container.style.height = height;
  }
}

export function setZoom(zoom) {
  if (!ZOOM_LEVELS.includes(zoom)) return;
  storage.saveSettings({ zoom });
  applyZoom(zoom);
}

// The fixed zoom levels above assume a window with room for at least 1x
// (VIRTUAL_W x VIRTUAL_H = 800x500). A phone in landscape is typically
// shorter than 500 CSS px, so 1x overflows the screen -- and since the
// touch controls are positioned against the canvas (see style.css), they
// go off the screen with it, putting the pause button out of reach
// entirely. Picks the largest level that actually fits the viewport,
// falling back to the smallest when even that doesn't.
//
// Deliberately not persisted (unlike setZoom): this is a fit-to-screen
// answer for the device currently in hand, not a preference, so it must
// never overwrite a zoom the player picked in Options on desktop.
export function fittedZoom() {
  const fits = ZOOM_LEVELS.filter((z) => VIRTUAL_W * z <= window.innerWidth && VIRTUAL_H * z <= window.innerHeight);
  return fits.length ? Math.max(...fits) : Math.min(...ZOOM_LEVELS);
}

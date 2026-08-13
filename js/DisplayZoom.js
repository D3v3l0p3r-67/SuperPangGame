import { VIRTUAL_W, VIRTUAL_H, ZOOM_LEVELS, ZOOM_FIT, DEFAULT_ZOOM } from './constants.js';
import * as storage from './storage.js';

// The game's own replacement for Phaser's Scale Manager (see GameConfig.js's
// scale.mode: NONE): the canvas is never continuously resized to fit the
// browser window, only ever set to VIRTUAL_W/VIRTUAL_H times a scale this
// module decides -- one of the fixed ZOOM_LEVELS, or whatever ZOOM_FIT
// works out to for the window as it currently is. #game-container is
// resized to match exactly (see style.css) so #ui-layer's `inset: 0` lines
// up with the canvas with no letterboxing gap to correct for.

// Never scale below this, however small the window gets: past it the game
// is unreadable anyway, and a zero (or negative) scale would collapse the
// canvas entirely.
const MIN_FIT_SCALE = 0.25;

export function getZoom() {
  const { zoom } = storage.loadSettings();
  if (zoom === ZOOM_FIT) return ZOOM_FIT;
  return ZOOM_LEVELS.includes(zoom) ? zoom : DEFAULT_ZOOM;
}

// The largest scale at which the WHOLE canvas still fits the window, at
// its true 8:5 shape. Width and height are both measured and the smaller
// answer wins: filling the other dimension would push the rest of the
// playfield off the screen, and a playfield you cannot see all of is not
// a playfield -- this game has balls arriving from every edge.
//
// The debug panel sits above the canvas rather than over it (see
// style.css's #tool-bar) and takes real height with it, so its height
// comes out of what is available -- otherwise opening it would push the
// bottom of the playfield off the bottom of the screen.
export function fitScale() {
  const toolBar = document.getElementById('tool-bar');
  const reserved = toolBar ? toolBar.getBoundingClientRect().height : 0;
  // clientWidth/Height rather than innerWidth/Height: these exclude a
  // scrollbar, so fitting can't itself produce the scrollbar that would
  // then make the fit wrong.
  const viewport = document.documentElement;
  const scaleX = viewport.clientWidth / VIRTUAL_W;
  const scaleY = (viewport.clientHeight - reserved) / VIRTUAL_H;
  return Math.max(MIN_FIT_SCALE, Math.min(scaleX, scaleY));
}

// What a zoom setting actually multiplies by right now -- the number
// itself for a fixed level, the current fit for ZOOM_FIT.
export function resolveZoom(zoom) {
  return zoom === ZOOM_FIT ? fitScale() : zoom;
}

// The zoom to actually render at, which is the stored preference unless
// the window is too small to hold it. A phone in landscape is usually
// shorter than 500 CSS px, so even 1x overflows it -- and the touch
// controls are anchored to the canvas, so they go off-screen with it and
// the pause button becomes unreachable. A size that does not fit the
// screen in front of the player is not a preference worth honouring:
// fitting is always better than losing part of the playfield.
export function activeZoom() {
  const zoom = getZoom();
  if (zoom === ZOOM_FIT) return ZOOM_FIT;
  const fits = VIRTUAL_W * zoom <= window.innerWidth && VIRTUAL_H * zoom <= window.innerHeight;
  return fits ? zoom : ZOOM_FIT;
}

export function applyZoom(zoom) {
  const canvas = document.querySelector('#game-container > canvas');
  const container = document.getElementById('game-container');
  // Rounded to whole CSS pixels: a fitted scale is rarely a round number,
  // and half a pixel at the edge of the canvas is a blurred edge.
  const scale = resolveZoom(zoom);
  const width = `${Math.round(VIRTUAL_W * scale)}px`;
  const height = `${Math.round(VIRTUAL_H * scale)}px`;
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
  if (zoom !== ZOOM_FIT && !ZOOM_LEVELS.includes(zoom)) return;
  storage.saveSettings({ zoom });
  applyZoom(activeZoom());
}

// A fitted canvas has to be re-fitted whenever what it is fitting into
// changes: the window resizing, a rotation, entering or leaving
// fullscreen -- and the debug panel opening or closing, which changes how
// much height is left over (hence the observer, not just window events).
// Does nothing at a fixed zoom, which by definition doesn't depend on the
// window at all.
let watching = false;

export function watchViewport() {
  if (watching) return;
  watching = true;
  // activeZoom, not the stored preference: a window too small for the
  // chosen size is being fitted too, and has to be re-fitted for the same
  // reasons.
  const refit = () => {
    if (activeZoom() === ZOOM_FIT) applyZoom(ZOOM_FIT);
  };
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
  document.addEventListener('fullscreenchange', refit);
  const toolBar = document.getElementById('tool-bar');
  if (toolBar && window.ResizeObserver) new ResizeObserver(refit).observe(toolBar);
}

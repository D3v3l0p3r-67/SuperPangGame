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

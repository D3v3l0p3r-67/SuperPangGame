// Technical constants: rendering resolution, timing, physics, palette.
// Gameplay tuning values (speeds, points, durations, level data) live in config.js / levels.js.

export const VIRTUAL_W = 256;
export const VIRTUAL_H = 224;

export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 250;

export const GRAVITY = 260; // px/s^2 in virtual units, shared by all falling/bouncing entities

export const STORAGE_PREFIX = 'balloonBuster.';
export const SCHEMA_VERSION = 1;

export const COLORS = {
  bgTop: '#0b0e2a',
  bgBottom: '#1c1042',
  ground: '#3a2d5c',
  groundEdge: '#5a4a8a',
  platform: '#4a3f6b',
  platformEdge: '#6d5fa0',
  text: '#f4f1de',
  textShadow: '#000000',
  hud: '#f4f1de',
  danger: '#e94560',
  accent: '#ffd23f',
  outline: '#0b0e2a',
};

export const GAME_STATES = Object.freeze({
  BOOT: 'BOOT',
  MENU: 'MENU',
  LEVEL_INTRO: 'LEVEL_INTRO',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
  HIGH_SCORE_ENTRY: 'HIGH_SCORE_ENTRY',
  HIGH_SCORE_TABLE: 'HIGH_SCORE_TABLE',
  VICTORY: 'VICTORY',
});

// Technical constants: rendering resolution, timing, physics, palette.
// Gameplay tuning values (speeds, points, durations, level data) live in config.js / levels.js.

export const VIRTUAL_W = 256;
export const VIRTUAL_H = 224;

// Everything here is a multiple of 8 (matching OBSTACLE_BLOCK_SIZE) so the
// playfield, ground line, and any obstacle grid all line up cleanly.
export const GROUND_MARGIN = 24;
export const GROUND_Y = VIRTUAL_H - GROUND_MARGIN;

// Base cell size obstacles are composed of -- a breakable obstacle is a
// group of independent OBSTACLE_BLOCK_SIZE x OBSTACLE_BLOCK_SIZE blocks
// (see LevelManager.js), so one can be shot away without affecting the
// rest of the shape.
export const OBSTACLE_BLOCK_SIZE = 8;

export const STORAGE_PREFIX = 'balloonBuster.';
export const SCHEMA_VERSION = 1;

export const COLORS = {
  bgTop: '#0b0e2a',
  bgBottom: '#1c1042',
  ground: '#3a2d5c',
  groundEdge: '#5a4a8a',
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
  HIT_FREEZE: 'HIT_FREEZE',
  PAUSED: 'PAUSED',
  LEVEL_CLEAR: 'LEVEL_CLEAR',
  GAME_OVER: 'GAME_OVER',
  HIGH_SCORE_ENTRY: 'HIGH_SCORE_ENTRY',
  HIGH_SCORE_TABLE: 'HIGH_SCORE_TABLE',
  VICTORY: 'VICTORY',
});

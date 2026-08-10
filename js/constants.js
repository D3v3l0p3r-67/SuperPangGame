// Technical constants: rendering resolution, timing, physics, palette.
// Gameplay tuning values (speeds, points, durations, level data) live in config.js / levels.js.

// 46 blocks (368px) of that width is the movable play area -- the rest is
// the border frame (OBSTACLE_BLOCK_SIZE on each side, see GameScene.
// drawBorder / the world bounds inset in GameScene.create).
export const VIRTUAL_W = 384;
// PLAYFIELD_H is the bordered play area (gameplay + floor strip), same as
// the old fixed canvas height. HUD_H is a dedicated bar reserved below it
// for the HUD (see GameScene.drawBackground + Hud.js), matching the
// reference layout instead of overlaying the HUD on top of gameplay.
// VIRTUAL_H is the *total* canvas height passed to Phaser.
export const PLAYFIELD_H = 224;
export const HUD_H = 40;
export const VIRTUAL_H = PLAYFIELD_H + HUD_H;

// Everything here is a multiple of 8 (matching OBSTACLE_BLOCK_SIZE) so the
// playfield, ground line, and any obstacle grid all line up cleanly.
export const GROUND_MARGIN = 24;
export const GROUND_Y = PLAYFIELD_H - GROUND_MARGIN;

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
  hudBg: '#05040a',
};

export const GAME_STATES = Object.freeze({
  BOOT: 'BOOT',
  MENU: 'MENU',
  EDITOR: 'EDITOR',
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

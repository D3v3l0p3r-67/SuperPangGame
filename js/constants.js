// Technical constants: rendering resolution, timing, physics, palette.
// Gameplay tuning values (speeds, points, durations, level data) live in config.js / levels.js.

// The playing surface: 800x420, bordered on all four sides (top/left/
// right/floor) by BORDER_THICKNESS -- see GameScene.drawBorder / the
// world bounds inset in GameScene.create.
export const VIRTUAL_W = 800;
// PLAYFIELD_H is the bordered play area (gameplay + floor strip), same as
// the old fixed canvas height. HUD_H is a dedicated bar reserved below it
// for the HUD (see GameScene.drawBackground + Hud.js), matching the
// reference layout instead of overlaying the HUD on top of gameplay.
// VIRTUAL_H is the *total* canvas height passed to Phaser (800x500 with
// the HUD included).
export const PLAYFIELD_H = 420;
export const HUD_H = 80;
export const VIRTUAL_H = PLAYFIELD_H + HUD_H;

// Thickness of the border/wall/floor/ceiling frame around the playfield,
// on all four sides alike (see GameScene.create's physics bounds inset
// and drawBorder's wall strips). Deliberately independent of
// OBSTACLE_BLOCK_SIZE below -- the border can change thickness without
// affecting the obstacle/ball placement grid, and vice versa.
export const BORDER_THICKNESS = 16;
export const GROUND_Y = PLAYFIELD_H - BORDER_THICKNESS;

// Base cell size obstacles are composed of -- a breakable obstacle is a
// group of independent OBSTACLE_BLOCK_SIZE x OBSTACLE_BLOCK_SIZE blocks
// (see LevelManager.js), so one can be shot away without affecting the
// rest of the shape. Also the level editor's placement/alignment grid
// (see editor.js's snapObstacleOrigin).
export const OBSTACLE_BLOCK_SIZE = 16;

// The only display sizes the game can render at -- see DisplayZoom.js.
// Deliberately NOT continuously responsive to the browser window: picking
// one of these multiplies VIRTUAL_W/VIRTUAL_H directly into the canvas's
// CSS size.
export const ZOOM_LEVELS = [0.5, 1, 2];
export const DEFAULT_ZOOM = 1;

export const STORAGE_PREFIX = 'balloonBuster.';
export const SCHEMA_VERSION = 1;

// Level-intro timing, shared between GameScene (which counts stateTimer
// down through it, firing one sound cue per phase) and LevelIntro.js
// (which reads it back to know which of the three words to show).
// READY and SET blink; GO! is solid.
export const LEVEL_INTRO_READY_SEC = 1;
export const LEVEL_INTRO_SET_SEC = 1;
export const LEVEL_INTRO_GO_SEC = 1;
export const LEVEL_INTRO_SEC = LEVEL_INTRO_READY_SEC + LEVEL_INTRO_SET_SEC + LEVEL_INTRO_GO_SEC;

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
  OPTIONS: 'OPTIONS',
  LEVEL_SELECT: 'LEVEL_SELECT',
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

// Technical constants: rendering resolution, timing, physics, palette.
// Gameplay tuning values (speeds, points, durations, level data) live in config.js / levels.js.

// The playing surface: 800x420, bordered on all four sides (top/left/
// right/floor) by BORDER_THICKNESS -- see GameScene.drawBorder / the
// world bounds inset in GameScene.create.
export const VIRTUAL_W = 800;
// VIRTUAL_H is the *total* canvas height passed to Phaser (800x500). It
// splits into the bordered play area (PLAYFIELD_H) and a dedicated HUD bar
// below it (HUD_H) -- see GameScene.drawBackground + Hud.js -- rather than
// overlaying the HUD on top of gameplay. Both are derived below, from the
// grid, instead of being picked by hand.
export const VIRTUAL_H = 500;

// Thickness of the border/wall/floor/ceiling frame around the playfield,
// on all four sides alike (see GameScene.create's physics bounds inset
// and drawBorder's wall strips). Deliberately independent of
// OBSTACLE_BLOCK_SIZE below -- the border can change thickness without
// affecting the obstacle/ball placement grid, and vice versa.
export const BORDER_THICKNESS = 16;

// Base cell size obstacles are composed of -- a breakable obstacle is a
// group of independent OBSTACLE_BLOCK_SIZE x OBSTACLE_BLOCK_SIZE blocks
// (see LevelManager.js), so one can be shot away without affecting the
// rest of the shape. Also the level editor's placement/alignment grid
// (see editor.js's snapObstacleOrigin).
export const OBSTACLE_BLOCK_SIZE = 16;

// How much of VIRTUAL_H the HUD asks for. It is a floor, not the final
// figure: whatever the playfield can't use in whole cells is handed to the
// HUD instead (Hud.js centres its content in HUD_H, so a few px either way
// changes nothing there).
const MIN_HUD_H = 80;

// The interior -- ceiling to ground -- is a whole number of obstacle
// blocks, and everything else follows from it. Rounding down is what makes
// the grid line up with the drawn border at BOTH ends: a leftover fraction
// of a cell would have to surface somewhere, and wherever it did it would
// show, either as a gap under the ceiling or as obstacles that can't rest
// on the floor. It would also leave one row a different height from every
// other, which breaks the player's step-up (see Player.js -- every row has
// to be exactly one step above the one below).
const INTERIOR_H = Math.floor((VIRTUAL_H - MIN_HUD_H - BORDER_THICKNESS * 2) / OBSTACLE_BLOCK_SIZE) * OBSTACLE_BLOCK_SIZE;

export const GROUND_Y = BORDER_THICKNESS + INTERIOR_H;
export const PLAYFIELD_H = GROUND_Y + BORDER_THICKNESS;
export const HUD_H = VIRTUAL_H - PLAYFIELD_H;

// The fixed display sizes the game can render at -- see DisplayZoom.js.
// Picking one of these multiplies VIRTUAL_W/VIRTUAL_H directly into the
// canvas's CSS size.
export const ZOOM_LEVELS = [0.5, 1, 2];
export const DEFAULT_ZOOM = 1;

// The one size setting that is not a fixed multiplier: fit the canvas to
// the window, at whatever scale that takes. Stored and passed around
// exactly like the numbers above, so everything that handles a zoom
// handles this too -- see DisplayZoom.fitScale for what it resolves to.
export const ZOOM_FIT = 'fit';

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
  // Reached, done, cleared: the world map's markers for the continents
  // the run has already been to (see WorldMapInterlude.render).
  success: '#4ad66d',
  outline: '#0b0e2a',
  hudBg: '#05040a',
};

export const GAME_STATES = Object.freeze({
  BOOT: 'BOOT',
  MENU: 'MENU',
  OPTIONS: 'OPTIONS',
  KEY_CONFIG: 'KEY_CONFIG',
  // Options is a list of doors now rather than a page of settings: SOUND
  // and DISPLAY are screens of their own, same as CONTROLS already was.
  SOUND: 'SOUND',
  DISPLAY: 'DISPLAY',
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

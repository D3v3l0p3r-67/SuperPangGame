// Central place naming every externally-loaded graphic file and the
// Phaser texture key it's registered under, so BootScene (which loads
// them) and the entities that use them (Ball, Player, Obstacle, ...)
// always agree on both. Swapping a graphic is just replacing the file at
// its path below -- nothing in code needs to change as long as the new
// file keeps the same name and pixel dimensions (each section's own
// sizing note explains what that is).

// Balls: one file per (shape, size) pair, sized exactly to that element's
// radius (see elements/round-ball-*.json, hex-ball-*.json -- currently
// 8/16/24/32/48px for round sizes 1-5, 8/16/24px for hex sizes 1-3) so
// it's used at native resolution with no runtime scaling.
export const BALL_TEXTURE_DIR = 'assets/balls/';

export function ballTextureKey(shape, size) {
  return `ball_${shape}_${size}`;
}

export function ballTexturePath(shape, size) {
  return `${BALL_TEXTURE_DIR}${ballTextureKey(shape, size)}.webp`;
}

// Player: one file per animation frame, each exactly PLAYER_CONFIG.
// spriteWidth x spriteHeight (16x32). Left/right isn't a separate file --
// Player.js mirrors the sprite horizontally (setFlipX) instead, so a
// swapped-in frame only needs to face right.
export const PLAYER_TEXTURE_DIR = 'assets/player/';

// state -> how many frames it has, in order (frame 1, 2, ...)
export const PLAYER_ANIM_FRAME_COUNTS = {
  idle: 1,
  move: 2,
  shot: 2,
  dead: 3,
};

export function playerTextureKey(state, frame) {
  return `player_${state}_${frame}`;
}

export function playerTexturePath(state, frame) {
  return `${PLAYER_TEXTURE_DIR}${playerTextureKey(state, frame)}.webp`;
}

// Obstacles: one beveled-block wall tile per distinct tileTexture named by
// an elements/obstacle-*.json (see elements.js's OBSTACLE_TYPES), each
// exactly OBSTACLE_BLOCK_SIZE square (8x8) -- tiled via TileSprite across
// whatever area a block/the border frame covers, so the file itself is
// just the one repeating cell.
export const OBSTACLE_TEXTURE_DIR = 'assets/obstacles/';

export function obstacleTextureKey(name) {
  return `obstacle_${name}`;
}

export function obstacleTexturePath(name) {
  return `${OBSTACLE_TEXTURE_DIR}${name}.webp`;
}

// Projectile (the harpoon shot) -- displayed at whatever width the active
// weapon state calls for (see Projectile.js's setDisplaySize), so the
// file's own pixel size is just its default/reference size (4x7).
export const PROJECTILE_TEXTURE_KEY = 'projectile';
export const PROJECTILE_TEXTURE_PATH = 'assets/projectile.webp';

// Particle (the small square used for every burst effect) -- always
// tinted at runtime to whatever color the effect needs (see GameScene.
// spawnBurst), so the file itself should stay plain white. 2x2px.
export const PARTICLE_TEXTURE_KEY = 'particle';
export const PARTICLE_TEXTURE_PATH = 'assets/particle.webp';

// Power-ups: one glyph-on-disc icon per elements/powerup-*.json's `type`
// (see elements.js's POWERUP_TYPES), 9x9px.
export const POWERUP_TEXTURE_DIR = 'assets/powerups/';

export function powerupTextureKey(type) {
  return `powerup_${type}`;
}

export function powerupTexturePath(type) {
  return `${POWERUP_TEXTURE_DIR}${type}.webp`;
}

// Levels: one JSON file per level under levels/, in the exact shape the
// level editor's own Export button produces (see editor.js's buildDef) --
// {id, name, timeLimitSec, obstacles, balls} -- so a new level is just a
// file dropped in this folder, no code change. Static hosting has no
// directory listing, so LevelManager can't just "read the folder" --
// instead ElementsScene probes level_01.json..level_<MAX_LEVEL_FILES>
// .json and keeps whichever ones actually loaded, which is also how "as
// many levels as there are files" is satisfied without a separate
// manifest to keep in sync. Raise MAX_LEVEL_FILES if there are ever more
// levels than that.
export const LEVELS_DIR = 'levels/';
export const MAX_LEVEL_FILES = 20;

export function levelFileKey(n) {
  return `level_${String(n).padStart(2, '0')}`;
}

export function levelFilePath(n) {
  return `${LEVELS_DIR}${levelFileKey(n)}.json`;
}

// Elements: one JSON file per ball size/shape, obstacle type, or power-up
// -- category, id, and the fields that category needs (see elements.js's
// registerElement) -- under elements/, freely named (round-ball-1.json,
// powerup-stoptime-5s.json, ...). Unlike levels (which follow a fixed
// level_NN naming ElementsScene can just probe), element filenames are
// meant to be descriptive and unordered, so there's no naming convention
// to probe -- ElementsScene instead reads elements/index.json, a plain
// array of filenames (no extension), and loads exactly those. Adding a
// new element is: drop the file in elements/, add its name to
// elements/index.json.
export const ELEMENTS_DIR = 'elements/';
export const ELEMENTS_INDEX_PATH = 'elements/index.json';
export const ELEMENTS_INDEX_KEY = 'elements-index';

export function elementFileKey(id) {
  return `element-${id}`;
}

export function elementFilePath(id) {
  return `${ELEMENTS_DIR}${id}.json`;
}

// Audio: a single config file lists every named sound (see audio.js's
// AUDIO_CONFIG, populated from this) with its file/category/volume/mode/
// overlap -- swapping a sound is replacing the .ogg file it points to, no
// code change. Same two-scene split as the elements/graphics above:
// ElementsScene loads+parses audio.json into AUDIO_CONFIG, then
// BootScene's preload() reads that registry to know which .ogg files to
// load, exactly like it already does for ball/obstacle/powerup graphics.
export const AUDIO_DIR = 'assets/audio/';
export const AUDIO_CONFIG_PATH = 'assets/audio/audio.json';
export const AUDIO_CONFIG_KEY = 'audio-config';

export function audioPath(file) {
  return `${AUDIO_DIR}${file}`;
}

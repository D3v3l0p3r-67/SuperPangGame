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

// Hex balls spin (see Ball.js) -- unlike round balls (one static image per
// size), a hex ball's own texture is a HEX_SPIN_FRAMES-frame spritesheet,
// each frame one rotation phase spaced across a regular hexagon's 60°
// rotational symmetry (0°, 20°, 40°) so frame 2 -> frame 0 loops
// seamlessly. Still the exact same filename/naming/native-size convention
// as ballTexturePath above (BootScene picks image-vs-spritesheet loading
// per shape) -- only hex is animated this way today.
export const HEX_SPIN_FRAMES = 3;

export function ballSpinAnimKey(shape, size) {
  return `ball-spin-${shape}-${size}`;
}

// Pop effect: a BALL_POP_FRAMES-frame animation played exactly where a
// ball popped (see GameScene.popBall), one image per (shape, size) pair
// so a different burst can be authored per ball type/size. Each frame is
// POP_FRAME_SCALE times that ball's own diameter square, centered on the
// ball -- bigger than the ball itself so the burst has room to expand
// past its edges within the frame.
export const BALL_POP_FRAMES = 2;
export const POP_FRAME_SCALE = 1.6;

export function ballPopTextureKey(shape, size) {
  return `ballpop_${shape}_${size}`;
}

export function ballPopTexturePath(shape, size) {
  return `${BALL_TEXTURE_DIR}pop_${shape}_${size}.webp`;
}

export function ballPopAnimKey(shape, size) {
  return `ball-pop-${shape}-${size}`;
}

// Player: a single spritesheet (one PNG, not one file per frame) of
// PLAYER_CONFIG.spriteWidth x spriteHeight (32x64) cells stacked
// vertically, in this fixed order: idle, shot, 4 walk frames, victory,
// dead -- see PLAYER_ANIM_FRAMES below for which index is which (see the
// README's "Swapping graphics" for the full frame reference). Every frame
// is authored facing LEFT; Player.js mirrors it (setFlipX) for
// right-facing instead of needing a separate left/right file.
export const PLAYER_TEXTURE_KEY = 'player';
export const PLAYER_TEXTURE_PATH = 'assets/player/player.png';
export const PLAYER_FRAME = { frameWidth: 32, frameHeight: 64 };

// state -> its frame index (or indices, in play order) within the
// spritesheet above.
export const PLAYER_ANIM_FRAMES = {
  idle: [0],
  shot: [1],
  move: [2, 3, 4, 5],
  victory: [6],
  dead: [7],
};

// Shield power-up effect: a PLAYER_SHIELD_FRAMES-frame looping animation
// drawn centered on the player while shielded (see Player.js's
// shieldEffect, toggled by the `shield` power-up's player_shield
// behavior -- elements.js's POWERUP_BEHAVIORS). One PLAYER_CONFIG.
// shieldSize (32) square spritesheet, frames stacked vertically same as
// the player's own sheet above.
export const PLAYER_SHIELD_TEXTURE_KEY = 'player-shield';
export const PLAYER_SHIELD_TEXTURE_PATH = 'assets/player/shield.webp';
export const PLAYER_SHIELD_FRAMES = 3;
export const PLAYER_SHIELD_ANIM_KEY = 'player-shield-loop';

// Obstacles: one beveled-block wall tile per distinct tileTexture named by
// an elements/obstacle-*.json (see elements.js's OBSTACLE_TYPES) -- tiled
// via TileSprite across whatever area a block/the border frame covers, so
// the file itself is just the one repeating cell. Sized to match
// OBSTACLE_BLOCK_SIZE/BORDER_THICKNESS exactly (16x16) so a block/the
// border reads as one clean tile rather than a busy sub-grid, though
// TileSprite would repeat a smaller texture just as correctly if it were
// ever swapped for one.
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

// Level backgrounds: one image per distinct levels/*.json `background`
// name, covering the sky area behind the playfield (VIRTUAL_W x GROUND_Y,
// see constants.js -- the ground/floor strip and HUD bar below it stay
// solid color, drawn by GameScene.drawBackground). "default" is the one
// every level and the level editor start out pointing at (see
// DEFAULT_BACKGROUND) -- add a new name here and reference it from a
// level's `background` field for a level-specific look.
export const BACKGROUND_TEXTURE_DIR = 'assets/backgrounds/';
export const DEFAULT_BACKGROUND = 'default';

export function backgroundTextureKey(name) {
  return `background_${name}`;
}

export function backgroundTexturePath(name) {
  return `${BACKGROUND_TEXTURE_DIR}${name}.webp`;
}

// Levels: one JSON file per level under levels/, in the exact shape the
// level editor's own Export button produces (see editor.js's buildDef) --
// {id, name, timeLimitSec, background, weapon, obstacles, balls} -- so a new level is just a
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

// HUD: the graphic status bar (see Hud.js) -- fixed labels, two digit
// spritesheets (one glyph size for the score, a smaller one shared by
// time/world/hi), the life icon, the weapon socket frame, and one icon
// per WEAPON_TYPES key. Every piece is plain white/native-color pixel art
// so Hud.js can setTint() each usage independently -- swapping any file
// (same name/dimensions) needs no code change.
export const HUD_DIR = 'assets/hud/';

export const HUD_DIGITS_LARGE_KEY = 'hud-digits-large';
export const HUD_DIGITS_LARGE_PATH = `${HUD_DIR}digits_large.webp`;
export const HUD_DIGITS_LARGE_FRAME = { frameWidth: 12, frameHeight: 18 }; // score

export const HUD_DIGITS_SMALL_KEY = 'hud-digits-small';
export const HUD_DIGITS_SMALL_PATH = `${HUD_DIR}digits_small.webp`;
export const HUD_DIGITS_SMALL_FRAME = { frameWidth: 8, frameHeight: 12 }; // time / world / hi

export const HUD_1P_KEY = 'hud-1p';
export const HUD_1P_PATH = `${HUD_DIR}hud_1p.webp`;
export const HUD_TIME_LABEL_KEY = 'hud-time-label';
export const HUD_TIME_LABEL_PATH = `${HUD_DIR}hud_time_label.webp`;
export const HUD_LEVEL_LABEL_KEY = 'hud-level-label';
export const HUD_LEVEL_LABEL_PATH = `${HUD_DIR}hud_level_label.webp`;
export const HUD_HI_LABEL_KEY = 'hud-hi-label';
export const HUD_HI_LABEL_PATH = `${HUD_DIR}hud_hi_label.webp`;

export const HUD_LIFE_KEY = 'hud-life';
export const HUD_LIFE_PATH = `${HUD_DIR}hud_life.webp`;

export const HUD_WEAPON_FRAME_KEY = 'hud-weapon-frame';
export const HUD_WEAPON_FRAME_PATH = `${HUD_DIR}hud_weapon_frame.webp`;

export function hudWeaponIconKey(type) {
  return `hud-weapon-${type}`;
}

export function hudWeaponIconPath(type) {
  return `${HUD_DIR}weapon_${type}.webp`;
}

// Level-intro screen (see LevelIntro.js) AND every DOM menu screen (see
// js/PixelText.js): one monospaced spritesheet covering space + A-Z +
// "!" + 0-9 + ":" + "." (40 frames, INTRO_FONT_CHARS gives each
// character's frame index). Digits/punctuation were appended after the
// original A-Z+!+space set so LevelIntro.js's existing frame indices
// never shifted. Unlike the HUD's fixed per-word label images, level
// names/menu text are arbitrary strings, so they need a real (if
// uppercase-only) font instead of a baked image. The level number itself
// still reuses the HUD's own large digit strip (see LevelIntro.js).
export const INTRO_FONT_KEY = 'intro-font';
export const INTRO_FONT_PATH = 'assets/intro/font_alpha.webp';
export const INTRO_FONT_FRAME = { frameWidth: 5, frameHeight: 6 };
export const INTRO_FONT_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ!0123456789:.';

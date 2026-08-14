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
// PLAYER_CONFIG.spriteWidth x spriteHeight (36x72) cells stacked
// vertically, in this fixed order: idle, shot, 4 walk frames, victory,
// dead, 2 climb, 2 ladder-exit, 2 step-up, 2 step-down, jump -- see
// PLAYER_ANIM_FRAMES below for which index is which (see the
// README's "Swapping graphics" for the full frame reference).
//
// Which way a frame faces depends on what it is: the game is played INTO
// the screen, so idle, shot, the climb and the ladder-exit are drawn from
// behind; the walk cycle and the step up/down frames are seen from the
// side and are the ones authored facing LEFT (Player.js mirrors those
// with setFlipX rather than needing a second set); victory and dead turn
// round and are the only frames with a face. Drawn by
// tools/player_sprite.py.
export const PLAYER_TEXTURE_KEY = 'player';
export const PLAYER_TEXTURE_PATH = 'assets/player/player.png';
export const PLAYER_FRAME = { frameWidth: 36, frameHeight: 72 };

// state -> its frame index (or indices, in play order) within the
// spritesheet above.
export const PLAYER_ANIM_FRAMES = {
  idle: [0],
  shot: [1],
  move: [2, 3, 4, 5],
  victory: [6],
  dead: [7],
  // Climbing a ladder: both hands stay on it (the weapon arm is already
  // up, so the free one is too, changing rung), the legs alternate, and
  // the body rises and falls with the effort. Loops while climbing and is
  // held frozen when the player stops partway up -- they are still on the
  // ladder, so the standing idle would be wrong (see Player.update).
  climb: [8, 9],
  // Stepping off the TOP of a ladder onto the ground: the weight comes
  // down through a crouch and straightens back into idle. Only at the top
  // -- at the bottom the player simply stands off it.
  ladderoff: [10, 11],
  // Walking up onto a block, and down off one (PLAYER_STEP_UP_PX): the
  // leading knee comes up and the body follows it, or the leading foot
  // reaches down and the body dips after it. Separate, because a step up
  // and a step down do not look alike.
  stepup: [12, 13],
  stepdown: [14, 15],
  // Clearing a level: the player faces out and hops on the spot, arms up
  // -- the standing victory pose alternating with frame 16, which is the
  // same pose airborne (it is the one frame in the sheet drawn off the
  // ground). It used to alternate idle/victory, which turned the player
  // back and forth between facing away and facing out. Six frames at the
  // rate BootScene gives this state is exactly the LEVEL_CLEAR_MIN_SEC the
  // scene holds the celebration for (see GameScene.levelClear/
  // Player.playLevelClearAnim).
  levelclear: [6, 16, 6, 16, 6, 16],
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

// Impact burst: played once at the point a ball actually touches the
// player (see GameScene.onPlayerHitBall), the counterpart to the ball-pop
// effect a shot ball leaves behind. Same two-beat shape and same vertical
// frame layout as the ball-pop sheets (see BALL_POP_FRAMES above) --
// PLAYER_HIT_SIZE wide by PLAYER_HIT_SIZE * PLAYER_HIT_FRAMES tall, frame
// 0 on top -- so swapping it is just replacing the one file, as long as
// the new art keeps that layout.
export const PLAYER_HIT_TEXTURE_KEY = 'player-hit';
export const PLAYER_HIT_TEXTURE_PATH = 'assets/player/hit.webp';
export const PLAYER_HIT_FRAMES = 2;
export const PLAYER_HIT_SIZE = 32;
export const PLAYER_HIT_ANIM_KEY = 'player-hit-burst';

// The puff of dust a landing kicks up at the player's feet (see
// Player.followGround / GameScene.playLandingDust). Same one-shot,
// frames-stacked-vertically layout as the burst sheets above, but
// DELIBERATELY not square -- PLAYER_DUST_SIZE is the frame's width and
// PLAYER_DUST_HEIGHT its height, because dust spreads sideways along the
// ground rather than billowing up.
export const PLAYER_DUST_TEXTURE_KEY = 'player-dust';
export const PLAYER_DUST_TEXTURE_PATH = 'assets/player/dust.webp';
export const PLAYER_DUST_FRAMES = 2;
export const PLAYER_DUST_SIZE = 32;
export const PLAYER_DUST_HEIGHT = 16;
export const PLAYER_DUST_ANIM_KEY = 'player-dust-puff';

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

// Ladders: one image per `texture` named by an elements/<ladder>.json (see
// elements.js's LADDER_TYPES). Unlike the obstacle tiles above this is the
// whole element at its authored size, not a repeating cell -- but it is
// drawn to be seamless top-to-bottom anyway, since a tall ladder is
// several of them stacked and the rung spacing has to carry across the
// join.
export const LADDER_TEXTURE_DIR = 'assets/ladders/';

export function ladderTextureKey(name) {
  return `ladder_${name}`;
}

export function ladderTexturePath(name) {
  return `${LADDER_TEXTURE_DIR}${name}.webp`;
}

// Shots: one spritesheet holding every weapon's shot graphic side by side,
// 4 cells of 36x400 (144x400 total). 400px tall because that's the full
// height a shot ever reaches -- from the player's feet on the ground up to
// the ceiling -- so the beam is drawn by CROPPING the top `length` pixels
// of its cell as it grows (see Projectile.js) rather than by stretching a
// small texture, which keeps the artwork at its authored pixel scale at
// every length. Each design is therefore authored head-at-the-top, shaft
// running down from it.
//
// SHOT_BEAM_WIDTH is the width of the drawn shot within its 36px cell
// (the rest is empty margin); it's what the collision body is sized to,
// so the hitbox matches the visible beam rather than the whole cell.
export const WEAPON_SHOTS_KEY = 'weapon-shots';
export const WEAPON_SHOTS_PATH = 'assets/weapons/shots.webp';
export const WEAPON_SHOTS_FRAME = { frameWidth: 36, frameHeight: 400 };
export const SHOT_BEAM_WIDTH = 6;

// weapon type (see config.js's WEAPON_TYPES) -> the cell index above for
// each phase of that weapon's shot. A weapon that can't stick to the
// ceiling only ever needs `flying`; the grapple uses all three, so its
// three states are visibly different shots rather than one graphic whose
// behaviour you have to infer.
export const WEAPON_SHOT_FRAMES = {
  harpoon: { flying: 0 },
  grapple: { flying: 1, stuck: 2, releasing: 3 },
};

export function weaponShotFrame(type, phase = 'flying') {
  const frames = WEAPON_SHOT_FRAMES[type] ?? WEAPON_SHOT_FRAMES.harpoon;
  return frames[phase] ?? frames.flying;
}

// Machine gun: unlike the harpoon and grapple, this weapon fires actual
// travelling BULLETS rather than a beam, so it has its own art rather than
// a cell in the shot spritesheet above. The dart is authored nose-up, so
// the game only rotates it by the angle it was fired at.
//
// BULLET_HIT is the splash it leaves where it stops on something it can't
// break -- the ceiling, the side walls, or an indestructible obstacle --
// with the same two-frame vertical layout every other effect sheet uses
// (frame 0 on top), so it swaps the same way.
export const BULLET_TEXTURE_KEY = 'bullet';
export const BULLET_TEXTURE_PATH = 'assets/weapons/bullet.webp';
export const BULLET_SIZE = { width: 6, height: 12 };
export const BULLET_HIT_TEXTURE_KEY = 'bullet-hit';
export const BULLET_HIT_TEXTURE_PATH = 'assets/weapons/bullet_hit.webp';
export const BULLET_HIT_FRAMES = 2;
export const BULLET_HIT_SIZE = 16;
export const BULLET_HIT_ANIM_KEY = 'bullet-hit-splash';

// Loading screen: the splash shown while BootScene loads everything else,
// plus a "%" glyph for the progress readout (the intro font has no percent
// sign, and this is the only place one is needed -- sized to
// HUD_DIGITS_SMALL_FRAME so it lines up with the digits beside it).
//
// These, and the small HUD digit strip the readout borrows, are loaded a
// scene EARLIER than everything else (ElementsScene, see BootScene's note)
// -- the loading screen has to be on screen before the load it reports on
// can start.
export const LOADING_TEXTURE_KEY = 'loading-splash';
export const LOADING_TEXTURE_PATH = 'assets/ui/loading.webp';
export const PERCENT_TEXTURE_KEY = 'loading-percent';
export const PERCENT_TEXTURE_PATH = 'assets/ui/percent.webp';

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
//
// A campaign level doesn't use its own: it gets its region's frame at the
// time of day it falls at, "<region background>_<phase>" (see regions.js's
// daylightBackground). Those five variants are generated from the region's
// one authored night frame by tools/daylight_backgrounds.py rather than
// drawn five times over, so a redrawn region is still one file to redraw.
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
export const MAX_LEVEL_FILES = 50;

export function levelFileKey(n) {
  return `level_${String(n).padStart(2, '0')}`;
}

export function levelFilePath(n) {
  return `${LEVELS_DIR}${levelFileKey(n)}.json`;
}

// Panic Mode's level -- same shape as a regular level file plus its own
// `panicSpawn` wave table (see LevelManager.js's PANIC_LEVEL/GameScene's
// updatePanicSpawner) -- deliberately loaded under a fixed name rather than
// through the level_NN probe above, so it never counts as (or displaces) a
// campaign level.
// The campaign's route: which continents it visits, in order, and the
// background/music/map position of each -- see js/regions.js.
export const REGIONS_KEY = 'regions';
export const REGIONS_PATH = `${LEVELS_DIR}regions.json`;

// The between-regions interlude's two graphics: the world map it draws the
// route on, and the plane that flies it. The map is authored at exactly
// half the playfield so it scales 2x cleanly (see js/WorldMapInterlude.js,
// which reads the texture's own width to place the route markers).
export const WORLDMAP_TEXTURE_KEY = 'worldmap';
export const WORLDMAP_TEXTURE_PATH = 'assets/ui/worldmap.webp';
export const PLANE_TEXTURE_KEY = 'plane';
export const PLANE_TEXTURE_PATH = 'assets/ui/plane.webp';

export const PANIC_LEVEL_KEY = 'panic-level';
export const PANIC_LEVEL_PATH = `${LEVELS_DIR}panic.json`;

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

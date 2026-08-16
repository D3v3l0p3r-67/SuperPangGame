import { OBSTACLE_BLOCK_SIZE, BORDER_THICKNESS, GROUND_Y, VIRTUAL_W } from './constants.js';
import { PLAYER_CONFIG } from './config.js';
import { Ball } from './Ball.js';
import { Ladder } from './Ladder.js';
import { Obstacle, refreshObstacleSeams } from './Obstacle.js';

// Populated by BootScene.populateLevels() from levels/*.json (see
// assets.js) before GameScene ever starts -- mutated in place (never
// reassigned) so this exported reference stays valid for every importer.
export const LEVELS = [];

// The same levels as loaded from levels/*.json, before any locally saved
// edit was laid over them (see ElementsScene / storage's levelEdits) --
// same index as LEVELS. This is what the editor's Revert puts back, and
// what tells it whether the level it has open is the shipped one.
export const SHIPPED_LEVELS = [];

// Swaps in a level definition at runtime, so saving in the editor changes
// the level the game plays from that moment on rather than only after a
// reload. LEVELS itself is never reassigned -- every importer holds this
// one array.
export function setLevel(index, def) {
  LEVELS[index] = def;
}

// The minimum a level definition has to have to be loadable: the two
// groups loadLevel() iterates. Everything else is optional and defaulted
// (see playerSpawn, and `ladders`/`background`/`weapon` below). Used both
// where a level file is read at boot and where the editor imports one, so
// "is this a level?" has a single answer.
export function isLevelDef(def) {
  return !!def && typeof def === 'object' && Array.isArray(def.obstacles) && Array.isArray(def.balls);
}

// Panic Mode's single level definition (levels/panic.json), populated by
// ElementsScene the same way as LEVELS above (Object.assign into this same
// reference, never reassigned) -- kept separate from LEVELS so it's never
// counted as a campaign level or offered in Start Level.
export const PANIC_LEVEL = {};

// Where the player starts, expressed the way Player.placeFeet takes it:
// x is the sprite's centre line, y the line the feet stand on. A level
// says this in an optional `playerStart` key -- without one the player
// starts in the middle of the floor, which is where every level written
// before the setting existed expects them.
export const DEFAULT_PLAYER_SPAWN = { x: VIRTUAL_W / 2, y: GROUND_Y };

// Keeps a start point inside the playfield with the whole sprite visible.
// Applied both where the editor places one and where a level is loaded, so
// a hand-edited file can't spawn the player inside the border or off the
// screen -- the same defensive reading every other field in a level gets.
export function clampPlayerSpawn(x, y) {
  const halfWidth = PLAYER_CONFIG.spriteWidth / 2;
  return {
    x: Math.min(Math.max(x, BORDER_THICKNESS + halfWidth), VIRTUAL_W - BORDER_THICKNESS - halfWidth),
    y: Math.min(Math.max(y, BORDER_THICKNESS + PLAYER_CONFIG.spriteHeight), GROUND_Y),
  };
}

// The start point a level definition asks for, or null when it names none
// (or names an unusable one). Null rather than the default itself, so a
// caller can tell "this level chose the middle of the floor" from "this
// level chose nothing" -- which is the difference the editor shows and
// writes back out.
export function playerSpawn(def) {
  const start = def.playerStart;
  if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) return null;
  return clampPlayerSpawn(start.x, start.y);
}

// Every level obstacle becomes one or more independent Obstacle blocks,
// each its own Arcade body -- that's what lets a breakable obstacle lose
// individual blocks to gunfire while the rest of its shape stays solid.
// A plain { x, y, w, h } auto-tiles into an OBSTACLE_BLOCK_SIZE grid
// (horizontal/vertical/rectangular shapes, per spec); a level can instead
// supply `cells`, a list of [dx, dy] pixel offsets from (x, y), to build
// non-rectangular ("stepped"/staircase) shapes block by block.
function obstacleBlocks(o) {
  if (o.cells) return o.cells.map(([dx, dy]) => [dx, dy, OBSTACLE_BLOCK_SIZE, OBSTACLE_BLOCK_SIZE]);

  const blocks = [];
  for (let dy = 0; dy < o.h; dy += OBSTACLE_BLOCK_SIZE) {
    const bh = Math.min(OBSTACLE_BLOCK_SIZE, o.h - dy);
    for (let dx = 0; dx < o.w; dx += OBSTACLE_BLOCK_SIZE) {
      const bw = Math.min(OBSTACLE_BLOCK_SIZE, o.w - dx);
      blocks.push([dx, dy, bw, bh]);
    }
  }
  return blocks;
}

// Loads a level definition into a GameScene's groups. Adding level 11+ is
// purely a new levels/level_11.json file -- nothing here needs to change.
// `idxOrDef` is normally an index into LEVELS, but the level editor passes
// a level definition object directly (its own, not part of LEVELS) to
// preview/play a custom level.
export function loadLevel(scene, idxOrDef) {
  const def = typeof idxOrDef === 'number' ? LEVELS[idxOrDef] : idxOrDef;

  scene.clearEntities();

  // One id per authored obstacle, shared by every block it decomposes
  // into: a 64x16 crate is four bodies and one THING, and shooting it
  // takes the thing (see GameScene.onProjectileHitObstacle).
  def.obstacles.forEach((o, pieceId) => {
    for (const [dx, dy, bw, bh] of obstacleBlocks(o)) {
      const block = new Obstacle(scene, o.type, o.x + dx, o.y + dy, bw, bh, o.powerup || null, pieceId);
      scene.obstacles.add(block);
    }
  });
  refreshObstacleSeams(scene.obstacles);

  // Optional, and defaulted here rather than required in the data: every
  // level written before ladders existed simply has no `ladders` key.
  for (const l of def.ladders || []) {
    scene.ladders.add(new Ladder(scene, l.type, l.x, l.y));
  }

  for (const b of def.balls) {
    const ball = new Ball(scene, b.shape, b.size, b.x, b.y, b.vx, b.vy, b.powerup || null);
    scene.balls.add(ball);
  }

  return def;
}

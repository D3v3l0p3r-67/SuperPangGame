import { OBSTACLE_BLOCK_SIZE } from './constants.js';
import { Ball } from './Ball.js';
import { Obstacle, refreshObstacleSeams } from './Obstacle.js';

// Populated by BootScene.populateLevels() from levels/*.json (see
// assets.js) before GameScene ever starts -- mutated in place (never
// reassigned) so this exported reference stays valid for every importer.
export const LEVELS = [];

// Panic Mode's single level definition (levels/panic.json), populated by
// ElementsScene the same way as LEVELS above (Object.assign into this same
// reference, never reassigned) -- kept separate from LEVELS so it's never
// counted as a campaign level or offered in Start Level.
export const PANIC_LEVEL = {};

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

  for (const o of def.obstacles) {
    for (const [dx, dy, bw, bh] of obstacleBlocks(o)) {
      const block = new Obstacle(scene, o.type, o.x + dx, o.y + dy, bw, bh, o.powerup || null);
      scene.obstacles.add(block);
    }
  }
  refreshObstacleSeams(scene.obstacles);

  for (const b of def.balls) {
    const ball = new Ball(scene, b.shape, b.size, b.x, b.y, b.vx, b.vy, b.powerup || null);
    scene.balls.add(ball);
  }

  return def;
}

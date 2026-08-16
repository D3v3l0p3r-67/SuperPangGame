import { OBSTACLE_TYPES } from './elements.js';
import { obstacleTextureKey } from './assets.js';
import { hexColor } from './colors.js';

// A single rectangular block balls collide with from any side, via a
// static Arcade body. LevelManager decomposes each level-authored
// obstacle into one or more of these (normally one per
// OBSTACLE_BLOCK_SIZE cell) so a multi-cell breakable obstacle can lose
// individual blocks to gunfire while the rest of its shape stays solid,
// and non-rectangular ("stepped") shapes are just a different set of
// block positions -- this class itself doesn't need to know any of that,
// it only ever renders/collides as one rectangle. Its type (from
// OBSTACLE_TYPES, see elements.js) decides whether it can be destroyed
// and how many shots it takes.
//
// A TileSprite, so it IS its own artwork: the material texture (see
// assets/obstacles, drawn by tools/obstacle_tiles.py) repeats across
// whatever w x h this block is, exactly as the border frame does, with
// only the palette (def.tileTexture) telling a crate from a wall -- so a
// crate reads as "the same wall, brown material" rather than a distinct
// look.
//
// The material carries no border of its own. What makes a block look like
// a block is drawn around the outside of the SHAPE its blocks form, not
// around each of them -- see drawObstacleEdges below. A 16x64 pillar is
// then one piece rather than four stacked boxes with seams down the
// middle of it.
//
// One game object, not two. This used to be an invisible Rectangle
// carrying the body with a separate TileSprite drawn over it, which put
// two entries on the display list per block -- 132 of level 50's 233,
// half of them rendering nothing -- and left the two to be kept in step
// by hand on every destroy.
export class Obstacle extends Phaser.GameObjects.TileSprite {
  constructor(scene, type, x, y, w, h, powerup = null) {
    const def = OBSTACLE_TYPES[type];
    super(scene, x, y, w, h, obstacleTextureKey(def.tileTexture));
    this.setOrigin(0, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setDepth(1);

    this.type = type;
    this.def = def;
    this.hitPoints = def.hitPoints;
    // Set by the level editor (or level data) to guarantee a specific
    // power-up drops when this block is destroyed -- see
    // GameScene.onProjectileHitObstacle. Meaningless (never read) for an
    // indestructible platform block, which never takes damage.
    this.forcedPowerup = powerup;
  }

  // Returns true if this hit destroyed the obstacle.
  takeHit() {
    if (!this.def.destructible) return false;
    this.hitPoints -= 1;
    if (this.hitPoints <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }
}

// A multi-block obstacle (or two separately-authored obstacles that just
// happen to sit flush against each other) is really a bunch of
// independent static bodies, each checked for collision on its own --
// which means a body sliding along the outside of that shape can catch on
// the SEAM between two adjacent blocks: Arcade sometimes resolves that
// exactly-tangent touch as if it landed on the seam itself (picking an
// arbitrary/wrong face), instead of the ball just continuing to slide
// past. Disabling checkCollision on whichever faces are internal (i.e.
// flush against another active block) removes those seams as collision
// targets entirely, leaving only the shape's true outer perimeter solid
// -- the standard fix for this class of bug in any tile/block-based
// Arcade Physics scene. Cheap enough to just recompute from scratch
// (O(blocks^2), and there are only ever a few dozen) any time the set of
// blocks changes, rather than tracking adjacency incrementally: after a
// level finishes loading (LevelManager.loadLevel), whenever the editor
// places/erases a block (editor.js), and whenever gunfire actually
// destroys one (GameScene.onProjectileHitObstacle) -- that last one is
// what re-exposes a neighbor's face once the block that used to cover it
// is gone.
export function refreshObstacleSeams(obstaclesGroup) {
  const blocks = obstaclesGroup.getChildren().filter((b) => b.active);
  for (const block of blocks) {
    const { x, y, width: w, height: h } = block.body;
    let up = false;
    let down = false;
    let left = false;
    let right = false;
    for (const other of blocks) {
      if (other === block) continue;
      const o = other.body;
      const verticalOverlap = o.x < x + w && o.x + o.width > x;
      const horizontalOverlap = o.y < y + h && o.y + o.height > y;
      if (verticalOverlap && o.y + o.height === y) up = true;
      if (verticalOverlap && o.y === y + h) down = true;
      if (horizontalOverlap && o.x + o.width === x) left = true;
      if (horizontalOverlap && o.x === x + w) right = true;
    }
    block.body.checkCollision.up = !up;
    block.body.checkCollision.down = !down;
    block.body.checkCollision.left = !left;
    block.body.checkCollision.right = !right;
    // The same four answers decide what the shape LOOKS like: an internal
    // face is not an edge, so nothing is drawn along it.
    block.edges = { up: !up, down: !down, left: !left, right: !right };
  }
  drawObstacleEdges(obstaclesGroup);
}

// The bevel, drawn around the outside of whatever shape the blocks form.
//
// Every block is a separate object with its own body (that is what lets a
// crate lose one block to gunfire while the rest stays solid), but a
// player looking at four stacked crates is looking at a pillar -- so the
// light and shadow belong to the pillar, not to each of its four blocks.
// Drawing them per block is what made a 16x64 piece read as four boxes.
//
// One Graphics object for the whole group, redrawn from scratch whenever
// the set of blocks changes -- the same moments the seams are recomputed,
// which is where the exposed faces come from. Cheap: a few dozen blocks,
// four lines each at most, and only when something is placed or shot.
export function drawObstacleEdges(obstaclesGroup) {
  const scene = obstaclesGroup.scene;
  if (!scene) return;
  if (!scene.obstacleEdges) {
    scene.obstacleEdges = scene.add.graphics();
    // Above the blocks (depth 1) and below everything that moves in front
    // of them -- balls, the player, shots.
    scene.obstacleEdges.setDepth(1.1);
  }
  const g = scene.obstacleEdges;
  g.clear();

  for (const block of obstaclesGroup.getChildren()) {
    if (!block.active || !block.edges) continue;
    const { x, y, displayWidth: w, displayHeight: h } = block;
    const light = hexColor(block.def.edgeLight ?? '#ffffff');
    const dark = hexColor(block.def.edgeDark ?? '#000000');
    // Lit from the top left, which is where every other sprite in this
    // game is lit from: the faces that look up and left catch it, the
    // ones that look down and right fall into shadow.
    line(g, light, x, y + 0.5, x + w, y + 0.5, block.edges.up);
    line(g, light, x + 0.5, y, x + 0.5, y + h, block.edges.left);
    line(g, dark, x, y + h - 0.5, x + w, y + h - 0.5, block.edges.down);
    line(g, dark, x + w - 0.5, y, x + w - 0.5, y + h, block.edges.right);
  }
}

function line(g, color, x1, y1, x2, y2, draw) {
  if (!draw) return;
  g.lineStyle(1, color, 1);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}

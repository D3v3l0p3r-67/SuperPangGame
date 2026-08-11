import { OBSTACLE_TYPES } from './elements.js';
import { obstacleTextureKey } from './assets.js';
import { hexColor } from './colors.js';

// A single rectangular block balls collide with from any side, via a
// static Arcade body. LevelManager decomposes each level-authored
// obstacle into one or more of these (normally one per 8x8 cell, see
// OBSTACLE_BLOCK_SIZE) so a multi-cell breakable obstacle can lose
// individual blocks to gunfire while the rest of its shape stays solid,
// and non-rectangular ("stepped") shapes are just a different set of
// block positions -- this class itself doesn't need to know any of that,
// it only ever renders/collides as one rectangle. Its type (from
// OBSTACLE_TYPES in config.js) decides whether it can be destroyed and
// how many shots it takes. Uses Phaser's plain Rectangle shape (not a
// texture) so each block can be sized exactly with no stretching.
export class Obstacle extends Phaser.GameObjects.Rectangle {
  constructor(scene, type, x, y, w, h, powerup = null) {
    const def = OBSTACLE_TYPES[type];
    super(scene, x + w / 2, y + h / 2, w, h, hexColor(def.color));

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

    // Every obstacle -- breakable crate or unbreakable wall -- is the same
    // beveled-block wall texture (see BootScene.buildWallTexture), tiled
    // across whatever w x h this block is (matches GameScene.drawBorder's
    // TileSprite approach); only the palette (def.tileTexture) differs, so
    // a crate reads as "the same wall, brown material" rather than a
    // distinct look. The Rectangle's own fill stays as a solid fallback
    // color underneath, fully hidden once the tile covers it.
    this.setFillStyle(hexColor(def.color), 0);
    this.wallTile = scene.add.tileSprite(x, y, w, h, obstacleTextureKey(def.tileTexture)).setOrigin(0, 0);
    this.wallTile.setDepth(2);
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

  destroy(fromScene) {
    if (this.wallTile) {
      this.wallTile.destroy(fromScene);
      this.wallTile = null;
    }
    super.destroy(fromScene);
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
  }
}

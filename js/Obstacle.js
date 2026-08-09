import { OBSTACLE_TYPES } from './config.js';

function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

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
    this.wallTile = scene.add.tileSprite(x, y, w, h, def.tileTexture).setOrigin(0, 0);
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

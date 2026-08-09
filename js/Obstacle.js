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
  constructor(scene, type, x, y, w, h) {
    const def = OBSTACLE_TYPES[type];
    super(scene, x + w / 2, y + h / 2, w, h, hexColor(def.color));

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setDepth(1);

    this.type = type;
    this.def = def;
    this.hitPoints = def.hitPoints;

    this.edge = scene.add.rectangle(x + w / 2, y, w, 2, hexColor(def.edgeColor));
    this.edge.setOrigin(0.5, 0);
    this.edge.setDepth(2);

    if (def.destructible) {
      this.setStrokeStyle(1, 0x0b0e2a);
    }
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
    if (this.edge) {
      this.edge.destroy(fromScene);
      this.edge = null;
    }
    super.destroy(fromScene);
  }
}

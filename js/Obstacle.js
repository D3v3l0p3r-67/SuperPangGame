import { OBSTACLE_TYPES } from './config.js';

function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

// A rectangular obstacle balls collide with from any side, via a static
// Arcade body. Its type (from OBSTACLE_TYPES in config.js) decides whether
// it can be destroyed and how many shots it takes -- adding a new obstacle
// type is purely a config change, nothing here needs to change. Uses
// Phaser's plain Rectangle shape (not a texture) so it can be sized to
// whatever width/height a level asks for with no stretching artifacts.
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

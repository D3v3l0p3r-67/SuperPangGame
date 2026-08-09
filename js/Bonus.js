import { POWERUP_TYPES, POWERUP_FALL_SPEED, POWERUP_TTL_MS } from './config.js';
import { GROUND_Y } from './constants.js';
import { powerupTextureKey } from './assets.js';

// A collectible power-up pickup. Drifts down to (roughly) ground level and
// despawns after a few seconds if not collected.
export class Bonus extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, type, x, y) {
    super(scene, x, y, powerupTextureKey(type));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.type = type;
    this.def = POWERUP_TYPES[type];
    this.floorY = GROUND_Y - 6;

    this.body.setAllowGravity(false);
    this.body.setVelocityY(POWERUP_FALL_SPEED);
    this.ttl = POWERUP_TTL_MS;
    this.setDepth(4);
  }

  update(dt) {
    if (this.y >= this.floorY) {
      this.y = this.floorY;
      this.body.setVelocityY(0);
    }
    this.ttl -= dt * 1000;
    if (this.ttl <= 0) this.destroy();
  }
}

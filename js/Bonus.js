import { POWERUP_FALL_SPEED, POWERUP_TTL_MS } from './config.js';
import { POWERUP_TYPES } from './elements.js';
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
    // The obstacle this drop came to rest on, if any -- see restOn().
    this.support = null;
    this.setDepth(4);
  }

  // Came to rest on an obstacle instead of on the ground (the collider in
  // GameScene.onPowerupHitObstacle calls this). The block it is standing on
  // is remembered, because nothing in Arcade would ever start this drop
  // moving again on its own: it has no gravity, and a body with no velocity
  // never moves into anything, so once the block under it is shot away the
  // drop would hang in mid-air exactly where the block used to be.
  restOn(obstacle) {
    this.body.setVelocityY(0);
    this.support = obstacle;
  }

  update(dt) {
    // The block it was standing on is gone: fall again. Where it stops is
    // decided the same way it was the first time -- the collider catches
    // the next obstacle below, and the floor line below catches everything
    // else.
    if (this.support && !this.support.active) {
      this.support = null;
      this.body.setVelocityY(POWERUP_FALL_SPEED);
    }

    // Landed: stop it ON the floor line. Through the BODY, not by writing
    // this.y -- Arcade moves the sprite from the body, never the other way
    // round, so setting the sprite alone would leave the pickup's actual
    // collision box a few px below the icon the player is aiming at for as
    // long as it sits there. (This body matches the sprite exactly -- no
    // setSize/setOffset -- so reset lands it exactly.)
    if (this.body.velocity.y !== 0 && this.body.center.y >= this.floorY) {
      this.body.reset(this.x, this.floorY); // also stops it -- see Body.reset
    }
    this.ttl -= dt * 1000;
    if (this.ttl <= 0) this.destroy();
  }
}

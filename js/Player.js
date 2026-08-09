import { PLAYER_CONFIG } from './config.js';
import { VIRTUAL_W, GROUND_Y } from './constants.js';

// Arcade sprite. Movement/animation stay explicit (velocity assigned every
// frame from input, not left to generic physics forces) -- Phaser owns the
// integration, collision, and world-bounds clamping, we own the numbers.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    const x = VIRTUAL_W / 2;
    const y = GROUND_Y - PLAYER_CONFIG.spriteHeight / 2;
    super(scene, x, y, 'player-idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Hitbox is smaller than the sprite and bottom-anchored: centered
    // horizontally (offsetX), flush with the sprite's bottom edge/feet
    // (offsetY = spriteHeight - hitboxHeight) rather than the sprite's
    // own vertical center.
    this.body.setSize(PLAYER_CONFIG.hitboxWidth, PLAYER_CONFIG.hitboxHeight);
    this.body.setOffset(
      (PLAYER_CONFIG.spriteWidth - PLAYER_CONFIG.hitboxWidth) / 2,
      PLAYER_CONFIG.spriteHeight - PLAYER_CONFIG.hitboxHeight
    );
    this.body.setAllowGravity(false);
    this.body.setCollideWorldBounds(true);

    this.facing = 1;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.isMoving = false;
    this.speedMultiplier = 1;
    this.shielded = false;
    this.invulnTimer = 0;

    this.shieldOutline = scene.add.rectangle(x, y, PLAYER_CONFIG.shieldSize, PLAYER_CONFIG.shieldSize);
    this.shieldOutline.setStrokeStyle(1, 0xffd23f);
    this.shieldOutline.setFillStyle();
    this.shieldOutline.setVisible(false);
    this.shieldOutline.setDepth(5);
    this.setDepth(4);
  }

  get isInvulnerable() {
    return this.invulnTimer > 0;
  }

  reset() {
    this.setPosition(VIRTUAL_W / 2, GROUND_Y - PLAYER_CONFIG.spriteHeight / 2);
    this.body.setVelocity(0, 0);
    this.speedMultiplier = 1;
    this.shielded = false;
    this.invulnTimer = 0;
    this.setAlpha(1);
    this.facing = 1;
    this.setFlipX(false);
  }

  update(dt, inputState) {
    let vx = 0;
    if (inputState.left) vx -= 1;
    if (inputState.right) vx += 1;
    this.isMoving = vx !== 0;
    if (vx !== 0) this.facing = vx;

    this.body.setVelocityX(vx * PLAYER_CONFIG.speed * this.speedMultiplier);

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt * 1000);
      this.setAlpha(Math.floor(this.invulnTimer / 90) % 2 === 0 ? 0.4 : 1);
    } else {
      this.setAlpha(1);
    }

    if (this.isMoving) {
      this.walkTimer += dt;
      if (this.walkTimer > 0.12) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 2;
      }
      this.setTexture(this.walkFrame === 0 ? 'player-idle' : 'player-walk');
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
      this.setTexture('player-idle');
    }
    this.setFlipX(this.facing < 0);

    this.shieldOutline.setPosition(this.x, this.y);
    this.shieldOutline.setVisible(this.shielded);
  }

  // Returns true if a life should be lost (i.e. no shield absorbed the hit).
  takeHit() {
    if (this.shielded) {
      this.shielded = false;
      this.invulnTimer = PLAYER_CONFIG.invulnMs;
      return false;
    }
    if (this.isInvulnerable) return false;
    this.invulnTimer = PLAYER_CONFIG.invulnMs;
    return true;
  }
}

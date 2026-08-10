import { PLAYER_CONFIG } from './config.js';
import { VIRTUAL_W, GROUND_Y } from './constants.js';
import { PLAYER_TEXTURE_KEY, PLAYER_ANIM_FRAMES } from './assets.js';

// Arcade sprite. Movement stays explicit (velocity assigned every frame
// from input, not left to generic physics forces) -- Phaser owns the
// integration, collision, and world-bounds clamping, we own the numbers.
// Facing is never a separate left/right asset -- setFlipX mirrors
// whichever frame is currently showing, so every animation only needs to
// be authored facing LEFT (see assets.js/BootScene's player animations);
// facing right is the mirrored (flipped) case.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    const x = VIRTUAL_W / 2;
    const y = GROUND_Y - PLAYER_CONFIG.spriteHeight / 2;
    super(scene, x, y, PLAYER_TEXTURE_KEY, PLAYER_ANIM_FRAMES.idle[0]);

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
    this.isMoving = false;
    this.speedMultiplier = 1;
    this.shielded = false;
    this.invulnTimer = 0;
    // While set ('shot', 'victory', or 'dead'), update() leaves the
    // current one-shot animation alone instead of overriding it with
    // idle/move every frame; cleared automatically when that animation
    // finishes.
    this.oneShotAnim = null;
    this.on('animationcomplete-player-shot', () => { this.oneShotAnim = null; });
    this.on('animationcomplete-player-victory', () => { this.oneShotAnim = null; });
    this.on('animationcomplete-player-dead', () => { this.oneShotAnim = null; });

    this.shieldOutline = scene.add.rectangle(x, y, PLAYER_CONFIG.shieldSize, PLAYER_CONFIG.shieldSize);
    this.shieldOutline.setStrokeStyle(1, 0xffd23f);
    this.shieldOutline.setFillStyle();
    this.shieldOutline.setVisible(false);
    this.shieldOutline.setDepth(5);
    this.setDepth(4);

    this.play('player-idle');
  }

  get isInvulnerable() {
    return this.invulnTimer > 0;
  }

  reset() {
    const x = VIRTUAL_W / 2;
    const y = GROUND_Y - PLAYER_CONFIG.spriteHeight / 2;
    this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.speedMultiplier = 1;
    this.shielded = false;
    this.invulnTimer = 0;
    this.setAlpha(1);
    this.facing = 1;
    this.setFlipX(this.facing > 0);
    this.oneShotAnim = null;
    this.play('player-idle');
    // update() is the only other place this normally moves/shows -- and
    // it doesn't run during LEVEL_INTRO (see GameScene.updatePlaying), so
    // without this a shield still active right as a level ends would sit
    // frozen at its old position/visible through the next level's intro
    // instead of following the player's fresh spawn point.
    this.shieldOutline.setPosition(x, y);
    this.shieldOutline.setVisible(false);
  }

  // Plays once, holding update() off the idle/move animation until it
  // finishes (see the 'animationcomplete-player-shot' listener above).
  playShotAnim() {
    this.oneShotAnim = 'shot';
    this.play('player-shot', true);
  }

  // Plays once, same as playShotAnim -- see GameScene.onPlayerHitBall.
  playDeadAnim() {
    this.oneShotAnim = 'dead';
    this.play('player-dead', true);
  }

  // Plays once, same as playShotAnim -- see GameScene.finishRun.
  playVictoryAnim() {
    this.oneShotAnim = 'victory';
    this.play('player-victory', true);
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

    if (!this.oneShotAnim) {
      this.play(this.isMoving ? 'player-move' : 'player-idle', true);
    }
    // Frames are authored facing left (see the class comment above), so
    // it's the RIGHT-facing case that needs the mirror now.
    this.setFlipX(this.facing > 0);

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

import { PLAYER_CONFIG, PLAYER_STEP_UP_PX } from './config.js';
import { VIRTUAL_W, GROUND_Y } from './constants.js';
import { PLAYER_TEXTURE_KEY, PLAYER_ANIM_FRAMES, PLAYER_SHIELD_TEXTURE_KEY, PLAYER_SHIELD_ANIM_KEY } from './assets.js';

// Arcade sprite. Movement stays explicit (velocity assigned every frame
// from input, not left to generic physics forces) -- Phaser owns the
// integration, collision, and world-bounds clamping, we own the numbers.
// Facing is never a separate left/right asset -- setFlipX mirrors
// whichever frame is currently showing, so every animation only needs to
// be authored facing LEFT (see assets.js/BootScene's player animations);
// facing right is the mirrored (flipped) case.
// The feet settle within a fraction of a pixel of the surface rather than
// exactly on it (followGround moves through velocity, and Arcade's
// integration lands close, not exact). Comparing step heights without a
// tolerance therefore fails by a hair -- a 16px tread reads as 16.4px and
// is rejected as a wall. One pixel is far below the step height and well
// above the residue.
const STEP_EPSILON = 1;

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
    // How fast the player drops when it walks off a ledge. Climbing is
    // instant (a step is only PLAYER_STEP_UP_PX tall, and gliding up it
    // would leave the player visibly inside the block for a few frames),
    // but a drop can be several steps' worth, and teleporting down that
    // far reads as a glitch.
    this.dropSpeed = 460;
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
    this.on('animationcomplete-player-levelclear', () => { this.oneShotAnim = null; });

    // A 3-frame looping animation (see assets.js's PLAYER_SHIELD_*)
    // instead of a drawn outline -- see update()/reset() for how it
    // tracks the player's position/visibility.
    this.shieldEffect = scene.add.sprite(x, y, PLAYER_SHIELD_TEXTURE_KEY);
    this.shieldEffect.play(PLAYER_SHIELD_ANIM_KEY);
    this.shieldEffect.setVisible(false);
    this.shieldEffect.setDepth(5);
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
    this.body.reset(x, y);
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
    this.shieldEffect.setPosition(x, y);
    this.shieldEffect.setVisible(false);
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

  // Level cleared: celebrate on the spot, alternating idle/victory three
  // times (see assets.js's PLAYER_ANIM_FRAMES.levelclear). The velocity
  // reset is the point of doing this here rather than just playing an
  // animation -- update() stops being called once the scene leaves
  // PLAYING (see GameScene.updatePlaying), so whatever velocity the
  // player was last moving at would otherwise carry it on sliding across
  // the screen for the whole celebration.
  playLevelClearAnim() {
    this.body.setVelocity(0, 0);
    this.isMoving = false;
    this.oneShotAnim = 'levelclear';
    this.play('player-levelclear', true);
  }

  // The player's feet: the bottom of the hitbox, which is flush with the
  // bottom of the sprite (see the constructor's setOffset).
  get feetY() {
    return this.body.bottom;
  }

  // Teleports the feet to `y` (spawn/reset only). Everything during play
  // moves through velocity instead -- see followGround.
  setFeet(y) {
    this.body.reset(this.x, y - PLAYER_CONFIG.spriteHeight / 2);
  }

  // Would the player fit standing on a surface at `top`? This is what
  // separates a STEP from a WALL. Without it, a wall built of stacked
  // blocks would be a ladder: each block's top is one block above the one
  // below, so the player would climb it a block at a time. Requiring room
  // for the whole body above the surface means stairs work and walls don't.
  canStandOn(top) {
    const left = this.body.x;
    const right = this.body.right;
    const headY = top - this.body.height;
    for (const o of this.scene.obstacles.getChildren()) {
      const ob = o.body;
      if (ob.right <= left || ob.x >= right) continue;
      if (ob.bottom <= headY || ob.y >= top) continue;
      return false;
    }
    return true;
  }

  // True when `obstacleBody` is a step this player can walk up rather than
  // a wall it has to stop at -- at most PLAYER_STEP_UP_PX above the feet,
  // with room to stand on top. GameScene uses this as the collider's
  // process callback, so a steppable block simply doesn't block.
  canStepOnto(obstacleBody) {
    return obstacleBody.y >= this.feetY - PLAYER_STEP_UP_PX - STEP_EPSILON
      && obstacleBody.y < this.feetY + STEP_EPSILON
      && this.canStandOn(obstacleBody.y);
  }

  // The surface the player should be standing on right now: the highest
  // one under its feet that it could actually step up onto, or the ground.
  supportSurface() {
    const left = this.body.x;
    const right = this.body.right;
    let best = GROUND_Y;
    for (const o of this.scene.obstacles.getChildren()) {
      const ob = o.body;
      if (ob.right <= left || ob.x >= right) continue;
      if (ob.y >= best) continue;                          // lower than what we have
      if (ob.y < this.feetY - PLAYER_STEP_UP_PX - STEP_EPSILON) continue; // too high to step onto
      if (!this.canStandOn(ob.y)) continue;                 // no headroom -- it's a wall
      best = ob.y;
    }
    return best;
  }

  // Keeps the feet on that surface: up instantly (it is one step at most),
  // down at a fall speed.
  //
  // Done by handing Arcade a velocity that covers exactly the distance
  // wanted this frame, rather than by writing a position. Writing the
  // sprite's y directly makes Arcade re-sync the body FROM the sprite,
  // and the sprite's x is a frame behind the body's -- which silently
  // undid the horizontal movement every frame and left the player unable
  // to walk at all.
  followGround(dt) {
    if (dt <= 0) return;
    const dy = this.supportSurface() - this.feetY;
    if (Math.abs(dy) < 0.5) {
      this.body.setVelocityY(0);
      return;
    }
    // Up: whatever it takes, it is one step. Down: capped, so walking off
    // a staircase falls rather than teleports.
    this.body.setVelocityY(dy < 0 ? dy / dt : Math.min(dy / dt, this.dropSpeed));
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

    // After the horizontal move, not before: which surface is underfoot
    // depends on where the player has just walked to.
    this.followGround(dt);

    this.shieldEffect.setPosition(this.x, this.y);
    this.shieldEffect.setVisible(this.shielded);
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

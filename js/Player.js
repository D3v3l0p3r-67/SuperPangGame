import { PLAYER_CONFIG, PLAYER_STEP_UP_PX, PLAYER_CLIMB_SPEED } from './config.js';
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

// Same idea for the ends of a ladder: the climb moves through velocity, so
// the feet land within a fraction of a pixel of an end rather than exactly
// on it, and an exact comparison would never see the climb arrive.
const LADDER_EPSILON = 1;

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
    // The ladder currently being climbed, or null when on foot. See
    // updateOnLadder() for what changes while it is set.
    this.ladder = null;
    // Whether this frame's up/down input went into a ladder rather than
    // being free for anything else. GameScene reads it to decide whether an
    // Up press meant "shoot" or "climb" -- they share the key.
    this.usedVerticalInput = false;
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
    this.ladder = null;
    this.usedVerticalInput = false;
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

  // Puts the player down exactly at (x, y), sprite and body together.
  //
  // Body.reset() on its own is not enough, and getting this wrong is what
  // an exact move costs in Arcade. reset() drops the body onto the game
  // object's top-left corner and ignores the body's own offset (the hitbox
  // is inset inside the sprite -- see the constructor), so the body ends
  // up out of the relationship Arcade maintains for it. updateFromGameObject
  // restores that -- but Arcade then writes the body back to the sprite by
  // the DELTA from `prev`, so that repair would be read as motion and the
  // SPRITE would be shoved by it on the next step. Re-baselining prev is
  // what makes the move a move and not a nudge.
  // Velocity is carried across on purpose: this is a placement, not a
  // stop. Body.reset() halts the body, which would cancel the walk every
  // time a step-up moved the feet -- the caller zeroes velocity itself
  // where stopping is the point.
  teleport(x, y) {
    const { x: vx, y: vy } = this.body.velocity;
    this.body.reset(x, y);
    this.body.updateFromGameObject();
    this.body.prev.set(this.body.position.x, this.body.position.y);
    this.body.prevFrame.set(this.body.position.x, this.body.position.y);
    this.body.setVelocity(vx, vy);
  }

  // Puts the player exactly where asked, in the terms the rest of this
  // class thinks in: the body's centre line and the feet.
  //
  // Both are read off the BODY, never the sprite. Arcade writes the body
  // back to the sprite once a frame, so mid-frame the sprite is a step
  // behind -- anchoring a move to it would quietly rewind the walk by a
  // frame every time a step-up moved the feet.
  placeFeet(centerX, feetY) {
    this.teleport(centerX, feetY - PLAYER_CONFIG.spriteHeight / 2);
  }

  // Puts the feet exactly on `y`, leaving the body's x where it is.
  setFeet(y) {
    this.placeFeet(this.body.center.x, y);
  }

  // How long one physics step lasts, in seconds -- NOT the render frame.
  // Arcade advances by a fixed step whatever the display is doing, so a
  // velocity meant to cover a known distance has to be measured against
  // the step, not against the frame that set it. Measured against the
  // frame, a display faster than the physics rate overshoots by the ratio
  // between them (2.4x at 144Hz) and every correction lands further out
  // than the last -- which is a player skidding back and forth rather than
  // arriving.
  get physicsStepSec() {
    const world = this.scene.physics.world;
    return world.fixedStep ? 1 / world.fps : 0;
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
  // `feetY` defaults to where the feet actually are; passing a different
  // one asks the same question about a position the player has not moved
  // to yet -- which is how the top of a ladder decides whether there is
  // anywhere to step off onto.
  supportSurface(feetY = this.feetY) {
    const left = this.body.x;
    const right = this.body.right;
    let best = GROUND_Y;
    for (const o of this.scene.obstacles.getChildren()) {
      const ob = o.body;
      if (ob.right <= left || ob.x >= right) continue;
      if (ob.y >= best) continue;                          // lower than what we have
      if (ob.y < feetY - PLAYER_STEP_UP_PX - STEP_EPSILON) continue; // too high to step onto
      if (!this.canStandOn(ob.y)) continue;                 // no headroom -- it's a wall
      best = ob.y;
    }
    return best;
  }

  // Keeps the feet on that surface: up instantly, down at a fall speed.
  //
  // Up is a placement rather than a velocity. It is one step at most (see
  // supportSurface), it wants to be instant anyway, and asking a velocity
  // to cover an exact distance is what made the player skid -- see
  // physicsStepSec.
  //
  // Down stays a velocity, because a drop should read as a fall rather
  // than a teleport; it is capped both by the fall speed and by what
  // covers the remaining distance in ONE physics step, so it settles onto
  // the surface instead of shooting past it and being pulled back.
  followGround(dt) {
    if (dt <= 0) return;
    const dy = this.supportSurface() - this.feetY;
    if (Math.abs(dy) < 0.5) {
      this.body.setVelocityY(0);
      return;
    }
    if (dy < 0) {
      this.setFeet(this.feetY + dy);
      this.body.setVelocityY(0);
      return;
    }
    const step = this.physicsStepSec || dt;
    this.body.setVelocityY(Math.min(dy / step, this.dropSpeed));
  }

  // The ladder a press of `dir` (-1 up, 1 down) would put the player on,
  // or null. Horizontal reach is by the player's CENTRE, so a ladder is
  // taken hold of when the player is actually standing in front of it
  // rather than when a shoulder happens to clip its edge.
  //
  // Going UP needs ladder above the feet that the player can actually
  // reach -- its foot no higher than their head, so a ladder hanging out
  // of reach overhead isn't grabbable from the floor. Going DOWN needs
  // ladder below the feet with its top at or above them, which is true
  // both at the very top of a ladder and on any platform it runs past.
  ladderFor(dir) {
    const cx = this.body.center.x;
    for (const l of this.scene.ladders.getChildren()) {
      if (cx < l.left || cx > l.right) continue;
      if (dir < 0) {
        if (l.top < this.feetY - LADDER_EPSILON && l.bottom >= this.body.y) return l;
      } else if (l.bottom > this.feetY + LADDER_EPSILON && l.top <= this.feetY + LADDER_EPSILON) {
        return l;
      }
    }
    return null;
  }

  dismountLadder() {
    this.ladder = null;
    this.body.setVelocityY(0);
  }

  // Movement while holding a ladder: up and down only (no left/right, by
  // design), passing straight through any obstacle in the way -- see
  // GameScene's player/obstacle collider, which stands down for a climber.
  //
  // Reaching an end is what lets go. At the BOTTOM that is unconditional:
  // stepping off downward just means standing on whatever is under the
  // ladder's foot, and if there is nothing there the player falls, exactly
  // as they would walking off a ledge. At the TOP it needs somewhere to
  // stand, or a ladder ending against the ceiling would drop the player
  // the whole way back down the instant they reached the top of it; with
  // no footing they simply stop there, still holding on.
  //
  // Only the end being climbed TOWARDS is tested. Testing both would let
  // go the instant the player took hold: a ladder standing on the floor
  // has its bottom exactly under the feet of anyone at the foot of it, so
  // pressing up there would mount and dismount in the same frame.
  //
  // Reaching an end doesn't always mean the climb is over. A tall ladder
  // is several elements stacked end to end, so the first thing an end
  // looks for is another ladder carrying on in the same direction -- the
  // seam between two of them has to be invisible to the player.
  updateOnLadder(dir) {
    const l = this.ladder;
    // Held on the ladder's centre line -- there is no left/right control
    // while climbing, so the only x this can ever have is the ladder's.
    if (Math.abs(this.body.center.x - l.centerX) > 0.5) this.placeFeet(l.centerX, this.feetY);
    this.body.setVelocityX(0);
    this.body.setVelocityY(dir * PLAYER_CLIMB_SPEED);

    if (dir > 0 && this.feetY >= l.bottom - LADDER_EPSILON) {
      const next = this.ladderFor(dir);
      if (next) this.ladder = next;
      else this.dismountLadder();
    } else if (dir < 0 && this.feetY <= l.top + LADDER_EPSILON) {
      const next = this.ladderFor(dir);
      if (next) this.ladder = next;
      else if (Math.abs(this.supportSurface(l.top) - l.top) < 0.5) this.dismountLadder();
      else {
        // Nothing to step off onto up here -- hold at the top instead.
        this.placeFeet(l.centerX, l.top);
        this.body.setVelocityY(0);
      }
    }
  }

  // Counts the post-hit grace period down, blinking the sprite for as long
  // as it lasts. Shared by both movement modes -- being on a ladder
  // changes how the player moves, not what a hit does to them.
  updateInvulnerability(dt) {
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt * 1000);
      this.setAlpha(Math.floor(this.invulnTimer / 90) % 2 === 0 ? 0.4 : 1);
    } else {
      this.setAlpha(1);
    }
  }

  update(dt, inputState) {
    // Up and down are the climb controls; up doubles as the shoot key, so
    // this flag reports back which of the two this frame's press was spent
    // on (see GameScene.updatePlaying).
    this.usedVerticalInput = false;

    if (!this.ladder) {
      const mountDir = inputState.upPressed ? -1 : (inputState.downPressed ? 1 : 0);
      if (mountDir !== 0) this.ladder = this.ladderFor(mountDir);
    }

    if (this.ladder) {
      this.usedVerticalInput = true;
      const dir = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);
      this.isMoving = dir !== 0;
      // Physics has already stepped by the time this runs, so the feet are
      // where this frame left them -- which is what the end checks read.
      this.updateOnLadder(dir);

      this.updateInvulnerability(dt);
      if (!this.oneShotAnim) this.play(this.isMoving ? 'player-move' : 'player-idle', true);
      this.setFlipX(this.facing > 0);
      this.shieldEffect.setPosition(this.x, this.y);
      this.shieldEffect.setVisible(this.shielded);
      return;
    }

    let vx = 0;
    if (inputState.left) vx -= 1;
    if (inputState.right) vx += 1;
    this.isMoving = vx !== 0;
    if (vx !== 0) this.facing = vx;

    this.body.setVelocityX(vx * PLAYER_CONFIG.speed * this.speedMultiplier);

    this.updateInvulnerability(dt);

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

import { MIN_BALL_SIZE } from './config.js';
import { getBallElement, maxBallSize, ballMovement } from './elements.js';
import { ballTextureKey, ballSpinAnimKey } from './assets.js';

// A ball is a (shape, size) pair. Every physical parameter -- radius,
// speed, bounceVelocity, gravity, points, color -- is read straight from
// its one BALL_ELEMENTS entry (see elements.js/elements/*.json), fully
// resolved there (a hex ball's speed is already whatever multiple of a
// round ball's it should be, no runtime multiplier). Two balls of the
// same (shape, size) always move and bounce identically (only direction
// can differ) because velocity is never randomized in magnitude, and
// landings always reset vertical speed to the size's fixed bounceVelocity
// via landOnTop() rather than reusing whatever the ball fell in at --
// GameScene's collision callbacks are the only place that calls
// landOnTop()/wall-flips, on top of Phaser's own collision detection.
export class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, shape, size, x, y, vx, vy, powerup = null) {
    // Clamped to however many size tiers this shape actually has elements
    // for (see maxBallSize) -- computed before super() since the clamped
    // size picks which texture file to load (each size is its own
    // native-resolution image, see assets.js -- not one shared texture
    // scaled at runtime).
    const clampedSize = Math.min(size, maxBallSize(shape));
    super(scene, x, y, ballTextureKey(shape, clampedSize));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const el = getBallElement(shape, clampedSize);
    this.shape = shape;
    this.size = clampedSize;
    this.hasGravity = el.hasGravity;
    this.radius = el.radius;
    this.points = el.points;
    this.speed = el.speed;
    this.bounceVelocity = el.bounceVelocity;
    this.gravityAccel = el.gravityAccel || 0;
    this.color = el.color;
    // Set by the level editor (or level data) to guarantee a specific
    // power-up drops when this exact ball is popped, bypassing the usual
    // random POWERUP_DROP_CHANCE roll -- see GameScene.popBall.
    this.forcedPowerup = powerup;

    // No setScale() needed -- the texture file is already the ball's true
    // pixel size (2x its radius), so the sprite and its circle body both
    // use that native size directly. The collider is deliberately 1px
    // shy of the drawn radius (2px narrower across) so contact needs a
    // slight visual overlap rather than triggering on the outermost
    // antialiased-looking edge pixel; `this.radius` stays the VISUAL
    // radius, which is what spawn placement/the editor position against.
    // The offset is left to setCircle's own default, which centres the
    // circle in the frame for whatever radius it's given.
    this.body.setCircle(Math.max(1, this.radius - 1));
    this.body.setAllowGravity(this.hasGravity);
    if (this.hasGravity) this.body.setGravityY(this.gravityAccel);
    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    this.body.setBounce(0, 0); // bounce handled explicitly, never via Arcade restitution
    this.setDepth(3);

    if (vx !== undefined) {
      this.body.setVelocityX(vx);
    } else {
      this.body.setVelocityX(this.randomHSpeed());
    }

    if (vy !== undefined) {
      this.body.setVelocityY(vy);
    } else if (this.hasGravity) {
      this.body.setVelocityY(0);
    } else {
      this.body.setVelocityY(this.speed * Math.SQRT1_2 * randomSign());
    }

    // Tracks which way the ball is currently headed horizontally,
    // independent of body.velocity.x -- see reassertHorizontal().
    this.hDir = Math.sign(this.body.velocity.x) || 1;

    // How this ball moves beyond bouncing (see elements.js's
    // BALL_MOVEMENTS): weaving, hunting the player, or -- for the plain
    // bouncers and every ball that shipped before variants existed --
    // nothing at all. Set after hDir, which is what a movement steers.
    this.movement = ballMovement(el.movement);
    this.movementPhase = 0;
    this.movement.init?.(this);

    // Last frame's vertical speed -- see rememberVerticalSpeed().
    this.lastVelocityY = this.body.velocity.y;

    // Hex balls spin (see setFrozen below); round balls fall/land, they
    // don't roll, so they stay on their single static frame.
    if (this.shape === 'hex') this.play(ballSpinAnimKey(this.shape, this.size));
  }

  // Horizontal speed magnitude never changes over a round ball's flight
  // (only vertical speed does, via gravity/landOnTop); a hex ball's
  // diagonal speed splits evenly between both axes at a constant
  // magnitude. Every bounce response below reapplies one of these fixed
  // magnitudes rather than reflecting the body's current velocity --
  // Arcade Physics resolves the collision (with bounce explicitly 0, see
  // constructor) by zeroing the colliding axis's velocity *before* the
  // collision callback runs, so "reflect whatever's there" would just
  // leave the ball motionless at the wall/obstacle instead of bouncing.
  get hSpeed() {
    return this.hasGravity ? this.speed : this.speed * Math.SQRT1_2;
  }

  get vSpeed() {
    return this.speed * Math.SQRT1_2; // only meaningful for hex balls
  }

  // A fresh random left/right horizontal speed at this ball's fixed
  // magnitude -- used both by the constructor's default vx and by
  // activateDrift() below (Panic Mode spawns a ball with vx pinned to 0,
  // see GameScene.spawnPanicBall, then calls this once it clears the
  // ceiling to give it the same drift a normal spawn would have gotten).
  randomHSpeed() {
    return this.hSpeed * randomSign();
  }

  // Panic Mode drops balls flush against the ceiling with vx forced to 0
  // so they fall straight down instead of drifting sideways through the
  // border (see GameScene.spawnPanicBall/updatePlaying's release check).
  // Called the instant one clears the ceiling to give it its normal,
  // never-zero horizontal drift.
  activateDrift() {
    this.body.setVelocityX(this.randomHSpeed());
    this.hDir = Math.sign(this.body.velocity.x) || 1;
  }

  // Panic Mode also overrides vertical motion during that same pinned
  // descent -- gravity off, vy set to a constant rate so every size can
  // hit its own prescribed time to a shared release height regardless of
  // sharing one gravityAccel (see GameScene.spawnPanicBall). Called
  // alongside activateDrift() once release fires, to hand vertical motion
  // back to whatever "normal" means for this ball: gravity balls just need
  // gravity switched back on (their current vy carries over smoothly into
  // it); non-gravity (hex) balls have no gravity to correct their vy later,
  // so it has to be set back to their fixed vSpeed immediately.
  resumeNormalFall() {
    if (this.hasGravity) this.body.setAllowGravity(true);
    else this.body.setVelocityY(this.vSpeed);
  }

  // Ball landed on a surface below it (ground or an obstacle top). Round
  // balls always leave at exactly bounceVelocity regardless of how fast
  // they were falling; hex balls reflect at their fixed diagonal speed.
  landOnTop() {
    this.body.setVelocityY(this.hasGravity ? -this.bounceVelocity : -this.vSpeed);
  }

  // Records the vertical speed the ball is currently travelling at, once
  // per frame from GameScene.updatePlaying. Necessary because Arcade
  // zeroes the colliding axis's velocity BEFORE the collision callback
  // runs (see the class comment above), so by the time bounceOffBottom()
  // is called the speed the ball actually arrived with is already gone --
  // this keeps the last value from before that, which is it.
  rememberVerticalSpeed() {
    this.lastVelocityY = this.body.velocity.y;
  }

  // Ball hit a surface above it (ceiling, or an obstacle's underside)
  // while moving up. A round ball turns around immediately and leaves at
  // the speed it was still climbing at, so the more climb the ceiling cut
  // short, the faster it comes back down -- rather than stalling at zero
  // and dribbling off the ceiling as it used to. That extra speed can't
  // accumulate across bounces: landOnTop() puts the next climb back at
  // the size's fixed bounceVelocity no matter how fast the ball landed.
  // Hex balls have no gravity and just reflect at their fixed speed.
  bounceOffBottom() {
    this.body.setVelocityY(this.hasGravity ? Math.abs(this.lastVelocityY) : this.vSpeed);
  }

  bounceOffLeft() {
    this.hDir = 1;
    this.body.setVelocityX(this.hSpeed);
  }

  bounceOffRight() {
    this.hDir = -1;
    this.body.setVelocityX(-this.hSpeed);
  }

  // Reapplies the ball's current horizontal direction unchanged (never
  // flips it) -- for a corner hit, where the vertical bounce above "wins"
  // (see GameScene.onWorldBounds/onBallHitObstacle) and horizontal isn't
  // supposed to change direction, but Arcade still zeroes vx as part of
  // resolving that same collision. Without this, the ball would be left
  // motionless on the horizontal axis instead of continuing the way it
  // was already going.
  reassertHorizontal() {
    this.body.setVelocityX(this.hDir * this.hSpeed);
  }

  // One frame of whatever this ball does beyond bouncing (see
  // elements.js's BALL_MOVEMENTS). Called from GameScene.updatePlaying
  // AFTER the physics step, so it can set the horizontal velocity
  // outright -- anything a bounce did this frame has already happened.
  // Never called while balls are frozen: a movement is motion, and a
  // frozen ball is not moving.
  updateMovement(dt, scene) {
    this.movement.update(this, dt, scene);
  }

  // Pauses/resumes the hex spin animation started in the constructor
  // while balls are frozen (see GameScene's ballsFrozen/time_freeze) --
  // round balls never animate, so this is a no-op for them. Safe to call
  // every frame regardless of whether frozen actually changed.
  setFrozen(frozen) {
    if (this.shape !== 'hex') return;
    if (frozen) this.anims.pause();
    else this.anims.resume();
  }

  // Descriptors for exactly two children one size smaller (one sent left,
  // one right), or none if already size 1. Children get a small one-time
  // upward pop (round) so they visibly separate from the hit point; the
  // moment either one first lands, GameScene's collision handling switches
  // it to the standard bounce for its size like any other ball.
  getSplitChildren() {
    if (this.size <= MIN_BALL_SIZE) return [];

    const childSize = this.size - 1;
    const childEl = getBallElement(this.shape, childSize);
    const childSpeed = childEl.speed;
    // Spawn the two children half the new (smaller) radius apart from the
    // pop point, one either side, so they don't start fully overlapping
    // each other -- they're still moving apart immediately (opposite vx)
    // either way, but this keeps them visually distinct from the very
    // first frame instead of one dead frame of a perfect double-image.
    const offset = childEl.radius / 2;
    const children = [];

    if (this.hasGravity) {
      const spawnKick = -childEl.bounceVelocity * 0.6;
      children.push({ shape: this.shape, size: childSize, x: this.x - offset, y: this.y, vx: -childSpeed, vy: spawnKick });
      children.push({ shape: this.shape, size: childSize, x: this.x + offset, y: this.y, vx: childSpeed, vy: spawnKick });
    } else {
      const component = childSpeed * Math.SQRT1_2;
      children.push({ shape: this.shape, size: childSize, x: this.x - offset, y: this.y, vx: -component, vy: -component });
      children.push({ shape: this.shape, size: childSize, x: this.x + offset, y: this.y, vx: component, vy: component });
    }
    return children;
  }
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

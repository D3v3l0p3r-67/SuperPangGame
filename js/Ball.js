import { MIN_BALL_SIZE } from './config.js';
import { getBallElement, maxBallSize } from './elements.js';
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
    // use that native size directly.
    this.body.setCircle(this.radius);
    this.body.setAllowGravity(this.hasGravity);
    if (this.hasGravity) this.body.setGravityY(this.gravityAccel);
    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    this.body.setBounce(0, 0); // bounce handled explicitly, never via Arcade restitution
    this.setDepth(3);

    if (vx !== undefined) {
      this.body.setVelocityX(vx);
    } else if (this.hasGravity) {
      this.body.setVelocityX(this.speed * randomSign());
    } else {
      this.body.setVelocityX(this.speed * Math.SQRT1_2 * randomSign());
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

  // Ball landed on a surface below it (ground or an obstacle top). Round
  // balls always leave at exactly bounceVelocity regardless of how fast
  // they were falling; hex balls reflect at their fixed diagonal speed.
  landOnTop() {
    this.body.setVelocityY(this.hasGravity ? -this.bounceVelocity : -this.vSpeed);
  }

  // Ball hit a surface above it (ceiling, or an obstacle's underside)
  // while moving up. Round balls just start falling again under gravity;
  // hex balls reflect at their fixed diagonal speed.
  bounceOffBottom() {
    this.body.setVelocityY(this.hasGravity ? 0 : this.vSpeed);
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
      const spawnKick = -childEl.bounceVelocity * 0.35;
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

import { BALL_SHAPES, BALL_SIZES, MIN_BALL_SIZE } from './config.js';

// Reference radius the round/hex textures are drawn at (see BootScene) --
// matches the largest ball (size 5, radius 24) so it renders at native
// resolution; every other Ball scales its sprite (and, via Arcade's
// scale-aware circle body, its collision radius) down from this to its
// actual size's radius.
export const BALL_TEXTURE_REF_RADIUS = 24;

// A ball is a (shape, size) pair. Shape (round/hex) decides whether gravity
// applies; size (1-5) decides every physical parameter -- radius, speed,
// bounceVelocity, gravity, points -- read straight from BALL_SHAPES /
// BALL_SIZES in config.js. Two balls of the same size always move and
// bounce identically (only direction can differ) because velocity is
// never randomized in magnitude, and landings always reset vertical speed
// to the size's fixed bounceVelocity via landOnTop() rather than reusing
// whatever the ball fell in at -- GameScene's collision callbacks are the
// only place that calls landOnTop()/wall-flips, on top of Phaser's own
// collision detection.
export class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, shape, size, x, y, vx, vy, powerup = null) {
    const textureKey = shape === 'hex' ? 'ball-hex' : 'ball-round';
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.shape = shape;
    this.shapeDef = BALL_SHAPES[shape];
    // Hex only has 3 defined tiers (see BALL_SHAPES.hex.maxSize) -- clamp
    // rather than index past the end of BALL_SIZES.
    this.size = Math.min(size, this.shapeDef.maxSize);
    const sizeDef = BALL_SIZES[this.size - 1];
    this.radius = sizeDef.radius;
    this.points = sizeDef.points;
    this.speed = sizeDef.speed * (this.shapeDef.speedMultiplier || 1);
    this.bounceVelocity = sizeDef.bounceVelocity;
    this.gravity = sizeDef.gravity;
    // Set by the level editor (or level data) to guarantee a specific
    // power-up drops when this exact ball is popped, bypassing the usual
    // random POWERUP_DROP_CHANCE roll -- see GameScene.popBall.
    this.forcedPowerup = powerup;

    this.setScale(this.radius / BALL_TEXTURE_REF_RADIUS);
    this.body.setCircle(BALL_TEXTURE_REF_RADIUS);
    this.body.setAllowGravity(this.shapeDef.gravity);
    if (this.shapeDef.gravity) this.body.setGravityY(this.gravity);
    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    this.body.setBounce(0, 0); // bounce handled explicitly, never via Arcade restitution
    this.setDepth(3);

    if (vx !== undefined) {
      this.body.setVelocityX(vx);
    } else if (this.shapeDef.gravity) {
      this.body.setVelocityX(this.speed * randomSign());
    } else {
      this.body.setVelocityX(this.speed * Math.SQRT1_2 * randomSign());
    }

    if (vy !== undefined) {
      this.body.setVelocityY(vy);
    } else if (this.shapeDef.gravity) {
      this.body.setVelocityY(0);
    } else {
      this.body.setVelocityY(this.speed * Math.SQRT1_2 * randomSign());
    }
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
    return this.shapeDef.gravity ? this.speed : this.speed * Math.SQRT1_2;
  }

  get vSpeed() {
    return this.speed * Math.SQRT1_2; // only meaningful for hex balls
  }

  // Ball landed on a surface below it (ground or an obstacle top). Round
  // balls always leave at exactly bounceVelocity regardless of how fast
  // they were falling; hex balls reflect at their fixed diagonal speed.
  landOnTop() {
    this.body.setVelocityY(this.shapeDef.gravity ? -this.bounceVelocity : -this.vSpeed);
  }

  // Ball hit a surface above it (ceiling, or an obstacle's underside)
  // while moving up. Round balls just start falling again under gravity;
  // hex balls reflect at their fixed diagonal speed.
  bounceOffBottom() {
    this.body.setVelocityY(this.shapeDef.gravity ? 0 : this.vSpeed);
  }

  bounceOffLeft() {
    this.body.setVelocityX(this.hSpeed);
  }

  bounceOffRight() {
    this.body.setVelocityX(-this.hSpeed);
  }

  // Hex balls spin around their own axis as they fly, like a rolling
  // wheel: angular speed derived from actual horizontal velocity / radius
  // so bigger/slower balls turn slower and it visibly reverses on a
  // horizontal bounce. Round balls don't spin (they fall/land, they don't
  // roll). Never called while frozen -- see GameScene.updatePlaying.
  spin(dt) {
    if (this.shapeDef.gravity) return;
    this.rotation += (this.body.velocity.x / this.radius) * dt;
  }

  // Descriptors for exactly two children one size smaller (one sent left,
  // one right), or none if already size 1. Children get a small one-time
  // upward pop (round) so they visibly separate from the hit point; the
  // moment either one first lands, GameScene's collision handling switches
  // it to the standard bounce for its size like any other ball.
  getSplitChildren() {
    if (this.size <= MIN_BALL_SIZE) return [];

    const childSize = this.size - 1;
    const childSizeDef = BALL_SIZES[childSize - 1];
    const childSpeed = childSizeDef.speed * (this.shapeDef.speedMultiplier || 1);
    const children = [];

    if (this.shapeDef.gravity) {
      const spawnKick = -childSizeDef.bounceVelocity * 0.35;
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: -childSpeed, vy: spawnKick });
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: childSpeed, vy: spawnKick });
    } else {
      const component = childSpeed * Math.SQRT1_2;
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: -component, vy: -component });
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: component, vy: component });
    }
    return children;
  }
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

import { BALL_SHAPES, BALL_SIZES, MIN_BALL_SIZE } from './config.js';

// Reference radius the round/hex textures are drawn at (see BootScene) --
// every Ball scales its sprite (and, via Arcade's scale-aware circle body,
// its collision radius) down from this to its actual size's radius.
export const BALL_TEXTURE_REF_RADIUS = 20;

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
  constructor(scene, shape, size, x, y, vx, vy) {
    const textureKey = shape === 'hex' ? 'ball-hex' : 'ball-round';
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.shape = shape;
    this.size = size;
    this.shapeDef = BALL_SHAPES[shape];
    const sizeDef = BALL_SIZES[size - 1];
    this.radius = sizeDef.radius;
    this.points = sizeDef.points;
    this.speed = sizeDef.speed;
    this.bounceVelocity = sizeDef.bounceVelocity;
    this.gravity = sizeDef.gravity;

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

  // Round balls always leave a landing at exactly this speed, regardless
  // of how fast they were falling -- the one deterministic bounce rule.
  landOnTop() {
    this.body.setVelocityY(-this.bounceVelocity);
  }

  bounceOffBottom() {
    this.body.setVelocityY(Math.abs(this.body.velocity.y));
  }

  bounceOffLeft() {
    this.body.setVelocityX(Math.abs(this.body.velocity.x));
  }

  bounceOffRight() {
    this.body.setVelocityX(-Math.abs(this.body.velocity.x));
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
    const children = [];

    if (this.shapeDef.gravity) {
      const spawnKick = -childSizeDef.bounceVelocity * 0.35;
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: -childSizeDef.speed, vy: spawnKick });
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: childSizeDef.speed, vy: spawnKick });
    } else {
      const component = childSizeDef.speed * Math.SQRT1_2;
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: -component, vy: -component });
      children.push({ shape: this.shape, size: childSize, x: this.x, y: this.y, vx: component, vy: component });
    }
    return children;
  }
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

import { VIRTUAL_W, VIRTUAL_H } from './constants.js';
import { PLAYER_CONFIG, BALL_SHAPES, BALL_SIZES, MIN_BALL_SIZE, OBSTACLE_TYPES, POWERUP_TYPES, POWERUP_FALL_SPEED, POWERUP_TTL_MS } from './config.js';
import { resolveCircleRect } from './physics.js';

const GROUND_MARGIN = 10;
export const GROUND_Y = VIRTUAL_H - GROUND_MARGIN;

export class Player {
  constructor() {
    this.width = PLAYER_CONFIG.width;
    this.height = PLAYER_CONFIG.height;
    this.facing = 1;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.isMoving = false;
    this.reset();
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  get isInvulnerable() {
    return this.invulnTimer > 0;
  }

  reset() {
    this.x = VIRTUAL_W / 2 - this.width / 2;
    this.y = GROUND_Y - this.height;
    this.speedMultiplier = 1;
    this.shielded = false;
    this.invulnTimer = 0;
  }

  update(dt, inputState) {
    let vx = 0;
    if (inputState.left) vx -= 1;
    if (inputState.right) vx += 1;
    this.isMoving = vx !== 0;
    if (vx !== 0) this.facing = vx;

    this.x += vx * PLAYER_CONFIG.speed * this.speedMultiplier * dt;
    this.x = clamp(this.x, 0, VIRTUAL_W - this.width);

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt * 1000);

    if (this.isMoving) {
      this.walkTimer += dt;
      if (this.walkTimer > 0.12) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 2;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }
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

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

let projectileId = 0;

export class Projectile {
  constructor(x, y, width, speed, pierce) {
    this.id = ++projectileId;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = 7;
    this.vy = -speed;
    this.hitsLeft = pierce;
    this.active = true;
  }

  get rect() {
    return { x: this.x - this.width / 2, y: this.y - this.height, w: this.width, h: this.height };
  }

  update(dt) {
    this.y += this.vy * dt;
    if (this.y < -this.height) this.active = false;
  }
}

let ballId = 0;

// A ball is a (shape, size) pair. Shape (round/hex) controls whether
// gravity applies and how it looks; size (1-5) controls every physical
// parameter (radius/speed/bounceVelocity/gravity/points), read straight
// from the BALL_SHAPES / BALL_SIZES registries in config.js. Two balls of
// the same size always move identically -- the only thing that can differ
// is their direction -- because velocity is never randomized and a
// landing always resets vertical speed to the size's fixed
// bounceVelocity rather than reusing whatever the ball fell in at.
export class Ball {
  constructor(shape, size, x, y, vx, vy) {
    this.id = ++ballId;
    this.shape = shape;
    this.size = size;
    this.shapeDef = BALL_SHAPES[shape];
    const sizeDef = BALL_SIZES[size - 1];
    this.radius = sizeDef.radius;
    this.points = sizeDef.points;
    this.speed = sizeDef.speed;
    this.bounceVelocity = sizeDef.bounceVelocity;
    this.gravity = sizeDef.gravity;
    this.x = x;
    this.y = y;

    // vx and vy are independently optional: level data typically pins down
    // just vx (direction), leaving vy to default sensibly per shape; split
    // children always pass both explicitly.
    if (vx !== undefined) {
      this.vx = vx;
    } else if (this.shapeDef.gravity) {
      this.vx = this.speed * randomSign();
    } else {
      this.vx = this.speed * Math.SQRT1_2 * randomSign();
    }

    if (vy !== undefined) {
      this.vy = vy;
    } else if (this.shapeDef.gravity) {
      // Fresh (non-split) round ball: no initial vertical speed -- it
      // free-falls to its first landing, after which every bounce uses
      // the size's standard bounceVelocity.
      this.vy = 0;
    } else {
      this.vy = this.speed * Math.SQRT1_2 * randomSign();
    }

    this.active = true;
  }

  get circle() {
    return { x: this.x, y: this.y, radius: this.radius };
  }

  // Round balls always leave a landing at exactly this speed, regardless
  // of how fast they were falling -- the one deterministic bounce rule.
  landOnTop() {
    this.vy = -this.bounceVelocity;
  }

  update(dt, obstacles) {
    // Sub-step so a fast ball can't cross an entire obstacle within one
    // frame (tunneling): cap each sub-step's travel to roughly one radius.
    const travel = Math.hypot(this.vx, this.vy) * dt;
    const maxStepTravel = Math.max(1, this.radius);
    const steps = Math.min(8, Math.max(1, Math.ceil(travel / maxStepTravel)));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i++) this.integrate(stepDt, obstacles);
  }

  integrate(dt, obstacles) {
    if (this.shapeDef.gravity) this.vy += this.gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.radius > VIRTUAL_W) {
      this.x = VIRTUAL_W - this.radius;
      this.vx = -Math.abs(this.vx);
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }

    if (this.y + this.radius > GROUND_Y) {
      this.y = GROUND_Y - this.radius;
      if (this.shapeDef.gravity) this.landOnTop();
      else this.vy = -Math.abs(this.vy);
    }

    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      const side = resolveCircleRect(this, obstacle.rect);
      if (!side) continue;
      if (side === 'top') {
        if (this.shapeDef.gravity) this.landOnTop();
        else this.vy = -Math.abs(this.vy);
      } else if (side === 'bottom') {
        this.vy = Math.abs(this.vy);
      } else if (side === 'left') {
        this.vx = -Math.abs(this.vx);
      } else {
        this.vx = Math.abs(this.vx);
      }
    }
  }

  // Marks this ball inactive and returns exactly two children one size
  // smaller (one sent left, one sent right), or none if already size 1.
  // Children get a small one-time upward pop so they visibly separate
  // from the hit point; the moment either one first lands, it switches to
  // the standard bounce for its size like any other ball.
  onHit() {
    this.active = false;
    if (this.size <= MIN_BALL_SIZE) return [];

    const childSize = this.size - 1;
    const childSizeDef = BALL_SIZES[childSize - 1];
    const children = [];

    if (this.shapeDef.gravity) {
      const spawnKick = -childSizeDef.bounceVelocity * 0.35;
      children.push(new Ball(this.shape, childSize, this.x, this.y, -childSizeDef.speed, spawnKick));
      children.push(new Ball(this.shape, childSize, this.x, this.y, childSizeDef.speed, spawnKick));
    } else {
      const component = childSizeDef.speed * Math.SQRT1_2;
      children.push(new Ball(this.shape, childSize, this.x, this.y, -component, -component));
      children.push(new Ball(this.shape, childSize, this.x, this.y, component, component));
    }
    return children;
  }
}

let obstacleId = 0;

// A rectangular obstacle balls collide with from any side. Its type (from
// OBSTACLE_TYPES in config.js) decides whether it can be destroyed and how
// many shots it takes; adding a new obstacle type is purely a config
// change, nothing here needs to change.
export class Obstacle {
  constructor(type, x, y, w, h) {
    this.id = ++obstacleId;
    this.type = type;
    this.def = OBSTACLE_TYPES[type];
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.hitPoints = this.def.hitPoints;
    this.active = true;
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // Returns true if this hit destroyed the obstacle.
  takeHit() {
    if (!this.def.destructible) return false;
    this.hitPoints -= 1;
    if (this.hitPoints <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }
}

export class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.def = POWERUP_TYPES[type];
    this.x = x;
    this.y = y;
    this.width = 9;
    this.height = 9;
    this.vy = POWERUP_FALL_SPEED;
    this.ttl = POWERUP_TTL_MS;
    this.active = true;
  }

  get rect() {
    return { x: this.x - this.width / 2, y: this.y - this.height / 2, w: this.width, h: this.height };
  }

  update(dt, floorY) {
    if (this.y < floorY) {
      this.y += this.vy * dt;
      if (this.y > floorY) this.y = floorY;
    }
    this.ttl -= dt * 1000;
    if (this.ttl <= 0) this.active = false;
  }
}

export class Particle {
  constructor(x, y, vx, vy, color, life, size = 2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.active = true;
  }

  get alpha() {
    return Math.max(0, this.life / this.maxLife);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 140 * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

export function spawnPopParticles(particles, x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 0.35 + Math.random() * 0.25));
  }
}

export function spawnSparkle(particles, x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 25;
    particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 0.3 + Math.random() * 0.2, 1.5));
  }
}

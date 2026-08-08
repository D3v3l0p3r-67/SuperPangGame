import { VIRTUAL_W, VIRTUAL_H, GRAVITY } from './constants.js';
import { PLAYER_CONFIG, BALL_SHAPES, BALL_SIZES, MIN_BALL_SIZE, POWERUP_TYPES, POWERUP_FALL_SPEED, POWERUP_TTL_MS } from './config.js';

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

// A ball is a (shape, size) pair. Shape (round/hex) controls physics and
// color; size (1-5) controls radius/speed/points and split behavior. Both
// are read from the BALL_SHAPES / BALL_SIZES registries in config.js, so
// adding a new shape or size tier there is all that's needed elsewhere.
export class Ball {
  constructor(shape, size, x, y, vx, vy) {
    this.id = ++ballId;
    this.shape = shape;
    this.size = size;
    this.shapeDef = BALL_SHAPES[shape];
    const sizeDef = BALL_SIZES[size - 1];
    this.radius = sizeDef.radius;
    this.points = sizeDef.points;
    this.baseSpeed = sizeDef.baseSpeed;
    this.x = x;
    this.y = y;

    if (vx !== undefined && vy !== undefined) {
      this.vx = vx;
      this.vy = vy;
    } else {
      const dirX = Math.random() < 0.5 ? -1 : 1;
      if (this.shapeDef.gravity) {
        this.vx = this.baseSpeed * dirX;
        this.vy = -this.baseSpeed * 0.6;
      } else {
        const dirY = Math.random() < 0.5 ? -1 : 1;
        const component = this.baseSpeed * Math.SQRT1_2;
        this.vx = component * dirX;
        this.vy = component * dirY;
      }
    }
    this.active = true;
  }

  get circle() {
    return { x: this.x, y: this.y, radius: this.radius };
  }

  update(dt, platforms) {
    if (this.shapeDef.gravity) this.vy += GRAVITY * dt;

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
      this.vy = -Math.abs(this.vy);
    }

    for (const platform of platforms) {
      if (this.hitsPlatformTop(platform)) {
        this.y = platform.y - this.radius;
        this.vy = -Math.abs(this.vy);
      }
    }
  }

  hitsPlatformTop(platform) {
    const withinX = this.x + this.radius > platform.x && this.x - this.radius < platform.x + platform.w;
    const crossingTop = this.vy > 0 && this.y + this.radius > platform.y && this.y - this.radius < platform.y + platform.h;
    return withinX && crossingTop;
  }

  // Marks this ball inactive and returns exactly two children one size
  // smaller (one sent left, one sent right), or none if already size 1.
  onHit() {
    this.active = false;
    if (this.size <= MIN_BALL_SIZE) return [];

    const childSize = this.size - 1;
    const childSpeed = BALL_SIZES[childSize - 1].baseSpeed;
    const children = [];

    if (this.shapeDef.gravity) {
      const vy = -Math.abs(childSpeed) * 0.6;
      children.push(new Ball(this.shape, childSize, this.x, this.y, -Math.abs(childSpeed), vy));
      children.push(new Ball(this.shape, childSize, this.x, this.y, Math.abs(childSpeed), vy));
    } else {
      const component = childSpeed * Math.SQRT1_2;
      children.push(new Ball(this.shape, childSize, this.x, this.y, -component, -component));
      children.push(new Ball(this.shape, childSize, this.x, this.y, component, component));
    }
    return children;
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

export class Platform {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
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

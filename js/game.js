import { VIRTUAL_W, VIRTUAL_H, COLORS, GAME_STATES } from './constants.js';
import { PLAYER_CONFIG, POWERUP_TYPE_KEYS, POWERUP_DROP_CHANCE } from './config.js';
import {
  Player, Obstacle, Ball, PowerUp, GROUND_Y,
  spawnPopParticles, spawnSparkle,
} from './entities.js';
import { createWeaponState, tryFire, EffectManager } from './weapons.js';
import { aabbOverlap, circleRectOverlap } from './physics.js';
import { LEVELS } from './levels.js';
import { getPlayerSprite, getPowerupIconSprite } from './sprites.js';
import { consumePausePressed } from './input.js';
import * as storage from './storage.js';

const PARTICLE_CAP = 220;
const LEVEL_INTRO_SEC = 1.6;
const LEVEL_CLEAR_SEC = 1.6;

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.state = GAME_STATES.MENU;
    this.score = 0;
    this.lives = PLAYER_CONFIG.startLives;
    this.levelIndex = 0;
    this.scoreMultiplier = 1;
    this.ballsFrozen = false;
    this.elapsedMs = 0;
    this.levelTimer = 0;
    this.stateTimer = 0;
    this.justSubmittedEntry = null;
    this.lastOutcome = null;

    this.player = new Player();
    this.projectiles = [];
    this.balls = [];
    this.powerups = [];
    this.particles = [];
    this.obstacles = [];

    this.weaponState = createWeaponState();
    this.effects = new EffectManager();
  }

  get currentLevelDef() {
    return LEVELS[this.levelIndex];
  }

  // Seconds left on the current level's clock, always >= 0. Shown live in
  // the HUD; running out only forfeits the level-clear time bonus.
  get remainingLevelTime() {
    const def = this.currentLevelDef;
    if (!def || !def.timeLimitSec) return 0;
    return Math.max(0, Math.ceil(def.timeLimitSec - this.levelTimer));
  }

  // Human-readable label for the currently active weapon configuration,
  // derived from whichever weapon-affecting power-ups are active.
  get weaponLabel() {
    const parts = [];
    if (this.effects.active.has('rapid_shot')) parts.push('RAPID');
    if (this.effects.active.has('wide_harpoon')) parts.push('WIDE');
    parts.push('HARPOON');
    return parts.join(' ');
  }

  startNewGame() {
    this.score = 0;
    this.lives = PLAYER_CONFIG.startLives;
    this.levelIndex = 0;
    this.scoreMultiplier = 1;
    this.ballsFrozen = false;
    this.justSubmittedEntry = null;
    this.effects.reset(this);
    this.loadLevel(this.levelIndex);
    this.state = GAME_STATES.LEVEL_INTRO;
    this.stateTimer = LEVEL_INTRO_SEC;
  }

  // Fully (re)loads the current level: balls, obstacles, projectiles,
  // on-field power-ups, particles, player position, weapon state, active
  // temporary effects, and the level timer. Score and lives are untouched,
  // so this is safe to call both when advancing levels and when the
  // current level restarts after a life is lost.
  loadLevel(idx) {
    const def = LEVELS[idx];
    this.obstacles = def.obstacles.map((o) => new Obstacle(o.type, o.x, o.y, o.w, o.h));
    this.balls = def.balls.map((b) => new Ball(b.shape, b.size, b.x, b.y, b.vx, undefined));
    this.projectiles = [];
    this.powerups = [];
    this.particles = [];
    this.player.reset();
    this.weaponState = createWeaponState();
    this.effects.reset(this);
    this.levelTimer = 0;
    const musicGroup = idx < 3 ? 0 : idx < 6 ? 1 : 2;
    this.audio.playMusic(musicGroup);
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.state = GAME_STATES.LEVEL_INTRO;
    this.stateTimer = LEVEL_INTRO_SEC;
  }

  goToMenu() {
    this.audio.stopMusic();
    this.state = GAME_STATES.MENU;
  }

  showHighScores() {
    this.justSubmittedEntry = null;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) this.state = GAME_STATES.PAUSED;
    else if (this.state === GAME_STATES.PAUSED) this.state = GAME_STATES.PLAYING;
  }

  resume() {
    if (this.state === GAME_STATES.PAUSED) this.state = GAME_STATES.PLAYING;
  }

  submitHighScore(name) {
    const { entry } = storage.saveHighScore({ name, score: this.score, level: this.levelIndex + 1 });
    this.justSubmittedEntry = entry;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  finishRun(outcome) {
    this.audio.stopMusic();
    this.lastOutcome = outcome;
    if (outcome === 'gameover') this.audio.gameover();
    else this.audio.levelclear();

    if (storage.qualifiesForHighScore(this.score)) {
      this.state = GAME_STATES.HIGH_SCORE_ENTRY;
    } else {
      this.state = outcome === 'gameover' ? GAME_STATES.GAME_OVER : GAME_STATES.VICTORY;
    }
  }

  levelClear() {
    const def = this.currentLevelDef;
    if (def.timeLimitSec) {
      const remaining = Math.max(0, def.timeLimitSec - this.levelTimer);
      this.score += Math.round(remaining * 10);
    }
    this.audio.levelclear();
    this.state = GAME_STATES.LEVEL_CLEAR;
    this.stateTimer = LEVEL_CLEAR_SEC;
  }

  popBall(ball) {
    this.score += Math.round(ball.points * this.scoreMultiplier);
    this.audio.pop(5 - ball.size);
    spawnPopParticles(this.particles, ball.x, ball.y, ball.shapeDef.color);
    const children = ball.onHit();
    for (const child of children) this.balls.push(child);
    if (Math.random() < POWERUP_DROP_CHANCE) {
      const type = POWERUP_TYPE_KEYS[Math.floor(Math.random() * POWERUP_TYPE_KEYS.length)];
      this.powerups.push(new PowerUp(type, ball.x, ball.y));
    }
    this.trimParticles();
  }

  trimParticles() {
    if (this.particles.length > PARTICLE_CAP) {
      this.particles.splice(0, this.particles.length - PARTICLE_CAP);
    }
  }

  update(dt, inputState) {
    switch (this.state) {
      case GAME_STATES.LEVEL_INTRO:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = GAME_STATES.PLAYING;
        break;
      case GAME_STATES.PLAYING:
        this.updatePlaying(dt, inputState);
        break;
      case GAME_STATES.PAUSED:
        if (consumePausePressed()) this.state = GAME_STATES.PLAYING;
        break;
      case GAME_STATES.LEVEL_CLEAR:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.advanceLevel();
        break;
      default:
        break;
    }
  }

  advanceLevel() {
    if (this.levelIndex + 1 < LEVELS.length) {
      this.levelIndex += 1;
      this.loadLevel(this.levelIndex);
      this.state = GAME_STATES.LEVEL_INTRO;
      this.stateTimer = LEVEL_INTRO_SEC;
    } else {
      this.finishRun('victory');
    }
  }

  updatePlaying(dt, inputState) {
    if (consumePausePressed()) {
      this.state = GAME_STATES.PAUSED;
      return;
    }

    this.elapsedMs += dt * 1000;
    this.levelTimer += dt;
    this.effects.update(this, this.elapsedMs);

    this.player.update(dt, inputState);
    if (inputState.shoot) {
      const tipX = this.player.x + this.player.width / 2;
      const tipY = this.player.y;
      if (tryFire(this.weaponState, this.projectiles, tipX, tipY)) this.audio.shoot();
    }

    for (const p of this.projectiles) p.update(dt);
    if (!this.ballsFrozen) {
      for (const ball of this.balls) ball.update(dt, this.obstacles);
    }
    for (const pu of this.powerups) pu.update(dt, GROUND_Y - 6);
    for (const particle of this.particles) particle.update(dt);

    this.resolveProjectileVsObstacle();
    this.resolveProjectileVsBall();
    this.resolvePlayerVsBall();
    if (this.state !== GAME_STATES.PLAYING) return; // a hit may have restarted/ended the level
    this.resolvePlayerVsPowerup();

    this.projectiles = this.projectiles.filter((p) => p.active);
    this.balls = this.balls.filter((b) => b.active);
    this.obstacles = this.obstacles.filter((o) => o.active);
    this.powerups = this.powerups.filter((pu) => pu.active);
    this.particles = this.particles.filter((p) => p.active);

    if (this.state === GAME_STATES.PLAYING && this.balls.length === 0) {
      this.levelClear();
    }
  }

  // A shot that hits an obstacle stops there -- it never passes through to
  // pop a ball behind it in the same frame. Destructible obstacles lose a
  // hit point and are removed once destroyed; balls can then pass freely
  // through the space they occupied.
  resolveProjectileVsObstacle() {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const obstacle of this.obstacles) {
        if (!obstacle.active) continue;
        if (aabbOverlap(proj.rect, obstacle.rect)) {
          proj.active = false;
          const destroyed = obstacle.takeHit();
          if (destroyed) spawnPopParticles(this.particles, obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, obstacle.def.color);
          break;
        }
      }
    }
  }

  resolveProjectileVsBall() {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const ball of this.balls) {
        if (!ball.active) continue;
        if (circleRectOverlap(ball.circle, proj.rect)) {
          this.popBall(ball);
          proj.hitsLeft -= 1;
          if (proj.hitsLeft <= 0) {
            proj.active = false;
            break;
          }
        }
      }
    }
  }

  resolvePlayerVsBall() {
    for (const ball of this.balls) {
      if (!ball.active) continue;
      if (circleRectOverlap(ball.circle, this.player.rect)) {
        const hadShield = this.player.shielded;
        const lostLife = this.player.takeHit();

        if (!lostLife && hadShield) {
          // Shield absorbed the hit: consumed immediately, level continues.
          this.effects.active.delete('shield');
        }

        if (lostLife) {
          this.audio.hit();
          this.lives -= 1;
          if (this.lives <= 0) {
            this.finishRun('gameover');
          } else {
            this.restartLevel();
          }
        }
        break;
      }
    }
  }

  resolvePlayerVsPowerup() {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      if (aabbOverlap(this.player.rect, pu.rect)) {
        this.effects.apply(pu.type, this, this.elapsedMs);
        this.audio.powerup();
        spawnSparkle(this.particles, pu.x, pu.y, pu.def.color);
        pu.active = false;
      }
    }
  }

  render(ctx) {
    this.renderBackground(ctx);
    this.renderObstacles(ctx);
    this.renderParticles(ctx);
    this.renderBalls(ctx);
    this.renderPowerups(ctx);
    this.renderProjectiles(ctx);
    this.renderPlayer(ctx);
  }

  renderBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_W, VIRTUAL_H - GROUND_Y);
    ctx.fillStyle = COLORS.groundEdge;
    ctx.fillRect(0, GROUND_Y, VIRTUAL_W, 2);
  }

  renderObstacles(ctx) {
    for (const obstacle of this.obstacles) {
      ctx.fillStyle = obstacle.def.color;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      ctx.fillStyle = obstacle.def.edgeColor;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, 2);
      if (obstacle.def.destructible) {
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1;
        ctx.strokeRect(obstacle.x + 0.5, obstacle.y + 0.5, obstacle.w - 1, obstacle.h - 1);
      }
    }
  }

  renderBalls(ctx) {
    for (const ball of this.balls) {
      if (ball.shape === 'hex') {
        tracePolygonPath(ctx, ball.x, ball.y, ball.radius, 6);
      } else {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = ball.shapeDef.color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.outline;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(
        ball.x - ball.radius * 0.35,
        ball.y - ball.radius * 0.35,
        Math.max(1, ball.radius * 0.3),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = ball.shapeDef.highlight;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  renderProjectiles(ctx) {
    for (const proj of this.projectiles) {
      const r = proj.rect;
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.w / 2, r.y - 4);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderPowerups(ctx) {
    for (const pu of this.powerups) {
      const sprite = getPowerupIconSprite(pu.type, pu.def.icon, pu.def.color);
      ctx.drawImage(sprite, pu.x - sprite.width / 2, pu.y - sprite.height / 2);
    }
  }

  renderPlayer(ctx) {
    const p = this.player;
    const flashing = p.isInvulnerable && Math.floor(this.elapsedMs / 90) % 2 === 0;
    if (flashing) ctx.globalAlpha = 0.4;

    const sprite = getPlayerSprite(p.walkFrame, p.isMoving);
    ctx.save();
    if (p.facing < 0) {
      ctx.translate(p.x + p.width, p.y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0);
    } else {
      ctx.drawImage(sprite, p.x, p.y);
    }
    ctx.restore();

    if (p.shielded) {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 1, p.y - 1, p.width + 2, p.height + 2);
    }

    ctx.globalAlpha = 1;
  }

  renderParticles(ctx) {
    for (const particle of this.particles) {
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }
}

function tracePolygonPath(ctx, x, y, radius, sides) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

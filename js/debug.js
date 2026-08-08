import { GAME_STATES, VIRTUAL_W } from './constants.js';
import { BALL_SHAPE_KEYS, BALL_SIZES, MAX_BALL_SIZE, POWERUP_TYPES, POWERUP_TYPE_KEYS } from './config.js';
import { Ball, PowerUp } from './entities.js';
import { LEVELS } from './levels.js';

// Purely observational + a couple of manual test hooks -- reads game state,
// never mutates gameplay logic. Can be deleted without affecting the game.
export class Debug {
  constructor(game) {
    this.game = game;
    this.enabled = new URLSearchParams(location.search).get('debug') === '1';
    this.frameTimes = [];
    this.panelEl = document.getElementById('debug-panel');
    this.textEl = null;
    this.spawnPanelBuilt = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1' || e.code === 'Backquote') {
        this.enabled = !this.enabled;
        this.sync();
      }
    });

    this.sync();
  }

  sync() {
    this.panelEl.classList.toggle('hidden', !this.enabled);
    if (this.enabled && !this.spawnPanelBuilt) this.buildSpawnPanel();
  }

  recordFrame(deltaMs) {
    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > 30) this.frameTimes.shift();
  }

  get fps() {
    if (!this.frameTimes.length) return 0;
    const avg = this.frameTimes.reduce((a, c) => a + c, 0) / this.frameTimes.length;
    return avg > 0 ? Math.round(1000 / avg) : 0;
  }

  addSectionLabel(parent, text) {
    const label = document.createElement('div');
    label.className = 'debug-section-label';
    label.textContent = text;
    parent.appendChild(label);
  }

  buildSpawnPanel() {
    this.spawnPanelBuilt = true;

    this.textEl = document.createElement('div');
    this.textEl.className = 'debug-text';
    this.panelEl.appendChild(this.textEl);

    const wrap = document.createElement('div');
    wrap.id = 'debug-spawn-panel';

    // -- Balls: pick a shape + size, spawn at the top-center of the field.
    this.addSectionLabel(wrap, 'Spawn ball');
    const ballRow = document.createElement('div');
    ballRow.className = 'debug-btn-row';
    const shapeSelect = document.createElement('select');
    for (const shape of BALL_SHAPE_KEYS) {
      const opt = document.createElement('option');
      opt.value = shape;
      opt.textContent = shape;
      shapeSelect.appendChild(opt);
    }
    const sizeSelect = document.createElement('select');
    for (const { size } of BALL_SIZES) {
      const opt = document.createElement('option');
      opt.value = String(size);
      opt.textContent = `size ${size}`;
      sizeSelect.appendChild(opt);
    }
    sizeSelect.value = String(MAX_BALL_SIZE);
    const spawnBallBtn = document.createElement('button');
    spawnBallBtn.textContent = 'Spawn';
    spawnBallBtn.onclick = () => {
      this.game.balls.push(new Ball(shapeSelect.value, parseInt(sizeSelect.value, 10), VIRTUAL_W / 2, 30));
    };
    ballRow.append(shapeSelect, sizeSelect, spawnBallBtn);
    wrap.appendChild(ballRow);

    // -- Power-ups: one clearly-labeled quick-spawn button per type
    // (fruit/bonus points, shield, weapon power-ups, and all the rest),
    // driven entirely by the POWERUP_TYPES registry so new entries there
    // show up automatically.
    this.addSectionLabel(wrap, 'Spawn power-up');
    const powerupRow = document.createElement('div');
    powerupRow.className = 'debug-btn-row';
    for (const type of POWERUP_TYPE_KEYS) {
      const def = POWERUP_TYPES[type];
      const btn = document.createElement('button');
      btn.textContent = def.label;
      btn.title = type;
      btn.onclick = () => {
        this.game.powerups.push(new PowerUp(type, VIRTUAL_W / 2, 30));
      };
      powerupRow.appendChild(btn);
    }
    wrap.appendChild(powerupRow);

    // -- Level jump
    this.addSectionLabel(wrap, 'Jump to level');
    const levelRow = document.createElement('div');
    levelRow.className = 'debug-btn-row';
    const levelInput = document.createElement('input');
    levelInput.type = 'number';
    levelInput.min = '1';
    levelInput.max = String(LEVELS.length);
    levelInput.value = '1';
    levelInput.style.width = '40px';
    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = 'Jump';
    jumpBtn.onclick = () => {
      const idx = Math.max(0, Math.min(LEVELS.length - 1, parseInt(levelInput.value, 10) - 1));
      this.game.levelIndex = idx;
      this.game.loadLevel(idx);
      this.game.state = GAME_STATES.PLAYING;
    };
    levelRow.append(levelInput, jumpBtn);
    wrap.appendChild(levelRow);

    this.panelEl.appendChild(wrap);
  }

  render(ctx) {
    if (!this.enabled) return;
    this.drawCollisionBounds(ctx);
    this.updateText();
  }

  updateText() {
    if (!this.textEl) return;
    const g = this.game;
    const lines = [
      `FPS ${this.fps}`,
      `STATE ${g.state}`,
      `LEVEL ${g.levelIndex + 1}/${LEVELS.length}  TIME ${g.remainingLevelTime}`,
      `SCORE ${g.score}  LIVES ${g.lives}  WEAPON ${g.weaponLabel}`,
      `BALLS ${g.balls.length}  PROJ ${g.projectiles.length}  PARTICLES ${g.particles.length}`,
      `EFFECTS ${[...g.effects.active.keys()].join(',') || '-'}`,
    ];
    this.textEl.textContent = lines.join('\n');
  }

  drawCollisionBounds(ctx) {
    const g = this.game;
    ctx.save();
    ctx.lineWidth = 1;

    ctx.strokeStyle = '#00ff00';
    ctx.strokeRect(g.player.x, g.player.y, g.player.width, g.player.height);

    ctx.strokeStyle = '#ff00ff';
    for (const ball of g.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = '#ffff00';
    for (const proj of g.projectiles) {
      const r = proj.rect;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    ctx.strokeStyle = '#00ffff';
    for (const pu of g.powerups) {
      const r = pu.rect;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    ctx.strokeStyle = '#ffffff';
    for (const platform of g.platforms) {
      ctx.strokeRect(platform.x, platform.y, platform.w, platform.h);
    }

    ctx.restore();
  }
}

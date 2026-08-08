import { GAME_STATES, VIRTUAL_W } from './constants.js';
import { BALLOON_KIND_KEYS } from './config.js';
import { Balloon } from './entities.js';
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

  buildSpawnPanel() {
    this.spawnPanelBuilt = true;

    this.textEl = document.createElement('div');
    this.textEl.className = 'debug-text';
    this.panelEl.appendChild(this.textEl);

    const wrap = document.createElement('div');
    wrap.id = 'debug-spawn-panel';

    const kindSelect = document.createElement('select');
    for (const kind of BALLOON_KIND_KEYS) {
      const opt = document.createElement('option');
      opt.value = kind;
      opt.textContent = kind;
      kindSelect.appendChild(opt);
    }
    const spawnBtn = document.createElement('button');
    spawnBtn.textContent = 'Spawn balloon';
    spawnBtn.onclick = () => {
      this.game.balloons.push(new Balloon(0, kindSelect.value, VIRTUAL_W / 2, 30));
    };

    const levelInput = document.createElement('input');
    levelInput.type = 'number';
    levelInput.min = '1';
    levelInput.max = String(LEVELS.length);
    levelInput.value = '1';
    levelInput.style.width = '40px';
    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = 'Jump to level';
    jumpBtn.onclick = () => {
      const idx = Math.max(0, Math.min(LEVELS.length - 1, parseInt(levelInput.value, 10) - 1));
      this.game.levelIndex = idx;
      this.game.loadLevel(idx);
      this.game.state = GAME_STATES.PLAYING;
    };

    wrap.append(kindSelect, spawnBtn, document.createElement('br'), levelInput, jumpBtn);
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
      `LEVEL ${g.levelIndex + 1}/${LEVELS.length}`,
      `SCORE ${g.score}  LIVES ${g.lives}`,
      `BALLOONS ${g.balloons.length}  PROJ ${g.projectiles.length}  PARTICLES ${g.particles.length}`,
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
    for (const balloon of g.balloons) {
      ctx.beginPath();
      ctx.arc(balloon.x, balloon.y, balloon.radius, 0, Math.PI * 2);
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

import { VIRTUAL_W, VIRTUAL_H, OBSTACLE_BLOCK_SIZE } from './constants.js';
import { BALL_SHAPE_KEYS, BALL_SHAPES, BALL_SIZES, POWERUP_TYPES, POWERUP_TYPE_KEYS } from './config.js';
import { Ball } from './Ball.js';
import { Bonus } from './Bonus.js';
import { LEVELS } from './LevelManager.js';

// Purely observational + a couple of manual test hooks -- reads scene
// state and draws over it, never mutates gameplay logic. Can be deleted
// without affecting the game. FPS comes straight from Phaser's own loop,
// no separate frame-timing code needed on our side.
export class Debug {
  constructor(scene) {
    this.scene = scene;
    this.enabled = new URLSearchParams(location.search).get('debug') === '1';
    this.showGrid = false;
    this.panelEl = document.getElementById('debug-panel');
    this.textEl = null;
    this.spawnPanelBuilt = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyD' && e.shiftKey) {
        this.enabled = !this.enabled;
        this.sync();
      } else if (e.code === 'KeyG' && this.enabled) {
        this.showGrid = !this.showGrid;
      }
    });

    this.sync();
  }

  sync() {
    this.panelEl.classList.toggle('hidden', !this.enabled);
    if (this.enabled && !this.spawnPanelBuilt) this.buildSpawnPanel();
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
    // Rebuilt whenever the shape changes -- hex only goes up to its
    // maxSize (3), not the full 5 round tiers.
    const populateSizes = () => {
      const maxSize = BALL_SHAPES[shapeSelect.value].maxSize;
      sizeSelect.innerHTML = '';
      for (const { size } of BALL_SIZES) {
        if (size > maxSize) continue;
        const opt = document.createElement('option');
        opt.value = String(size);
        opt.textContent = `size ${size}`;
        sizeSelect.appendChild(opt);
      }
      sizeSelect.value = String(maxSize);
    };
    shapeSelect.onchange = populateSizes;
    populateSizes();
    const spawnBallBtn = document.createElement('button');
    spawnBallBtn.textContent = 'Spawn';
    spawnBallBtn.onclick = () => {
      const ball = new Ball(this.scene, shapeSelect.value, parseInt(sizeSelect.value, 10), VIRTUAL_W / 2, 30);
      this.scene.balls.add(ball);
    };
    const removeAllBtn = document.createElement('button');
    removeAllBtn.textContent = 'Remove all balls';
    removeAllBtn.onclick = () => {
      this.scene.balls.clear(true, true);
    };
    ballRow.append(shapeSelect, sizeSelect, spawnBallBtn, removeAllBtn);
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
        const bonus = new Bonus(this.scene, type, VIRTUAL_W / 2, 30);
        this.scene.powerups.add(bonus);
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
      this.scene.levelIndex = idx;
      this.scene.loadLevel(idx);
      this.scene.state = 'PLAYING';
    };
    levelRow.append(levelInput, jumpBtn);
    wrap.appendChild(levelRow);

    // -- 8x8 alignment grid (also toggled with the G key)
    this.addSectionLabel(wrap, 'Grid');
    const gridRow = document.createElement('div');
    gridRow.className = 'debug-btn-row';
    const gridBtn = document.createElement('button');
    gridBtn.textContent = 'Toggle 8x8 grid';
    gridBtn.onclick = () => {
      this.showGrid = !this.showGrid;
    };
    gridRow.appendChild(gridBtn);
    wrap.appendChild(gridRow);

    this.panelEl.appendChild(wrap);
  }

  render(graphics) {
    graphics.clear();
    if (!this.enabled) return;
    if (this.showGrid) this.drawGrid(graphics);
    this.drawCollisionBounds(graphics);
    this.updateText();
  }

  // Every OBSTACLE_BLOCK_SIZE (8px) across the whole canvas, so obstacle/
  // border alignment can be checked directly against it -- toggle with
  // the G key or the panel button, independent of the collision overlay.
  drawGrid(graphics) {
    graphics.lineStyle(1, 0x00ff00, 0.25);
    for (let x = 0; x <= VIRTUAL_W; x += OBSTACLE_BLOCK_SIZE) {
      graphics.lineBetween(x, 0, x, VIRTUAL_H);
    }
    for (let y = 0; y <= VIRTUAL_H; y += OBSTACLE_BLOCK_SIZE) {
      graphics.lineBetween(0, y, VIRTUAL_W, y);
    }
  }

  updateText() {
    if (!this.textEl) return;
    const g = this.scene;
    const lines = [
      `FPS ${Math.round(this.scene.game.loop.actualFps)}`,
      `STATE ${g.state}`,
      `LEVEL ${g.levelIndex + 1}/${LEVELS.length}  TIME ${g.remainingLevelTime}`,
      `SCORE ${g.score}  LIVES ${g.lives}  WEAPON ${g.weaponLabel}`,
      `BALLS ${g.balls.countActive(true)}  PROJ ${g.projectiles.countActive(true)}  POWERUPS ${g.powerups.countActive(true)}`,
      `EFFECTS ${[...g.effects.active.keys()].join(',') || '-'}`,
    ];
    this.textEl.textContent = lines.join('\n');
  }

  drawCollisionBounds(graphics) {
    const g = this.scene;

    // body.x/y are the body's actual top-left world position, already
    // accounting for its offset within the sprite (see Player.js) -- not
    // simply centered on the sprite's x/y anymore.
    graphics.lineStyle(1, 0x00ff00, 1);
    graphics.strokeRect(g.player.body.x, g.player.body.y, g.player.body.width, g.player.body.height);

    graphics.lineStyle(1, 0xff00ff, 1);
    for (const ball of g.balls.getChildren()) {
      graphics.strokeCircle(ball.x, ball.y, ball.radius);
    }

    graphics.lineStyle(1, 0xffff00, 1);
    for (const proj of g.projectiles.getChildren()) {
      graphics.strokeRect(proj.x - proj.body.width / 2, proj.y - proj.body.height / 2, proj.body.width, proj.body.height);
    }

    graphics.lineStyle(1, 0x00ffff, 1);
    for (const pu of g.powerups.getChildren()) {
      graphics.strokeRect(pu.x - pu.body.width / 2, pu.y - pu.body.height / 2, pu.body.width, pu.body.height);
    }

    graphics.lineStyle(1, 0xffffff, 1);
    for (const obstacle of g.obstacles.getChildren()) {
      graphics.strokeRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height);
    }
  }
}

import { VIRTUAL_W, VIRTUAL_H, OBSTACLE_BLOCK_SIZE, GAME_STATES } from './constants.js';
import { BALL_SHAPE_KEYS, BALL_ELEMENTS, maxBallSize, POWERUP_TYPES, POWERUP_TYPE_KEYS } from './elements.js';
import { WEAPON_TYPES, LEVEL_TRANSITION } from './config.js';
import { LEVEL_TRANSITIONS } from './LevelTransition.js';
import { createWeaponState } from './weapons.js';
import { Ball } from './Ball.js';
import { Bonus } from './Bonus.js';
import { LEVELS } from './LevelManager.js';
import { makeButton, makeSelect, labelled, row, group } from './panelUi.js';

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

  buildSpawnPanel() {
    this.spawnPanelBuilt = true;

    // -- Balls: pick a shape + size, spawn at the top-center of the field.
    const shapeSelect = makeSelect(BALL_SHAPE_KEYS.map((shape) => [shape, shape]), () => populateSizes());
    const sizeSelect = makeSelect([], null);
    // Rebuilt whenever the shape changes -- hex only goes up to its
    // maxSize (3), not the full 5 round tiers.
    const populateSizes = () => {
      sizeSelect.innerHTML = '';
      for (const el of BALL_ELEMENTS) {
        if (el.shape !== shapeSelect.value) continue;
        const opt = document.createElement('option');
        opt.value = String(el.size);
        opt.textContent = String(el.size);
        sizeSelect.appendChild(opt);
      }
      sizeSelect.value = String(maxBallSize(shapeSelect.value));
    };
    populateSizes();
    this.panelEl.appendChild(group(
      'BALL',
      row(shapeSelect, labelled('size ', sizeSelect)),
      row(
        makeButton('Spawn', () => {
          this.scene.balls.add(new Ball(this.scene, shapeSelect.value, parseInt(sizeSelect.value, 10), VIRTUAL_W / 2, 30));
        }),
        makeButton('Remove all', () => this.scene.balls.clear(true, true)),
      ),
    ));

    // -- Power-ups: one clearly-labeled quick-spawn button per type
    // (fruit/bonus points, shield, weapon power-ups, and all the rest),
    // driven entirely by the POWERUP_TYPES registry so new entries there
    // show up automatically. Three to a row rather than one long line:
    // there are more of these than of anything else in here, and in one
    // row this group alone would be wider than the canvas.
    const powerupButtons = POWERUP_TYPE_KEYS.map((type) => makeButton(POWERUP_TYPES[type].label, () => {
      this.scene.powerups.add(new Bonus(this.scene, type, VIRTUAL_W / 2, 30));
    }, type));
    const powerupRows = [];
    for (let i = 0; i < powerupButtons.length; i += 3) powerupRows.push(row(...powerupButtons.slice(i, i + 3)));
    this.panelEl.appendChild(group('SPAWN POWER-UP', ...powerupRows));

    // -- Weapons, alongside the power-up spawns above. These can't be
    // spawned as a pickup the way a power-up can -- a weapon is a property
    // of the level (see LevelManager's `weapon` field), not something that
    // drops -- so the button hands it to the player directly instead.
    // Driven by the WEAPON_TYPES registry, same as the power-up row, so a
    // new weapon shows up here on its own.
    const weaponButtons = Object.entries(WEAPON_TYPES).map(([type, def]) => makeButton(def.label, () => {
      this.scene.weaponType = type;
      this.scene.weaponState = createWeaponState(type);
      // createWeaponState rebuilds from the weapon's base values, which
      // would silently drop a weapon power-up that's still running --
      // re-apply whatever is active so switching weapons mid-effect
      // doesn't cancel it. Every durable effect's apply() is a plain
      // setter, and instant ones are never held in `active`, so
      // re-running them is safe.
      for (const active of this.scene.effects.active.keys()) POWERUP_TYPES[active].apply(this.scene);
    }, type));
    this.panelEl.appendChild(group(
      'GIVE WEAPON',
      row(...weaponButtons.slice(0, 2)),
      row(...weaponButtons.slice(2)),
    ));

    // -- Jumping straight to a level, and watching a transition without
    // having to clear one to see it. Both are "show me that part of the
    // campaign now", so they share a group. The transition picker only
    // overrides what plays here; a real run uses config.js's
    // LEVEL_TRANSITION.
    const levelInput = document.createElement('input');
    levelInput.type = 'number';
    levelInput.min = '1';
    levelInput.max = String(LEVELS.length);
    levelInput.value = '1';
    levelInput.style.width = 'calc(var(--panel-unit) * 9)';
    const transitionSelect = makeSelect(
      Object.entries(LEVEL_TRANSITIONS).map(([name, def]) => [name, def.label]), null,
    );
    transitionSelect.value = LEVEL_TRANSITION;
    this.panelEl.appendChild(group(
      'CAMPAIGN',
      row(labelled('Level ', levelInput), makeButton('Jump', () => {
        const idx = Math.max(0, Math.min(LEVELS.length - 1, parseInt(levelInput.value, 10) - 1));
        this.scene.levelIndex = idx;
        this.scene.loadLevel(idx);
        this.scene.state = GAME_STATES.PLAYING;
      })),
      row(transitionSelect, makeButton('Play', () => this.scene.transition.start(transitionSelect.value, null))),
    ));

    // -- The 16x16 alignment grid (also toggled with the G key).
    this.panelEl.appendChild(group(
      'VIEW',
      row(makeButton('16x16 grid', () => { this.showGrid = !this.showGrid; })),
    ));

    // Live readout, pushed to the far end -- see .panel-status. Two
    // columns of it, so it stays about as tall as the control groups
    // beside it instead of stretching the panel to six lines.
    this.textEl = document.createElement('div');
    this.panelEl.appendChild(group('STATE', this.textEl));
    this.panelEl.lastChild.classList.add('panel-status');
  }

  render(graphics) {
    // Nothing to clear unless something was drawn: debug mode is off for
    // the entire game as shipped, and this runs every frame.
    if (!this.enabled) {
      if (this.drewLastFrame) {
        graphics.clear();
        this.drewLastFrame = false;
      }
      return;
    }
    graphics.clear();
    this.drewLastFrame = true;
    if (this.showGrid) this.drawGrid(graphics);
    this.drawCollisionBounds(graphics);
    this.updateText();
  }

  // Every OBSTACLE_BLOCK_SIZE across the whole canvas, so obstacle/border
  // alignment can be checked directly against it -- toggle with the G key
  // or the panel button, independent of the collision overlay.
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
    // Three lines, not one per figure: this group wraps onto its own line
    // of the panel, and every line it takes is height pushed onto the game
    // below it.
    this.textEl.textContent = [
      `${g.state}  fps ${Math.round(this.scene.game.loop.actualFps)}  level ${g.levelIndex + 1}/${LEVELS.length}  time ${g.remainingLevelTime}`,
      `score ${g.score}  lives ${g.lives}  ${g.weaponLabel}`,
      `balls ${g.balls.countActive(true)}  shots ${g.projectiles.countActive(true)}  drops ${g.powerups.countActive(true)}  effects ${[...g.effects.active.keys()].join(' ') || '-'}`,
    ].join('\n');
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

    // Straight off the bodies: an obstacle block is positioned by its
    // top-left corner (see Obstacle.js), not centred like the sprites above.
    graphics.lineStyle(1, 0xffffff, 1);
    for (const obstacle of g.obstacles.getChildren()) {
      const b = obstacle.body;
      graphics.strokeRect(b.x, b.y, b.width, b.height);
    }
  }
}

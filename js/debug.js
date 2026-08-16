import { VIRTUAL_W, VIRTUAL_H, OBSTACLE_BLOCK_SIZE, GAME_STATES } from './constants.js';
import { BALL_SHAPE_KEYS, BALL_ELEMENTS, maxBallSize, POWERUP_TYPES, POWERUP_TYPE_KEYS } from './elements.js';
import { WEAPON_TYPES, LEVEL_TRANSITION } from './config.js';
import { LEVEL_TRANSITIONS } from './LevelTransition.js';
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
    // The collision outlines used to come with debug mode itself, with no
    // way to put them away -- which made everything else it draws harder
    // to read whenever they weren't what was being looked at. On by
    // default, since that is what turning debug mode on has always meant.
    this.showColliders = true;
    this.panelEl = document.getElementById('debug-panel');
    this.textEl = null;
    this.spawnPanelBuilt = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyD' && e.shiftKey) {
        this.enabled = !this.enabled;
        this.sync();
      } else if (e.code === 'KeyG' && this.enabled) {
        this.setOverlay('showGrid', !this.showGrid);
      } else if (e.code === 'KeyC' && this.enabled) {
        this.setOverlay('showColliders', !this.showColliders);
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
      // Pop, not remove: every ball takes the hit it would take from a
      // shot -- score, sound, burst, drop roll and all -- so the big ones
      // split rather than vanishing. One press is one volley, which is
      // what makes it useful for watching a whole field come apart (and
      // why it is a separate button from Remove all, which is for
      // clearing the field with none of that happening).
      row(makeButton('Pop all', () => {
        // Over a copy: popping mutates the group, both by destroying the
        // ball and by adding whatever it splits into.
        for (const ball of [...this.scene.balls.getChildren()]) this.scene.popBall(ball);
      })),
    ));

    // -- Power-ups: one clearly-labeled button per type (fruit/bonus
    // points, shield, weapon power-ups, and all the rest), driven entirely
    // by the POWERUP_TYPES registry so new entries there show up
    // automatically. Three to a row rather than one long line: there are
    // more of these than of anything else in here, and in one row this
    // group alone would be wider than the canvas.
    //
    // What a press DOES is the mode picked above them, because the two
    // are worth testing separately: dropping the pickup is the way to
    // check that it falls, lands and can be collected, while applying it
    // outright is the way to check what it then does -- and hunting down
    // a bonus that has bounced onto a ledge is in the way of that.
    this.powerupMode = 'spawn';
    this.powerupModeButtons = {
      spawn: makeButton('Drop pickup', () => this.setPowerupMode('spawn'), 'Spawns the bonus to be collected'),
      use: makeButton('Use now', () => this.setPowerupMode('use'), 'Applies the effect to the player straight away'),
    };
    const powerupButtons = POWERUP_TYPE_KEYS.map((type) => makeButton(POWERUP_TYPES[type].label, () => {
      if (this.powerupMode === 'use') {
        // Exactly what walking into one does, minus the pickup itself
        // (see GameScene.collectPowerup) -- so an instant effect scores
        // and a timed one starts its clock, same as in a real run.
        this.scene.effects.apply(type, this.scene, this.scene.elapsedMs);
        this.scene.audio.play(POWERUP_TYPES[type].pickupSound);
      } else {
        this.scene.powerups.add(new Bonus(this.scene, type, VIRTUAL_W / 2, 30));
      }
    }, type));
    const powerupRows = [row(this.powerupModeButtons.spawn, this.powerupModeButtons.use)];
    for (let i = 0; i < powerupButtons.length; i += 3) powerupRows.push(row(...powerupButtons.slice(i, i + 3)));
    this.panelEl.appendChild(group('POWER-UP', ...powerupRows));
    this.syncPowerupModeButtons();

    // -- Weapons, alongside the power-up spawns above. There is a pickup
    // for each of them now (elements/powerup-weapon-*.json), and the row
    // above will spawn one; this row is the shortcut that skips the
    // collecting, which is what you want when the question is "how does
    // the grapple handle here". Driven by the WEAPON_TYPES registry, same
    // as the power-up row, so a new weapon shows up here on its own.
    const weaponButtons = Object.entries(WEAPON_TYPES).map(([type, def]) => makeButton(
      def.label, () => this.scene.setWeapon(type), type,
    ));
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
    const jumpTo = (idx) => {
      this.scene.levelIndex = idx;
      this.scene.loadLevel(idx);
      this.scene.state = GAME_STATES.PLAYING;
    };
    const chosenLevel = () => Math.max(0, Math.min(LEVELS.length - 1, parseInt(levelInput.value, 10) - 1));
    this.panelEl.appendChild(group(
      'CAMPAIGN',
      row(
        labelled('Level ', levelInput),
        makeButton('To start', () => jumpTo(chosenLevel()), 'Play this level from the beginning'),
        // Everything that follows clearing a level, without playing it:
        // the celebration, the time tally, the transition, and -- across a
        // region boundary -- the world map. That last stretch is the whole
        // point: it is otherwise only reachable by actually beating the
        // level before it, which is a slow way to look at a hand-off
        // between two levels.
        makeButton('To end', () => {
          jumpTo(chosenLevel());
          this.scene.balls.clear(true, true);
          // recordTime: false because this did not play the level -- the
          // fraction of a second between jumping and clearing would stand
          // as that level's record from then on.
          this.scene.levelClear({ recordTime: false });
        }, 'Clear this level now, and carry on into the next'),
      ),
      row(transitionSelect, makeButton('Play', () => this.scene.transition.start(transitionSelect.value, null))),
    ));

    // -- What debug mode draws over the game. Each also has a key of its
    // own (G and C), so either can be flicked on and off without moving
    // the pointer off whatever is being watched.
    this.overlayButtons = {
      showGrid: makeButton('16x16 grid', () => this.setOverlay('showGrid', !this.showGrid), 'Shortcut: G'),
      showColliders: makeButton('Colliders', () => this.setOverlay('showColliders', !this.showColliders), 'Shortcut: C'),
    };
    this.panelEl.appendChild(group(
      'VIEW',
      row(this.overlayButtons.showGrid),
      row(this.overlayButtons.showColliders),
    ));
    this.syncOverlayButtons();

    // Live readout, pushed to the far end -- see .panel-status. Two
    // columns of it, so it stays about as tall as the control groups
    // beside it instead of stretching the panel to six lines.
    this.textEl = document.createElement('div');
    this.panelEl.appendChild(group('STATE', this.textEl));
    this.panelEl.lastChild.classList.add('panel-status');
  }

  // The single place either overlay is switched, so the panel button and
  // the keyboard shortcut can never disagree about what is showing.
  setOverlay(name, on) {
    this[name] = on;
    this.syncOverlayButtons();
  }

  syncOverlayButtons() {
    if (!this.overlayButtons) return;
    for (const [name, btn] of Object.entries(this.overlayButtons)) {
      btn.classList.toggle('panel-btn-on', this[name]);
    }
  }

  // What the power-up buttons do: drop the pickup, or apply the effect
  // outright. One place, so the buttons and the mode can't disagree --
  // same arrangement as the overlay toggles above.
  setPowerupMode(mode) {
    this.powerupMode = mode;
    this.syncPowerupModeButtons();
  }

  syncPowerupModeButtons() {
    for (const [mode, btn] of Object.entries(this.powerupModeButtons)) {
      btn.classList.toggle('panel-btn-on', this.powerupMode === mode);
    }
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
    if (this.showColliders) this.drawCollisionBounds(graphics);
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
    // One line. This group takes a full row of the panel to itself, and
    // every row the panel takes is height pushed onto the game below it,
    // so three lines here cost three lines of playfield. Names are cut to
    // the shortest thing still readable for the same reason; the line is
    // allowed to ellipsize rather than wrap (see style.css's
    // #debug-panel .panel-status), so an unusually long tail -- several
    // effects at once -- shortens the readout instead of growing the
    // panel.
    // Power-ups by the first word of their type: `rapid_shot` and
    // `score_multiplier` are already unambiguous at `rapid` and `score`,
    // and this is the one part of the line with no length limit -- four
    // running at once would otherwise be more than half of it.
    const effects = [...g.effects.active.keys()].map((key) => key.split('_')[0]);
    this.textEl.textContent = [
      g.state,
      `${Math.round(this.scene.game.loop.actualFps)}fps`,
      `L${g.levelIndex + 1}/${LEVELS.length}`,
      `t${g.remainingLevelTime}`,
      `pts ${g.score}`,
      `lives ${g.lives}`,
      g.weaponLabel,
      `balls ${g.balls.countActive(true)}`,
      `shots ${g.projectiles.countActive(true)}`,
      `drops ${g.powerups.countActive(true)}`,
      `fx ${effects.join(',') || '-'}`,
    ].join(' ');
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

    // Off the bodies: a beam is positioned by its HEAD (origin 0, 0.5 --
    // see Projectile.js), so proj.y is its top edge rather than its middle.
    graphics.lineStyle(1, 0xffff00, 1);
    for (const proj of g.projectiles.getChildren()) {
      const b = proj.body;
      graphics.strokeRect(b.x, b.y, b.width, b.height);
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

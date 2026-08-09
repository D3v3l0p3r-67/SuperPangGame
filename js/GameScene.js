import { VIRTUAL_W, PLAYFIELD_H, GROUND_Y, OBSTACLE_BLOCK_SIZE, GAME_STATES, COLORS } from './constants.js';
import { PLAYER_CONFIG, WEAPON_TYPES, POWERUP_TYPE_KEYS, POWERUP_DROP_CHANCE } from './config.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { Projectile } from './Projectile.js';
import { Bonus } from './Bonus.js';
import { createWeaponState, EffectManager } from './weapons.js';
import { loadLevel as loadLevelData, LEVELS } from './LevelManager.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Debug } from './debug.js';
import { Editor } from './editor.js';
import { touchInput, initTouchInput, consumeTouchPausePressed } from './input.js';
import * as storage from './storage.js';
import { obstacleTextureKey, PARTICLE_TEXTURE_KEY } from './assets.js';

// 1s each for "3", "2", "1", then a shorter "GO!" beat before play starts.
const LEVEL_INTRO_COUNT_SEC = 3;
const LEVEL_INTRO_GO_SEC = 0.6;
const LEVEL_INTRO_SEC = LEVEL_INTRO_COUNT_SEC + LEVEL_INTRO_GO_SEC;
const LEVEL_CLEAR_SEC = 1.6;
const HIT_FREEZE_SEC = 2;

function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

// The whole game lives in this one Scene. Phaser owns the loop (update()
// is called once per rendered frame with a real delta), rendering (every
// GameObject below draws itself -- there is no manual render() pass),
// input (keyboard via Phaser's own Keyboard plugin), and collision
// detection (Arcade Physics colliders/overlaps). We keep explicit control
// only where the deterministic Pang-style feel requires it: the velocity
// values assigned to Player/Ball/Projectile, and the exact bounce
// response applied in the collision callbacks below.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.audio = new AudioEngine();
    const settings = storage.loadSettings();
    this.audio.applySettings(settings);
    const originalResume = this.audio.resumeContext.bind(this.audio);
    this.audio.resumeContext = () => {
      originalResume();
      this.audio.applySettings(storage.loadSettings());
    };

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
    this.isCustomLevel = false;
    this.customLevelDef = null;

    this.cameras.main.setBackgroundColor(COLORS.bgTop);
    this.drawBackground();
    this.drawBorder();

    // Inset by the border's thickness (OBSTACLE_BLOCK_SIZE) on top/left/
    // right so a ball/player actually bounces off the border's visible
    // inner face instead of the (invisible) canvas edge underneath it --
    // without this the ball would visually travel OBSTACLE_BLOCK_SIZE px
    // into the border tiles before bouncing. The bottom is unaffected:
    // the bottom border sits just past GROUND_Y already (see drawBorder),
    // so GROUND_Y is already exactly the border's inner face there.
    const bt = OBSTACLE_BLOCK_SIZE;
    this.physics.world.setBounds(bt, bt, VIRTUAL_W - bt * 2, GROUND_Y - bt);
    this.physics.world.on('worldbounds', this.onWorldBounds, this);

    this.obstacles = this.physics.add.staticGroup();
    // Plain (non-physics) Groups on purpose: Phaser.Physics.Arcade.Group
    // re-applies its own group-wide physics defaults (velocity 0, gravity
    // 0, collideWorldBounds false, ...) to every member's body on add(),
    // which would silently stomp the per-instance velocity/gravity each
    // Ball/Projectile/Bonus sets up for itself in its own constructor.
    // Plain Groups are still valid collider/overlap targets in Arcade
    // Physics -- only bodies matter, not which Group class holds them.
    this.balls = this.add.group();
    this.projectiles = this.add.group();
    this.powerups = this.add.group();

    this.player = new Player(this);

    this.weaponState = createWeaponState();
    this.effects = new EffectManager();

    this.physics.add.collider(this.balls, this.obstacles, this.onBallHitObstacle, null, this);
    this.physics.add.overlap(this.projectiles, this.balls, this.onProjectileHitBall, null, this);
    this.physics.add.overlap(this.projectiles, this.obstacles, this.onProjectileHitObstacle, null, this);
    this.physics.add.overlap(this.player, this.balls, this.onPlayerHitBall, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.onPlayerCollectPowerup, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', d: 'D', space: 'SPACE', p: 'P', esc: 'ESC' });
    // Event-based rather than a per-frame JustDown() poll, so the toggle
    // reacts the instant Phaser's input manager processes the keydown --
    // not gated behind this scene's own render-frame cadence.
    this.keys.p.on('down', () => this.handlePauseKey());
    this.keys.esc.on('down', () => this.handlePauseKey());
    initTouchInput();

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    this.ui = new UI(this, this.audio, storage);
    this.ui.showTouchControlsIfNeeded();
    this.debug = new Debug(this);
    this.editor = new Editor(this);
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(hexColor(COLORS.bgTop), hexColor(COLORS.bgTop), hexColor(COLORS.bgBottom), hexColor(COLORS.bgBottom), 1);
    g.fillRect(0, 0, VIRTUAL_W, GROUND_Y);
    g.fillStyle(hexColor(COLORS.ground), 1);
    g.fillRect(0, GROUND_Y, VIRTUAL_W, PLAYFIELD_H - GROUND_Y);
    g.fillStyle(hexColor(COLORS.groundEdge), 1);
    g.fillRect(0, GROUND_Y, VIRTUAL_W, 2);
    // Dedicated HUD bar below the bordered playfield (see constants.js
    // HUD_H) -- the DOM #hud overlay is positioned to exactly cover this
    // same strip, see style.css.
    g.fillStyle(hexColor(COLORS.hudBg), 1);
    g.fillRect(0, PLAYFIELD_H, VIRTUAL_W, this.game.config.height - PLAYFIELD_H);
    g.fillStyle(hexColor(COLORS.accent), 1);
    g.fillRect(0, PLAYFIELD_H, VIRTUAL_W, 2);
    g.setDepth(0);
  }

  // The tiled frame the ball/player can never cross -- identical on every
  // level (drawn once here, not level data) and sized to the exact
  // playfield rectangle physics.world.setBounds uses. Top/left/right hug
  // the inside of the world bounds (there's no room outside them --
  // canvas edge and world bound are the same line there); the bottom
  // strip instead sits just past GROUND_Y, in the decorative floor strip
  // below the world bounds, so it doesn't need its own space carved out
  // of the playfield.
  drawBorder() {
    const t = OBSTACLE_BLOCK_SIZE;
    const wallTexture = obstacleTextureKey('wall');
    const strips = [
      this.add.tileSprite(0, 0, VIRTUAL_W, t, wallTexture),
      this.add.tileSprite(0, 0, t, GROUND_Y, wallTexture),
      this.add.tileSprite(VIRTUAL_W - t, 0, t, GROUND_Y, wallTexture),
      this.add.tileSprite(0, GROUND_Y, VIRTUAL_W, t, wallTexture),
    ];
    for (const strip of strips) {
      strip.setOrigin(0, 0);
      strip.setDepth(0.5);
    }
  }

  get currentLevelDef() {
    return this.isCustomLevel ? this.customLevelDef : LEVELS[this.levelIndex];
  }

  get remainingLevelTime() {
    const def = this.currentLevelDef;
    if (!def || !def.timeLimitSec) return 0;
    return Math.max(0, Math.ceil(def.timeLimitSec - this.levelTimer));
  }

  // "3", "2", "1" for one second each, then "GO!" for the final beat --
  // stateTimer counts down from LEVEL_INTRO_SEC to 0 during LEVEL_INTRO.
  get introCountdownLabel() {
    if (this.state !== GAME_STATES.LEVEL_INTRO) return '';
    const countTime = this.stateTimer - LEVEL_INTRO_GO_SEC;
    return countTime > 0 ? String(Math.ceil(countTime)) : 'GO!';
  }

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
    this.isCustomLevel = false;
    this.customLevelDef = null;
    this.effects.reset(this);
    this.loadLevel(this.levelIndex);
    this.startLevelIntro();
  }

  // Level editor entry point: same setup as startNewGame(), but plays a
  // single editor-authored level (loadLevel/currentLevelDef/advanceLevel
  // all branch on isCustomLevel to use it instead of indexing LEVELS).
  startCustomLevel(def) {
    this.score = 0;
    this.lives = PLAYER_CONFIG.startLives;
    this.levelIndex = 0;
    this.scoreMultiplier = 1;
    this.ballsFrozen = false;
    this.justSubmittedEntry = null;
    this.isCustomLevel = true;
    this.customLevelDef = def;
    this.effects.reset(this);
    this.loadLevel(def);
    this.startLevelIntro();
  }

  enterEditor() {
    this.audio.stopMusic();
    this.obstacles.clear(true, true);
    this.balls.clear(true, true);
    this.projectiles.clear(true, true);
    this.powerups.clear(true, true);
    this.state = GAME_STATES.EDITOR;
    this.physics.pause();
    this.editor.enable();
  }

  exitEditor() {
    this.editor.disable();
    this.obstacles.clear(true, true);
    this.balls.clear(true, true);
    this.goToMenu();
  }

  // Balls and the player must stay frozen for the whole "3, 2, 1, GO!"
  // countdown -- Arcade Physics keeps stepping every frame regardless of
  // scene state unless explicitly paused, so without this balls would
  // already be falling/bouncing while the countdown is still on screen.
  startLevelIntro() {
    this.state = GAME_STATES.LEVEL_INTRO;
    this.stateTimer = LEVEL_INTRO_SEC;
    this.physics.pause();
  }

  // Fully (re)loads the current level: balls, obstacles, projectiles,
  // on-field power-ups, player position, weapon state, active temporary
  // effects, and the level timer. Score and lives are untouched, so this
  // is safe both when advancing levels and when the current level
  // restarts after a life is lost. `idxOrDef` is a LEVELS index normally,
  // or the editor's own level definition object for a custom level.
  loadLevel(idxOrDef) {
    const def = loadLevelData(this, idxOrDef);
    this.player.reset();
    this.weaponState = createWeaponState();
    this.effects.reset(this);
    this.levelTimer = 0;
    const musicGroup = typeof idxOrDef !== 'number' ? 2 : idxOrDef < 3 ? 0 : idxOrDef < 6 ? 1 : 2;
    this.audio.playMusic(musicGroup);
    return def;
  }

  restartLevel() {
    this.loadLevel(this.isCustomLevel ? this.customLevelDef : this.levelIndex);
    this.startLevelIntro();
  }

  advanceLevel() {
    if (this.isCustomLevel) {
      this.finishRun('victory');
    } else if (this.levelIndex + 1 < LEVELS.length) {
      this.levelIndex += 1;
      this.loadLevel(this.levelIndex);
      this.startLevelIntro();
    } else {
      this.finishRun('victory');
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

  goToMenu() {
    this.audio.stopMusic();
    this.state = GAME_STATES.MENU;
  }

  showHighScores() {
    this.justSubmittedEntry = null;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  submitHighScore(name) {
    const { entry } = storage.saveHighScore({ name, score: this.score, level: this.levelIndex + 1 });
    this.justSubmittedEntry = entry;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  pause() {
    this.physics.pause();
    this.state = GAME_STATES.PAUSED;
  }

  resumeFromPause() {
    this.physics.resume();
    this.state = GAME_STATES.PLAYING;
  }

  resume() {
    if (this.state === GAME_STATES.PAUSED) this.resumeFromPause();
  }

  togglePause() {
    if (this.state === GAME_STATES.PLAYING) this.pause();
    else if (this.state === GAME_STATES.PAUSED) this.resumeFromPause();
  }

  handlePauseKey() {
    if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.PAUSED) this.togglePause();
  }

  update(time, delta) {
    const dt = Math.min(delta, 250) / 1000;

    if (consumeTouchPausePressed()) this.handlePauseKey();

    switch (this.state) {
      case GAME_STATES.LEVEL_INTRO:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.physics.resume();
          this.state = GAME_STATES.PLAYING;
        }
        break;
      case GAME_STATES.PLAYING:
        this.updatePlaying(dt);
        break;
      case GAME_STATES.HIT_FREEZE:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (this.pendingGameOver) this.finishRun('gameover');
          else this.restartLevel();
        }
        break;
      case GAME_STATES.LEVEL_CLEAR:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.advanceLevel();
        break;
      default:
        break;
    }

    this.debug.render(this.debugGraphics);
    this.editor.render();
    this.ui.render();
  }

  readInput() {
    return {
      left: this.cursors.left.isDown || this.keys.a.isDown || touchInput.left,
      right: this.cursors.right.isDown || this.keys.d.isDown || touchInput.right,
      shoot: this.cursors.up.isDown || this.keys.w.isDown || this.keys.space.isDown || touchInput.shoot,
    };
  }

  updatePlaying(dt) {
    this.elapsedMs += dt * 1000;
    this.levelTimer += dt;
    this.effects.update(this, this.elapsedMs);

    const inputState = this.readInput();
    this.player.update(dt, inputState);

    if (inputState.shoot) this.tryFire();

    // Last 3s of time_freeze: blink the (harmless, see onPlayerHitBall)
    // frozen balls as a warning the freeze is about to end; reset alpha
    // once it actually does.
    const freezeExpiresAt = this.effects.active.get('time_freeze');
    const freezeWarning = this.ballsFrozen && freezeExpiresAt !== undefined && freezeExpiresAt - this.elapsedMs <= 3000;
    for (const ball of this.balls.getChildren()) {
      ball.body.moves = !this.ballsFrozen;
      ball.setAlpha(freezeWarning ? (Math.floor(this.elapsedMs / 90) % 2 === 0 ? 0.35 : 1) : 1);
      if (!this.ballsFrozen) ball.spin(dt);
    }
    for (const pu of this.powerups.getChildren()) pu.update(dt);

    if (this.state === GAME_STATES.PLAYING && this.balls.countActive(true) === 0) {
      this.levelClear();
    }
  }

  tryFire() {
    const activeCount = this.projectiles.countActive(true);
    if (activeCount >= this.weaponState.maxActiveShots) return;
    const base = WEAPON_TYPES.harpoon;
    const width = base.width * this.weaponState.widthMultiplier;
    const tipX = this.player.x;
    const tipY = this.player.y - PLAYER_CONFIG.spriteHeight / 2;
    const proj = new Projectile(this, tipX, tipY, width, base.shotSpeed, this.weaponState.pierce);
    this.projectiles.add(proj);
    this.audio.shoot();
    this.player.playShotAnim();
  }

  popBall(ball) {
    this.score += Math.round(ball.points * this.scoreMultiplier);
    this.audio.pop(5 - ball.size);
    this.spawnBurst(ball.x, ball.y, ball.shapeDef.color, 10);

    const children = ball.getSplitChildren();
    const forcedPowerup = ball.forcedPowerup;
    ball.destroy();
    for (const spec of children) {
      const child = new Ball(this, spec.shape, spec.size, spec.x, spec.y, spec.vx, spec.vy);
      this.balls.add(child);
    }

    // A ball the level editor tagged with a powerup guarantees that drop
    // (bypassing the random roll below) -- see Ball.js's forcedPowerup.
    const dropType = forcedPowerup
      || (Math.random() < POWERUP_DROP_CHANCE ? POWERUP_TYPE_KEYS[Math.floor(Math.random() * POWERUP_TYPE_KEYS.length)] : null);
    if (dropType) {
      const bonus = new Bonus(this, dropType, ball.x, ball.y);
      this.powerups.add(bonus);
    }
  }

  spawnBurst(x, y, colorHex, count, small = false) {
    // Kept tight and short-lived on purpose: a wide/fast/long-lived burst
    // visibly drifts away from the hit point before it fades, which reads
    // as "the effect isn't where the ball was" even though it started
    // exactly there.
    const emitter = this.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
      lifespan: small ? 220 : 280,
      speed: small ? { min: 10, max: 25 } : { min: 15, max: 45 },
      scale: { start: small ? 1.5 : 2, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 60,
      tint: hexColor(colorHex),
      quantity: count,
      emitting: false,
      // A burst near the ground can otherwise drift (via gravityY + its
      // own outward speed) below GROUND_Y and render in the HUD strip,
      // which nothing else in the game is ever allowed to do -- kill any
      // particle the instant it leaves the playfield rectangle.
      deathZone: { type: 'onLeave', source: new Phaser.Geom.Rectangle(0, 0, VIRTUAL_W, GROUND_Y) },
    });
    emitter.setDepth(7);
    emitter.explode(count, x, y);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  // -- Collision handlers -------------------------------------------------

  onWorldBounds(body, up, down, left, right) {
    const go = body.gameObject;
    if (go instanceof Ball) {
      if (down) go.landOnTop();
      if (up) go.bounceOffBottom();
      if (left) go.bounceOffLeft();
      if (right) go.bounceOffRight();
    } else if (go instanceof Projectile) {
      if (up) go.destroy();
    }
  }

  onBallHitObstacle(ballGO, obstacleGO) {
    // Vertical and horizontal contact are independent, not else-if-chained
    // together: a corner hit can have both touching.down (or up) AND
    // touching.left (or right) true at once. Chaining all four as one
    // else-if only fired the vertical bounce and silently skipped the
    // horizontal one -- since Arcade Physics (bounce 0, see Ball.js)
    // already zeroed vx as part of resolving that same collision, the
    // ball was left drifting with zero horizontal speed, bouncing
    // straight up and down like it was stuck on a rail.
    const body = ballGO.body;
    if (body.touching.down) ballGO.landOnTop();
    else if (body.touching.up) ballGO.bounceOffBottom();
    if (body.touching.left) ballGO.bounceOffLeft();
    else if (body.touching.right) ballGO.bounceOffRight();
  }

  onProjectileHitObstacle(projGO, obstacleGO) {
    if (!projGO.active) return;
    projGO.destroy();
    const forcedPowerup = obstacleGO.forcedPowerup;
    const destroyed = obstacleGO.takeHit();
    if (destroyed) {
      this.spawnBurst(obstacleGO.x, obstacleGO.y, obstacleGO.def.color, 10);
      // A crate the level editor tagged with a powerup drops it the
      // moment it's shot down -- see Obstacle.js's forcedPowerup.
      if (forcedPowerup) {
        const bonus = new Bonus(this, forcedPowerup, obstacleGO.x, obstacleGO.y);
        this.powerups.add(bonus);
      }
    }
  }

  onProjectileHitBall(projGO, ballGO) {
    if (!projGO.active || !ballGO.active) return;
    this.popBall(ballGO);
    if (projGO.registerHit()) projGO.destroy();
  }

  onPlayerHitBall(playerGO, ballGO) {
    if (this.state !== GAME_STATES.PLAYING || !ballGO.active) return;
    if (this.ballsFrozen) return; // time_freeze: frozen balls can't hurt the player

    const hadShield = this.player.shielded;
    const lostLife = this.player.takeHit();
    if (!lostLife && hadShield) this.effects.active.delete('shield');

    if (lostLife) {
      this.audio.hit();
      this.lives -= 1;
      this.player.playDeadAnim();
      this.startHitFreeze(this.lives <= 0);
    }
  }

  // Freeze-frame everything (player, balls, projectiles) for a beat after
  // a hit lands, before restarting the level or ending the run -- same
  // physics.pause() mechanism as LEVEL_INTRO/PAUSED, so nothing simulates
  // while the frozen picture is on screen.
  startHitFreeze(isGameOver) {
    this.pendingGameOver = isGameOver;
    this.state = GAME_STATES.HIT_FREEZE;
    this.stateTimer = HIT_FREEZE_SEC;
    this.physics.pause();
  }

  onPlayerCollectPowerup(playerGO, bonusGO) {
    if (!bonusGO.active) return;
    this.effects.apply(bonusGO.type, this, this.elapsedMs);
    this.audio.powerup();
    this.spawnBurst(bonusGO.x, bonusGO.y, bonusGO.def.color, 8, true);
    bonusGO.destroy();
  }
}

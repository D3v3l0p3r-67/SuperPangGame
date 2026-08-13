import { VIRTUAL_W, PLAYFIELD_H, GROUND_Y, BORDER_THICKNESS, GAME_STATES, COLORS, LEVEL_INTRO_SEC, LEVEL_INTRO_GO_SEC, LEVEL_INTRO_SET_SEC } from './constants.js';
import {
  PLAYER_CONFIG, WEAPON_TYPES, POWERUP_DROP_CHANCE,
  TIME_BONUS_POINTS_PER_SEC, TIME_BONUS_COUNTDOWN_PER_SEC, TIME_BONUS_TICK_SEC, LEVEL_TRANSITION,
} from './config.js';
import { POWERUP_TYPE_KEYS, getBallElement } from './elements.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { Projectile } from './Projectile.js';
import { Bullet } from './Bullet.js';
import { Bonus } from './Bonus.js';
import { refreshObstacleSeams } from './Obstacle.js';
import { createWeaponState, EffectManager } from './weapons.js';
import { loadLevel as loadLevelData, playerSpawn, DEFAULT_PLAYER_SPAWN, LEVELS, PANIC_LEVEL } from './LevelManager.js';
import { AudioManager } from './audio.js';
import { UI } from './ui.js';
import { Hud } from './Hud.js';
import { LevelIntro } from './LevelIntro.js';
import { LevelTransition } from './LevelTransition.js';
import { WorldMapInterlude } from './WorldMapInterlude.js';
import { regionForLevel, regionIndexForLevel, crossesRegion } from './regions.js';
import { ScorePopup } from './ScorePopup.js';
import { Debug } from './debug.js';
import { Editor } from './editor.js';
import { touchInput, initTouchInput, consumeTouchPausePressed } from './input.js';
import { initKeyboard, readKeyboard, onPauseKey } from './keys.js';
import * as storage from './storage.js';
import {
  obstacleTextureKey, PARTICLE_TEXTURE_KEY, backgroundTextureKey, DEFAULT_BACKGROUND,
  ballPopTextureKey, ballPopAnimKey,
  PLAYER_HIT_TEXTURE_KEY, PLAYER_HIT_ANIM_KEY,
  PLAYER_DUST_TEXTURE_KEY, PLAYER_DUST_ANIM_KEY,
  BULLET_HIT_TEXTURE_KEY, BULLET_HIT_ANIM_KEY,
} from './assets.js';
import { hexColor } from './colors.js';

// Shortest the cleared-level screen ever lasts, so the player's
// celebration animation (6 frames at 3fps = 2s, see assets.js's
// PLAYER_ANIM_FRAMES.levelclear) always finishes even when there's no
// time bonus to count off. A level with time left runs longer than this:
// the tally takes as long as it takes, and LEVEL_CLEAR_PAUSE_SEC is held
// after it before the next level loads.
const LEVEL_CLEAR_MIN_SEC = 2;
const LEVEL_CLEAR_PAUSE_SEC = 1;

// How long leftover shots/power-ups/score popups take to fade away once a
// level is cleared (see fadeOutLeftovers). Under LEVEL_CLEAR_MIN_SEC, so
// the fade always finishes before the next level can load.
const LEFTOVER_FADE_SEC = 1;
const HIT_FREEZE_SEC = 2;

// One ball bounce, resolved from whichever set of contact flags the
// caller has -- the world-bounds event's own arguments, or an obstacle
// collision's body.touching (see the two call sites below).
//
// Exactly one axis changes DIRECTION per bounce: a corner hit (e.g. down
// AND left both true at once) picks vertical over horizontal rather than
// flipping both. Arcade still zeroes BOTH axes' velocity while resolving
// that corner collision though (see Ball.js), so the horizontal axis --
// even though it isn't supposed to change direction here -- has to be
// explicitly reasserted, or the ball is left motionless on it.
function resolveBallBounce(ball, { up, down, left, right }) {
  if (down) {
    ball.landOnTop();
    if (left || right) ball.reassertHorizontal();
  } else if (up) {
    ball.bounceOffBottom();
    if (left || right) ball.reassertHorizontal();
  } else if (left) {
    ball.bounceOffLeft();
  } else if (right) {
    ball.bounceOffRight();
  }
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
    this.audio = new AudioManager(this);
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
    // Cleared-level time-bonus tally -- see levelClear/updateLevelClear.
    this.timeBonusSecondsLeft = 0;
    this.timeBonusPartialPoint = 0;
    this.timeBonusTickTimer = 0;
    this.introLeadInSec = 0; // see startLevelIntro/beginRun
    this.levelClearElapsed = 0;
    this.levelClearPhase = 'pause';
    this.justSubmittedEntry = null;
    this.lastOutcome = null;
    this.isCustomLevel = false;
    this.customLevelDef = null;
    this.isPanicMode = false;
    this.pausedFromEditor = false;
    // Which campaign level the LEVEL EDITOR has open (an index into
    // LEVELS), and the unsaved buffer a playtest of it left behind --
    // playtesting replaces everything in the scene, so this is what lets
    // coming back from one carry on editing instead of re-reading the
    // level and dropping every unsaved change. See editLevel/Editor.play.
    this.editorLevelIndex = 0;
    this.editorDraft = null;
    // Which list the level-select screen is showing: 'play' (Start Level)
    // or 'edit' (pick the level to open in the editor). Same screen and
    // the same fifty levels -- see ui.js's renderLevelSelect.
    this.levelSelectMode = 'play';
    this.panicWaveIndex = 0;
    this.panicPopCount = 0;
    this.weaponType = 'harpoon';
    this.volleyCounter = 0; // see fireVolley -- ids only need to be distinct
    this.scorePopups = []; // live ScorePopup instances -- see popBall/updatePlaying
    // Tracks last frame's shoot input so a held key only ever fires once
    // per press (see updatePlaying).
    this.wasShooting = false;
    // Same, for the two climb controls -- see updatePlaying.
    this.wasUp = false;
    this.wasDown = false;

    this.cameras.main.setBackgroundColor(COLORS.bgTop);
    this.drawBackground();
    this.drawBorder();

    // Inset by the border's thickness (BORDER_THICKNESS) on top/left/
    // right so a ball/player actually bounces off the border's visible
    // inner face instead of the (invisible) canvas edge underneath it --
    // without this the ball would visually travel BORDER_THICKNESS px
    // into the border tiles before bouncing. The bottom is unaffected:
    // the bottom border sits just past GROUND_Y already (see drawBorder),
    // so GROUND_Y is already exactly the border's inner face there.
    const bt = BORDER_THICKNESS;
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
    // Ladders collide with nothing at all (see Ladder.js) -- this group
    // exists so they are cleared with everything else on a level change,
    // and so Player.js has somewhere to look them up.
    this.ladders = this.add.group();
    this.projectiles = this.add.group();
    this.powerups = this.add.group();

    this.player = new Player(this);

    this.weaponState = createWeaponState();
    this.effects = new EffectManager();

    this.physics.add.collider(this.balls, this.obstacles, this.onBallHitObstacle, null, this);
    this.physics.add.overlap(this.projectiles, this.balls, this.onProjectileHitBall, null, this);
    this.physics.add.overlap(this.projectiles, this.obstacles, this.onProjectileHitObstacle, null, this);
    // Solid, not an overlap -- an intact obstacle physically blocks the
    // player like the border does; only once its blocks are actually shot
    // down (removed from this.obstacles, see onProjectileHitObstacle) does
    // that space open up. No callback needed, Arcade's own separation is
    // the entire effect.
    // The process callback is what lets the player walk UP a low ledge: an
    // obstacle it can step onto (see Player.canStepOnto) is skipped rather
    // than collided with, and Player.followGround lifts the feet onto it.
    // Anything taller, or without headroom above it, still blocks.
    // A climber passes through obstacles outright, which is what lets a
    // ladder carry the player up through the platform it ends against.
    this.physics.add.collider(this.player, this.obstacles, null,
      (playerGO, obstacleGO) => !playerGO.ladder && !playerGO.canStepOnto(obstacleGO.body), this);
    this.physics.add.overlap(this.player, this.balls, this.onPlayerHitBall, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.onPlayerCollectPowerup, null, this);
    this.physics.add.overlap(this.projectiles, this.powerups, this.onProjectileHitPowerup, null, this);
    // A dropped power-up can land on an obstacle instead of falling all
    // the way to the ground -- see onPowerupHitObstacle/Bonus.js.
    this.physics.add.collider(this.powerups, this.obstacles, this.onPowerupHitObstacle, null, this);

    // Keyboard comes from js/keys.js rather than Phaser's own plugin,
    // because every game key is rebindable (see the CONTROLS screen) and
    // a binding is the physical KeyboardEvent.code the player pressed.
    initKeyboard();
    // Event-based rather than a per-frame poll, so the toggle reacts the
    // instant the browser reports the keydown -- not gated behind this
    // scene's own render-frame cadence.
    onPauseKey(() => this.handlePauseKey());
    // Losing the window pauses a run, onto the same screen Escape opens.
    // Both signals are needed, because they are different situations and
    // Phaser handles them differently. HIDDEN (the tab switched away)
    // already stops its game loop, so nothing simulates while you are
    // gone -- but coming back would drop you straight into a live ball
    // with no warning. BLUR (another window in front, the game still on
    // screen) does NOT stop the loop: the level clock would go on running
    // while nobody is playing, which is the one that actually costs you
    // the level. Neither has a matching resume: coming back is a decision
    // the player makes on the pause screen, not one focus makes for them.
    for (const event of [Phaser.Core.Events.BLUR, Phaser.Core.Events.HIDDEN]) {
      this.game.events.on(event, () => this.pauseFromFocusLoss());
    }
    initTouchInput();

    this.buildBurstEmitters();

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(100);

    this.ui = new UI(this, this.audio, storage);
    this.ui.showTouchControlsIfNeeded();
    this.ui.setupMobileFullscreen();
    this.hud = new Hud(this);
    this.levelIntro = new LevelIntro(this);
    this.transition = new LevelTransition(this);
    this.worldMap = new WorldMapInterlude(this);
    this.debug = new Debug(this);
    this.editor = new Editor(this);
  }

  drawBackground() {
    // Per-level background image (see setLevelBackground, called from
    // loadLevel) covers the sky area a flat gradient fill used to occupy
    // here; the floor strip and HUD bar below stay solid color on every
    // level, drawn by the Graphics object below as before.
    this.backgroundImage = this.add.image(0, 0, backgroundTextureKey(DEFAULT_BACKGROUND))
      .setOrigin(0, 0)
      .setDisplaySize(VIRTUAL_W, GROUND_Y)
      .setDepth(0);

    const g = this.add.graphics();
    g.fillStyle(hexColor(COLORS.ground), 1);
    g.fillRect(0, GROUND_Y, VIRTUAL_W, PLAYFIELD_H - GROUND_Y);
    g.fillStyle(hexColor(COLORS.groundEdge), 1);
    g.fillRect(0, GROUND_Y, VIRTUAL_W, 2);
    // Dedicated HUD bar below the bordered playfield (see constants.js
    // HUD_H) -- Hud.js draws the actual stat graphics into this same
    // strip (its container sits at y = PLAYFIELD_H).
    g.fillStyle(hexColor(COLORS.hudBg), 1);
    g.fillRect(0, PLAYFIELD_H, VIRTUAL_W, this.game.config.height - PLAYFIELD_H);
    g.fillStyle(hexColor(COLORS.accent), 1);
    g.fillRect(0, PLAYFIELD_H, VIRTUAL_W, 2);
    g.setDepth(0);
  }

  // The two particle bursts the game ever plays -- a normal one (a ball or
  // an obstacle breaking) and a smaller, shorter one (a power-up being
  // collected) -- built ONCE here and re-fired for the rest of the
  // session. Only the tint changes per burst, which is why two fixed
  // emitters cover it rather than one reconfigured on the fly.
  //
  // Building one per burst instead (and destroying it on a timer 500ms
  // later) meant a whole emitter, its particle pool and a fresh death-zone
  // Geom for every ball popped -- the most frequent event in the game.
  //
  // Kept tight and short-lived on purpose: a wide/fast/long-lived burst
  // visibly drifts away from the hit point before it fades, which reads as
  // "the effect isn't where the ball was" even though it started exactly
  // there.
  buildBurstEmitters() {
    // A burst near the ground can otherwise drift (via gravityY + its own
    // outward speed) below GROUND_Y and render in the HUD strip, which
    // nothing else in the game is ever allowed to do -- kill any particle
    // the instant it leaves the playfield rectangle.
    const deathZone = { type: 'onLeave', source: new Phaser.Geom.Rectangle(0, 0, VIRTUAL_W, GROUND_Y) };
    const make = (lifespan, speed, scale) => this.add.particles(0, 0, PARTICLE_TEXTURE_KEY, {
      lifespan, speed, scale, alpha: { start: 1, end: 0 }, gravityY: 60, emitting: false, deathZone,
    }).setDepth(7);
    this.burstNormal = make(280, { min: 15, max: 45 }, { start: 2, end: 0 });
    this.burstSmall = make(220, { min: 10, max: 25 }, { start: 1.5, end: 0 });
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
    const t = BORDER_THICKNESS;
    const wallTexture = obstacleTextureKey('wall');
    const strips = [
      this.add.tileSprite(0, 0, VIRTUAL_W, t, wallTexture),
      this.add.tileSprite(0, 0, t, GROUND_Y, wallTexture),
      this.add.tileSprite(VIRTUAL_W - t, 0, t, GROUND_Y, wallTexture),
      this.add.tileSprite(0, GROUND_Y, VIRTUAL_W, PLAYFIELD_H - GROUND_Y, wallTexture),
    ];
    for (const strip of strips) {
      strip.setOrigin(0, 0);
      strip.setDepth(0.5);
    }
  }

  get currentLevelDef() {
    if (this.isCustomLevel) return this.customLevelDef;
    if (this.isPanicMode) return PANIC_LEVEL;
    return LEVELS[this.levelIndex];
  }

  get remainingLevelTime() {
    // While a cleared level is tallying its time bonus, the HUD's clock
    // follows the draining bonus counter instead of the (now frozen) level
    // timer -- that's what makes the time visibly count down into the
    // score (see updateLevelClear).
    if (this.state === GAME_STATES.LEVEL_CLEAR) return Math.max(0, Math.ceil(this.timeBonusSecondsLeft));
    const def = this.currentLevelDef;
    if (!def || !def.timeLimitSec) return 0;
    return Math.max(0, Math.ceil(def.timeLimitSec - this.levelTimer));
  }

  // How many shots the weapon in hand allows on its own, before any
  // power-up. Read by the rapid_shot behavior, which adds to it rather
  // than replacing it.
  get baseMaxActiveShots() {
    return WEAPON_TYPES[this.weaponType].baseMaxActiveShots;
  }

  get weaponLabel() {
    const parts = [];
    if (this.effects.active.has('rapid_shot')) parts.push('RAPID');
    parts.push(WEAPON_TYPES[this.weaponType].label.toUpperCase());
    return parts.join(' ');
  }

  // Empties every entity group, destroying the members rather than just
  // removing them from the group -- shared by the editor entry/exit
  // paths here and by LevelManager's own level (re)load.
  clearEntities() {
    // A level-clear fade (see fadeOutLeftovers) normally finishes well
    // before this runs, but quitting or restarting mid-fade would leave
    // a tween animating an object that no longer exists -- so drop any
    // tween still targeting these before destroying them.
    this.tweens.killTweensOf([...this.projectiles.getChildren(), ...this.powerups.getChildren()]);
    this.obstacles.clear(true, true);
    this.ladders.clear(true, true);
    this.balls.clear(true, true);
    this.projectiles.clear(true, true);
    this.powerups.clear(true, true);
  }

  // Shared fresh-run setup behind all four entry points below: what a new
  // run resets (score, lives, multiplier, effects, ...) is identical for
  // every one of them, only WHICH level definition gets loaded differs.
  // `customDef` is the editor's own level object, or null for an ordinary
  // run through LEVELS; `panicMode` selects PANIC_LEVEL instead -- either
  // way, everything else (currentLevelDef, restartLevel, advanceLevel,
  // levelClear's unlock bookkeeping) branches on the isCustomLevel/
  // isPanicMode flags set here.
  beginRun(levelIndex, customDef, panicMode = false) {
    // Quitting to the menu mid-transition leaves the overlay up; starting
    // anything new clears it.
    this.transition.stop();
    this.worldMap.stop();
    this.score = 0;
    this.lives = PLAYER_CONFIG.startLives;
    this.levelIndex = levelIndex;
    this.scoreMultiplier = 1;
    this.ballsFrozen = false;
    this.justSubmittedEntry = null;
    this.isCustomLevel = customDef !== null;
    this.customLevelDef = customDef;
    this.isPanicMode = panicMode;
    // Only a genuinely fresh run starts back at wave 1 -- a same-run
    // restart after losing a life (restartLevel(), which calls loadLevel()
    // directly rather than through here) deliberately leaves this alone,
    // so the run picks back up on whatever wave it was on (see loadLevel's
    // own panicPopCount/panicSpawnAt reset for what DOES restart on a hit).
    this.panicWaveIndex = 0;
    this.effects.reset(this);
    // The run-start fanfare used to play straight over the countdown's own
    // cues. The countdown now waits it out: its title card is up (the
    // LEVEL/name rows) while the fanfare rings, and READY only sounds once
    // it's finished. Only a NEW run gets this -- advancing or restarting a
    // level within one doesn't replay the fanfare, so those intros start
    // immediately as before.
    const fanfare = this.audio.play('superpang');
    this.loadLevel(panicMode ? PANIC_LEVEL : (customDef ?? levelIndex));
    this.startLevelIntro(fanfare?.duration ?? 0);
  }

  startNewGame() {
    this.beginRun(0, null);
  }

  // Entry point for the menu's Start Level screen -- identical setup to
  // startNewGame(), just at an arbitrary (already-unlocked, see
  // storage.isLevelUnlocked) level index instead of always 0.
  startAtLevel(levelIndex) {
    this.beginRun(levelIndex, null);
  }

  // Level editor entry point: same setup again, but playing a single
  // editor-authored level instead of indexing into LEVELS.
  startCustomLevel(def) {
    this.beginRun(0, def);
  }

  // Endless survival mode: no fixed ball set and no time limit -- balls
  // instead drop from the ceiling on a timer defined by PANIC_LEVEL's own
  // panicSpawn wave table (levels/panic.json), escalating in size/speed
  // the longer the run lasts (see updatePanicSpawner). Ends the same way
  // an ordinary run does, by running out of lives.
  startPanicMode() {
    this.beginRun(0, null, true);
  }

  // Opens the editor on a campaign level, from the level list (see
  // showLevelSelect('edit')). A fresh pick starts from that level as it
  // stands, so any buffer left by a previous session's playtest goes.
  editLevel(levelIndex) {
    this.editorLevelIndex = levelIndex;
    this.editorDraft = null;
    this.enterEditor();
  }

  enterEditor() {
    this.audio.stopMusic();
    this.clearEntities();
    // Editing isn't a run of anything -- clear both run-mode flags so a
    // playtest that came before (which set isCustomLevel, see beginRun)
    // can't leave the pause menu offering run-only actions like RESTART
    // LEVEL while what's actually on screen is the editor.
    this.isCustomLevel = false;
    this.isPanicMode = false;
    this.pausedFromEditor = false;
    this.state = GAME_STATES.EDITOR;
    this.physics.pause();
    this.editor.enable(this.editorLevelIndex, this.editorDraft);
  }

  // Escape while editing opens the same pause menu gameplay uses (it did
  // nothing at all before), with a LEVEL EDITOR entry back to editing --
  // see ui.js's setScreen. The editor's panel is hidden while the menu is
  // up so the two aren't stacked on screen at once; disable() only hides
  // UI, so the level being edited stays in the scene untouched, unsaved
  // edits included (see Editor.reshowPanel).
  pauseFromEditor() {
    this.editor.disable();
    this.pausedFromEditor = true;
    this.pause();
  }

  // Back to editing from the pause menu, by either route: resuming an
  // editor session Escape interrupted (the level is still in the scene, so
  // just show the panel again), or leaving a playtest (which replaced the
  // scene's contents, so the editor reloads -- from the draft the playtest
  // was started from, saved or not, see editorDraft).
  returnToEditor() {
    if (this.pausedFromEditor) {
      this.pausedFromEditor = false;
      this.editor.reshowPanel();
      this.state = GAME_STATES.EDITOR;
      return; // physics stays paused, exactly as enterEditor leaves it
    }
    this.enterEditor();
  }

  exitEditor() {
    this.editor.disable();
    this.clearEntities();
    this.goToMenu();
  }

  // Balls and the player must stay frozen for the whole "3, 2, 1, GO!"
  // countdown -- Arcade Physics keeps stepping every frame regardless of
  // scene state unless explicitly paused, so without this balls would
  // already be falling/bouncing while the countdown is still on screen.
  // `leadInSec` holds the countdown (and its cues) for that long first,
  // showing only the LEVEL/name title card -- used to let the run-start
  // fanfare finish before READY interrupts it (see beginRun).
  startLevelIntro(leadInSec = 0) {
    this.state = GAME_STATES.LEVEL_INTRO;
    this.stateTimer = LEVEL_INTRO_SEC;
    this.introLeadInSec = leadInSec;
    this.physics.pause();
    // One cue per countdown word. READY sounds as the countdown proper
    // opens -- here, or when the lead-in expires (see update's LEVEL_INTRO
    // case); SET and GO! fire from there too, at the exact thresholds
    // LevelIntro.js swaps the text at, so word and sound always land
    // together however long the countdown is.
    this.setSoundPlayed = false;
    this.goSoundPlayed = false;
    if (leadInSec <= 0) this.audio.play('ready');
  }

  // Fully (re)loads the current level: balls, obstacles, projectiles,
  // on-field power-ups, player position, weapon state, active temporary
  // effects, and the level timer. Score and lives are untouched, so this
  // is safe both when advancing levels and when the current level
  // restarts after a life is lost. `idxOrDef` is a LEVELS index normally,
  // or the editor's own level definition object for a custom level.
  loadLevel(idxOrDef) {
    const def = loadLevelData(this, idxOrDef);
    for (const popup of this.scorePopups) popup.destroy();
    this.scorePopups = [];
    this.player.reset(playerSpawn(def) || DEFAULT_PLAYER_SPAWN);
    this.weaponType = def.weapon && WEAPON_TYPES[def.weapon] ? def.weapon : 'harpoon';
    this.weaponState = createWeaponState(this.weaponType);
    // A campaign level takes its look and its music from the continent
    // it is played on (see js/regions.js), not from its own file -- that's
    // what makes five levels in a row feel like one place. Editor/custom
    // levels and Panic Mode aren't on the itinerary and keep their own.
    const region = typeof idxOrDef === 'number' ? regionForLevel(idxOrDef) : null;
    this.backgroundImage.setTexture(backgroundTextureKey(
      region?.background || def.background || DEFAULT_BACKGROUND));
    this.effects.reset(this);
    this.levelTimer = 0;
    // Panic Mode only (see updatePanicSpawner/panicWave/popBall) --
    // panicSpawnAt is the levelTimer value at which the next ceiling-drop
    // ball is due; panicPopCount tracks progress within the CURRENT wave.
    // Both reset on every load, including a post-hit restart, so a life
    // lost restarts the wave you were actually on ("that level's balls
    // start falling again") rather than dumping progress. panicWaveIndex
    // itself is deliberately NOT touched here -- see beginRun().
    this.panicSpawnAt = def.panicSpawn?.initialDelaySec ?? 0;
    this.panicPopCount = 0;
    this.hurryUpPlayed = false;
    this.hurryMusicPlayed = false;
    // A key still held from before this level started (e.g. mashed
    // through the level-clear screen) shouldn't read as a fresh press.
    this.wasShooting = true;
    // Stored, not started yet: music only actually starts once the balls
    // do (LEVEL_INTRO -> PLAYING, see update()), never during the frozen
    // "READY"/"GO!" countdown. A campaign level plays its continent's
    // track; Panic Mode and editor playtests, being off the itinerary,
    // keep the two generic ones.
    this.pendingMusicName = region?.music ?? (this.isPanicMode ? 'music02' : 'music01');
    // Warm it now rather than at the moment it is due. Music is fetched on
    // demand (see BootScene's preload / audio.js's ensureMusicLoaded), and
    // everything between here and the first ball moving -- the fanfare,
    // READY/SET/GO, and on a continent change the whole world-map flight
    // -- is cover for that fetch. The hurry-up track has no such cover
    // (it cuts in at 15 seconds left, mid-play), so it is warmed here too;
    // it is the smallest track in the game.
    this.audio.ensureMusicLoaded(this.pendingMusicName);
    if (def.timeLimitSec) this.audio.ensureMusicLoaded('music_hurry');
    return def;
  }

  restartLevel() {
    if (this.isCustomLevel) this.loadLevel(this.customLevelDef);
    else if (this.isPanicMode) this.loadLevel(PANIC_LEVEL);
    else this.loadLevel(this.levelIndex);
    this.startLevelIntro();
  }

  advanceLevel() {
    if (this.isCustomLevel) {
      // A level opened via the editor's Play button is a playtest, not a
      // real run -- clearing it doesn't end anything (there's no "next
      // level" to go to and no victory to record), it just pauses on the
      // same menu Escape would, restart included (see ui.js's setScreen),
      // so the level's own author can immediately go again.
      this.pause();
    } else if (this.levelIndex + 1 < LEVELS.length) {
      // The one real level-to-level step in a campaign run, and the only
      // place a transition belongs: the screen is hidden, the next level
      // is built underneath it, and it is drawn back off (see
      // js/LevelTransition.js). Finishing the run doesn't get one -- there
      // is no next level to reveal, only the victory screen, which is DOM
      // and sits above the canvas the effect is drawn on anyway.
      const from = this.levelIndex;
      const to = from + 1;
      this.transition.start(LEVEL_TRANSITION, () => {
        this.levelIndex = to;
        this.loadLevel(to);
        // Crossing to a new continent: the transition uncovers onto the
        // world map instead of onto the level, and the level's own intro
        // waits until the plane has landed and the map has faded.
        if (crossesRegion(from, to)) {
          this.audio.stopMusic();
          this.worldMap.start(regionIndexForLevel(from), regionIndexForLevel(to),
            () => this.startLevelIntro());
        } else {
          this.startLevelIntro();
        }
      });
    } else {
      this.finishRun('victory');
    }
  }

  levelClear() {
    const def = this.currentLevelDef;
    // The time bonus is no longer added in one jump -- it's counted off
    // second by second during LEVEL_CLEAR so the clock visibly drains
    // into the score (see updateLevelClear).
    this.timeBonusSecondsLeft = def.timeLimitSec
      ? Math.max(0, def.timeLimitSec - this.levelTimer)
      : 0;
    this.timeBonusPartialPoint = 0;
    this.timeBonusTickTimer = 0; // ticks from the very first tally frame
    this.levelClearElapsed = 0;
    this.levelClearPhase = this.timeBonusSecondsLeft > 0 ? 'tally' : 'pause';
    // Custom/editor levels aren't part of LEVELS and never unlock anything.
    if (!this.isCustomLevel) storage.markLevelCleared(this.levelIndex);
    this.audio.stopMusic();
    this.audio.play('levelcomplete');
    // Celebrate standing still rather than coasting onward: physics keeps
    // running through LEVEL_CLEAR while update() no longer feeds the
    // player input, so without this it would keep sliding at whatever
    // speed it happened to be moving at when the last ball popped.
    this.player.playLevelClearAnim();
    this.fadeOutLeftovers();
    this.state = GAME_STATES.LEVEL_CLEAR;
    this.stateTimer = LEVEL_CLEAR_PAUSE_SEC;
  }

  // The cleared-level screen: first the leftover clock is counted off into
  // the score a bit at a time (the HUD's TIME row reads timeBonusSecondsLeft
  // while this runs, see remainingLevelTime, so one visibly drains as the
  // other climbs), then LEVEL_CLEAR_PAUSE_SEC of stillness, and only then
  // does the next level load. Points accrue fractionally and are handed to
  // the score in whole units, so the HUD's integer readout climbs smoothly
  // instead of in one jump at the end.
  updateLevelClear(dt) {
    this.levelClearElapsed += dt;

    if (this.levelClearPhase === 'tally') {
      const drained = Math.min(this.timeBonusSecondsLeft, TIME_BONUS_COUNTDOWN_PER_SEC * dt);
      this.timeBonusSecondsLeft -= drained;
      this.timeBonusPartialPoint += drained * TIME_BONUS_POINTS_PER_SEC;
      const whole = Math.floor(this.timeBonusPartialPoint);
      this.score += whole;
      this.timeBonusPartialPoint -= whole;

      // The counting sound, on its own fixed interval so it ticks at a
      // steady rate rather than once per frame (frame-rate dependent) or
      // once per point (thousands a second).
      // Reset rather than subtract the interval: after a dropped frame the
      // timer can be several intervals overdue, and carrying that debt
      // forward would fire a burst of ticks catching up.
      this.timeBonusTickTimer -= dt;
      if (this.timeBonusTickTimer <= 0) {
        this.audio.play('scoretick');
        this.timeBonusTickTimer = TIME_BONUS_TICK_SEC;
      }

      if (this.timeBonusSecondsLeft > 0) return;
      this.timeBonusSecondsLeft = 0;
      this.levelClearPhase = 'pause';
      this.stateTimer = LEVEL_CLEAR_PAUSE_SEC;
      return;
    }

    this.stateTimer -= dt;
    // The minimum keeps a short tally (or none at all) from cutting the
    // player's 2s celebration animation short.
    // Once the transition is running it owns the handover -- the state
    // stays LEVEL_CLEAR until it has the screen covered, so without this
    // the advance would be re-triggered on every frame until then.
    if (this.transition.active || this.worldMap.active) return;
    if (this.stateTimer <= 0 && this.levelClearElapsed >= LEVEL_CLEAR_MIN_SEC) this.advanceLevel();
  }

  // Anything still lying around when the level ends -- a shot mid-flight,
  // uncollected power-ups -- fades away over LEFTOVER_FADE_SEC instead of
  // blinking out of existence the instant the level does. Their bodies go
  // first, so a power-up can't still be collected (or a beam still pop
  // something) while it's visibly on its way out. The fade is deliberately
  // shorter than LEVEL_CLEAR_MIN_SEC so it always finishes before the next
  // level loads and clearEntities() takes the objects away underneath it.
  fadeOutLeftovers() {
    for (const go of [...this.projectiles.getChildren(), ...this.powerups.getChildren()]) {
      if (go.body) go.body.enable = false;
      this.tweens.add({
        targets: go,
        alpha: 0,
        duration: LEFTOVER_FADE_SEC * 1000,
        onComplete: () => go.destroy(),
      });
    }
    // The last ball's "+N" is still on screen at this exact moment (that
    // pop is what cleared the level), so it fades on the same clock rather
    // than hanging frozen -- update() stops driving popups outside PLAYING.
    for (const popup of this.scorePopups) popup.fadeOut(LEFTOVER_FADE_SEC * 1000);
  }

  finishRun(outcome) {
    // A run can end while a transition is mid-flight (the last level
    // cleared into a game over on the timer, say) -- drop the overlay
    // rather than leave the playfield covered under the end screen.
    this.transition.stop();
    this.worldMap.stop();
    this.audio.stopMusic();
    this.lastOutcome = outcome;
    if (outcome === 'gameover') this.audio.play('gameover');
    else {
      this.audio.play('levelcomplete');
      this.player.playVictoryAnim();
    }

    if (storage.qualifiesForHighScore(this.score)) {
      this.state = GAME_STATES.HIGH_SCORE_ENTRY;
    } else {
      this.state = outcome === 'gameover' ? GAME_STATES.GAME_OVER : GAME_STATES.VICTORY;
    }
  }

  goToMenu() {
    // Quitting straight from an Escape-in-the-editor pause has to finish
    // that exit properly -- pauseFromEditor only hid the panel, so the
    // level being edited is still sitting in the scene and would otherwise
    // stay visible behind the main menu.
    if (this.pausedFromEditor) {
      this.pausedFromEditor = false;
      this.clearEntities();
    }
    this.audio.stopMusic();
    this.state = GAME_STATES.MENU;
  }

  showHighScores() {
    this.justSubmittedEntry = null;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  showOptions() {
    this.state = GAME_STATES.OPTIONS;
  }

  // Rebinding the game's keys, on a screen of its own rather than in the
  // options list: six actions with two keys each is a table, not a row of
  // settings (see ui.js's renderKeyList).
  showKeyConfig() {
    this.state = GAME_STATES.KEY_CONFIG;
  }

  showLevelSelect(mode = 'play') {
    this.levelSelectMode = mode;
    this.state = GAME_STATES.LEVEL_SELECT;
  }

  submitHighScore(name) {
    const { entry } = storage.saveHighScore({ name, score: this.score, level: this.levelIndex + 1 });
    this.justSubmittedEntry = entry;
    this.state = GAME_STATES.HIGH_SCORE_TABLE;
  }

  pause() {
    this.physics.pause();
    this.audio.pauseMusic();
    this.state = GAME_STATES.PAUSED;
  }

  resumeFromPause() {
    // Resuming a pause that came from the editor means going back to
    // editing, not starting to play whatever level was loaded before.
    if (this.pausedFromEditor) {
      this.returnToEditor();
      return;
    }
    this.physics.resume();
    this.audio.resumeMusic();
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
    if (this.state === GAME_STATES.EDITOR) this.pauseFromEditor();
    else if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.PAUSED) this.togglePause();
  }

  // The window went away mid-run (see create). Only actual play is worth
  // freezing: a menu and the editor have nothing running, an already-open
  // pause screen is where this would put you anyway, and pausing the
  // level intro would cut its countdown short (leaving the pause screen
  // goes straight to PLAYING).
  pauseFromFocusLoss() {
    if (this.state === GAME_STATES.PLAYING) this.pause();
  }

  update(time, delta) {
    const dt = Math.min(delta, 250) / 1000;

    if (consumeTouchPausePressed()) this.handlePauseKey();

    switch (this.state) {
      case GAME_STATES.LEVEL_INTRO:
        // Lead-in: hold the countdown (and the physics freeze) while the
        // run-start fanfare finishes, then open with READY.
        if (this.introLeadInSec > 0) {
          this.introLeadInSec -= dt;
          if (this.introLeadInSec <= 0) this.audio.play('ready');
          break;
        }
        this.stateTimer -= dt;
        // The same thresholds LevelIntro.js uses to swap the countdown
        // word, so each sound lands on the frame its word appears.
        if (!this.setSoundPlayed && this.stateTimer <= LEVEL_INTRO_GO_SEC + LEVEL_INTRO_SET_SEC) {
          this.setSoundPlayed = true;
          this.audio.play('set');
        }
        if (!this.goSoundPlayed && this.stateTimer <= LEVEL_INTRO_GO_SEC) {
          this.goSoundPlayed = true;
          this.audio.play('go');
        }
        if (this.stateTimer <= 0) {
          this.physics.resume();
          this.state = GAME_STATES.PLAYING;
          // Music starts exactly when the balls do, never during the
          // frozen countdown -- see loadLevel()'s pendingMusicName.
          this.audio.playMusic(this.pendingMusicName);
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
        this.updateLevelClear(dt);
        break;
      default:
        break;
    }

    this.debug.render(this.debugGraphics);
    this.editor.render();
    this.ui.render();
    this.hud.render();
    this.levelIntro.render();
    // Ticked outside the state switch, and last: the transition spans the
    // very change of state it wraps (LEVEL_CLEAR out, LEVEL_INTRO in), so
    // it can't belong to either case, and it has to paint over everything
    // the frame already drew.
    this.transition.update(dt);
    this.worldMap.update(dt);
  }

  // `up` is both the climb control and (as it always has been) the shoot
  // key -- which of the two a press means is decided in updatePlaying,
  // once Player.update has said whether it had a ladder to spend it on.
  // `shoot` here is therefore only the keys that mean nothing else, so
  // that shooting still works with both hands on the ladder.
  // The keyboard (whatever it is currently bound to, see keys.js) and the
  // touch overlay (see input.js) folded into one set of booleans, so
  // nothing downstream has to know which of the two a player is using.
  readInput() {
    const keyboard = readKeyboard();
    return {
      left: keyboard.left || touchInput.left,
      right: keyboard.right || touchInput.right,
      up: keyboard.up || touchInput.up,
      down: keyboard.down || touchInput.down,
      shoot: keyboard.shoot || touchInput.shoot,
    };
  }

  updatePlaying(dt) {
    this.elapsedMs += dt * 1000;
    this.levelTimer += dt;
    this.effects.update(this, this.elapsedMs);

    // Running out of time is exactly the same hit as a ball touching the
    // player (see onTimeUp/hitPlayer) -- checked every frame the clock
    // stays expired, same as an overlapping ball would keep re-triggering
    // onPlayerHitBall, so shield/invulnerability behave identically.
    if (this.currentLevelDef?.timeLimitSec && this.levelTimer >= this.currentLevelDef.timeLimitSec) {
      this.onTimeUp();
      if (this.state !== GAME_STATES.PLAYING) return; // hitPlayer() may have frozen/ended the run
    }

    // 15s left: switch the background music itself to the more urgent
    // loop (independent of the short one-shot ping below, at its own
    // later/shorter threshold).
    if (!this.hurryMusicPlayed && this.currentLevelDef?.timeLimitSec && this.remainingLevelTime > 0 && this.remainingLevelTime <= 15) {
      this.audio.playMusic('music_hurry');
      this.hurryMusicPlayed = true;
    }

    if (!this.hurryUpPlayed && this.currentLevelDef?.timeLimitSec && this.remainingLevelTime > 0 && this.remainingLevelTime <= 10) {
      this.audio.play('hurryup');
      this.hurryUpPlayed = true;
    }

    if (this.isPanicMode) this.updatePanicSpawner();

    const inputState = this.readInput();
    // Getting ON a ladder is a press, never a hold: holding up to climb
    // one must not grab the next one the moment the player walks past its
    // foot, and holding down on top of one must not re-mount it.
    inputState.upPressed = inputState.up && !this.wasUp;
    inputState.downPressed = inputState.down && !this.wasDown;
    this.wasUp = inputState.up;
    this.wasDown = inputState.down;
    this.player.update(dt, inputState);

    // One shot per press, for every weapon and power-up alike: the input
    // has to be released and pressed again before it fires again, so
    // holding the key/button down does nothing. What rapid_shot changes is
    // only how many shots may be in the air at once (weaponState
    // .maxActiveShots, see tryFire) -- never how the trigger itself reads.
    //
    // One trigger, not two: up used to fire as well as climb, which meant
    // the scene had to work out which of the two a press was meant for,
    // and a ladder underfoot made shooting unreliable. Up climbs now (see
    // keys.js's DEFAULT_BINDINGS).
    if (inputState.shoot && !this.wasShooting) this.tryFire();
    this.wasShooting = inputState.shoot;

    // Last 3s of time_freeze: blink the (harmless, see onPlayerHitBall)
    // frozen balls as a warning the freeze is about to end; reset alpha
    // once it actually does.
    const freezeExpiresAt = this.effects.active.get('time_freeze');
    const freezeWarning = this.ballsFrozen && freezeExpiresAt !== undefined && freezeExpiresAt - this.elapsedMs <= 3000;
    for (const ball of this.balls.getChildren()) {
      ball.body.moves = !this.ballsFrozen;
      ball.setAlpha(freezeWarning ? (Math.floor(this.elapsedMs / 90) % 2 === 0 ? 0.35 : 1) : 1);
      ball.setFrozen(this.ballsFrozen);
      // Physics has already stepped by the time scene update runs, so this
      // captures the speed the ball is travelling at going INTO the next
      // step -- i.e. its impact speed, which Arcade wipes before the
      // collision callback can read it (see Ball.rememberVerticalSpeed).
      ball.rememberVerticalSpeed();
      // Panic Mode ceiling-drop balls (see spawnPanicBall) spawn centered
      // on the ceiling border's own inner edge, depth-sorted behind it and
      // with world-bounds collision off, so they visibly slide out from
      // under/through the border instead of just appearing already fully
      // below it -- restored to normal once the whole ball has cleared it.
      if (ball.emergeY !== undefined && ball.body.y >= ball.emergeY) {
        ball.setDepth(3);
        ball.body.setCollideWorldBounds(true);
        ball.emergeY = undefined;
      }
      // Pinned to vx=0 and a controlled constant descent (see
      // spawnPanicBall) so it visibly falls straight down first; the
      // instant it reaches the shared release height, give it normal
      // drift and hand its vertical motion back to normal ball behavior.
      if (ball.dropReleaseY !== undefined && ball.body.y >= ball.dropReleaseY) {
        ball.activateDrift();
        ball.resumeNormalFall();
        ball.dropReleaseY = undefined;
      }
    }
    for (const pu of this.powerups.getChildren()) pu.update(dt);

    // Laser beams grow upward from the muzzle they were fired at until
    // something stops them -- a ball/obstacle overlap (handled by the
    // collision callbacks) or the ceiling, which updateBeam reports by
    // returning false. Iterated over a copy since destroy() mutates the
    // group's own child list mid-loop.
    for (const proj of [...this.projectiles.getChildren()]) {
      if (!proj.updateBeam(dt)) proj.destroy();
    }

    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.update(dt);
      if (popup.dead) this.scorePopups.splice(i, 1);
    }

    // Panic Mode is endless -- it has no "all balls cleared" win condition
    // (the ceiling spawner just keeps going, see updatePanicSpawner), only
    // the ordinary run-out-of-lives loss.
    if (this.state === GAME_STATES.PLAYING && !this.isPanicMode && this.balls.countActive(true) === 0) {
      this.levelClear();
    }
  }

  // Panic Mode's active wave: PANIC_LEVEL.panicSpawn.waves (levels/
  // panic.json) is a list of { popTarget, intervalSec, shapes } entries --
  // progress is driven by balls actually popped (panicPopCount, see
  // popBall/advancePanicProgress), not a timer, so a sharper player faces
  // harder waves sooner instead of everyone escalating in lockstep. The
  // last wave repeats forever once the run outlasts the whole table.
  get panicWave() {
    const waves = this.currentLevelDef?.panicSpawn?.waves;
    if (!waves || !waves.length) return null;
    return waves[Math.min(this.panicWaveIndex, waves.length - 1)];
  }

  // 0-100 completion of the CURRENT wave, for the HUD's progress bar (see
  // Hud.js) -- caps at 100 on the final wave instead of ever exceeding it.
  get panicProgressPct() {
    const wave = this.panicWave;
    if (!wave || !wave.popTarget) return 0;
    return Math.min(100, Math.floor(100 * this.panicPopCount / wave.popTarget));
  }

  // Ball spawn timing only -- still purely time-driven (panicSpawnAt vs
  // levelTimer) since spawn CADENCE is about keeping the pressure steady,
  // unlike wave difficulty which is skill-gated (see panicWave above).
  updatePanicSpawner() {
    const wave = this.panicWave;
    if (!wave || this.levelTimer < this.panicSpawnAt) return;
    this.spawnPanicBall(wave, this.currentLevelDef.panicSpawn);
    this.panicSpawnAt = this.levelTimer + wave.intervalSec;
  }

  // Picks one (shape, size) from the wave's weighted `shapes` list and
  // drops it in at a random x with its BOTTOM edge flush against the
  // ceiling border's inner face -- i.e. entirely hidden above/within the
  // border strip at spawn, none of it poking into the playfield yet (see
  // the emergeY check in updatePlaying) -- so it visibly slides out
  // through the border as it falls, rather than just appearing already
  // mostly exposed.
  //
  // Becoming "active" (normal drift + normal falling, see resumeNormalFall)
  // happens at a fixed HEIGHT shared by every size (releaseHeightPx below
  // the border, measured to the ball's own center) but after a size-scaled
  // TIME (releaseDelayBaseSec + (size-1)*releaseDelayStepSec) -- every
  // round size shares the same gravityAccel (see elements/round-ball-*
  // .json), so hitting two independent targets (same end height, different
  // elapsed time) means the descent speed has to be deliberately overridden
  // rather than left to each ball's own gravity: gravity is switched off
  // for the descent and vy is set to exactly travelDistance/delaySec,
  // restored to normal (resumeNormalFall) only once release fires.
  spawnPanicBall(wave, spawn) {
    const entries = wave.shapes;
    const totalWeight = entries.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    let choice = entries[entries.length - 1];
    for (const e of entries) {
      roll -= e.weight ?? 1;
      if (roll <= 0) { choice = e; break; }
    }

    const el = getBallElement(choice.shape, choice.size);
    const bt = BORDER_THICKNESS;
    const x = Phaser.Math.Between(bt + el.radius, VIRTUAL_W - bt - el.radius);
    const y = bt - el.radius;
    const bodyY = y - el.radius; // Arcade's circle-body top-left == center - radius

    const releaseHeightPx = spawn.releaseHeightPx ?? 48;
    const delaySec = (spawn.releaseDelayBaseSec ?? 1) + (el.size - 1) * (spawn.releaseDelayStepSec ?? 0.5);
    // Distance from THIS ball's own bodyY to the shared release height
    // (measured by ball CENTER, bt + releaseHeightPx, so it's identical
    // across sizes) -- working in bodyY terms throughout keeps this
    // consistent with the >= comparison in updatePlaying's release check.
    const travelPx = releaseHeightPx + el.radius;
    const vy = travelPx / delaySec;

    const ball = new Ball(this, choice.shape, choice.size, x, y, 0, vy);
    // Gravity would otherwise accelerate the descent, missing both the
    // fixed height and the fixed time -- overridden with a constant
    // velocity for the whole pre-release descent instead (see above).
    ball.body.setAllowGravity(false);
    // World bounds sit at exactly y = bt -- collision would otherwise
    // immediately shove a ball spawned above that line back down, undoing
    // the "still emerging through the ceiling" look before it even starts.
    ball.body.setCollideWorldBounds(false);
    ball.setDepth(0.4); // below the ceiling border's own depth (0.5) while emerging
    ball.emergeY = bt; // body.y (top edge) reaching this means the whole ball has cleared the border
    ball.dropReleaseY = bodyY + travelPx;
    this.balls.add(ball);
  }

  // Panic Mode's own "level" progress: popping enough balls (the active
  // wave's popTarget) advances to the next, harder wave -- see panicWave/
  // updatePanicSpawner. Skill-driven on purpose (pop faster, face harder
  // waves sooner) rather than a blind timer.
  advancePanicProgress() {
    this.panicPopCount += 1;
    const wave = this.panicWave;
    const waves = this.currentLevelDef.panicSpawn.waves;
    if (wave && this.panicPopCount >= wave.popTarget && this.panicWaveIndex + 1 < waves.length) {
      this.panicWaveIndex += 1;
      this.panicPopCount = 0;
    }
  }

  tryFire() {
    const base = WEAPON_TYPES[this.weaponType];
    if (base.volley) {
      this.fireVolley(base);
      return;
    }
    const activeCount = this.projectiles.countActive(true);
    if (activeCount >= this.weaponState.maxActiveShots) return;
    // The beam spans the player: its foot is planted at their FEET (not
    // at the ground line -- standing on a platform or holding a ladder,
    // those are different heights, and anchoring to the ground would
    // sprout the shot from the floor far below them), and its head starts
    // at the muzzle, the same height above the feet a shot has always
    // appeared at.
    const tipX = this.player.x;
    const tipY = this.player.y - PLAYER_CONFIG.spriteHeight / 2;
    const proj = new Projectile(
      this, tipX, tipY, this.player.feetY, base.width, base.shotSpeed, this.weaponState.pierce, this.weaponType,
      base.ceilingStickSec ?? 0, base.ceilingReleaseWarnSec ?? 0,
    );
    this.projectiles.add(proj);
    // "Special/rapid" shot sound while a weapon power-up is boosting the
    // harpoon (rapid_shot: more shots in the air at once); the plain
    // harpoon sound otherwise.
    this.audio.play(this.effects.active.has('rapid_shot') ? 'weaponshootm' : 'weaponshoot');
    this.player.playShotAnim();
  }

  // The machine gun: one press puts up a fanned volley of bullets rather
  // than a single beam. What the weapon limits is how many VOLLEYS are in
  // the air, not how many bullets -- counting bullets would mean the first
  // press alone used the whole allowance up.
  fireVolley(base) {
    const live = new Set();
    for (const p of this.projectiles.getChildren()) {
      if (p.active && p.volleyId !== undefined) live.add(p.volleyId);
    }
    if (live.size >= this.weaponState.maxActiveShots) return;

    const { count, spreadDeg, spacingPx } = base.volley;
    const id = ++this.volleyCounter;
    const muzzleY = this.player.y - PLAYER_CONFIG.spriteHeight / 2;
    for (let i = 0; i < count; i++) {
      // Spread evenly about straight up: with 4 bullets that is -1.5, -0.5,
      // +0.5, +1.5 steps, so the fan stays symmetric and no bullet goes
      // straight up the middle.
      const offset = i - (count - 1) / 2;
      const angle = Phaser.Math.DegToRad(offset * spreadDeg);
      const bullet = new Bullet(
        this, this.player.x + offset * spacingPx, muzzleY,
        angle, base.shotSpeed, this.weaponState.pierce, id,
      );
      this.projectiles.add(bullet);
    }
    this.audio.play(this.effects.active.has('rapid_shot') ? 'weaponshootm' : 'weaponshoot');
    this.player.playShotAnim();
  }

  // The splash a bullet leaves where it stops on something it cannot break
  // -- the ceiling, a side wall, or an indestructible obstacle. The beam
  // weapons have no equivalent: a beam ENDS at the ceiling by design, while
  // a bullet visibly strikes it.
  playBulletImpact(x, y) {
    const sprite = this.add.sprite(x, y, BULLET_HIT_TEXTURE_KEY);
    sprite.setDepth(6);
    sprite.play(BULLET_HIT_ANIM_KEY);
    sprite.once('animationcomplete', () => sprite.destroy());
  }

  // The puff a landing kicks up, at the feet that landed (see
  // Player.followGround), and the thud that goes with it -- one call, so
  // the sound can't be triggered anywhere the dust isn't. Anchored by its
  // BOTTOM edge so the cloud sits on the surface rather than straddling
  // it, and drawn just under the player (depth 4) so they stand in it
  // rather than behind it.
  playLandingDust(x, feetY) {
    this.audio.play('playerland');
    const sprite = this.add.sprite(x, feetY, PLAYER_DUST_TEXTURE_KEY).setOrigin(0.5, 1);
    sprite.setDepth(3.8);
    sprite.play(PLAYER_DUST_ANIM_KEY);
    sprite.once('animationcomplete', () => sprite.destroy());
  }

  popBall(ball) {
    const awarded = Math.round(ball.points * this.scoreMultiplier);
    this.score += awarded;
    if (this.isPanicMode) this.advancePanicProgress();
    this.audio.play('balldestroy');
    this.playBallPopEffect(ball.x, ball.y, ball.shape, ball.size);
    this.scorePopups.push(new ScorePopup(this, ball.x, ball.y, awarded, ball.color, ball.radius));

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

  // A 2-frame pop animation, one image per (shape, size) ball -- see
  // assets.js's ballPopTexturePath/ballPopAnimKey -- played once exactly
  // where the ball was, in place of the generic tinted-particle burst
  // spawnBurst() still uses for obstacles/power-ups.
  playBallPopEffect(x, y, shape, size) {
    const sprite = this.add.sprite(x, y, ballPopTextureKey(shape, size));
    sprite.setDepth(6);
    sprite.play(ballPopAnimKey(shape, size));
    sprite.once('animationcomplete', () => sprite.destroy());
  }

  spawnBurst(x, y, colorHex, count, small = false) {
    const emitter = small ? this.burstSmall : this.burstNormal;
    emitter.setParticleTint(hexColor(colorHex));
    emitter.explode(count, x, y);
  }

  // -- Collision handlers -------------------------------------------------

  // Only balls reach here now: the laser beam doesn't move (it grows in
  // place, see Projectile.js), so it never collides with the world bounds
  // -- reaching the ceiling is length-capped in updateBeam instead.
  onWorldBounds(body, up, down, left, right) {
    const go = body.gameObject;
    if (go instanceof Ball) resolveBallBounce(go, { up, down, left, right });
  }

  // Arcade's body.touching exposes the same up/down/left/right contact
  // flags the world-bounds event passes as arguments, so both bounce
  // sites resolve through the one helper above.
  onBallHitObstacle(ballGO) {
    resolveBallBounce(ballGO, ballGO.body.touching);
  }

  onProjectileHitObstacle(projGO, obstacleGO) {
    if (!projGO.active) return;
    // An already-hanging beam keeps hold of what it caught -- it mustn't
    // spend itself, or chip away at anything, on a second contact.
    if (projGO.isAnchored) return;
    // Nor on the surface the player is standing on: a beam climbs, so only
    // what is above its foot is in its way (see Projectile.blockedBy).
    if (!projGO.blockedBy(obstacleGO.body)) return;
    // A grapple catches under an indestructible block exactly as it does
    // under the ceiling: a block it can never shoot through is something
    // to hang from, not something to waste the shot on. Destructible
    // blocks still take the hit and stop the shot, so the grapple can't be
    // used to dodge breaking them open.
    if (!obstacleGO.def.destructible && projGO.anchorAt(obstacleGO.body.bottom)) return;
    // A bullet can't catch hold, so an unbreakable block simply stops it --
    // and that stop gets the same splash the ceiling and side walls give.
    if (!obstacleGO.def.destructible && projGO.volleyId !== undefined) {
      const tip = projGO.tip;
      this.playBulletImpact(tip.x, Math.max(obstacleGO.body.bottom, tip.y));
    }
    projGO.destroy();
    const forcedPowerup = obstacleGO.forcedPowerup;
    // Read while the block still exists: takeHit() destroys it, which takes
    // its body with it, and a block is positioned by its top-left corner.
    const centerX = obstacleGO.x + obstacleGO.width / 2;
    const centerY = obstacleGO.y + obstacleGO.height / 2;
    const destroyed = obstacleGO.takeHit();
    if (destroyed) {
      this.audio.play('walldestroy');
      this.spawnBurst(centerX, centerY, obstacleGO.def.color, 10);
      // The destroyed block may have been shielding a neighbor's face
      // from ever registering a collision (see Obstacle.js's
      // refreshObstacleSeams) -- recompute now that it's actually gone,
      // or a ball/the player could pass straight through where it used
      // to be.
      refreshObstacleSeams(this.obstacles);
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
    this.playPlayerHitEffect(playerGO, ballGO);
    this.hitPlayer();
  }

  // The impact burst, played where the ball actually touched -- the
  // counterpart to playBallPopEffect below, which marks the other kind of
  // collision. The contact point is taken as the point on the ball's rim
  // facing the player rather than either body's centre: at the frame the
  // overlap fires, that lands on the surface the two met at, so a big ball
  // bursts at its edge instead of from somewhere inside itself.
  playPlayerHitEffect(playerGO, ballGO) {
    const dx = playerGO.x - ballGO.x;
    const dy = playerGO.y - ballGO.y;
    const dist = Math.hypot(dx, dy) || 1;
    const sprite = this.add.sprite(
      ballGO.x + (dx / dist) * ballGO.radius,
      ballGO.y + (dy / dist) * ballGO.radius,
      PLAYER_HIT_TEXTURE_KEY,
    );
    sprite.setDepth(7); // above the player (4) and the ball-pop burst (6)
    sprite.play(PLAYER_HIT_ANIM_KEY);
    sprite.once('animationcomplete', () => sprite.destroy());
  }

  // Running out of time counts as exactly the same hit as a ball touching
  // the player -- shield absorbs it the same way, otherwise it costs a
  // life and freezes the same way (see updatePlaying's timeLimitSec
  // check). Kept as its own entry point (rather than folding into
  // onPlayerHitBall) since there's no ball/overlap involved.
  onTimeUp() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.hitPlayer();
  }

  hitPlayer() {
    const hadShield = this.player.shielded;
    const lostLife = this.player.takeHit();
    if (!lostLife && hadShield) {
      this.effects.active.delete('shield');
      this.audio.play('itemshieldloose');
    }

    if (lostLife) {
      this.audio.stopMusic();
      this.audio.play('playerlifeloose');
      // A playtest from the editor has unlimited lives -- it's there to
      // test the level layout, not to be beaten, so a hit just restarts
      // it (below) rather than ever costing a real life or ending in
      // game over.
      if (!this.isCustomLevel) this.lives -= 1;
      this.player.playDeadAnim();
      this.startHitFreeze(!this.isCustomLevel && this.lives <= 0);
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

  // Landed on top of an obstacle instead of the ground -- stop it there
  // (Bonus.update's own floorY snap only ever fires if it never hits
  // anything on the way down). Only the vertical case matters: a bonus
  // has no horizontal velocity, so it can't arrive at a side face.
  onPowerupHitObstacle(bonusGO, obstacleGO) {
    if (bonusGO.body.touching.down) bonusGO.body.setVelocityY(0);
  }

  onPlayerCollectPowerup(playerGO, bonusGO) {
    if (!bonusGO.active) return;
    this.collectPowerup(bonusGO);
  }

  // Shooting a dropped power-up collects it too, same as walking into it.
  onProjectileHitPowerup(projGO, bonusGO) {
    if (!projGO.active || !bonusGO.active) return;
    this.collectPowerup(bonusGO);
    if (projGO.registerHit()) projGO.destroy();
  }

  collectPowerup(bonusGO) {
    this.effects.apply(bonusGO.type, this, this.elapsedMs);
    this.audio.play(bonusGO.def.pickupSound);
    this.spawnBurst(bonusGO.x, bonusGO.y, bonusGO.def.color, 8, true);
    bonusGO.destroy();
  }
}

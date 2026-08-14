import { OBSTACLE_TYPES, OBSTACLE_TYPE_KEYS, LADDER_TYPES, LADDER_TYPE_KEYS, POWERUP_TYPE_KEYS, BALL_ELEMENTS } from './elements.js';
import { AUDIO_CONFIG } from './audio.js';
import { WEAPON_TYPES, PLAYER_CONFIG, SHOT_LOCK_SEC } from './config.js';
import { LEVELS } from './LevelManager.js';
import { daylightBackgroundNames } from './regions.js';
import { VIRTUAL_W, VIRTUAL_H, COLORS } from './constants.js';
import { hexColor } from './colors.js';
import {
  ballTextureKey, ballTexturePath, HEX_SPIN_FRAMES, ballSpinAnimKey,
  ballPopTextureKey, ballPopTexturePath, BALL_POP_FRAMES, POP_FRAME_SCALE, ballPopAnimKey,
  PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_PATH, PLAYER_FRAME, PLAYER_ANIM_FRAMES,
  PLAYER_SHIELD_TEXTURE_KEY, PLAYER_SHIELD_TEXTURE_PATH, PLAYER_SHIELD_FRAMES, PLAYER_SHIELD_ANIM_KEY,
  PLAYER_HIT_TEXTURE_KEY, PLAYER_HIT_TEXTURE_PATH, PLAYER_HIT_FRAMES, PLAYER_HIT_SIZE, PLAYER_HIT_ANIM_KEY,
  PLAYER_DUST_TEXTURE_KEY, PLAYER_DUST_TEXTURE_PATH, PLAYER_DUST_FRAMES,
  PLAYER_DUST_SIZE, PLAYER_DUST_HEIGHT, PLAYER_DUST_ANIM_KEY,
  PLAYER_GHOST_TEXTURE_KEY, PLAYER_GHOST_TEXTURE_PATH, PLAYER_GHOST_FRAMES,
  PLAYER_GHOST_FRAME, PLAYER_GHOST_ANIM_KEY,
  BULLET_TEXTURE_KEY, BULLET_TEXTURE_PATH,
  BULLET_HIT_TEXTURE_KEY, BULLET_HIT_TEXTURE_PATH, BULLET_HIT_FRAMES, BULLET_HIT_SIZE, BULLET_HIT_ANIM_KEY,
  obstacleTextureKey, obstacleTexturePath,
  ladderTextureKey, ladderTexturePath,
  WEAPON_SHOTS_KEY, WEAPON_SHOTS_PATH, WEAPON_SHOTS_FRAME,
  PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH,
  powerupTextureKey, powerupTexturePath,
  backgroundTextureKey, backgroundTexturePath, DEFAULT_BACKGROUND,
  WORLDMAP_TEXTURE_KEY, WORLDMAP_TEXTURE_PATH, PLANE_TEXTURE_KEY, PLANE_TEXTURE_PATH,
  audioPath,
  HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_PATH, HUD_DIGITS_LARGE_FRAME,
  HUD_DIGITS_SMALL_KEY, HUD_DIGITS_SMALL_FRAME,
  LOADING_TEXTURE_KEY, PERCENT_TEXTURE_KEY,
  HUD_1P_KEY, HUD_1P_PATH, HUD_TIME_LABEL_KEY, HUD_TIME_LABEL_PATH,
  HUD_LEVEL_LABEL_KEY, HUD_LEVEL_LABEL_PATH, HUD_HI_LABEL_KEY, HUD_HI_LABEL_PATH,
  HUD_LIFE_KEY, HUD_LIFE_PATH, HUD_WEAPON_FRAME_KEY, HUD_WEAPON_FRAME_PATH,
  hudWeaponIconKey, hudWeaponIconPath,
  INTRO_FONT_KEY, INTRO_FONT_PATH, INTRO_FONT_FRAME,
} from './assets.js';

// Angular speed a hex ball's fixed diagonal speed/radius implies (this is
// the same relationship Ball.js used to apply as a smooth per-frame
// rotation transform -- bigger/slower balls turn slower -- before that
// became visibly blurry/aliased on this game's tiny pixel-art hexagons at
// arbitrary rotation angles), converted from radians/sec to frames/sec
// for a HEX_SPIN_FRAMES-frame-per-rotation cycle, then sped up on top of
// that physically-derived rate (SPIN_SPEED_MULTIPLIER: 1.5x, then a
// further 30% on top of that -- 1.5 * 1.3 = 1.95).
const SPIN_SPEED_MULTIPLIER = 1.95;

// Shortest time the loading screen stays up before Game takes over -- see
// the hold at the end of create().
const LOADING_MIN_MS = 900;

function hexSpinFrameRate(speed, radius) {
  const hSpeed = speed * Math.SQRT1_2;
  const angularSpeed = hSpeed / radius; // radians/sec
  return (angularSpeed / (Math.PI * 2)) * HEX_SPIN_FRAMES * SPIN_SPEED_MULTIPLIER;
}

// Runs after ElementsScene, which has already populated BALL_ELEMENTS/
// OBSTACLE_TYPES/POWERUP_TYPE_KEYS (see elements.js) -- this scene's only
// job is to load every graphic file those registries call for (see
// assets.js for each one's naming/path convention) and, for the player,
// wire the loaded frames into Phaser animations. Nothing is drawn
// procedurally, so swapping any graphic is purely a file replacement, no
// code changes.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.showLoadingScreen();

    for (const el of BALL_ELEMENTS) {
      // Hex balls spin (see Ball.js/assets.js's HEX_SPIN_FRAMES) so their
      // own texture is a spritesheet; round balls are one static image.
      if (el.shape === 'hex') {
        this.load.spritesheet(ballTextureKey(el.shape, el.size), ballTexturePath(el.shape, el.size), { frameWidth: el.radius * 2, frameHeight: el.radius * 2 });
      } else {
        this.load.image(ballTextureKey(el.shape, el.size), ballTexturePath(el.shape, el.size));
      }

      const popFrameSize = Math.round(el.radius * 2 * POP_FRAME_SCALE);
      this.load.spritesheet(ballPopTextureKey(el.shape, el.size), ballPopTexturePath(el.shape, el.size), { frameWidth: popFrameSize, frameHeight: popFrameSize });
    }

    this.load.spritesheet(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_PATH, PLAYER_FRAME);
    this.load.spritesheet(PLAYER_SHIELD_TEXTURE_KEY, PLAYER_SHIELD_TEXTURE_PATH, { frameWidth: PLAYER_CONFIG.shieldSize, frameHeight: PLAYER_CONFIG.shieldSize });
    this.load.spritesheet(PLAYER_HIT_TEXTURE_KEY, PLAYER_HIT_TEXTURE_PATH, { frameWidth: PLAYER_HIT_SIZE, frameHeight: PLAYER_HIT_SIZE });
    this.load.spritesheet(PLAYER_DUST_TEXTURE_KEY, PLAYER_DUST_TEXTURE_PATH, { frameWidth: PLAYER_DUST_SIZE, frameHeight: PLAYER_DUST_HEIGHT });
    this.load.spritesheet(PLAYER_GHOST_TEXTURE_KEY, PLAYER_GHOST_TEXTURE_PATH, PLAYER_GHOST_FRAME);
    this.load.image(BULLET_TEXTURE_KEY, BULLET_TEXTURE_PATH);
    this.load.spritesheet(BULLET_HIT_TEXTURE_KEY, BULLET_HIT_TEXTURE_PATH, { frameWidth: BULLET_HIT_SIZE, frameHeight: BULLET_HIT_SIZE });
    this.load.image(WORLDMAP_TEXTURE_KEY, WORLDMAP_TEXTURE_PATH);
    this.load.image(PLANE_TEXTURE_KEY, PLANE_TEXTURE_PATH);

    const tileNames = new Set(OBSTACLE_TYPE_KEYS.map((type) => OBSTACLE_TYPES[type].tileTexture));
    for (const name of tileNames) {
      this.load.image(obstacleTextureKey(name), obstacleTexturePath(name));
    }

    const ladderNames = new Set(LADDER_TYPE_KEYS.map((type) => LADDER_TYPES[type].texture));
    for (const name of ladderNames) {
      this.load.image(ladderTextureKey(name), ladderTexturePath(name));
    }

    this.load.spritesheet(WEAPON_SHOTS_KEY, WEAPON_SHOTS_PATH, WEAPON_SHOTS_FRAME);
    this.load.image(PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH);

    for (const type of POWERUP_TYPE_KEYS) {
      this.load.image(powerupTextureKey(type), powerupTexturePath(type));
    }

    // DEFAULT_BACKGROUND is always loaded (the level editor's own starting
    // background, before any level-specific one is chosen), plus every
    // distinct `background` a loaded level actually names, plus every
    // region's frame at each of its five times of day -- a campaign level
    // picks one of those by where it falls in its region (see regions.js's
    // daylightPhaseForLevel), so all five have to be loaded before the
    // region's first level starts.
    const backgroundNames = new Set([
      DEFAULT_BACKGROUND,
      ...LEVELS.map((lvl) => lvl.background).filter(Boolean),
      ...daylightBackgroundNames(),
    ]);
    for (const name of backgroundNames) {
      this.load.image(backgroundTextureKey(name), backgroundTexturePath(name));
    }

    // AUDIO_CONFIG is already fully populated by ElementsScene (audio.json
    // is self-contained, no manifest indirection needed -- see
    // ElementsScene.js) -- each sound is loaded under its own config key
    // name, so AudioManager can play it back by that same name.
    //
    // Music is deliberately NOT loaded here. The 13 tracks are 4.7MB
    // against 141KB for every sound effect in the game, only one of them
    // ever plays at a time, and eight of them belong to continents a run
    // may never reach -- so waiting for all of them before the menu can
    // open is most of the first load spent on audio that may never be
    // heard. AudioManager fetches a track the first time it is asked for
    // and GameScene warms the next continent's up during the world-map
    // interlude, which is several seconds of cover (see audio.js's
    // ensureMusicLoaded / GameScene.loadLevel).
    for (const [name, cfg] of Object.entries(AUDIO_CONFIG)) {
      if (cfg.category === 'music') continue;
      this.load.audio(name, audioPath(cfg.file));
    }

    this.load.spritesheet(HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_PATH, HUD_DIGITS_LARGE_FRAME);
    // HUD_DIGITS_SMALL is deliberately NOT loaded here -- ElementsScene
    // already loaded it, because this scene's own loading screen prints
    // its progress percentage with it (see showLoadingScreen below).
    this.load.image(HUD_1P_KEY, HUD_1P_PATH);
    this.load.image(HUD_TIME_LABEL_KEY, HUD_TIME_LABEL_PATH);
    this.load.image(HUD_LEVEL_LABEL_KEY, HUD_LEVEL_LABEL_PATH);
    this.load.image(HUD_HI_LABEL_KEY, HUD_HI_LABEL_PATH);
    this.load.image(HUD_LIFE_KEY, HUD_LIFE_PATH);
    this.load.image(HUD_WEAPON_FRAME_KEY, HUD_WEAPON_FRAME_PATH);
    for (const type of Object.keys(WEAPON_TYPES)) {
      this.load.image(hudWeaponIconKey(type), hudWeaponIconPath(type));
    }

    this.load.spritesheet(INTRO_FONT_KEY, INTRO_FONT_PATH, INTRO_FONT_FRAME);
  }

  // The first-load screen: the splash image (see assets.js's
  // LOADING_TEXTURE_KEY) with a progress bar and a live percentage under
  // it, all drawn from the three graphics ElementsScene loaded ahead of
  // this scene. Built in preload() -- before this scene's own load starts
  // -- so it is already on screen for the load it reports on, and torn
  // down by Phaser itself when this scene stops and Game takes over.
  //
  // The percentage is composed from the HUD's own small digit strip plus a
  // "%" glyph, keeping to the same "no drawn text, only loaded images"
  // rule the HUD and level-intro follow.
  showLoadingScreen() {
    this.loadingShownAt = this.time.now; // see the hold in create()
    this.add.image(VIRTUAL_W / 2, VIRTUAL_H / 2, LOADING_TEXTURE_KEY).setDepth(0);

    const BAR_W = 400;
    const BAR_H = 14;
    const barX = (VIRTUAL_W - BAR_W) / 2;
    const barY = 452;

    this.add.rectangle(barX, barY, BAR_W, BAR_H, 0x000000, 0.65).setOrigin(0, 0).setDepth(1)
      .setStrokeStyle(2, hexColor(COLORS.accent));
    const fill = this.add.rectangle(barX + 2, barY + 2, 0, BAR_H - 4, hexColor(COLORS.accent))
      .setOrigin(0, 0).setDepth(2);

    // Pooled: at most 3 digits ("100") plus the % sign, shown/hidden as
    // the number's width changes rather than recreated each update.
    const digitW = HUD_DIGITS_SMALL_FRAME.frameWidth;
    const pctY = barY + BAR_H + 8;
    const digits = [0, 1, 2].map((i) => this.add.image(0, pctY, HUD_DIGITS_SMALL_KEY, 0)
      .setOrigin(0, 0).setDepth(2).setVisible(false));
    const percentSign = this.add.image(0, pctY, PERCENT_TEXTURE_KEY).setOrigin(0, 0).setDepth(2);

    const render = (value) => {
      const str = String(value);
      const totalW = str.length * digitW + digitW;
      let x = (VIRTUAL_W - totalW) / 2;
      for (let i = 0; i < digits.length; i++) {
        const has = i < str.length;
        digits[i].setVisible(has);
        if (!has) continue;
        digits[i].setFrame(Number(str[i]));
        digits[i].x = x;
        x += digitW;
      }
      percentSign.x = x;
      fill.width = (BAR_W - 4) * (value / 100);
    };

    render(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value) => render(Math.round(value * 100)));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => render(100));
  }

  create() {
    this.buildPlayerAnimations();
    this.buildBallAnimations();
    this.anims.create({
      key: PLAYER_SHIELD_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(PLAYER_SHIELD_TEXTURE_KEY, { start: 0, end: PLAYER_SHIELD_FRAMES - 1 }),
      frameRate: 8,
      repeat: -1,
    });
    // Same rate as the ball-pop burst (see buildBallAnimations), so a hit
    // on the player and a hit on a ball read as the same kind of event.
    this.anims.create({
      key: BULLET_HIT_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(BULLET_HIT_TEXTURE_KEY, { start: 0, end: BULLET_HIT_FRAMES - 1 }),
      frameRate: 14,
      repeat: 0,
    });
    this.anims.create({
      key: PLAYER_HIT_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(PLAYER_HIT_TEXTURE_KEY, { start: 0, end: PLAYER_HIT_FRAMES - 1 }),
      frameRate: 12,
      repeat: 0,
    });
    // Slower than the impact bursts above on purpose: dust settles, it
    // doesn't snap.
    this.anims.create({
      key: PLAYER_DUST_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(PLAYER_DUST_TEXTURE_KEY, { start: 0, end: PLAYER_DUST_FRAMES - 1 }),
      frameRate: 9,
      repeat: 0,
    });
    // The only looping one of these: the ghost beats its wings for the
    // whole of its flight rather than playing a burst and stopping, so it
    // repeats and the tween that carries it up is what ends it (see
    // GameScene.spawnDeathGhost). Slow enough to read as wingbeats -- two
    // frames at a burst rate would just flicker -- and DEATH_GHOST_SEC is
    // long enough to fit several of them.
    this.anims.create({
      key: PLAYER_GHOST_ANIM_KEY,
      frames: this.anims.generateFrameNumbers(PLAYER_GHOST_TEXTURE_KEY, { start: 0, end: PLAYER_GHOST_FRAMES - 1 }),
      frameRate: 7,
      repeat: -1,
    });

    // Hold the finished loading screen briefly before handing over. On a
    // fast (or cached) load the whole thing can complete in a few frames,
    // and blinking a splash + "100%" past the player for two frames reads
    // as a glitch rather than as a loading screen. Only ever ADDS time on
    // an already-instant load -- a slow one has long since passed this.
    const remaining = Math.max(0, LOADING_MIN_MS - (this.time.now - this.loadingShownAt));
    if (remaining === 0) this.scene.start('Game');
    else this.time.delayedCall(remaining, () => this.scene.start('Game'));
  }

  // One pop animation per (shape, size) ball (see assets.js's
  // ballPopAnimKey), plus one looping spin animation per hex size --
  // round balls don't spin, so they only get a pop animation.
  buildBallAnimations() {
    for (const el of BALL_ELEMENTS) {
      this.anims.create({
        key: ballPopAnimKey(el.shape, el.size),
        frames: this.anims.generateFrameNumbers(ballPopTextureKey(el.shape, el.size), { start: 0, end: BALL_POP_FRAMES - 1 }),
        frameRate: 12,
        repeat: 0,
      });

      if (el.shape === 'hex') {
        this.anims.create({
          key: ballSpinAnimKey(el.shape, el.size),
          frames: this.anims.generateFrameNumbers(ballTextureKey(el.shape, el.size), { start: 0, end: HEX_SPIN_FRAMES - 1 }),
          frameRate: hexSpinFrameRate(el.speed, el.radius),
          repeat: -1,
        });
      }
    }
  }

  // One Phaser animation per player state, built from frame indices within
  // the one player spritesheet (see assets.js's PLAYER_ANIM_FRAMES) --
  // Player.js just calls this.play('player-<state>'). idle/move loop;
  // shot/victory/dead play once and Player.js switches back to idle/move
  // itself when they end (see Player.js's 'animationcomplete' handling).
  buildPlayerAnimations() {
    const LOOPING = new Set(['idle', 'move', 'climb']);
    // levelclear's rate is what makes its 6 frames (three idle/victory
    // alternations, see assets.js) last exactly the LEVEL_CLEAR_MIN_SEC that
    // GameScene holds the celebration for -- change one and change both.
    // The step and ladder-exit states are brief on purpose: they cover a
    // single 16px move, and anything slower reads as the player pausing to
    // think about it rather than taking the step.
    //
    // shot's rate is the one that has to agree with something outside this
    // file: its single frame has to be on screen for exactly as long as
    // the player is held still by having fired (config.js's
    // SHOT_LOCK_SEC), so the pose and the pause end together.
    const FRAME_RATE = {
      idle: 1, move: 8, shot: 1 / SHOT_LOCK_SEC, victory: 1, dead: 1, levelclear: 3,
      climb: 6, ladderoff: 8, stepup: 12, stepdown: 12,
    };
    for (const [state, frameIndices] of Object.entries(PLAYER_ANIM_FRAMES)) {
      this.anims.create({
        key: `player-${state}`,
        frames: frameIndices.map((frame) => ({ key: PLAYER_TEXTURE_KEY, frame })),
        frameRate: FRAME_RATE[state] ?? 8,
        repeat: LOOPING.has(state) ? -1 : 0,
      });
    }
  }
}

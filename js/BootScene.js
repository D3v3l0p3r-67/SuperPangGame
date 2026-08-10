import { OBSTACLE_TYPES, OBSTACLE_TYPE_KEYS, POWERUP_TYPE_KEYS, BALL_ELEMENTS } from './elements.js';
import { AUDIO_CONFIG } from './audio.js';
import { WEAPON_TYPES } from './config.js';
import { LEVELS } from './LevelManager.js';
import {
  ballTextureKey, ballTexturePath,
  PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_PATH, PLAYER_FRAME, PLAYER_ANIM_FRAMES,
  obstacleTextureKey, obstacleTexturePath,
  PROJECTILE_TEXTURE_KEY, PROJECTILE_TEXTURE_PATH,
  PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH,
  powerupTextureKey, powerupTexturePath,
  backgroundTextureKey, backgroundTexturePath, DEFAULT_BACKGROUND,
  audioPath,
  HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_PATH, HUD_DIGITS_LARGE_FRAME,
  HUD_DIGITS_SMALL_KEY, HUD_DIGITS_SMALL_PATH, HUD_DIGITS_SMALL_FRAME,
  HUD_1P_KEY, HUD_1P_PATH, HUD_TIME_LABEL_KEY, HUD_TIME_LABEL_PATH,
  HUD_WORLD_LABEL_KEY, HUD_WORLD_LABEL_PATH, HUD_HI_LABEL_KEY, HUD_HI_LABEL_PATH,
  HUD_LIFE_KEY, HUD_LIFE_PATH, HUD_WEAPON_FRAME_KEY, HUD_WEAPON_FRAME_PATH,
  hudWeaponIconKey, hudWeaponIconPath,
  INTRO_FONT_KEY, INTRO_FONT_PATH, INTRO_FONT_FRAME,
} from './assets.js';

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
    for (const el of BALL_ELEMENTS) {
      this.load.image(ballTextureKey(el.shape, el.size), ballTexturePath(el.shape, el.size));
    }

    this.load.spritesheet(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_PATH, PLAYER_FRAME);

    const tileNames = new Set(OBSTACLE_TYPE_KEYS.map((type) => OBSTACLE_TYPES[type].tileTexture));
    for (const name of tileNames) {
      this.load.image(obstacleTextureKey(name), obstacleTexturePath(name));
    }

    this.load.image(PROJECTILE_TEXTURE_KEY, PROJECTILE_TEXTURE_PATH);
    this.load.image(PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH);

    for (const type of POWERUP_TYPE_KEYS) {
      this.load.image(powerupTextureKey(type), powerupTexturePath(type));
    }

    // DEFAULT_BACKGROUND is always loaded (the level editor's own starting
    // background, before any level-specific one is chosen), plus every
    // distinct `background` a loaded level actually names.
    const backgroundNames = new Set([DEFAULT_BACKGROUND, ...LEVELS.map((lvl) => lvl.background).filter(Boolean)]);
    for (const name of backgroundNames) {
      this.load.image(backgroundTextureKey(name), backgroundTexturePath(name));
    }

    // AUDIO_CONFIG is already fully populated by ElementsScene (audio.json
    // is self-contained, no manifest indirection needed -- see
    // ElementsScene.js) -- each sound is loaded under its own config key
    // name, so AudioManager can play it back by that same name.
    for (const [name, cfg] of Object.entries(AUDIO_CONFIG)) {
      this.load.audio(name, audioPath(cfg.file));
    }

    this.load.spritesheet(HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_PATH, HUD_DIGITS_LARGE_FRAME);
    this.load.spritesheet(HUD_DIGITS_SMALL_KEY, HUD_DIGITS_SMALL_PATH, HUD_DIGITS_SMALL_FRAME);
    this.load.image(HUD_1P_KEY, HUD_1P_PATH);
    this.load.image(HUD_TIME_LABEL_KEY, HUD_TIME_LABEL_PATH);
    this.load.image(HUD_WORLD_LABEL_KEY, HUD_WORLD_LABEL_PATH);
    this.load.image(HUD_HI_LABEL_KEY, HUD_HI_LABEL_PATH);
    this.load.image(HUD_LIFE_KEY, HUD_LIFE_PATH);
    this.load.image(HUD_WEAPON_FRAME_KEY, HUD_WEAPON_FRAME_PATH);
    for (const type of Object.keys(WEAPON_TYPES)) {
      this.load.image(hudWeaponIconKey(type), hudWeaponIconPath(type));
    }

    this.load.spritesheet(INTRO_FONT_KEY, INTRO_FONT_PATH, INTRO_FONT_FRAME);
  }

  create() {
    this.buildPlayerAnimations();
    this.scene.start('Game');
  }

  // One Phaser animation per player state, built from frame indices within
  // the one player spritesheet (see assets.js's PLAYER_ANIM_FRAMES) --
  // Player.js just calls this.play('player-<state>'). idle/move loop;
  // shot/victory/dead play once and Player.js switches back to idle/move
  // itself when they end (see Player.js's 'animationcomplete' handling).
  buildPlayerAnimations() {
    const LOOPING = new Set(['idle', 'move']);
    const FRAME_RATE = { idle: 1, move: 8, shot: 14, victory: 1, dead: 1 };
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

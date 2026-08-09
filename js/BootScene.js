import { BALL_SHAPES, BALL_SIZES, OBSTACLE_TYPES, OBSTACLE_TYPE_KEYS, POWERUP_TYPE_KEYS } from './config.js';
import {
  ballTextureKey, ballTexturePath,
  playerTextureKey, playerTexturePath, PLAYER_ANIM_FRAME_COUNTS,
  obstacleTextureKey, obstacleTexturePath,
  PROJECTILE_TEXTURE_KEY, PROJECTILE_TEXTURE_PATH,
  PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH,
  powerupTextureKey, powerupTexturePath,
  levelFileKey, levelFilePath, MAX_LEVEL_FILES,
} from './assets.js';
import { LEVELS } from './LevelManager.js';

// Every graphic in the game is a real file under assets/ (see assets.js
// for the naming/path convention each one follows) -- BootScene's only
// job is to load them all here and, for the player, wire the loaded
// frames into Phaser animations. Nothing is drawn procedurally anymore,
// so swapping any graphic is purely a file replacement, no code changes.
// It also loads every levels/*.json file (see assets.js/LevelManager.js)
// and populates LEVELS with whichever ones exist before GameScene starts.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const [shape, shapeDef] of Object.entries(BALL_SHAPES)) {
      for (const { size } of BALL_SIZES) {
        if (size > shapeDef.maxSize) continue;
        this.load.image(ballTextureKey(shape, size), ballTexturePath(shape, size));
      }
    }

    for (const [state, count] of Object.entries(PLAYER_ANIM_FRAME_COUNTS)) {
      for (let frame = 1; frame <= count; frame++) {
        this.load.image(playerTextureKey(state, frame), playerTexturePath(state, frame));
      }
    }

    const tileNames = new Set(OBSTACLE_TYPE_KEYS.map((type) => OBSTACLE_TYPES[type].tileTexture));
    for (const name of tileNames) {
      this.load.image(obstacleTextureKey(name), obstacleTexturePath(name));
    }

    this.load.image(PROJECTILE_TEXTURE_KEY, PROJECTILE_TEXTURE_PATH);
    this.load.image(PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_PATH);

    for (const type of POWERUP_TYPE_KEYS) {
      this.load.image(powerupTextureKey(type), powerupTexturePath(type));
    }

    // Static hosting can't list a folder's contents, so probe a generous
    // range of filenames and keep whichever actually exist (see
    // populateLevels) -- a 404 for a not-yet-used slot is expected and
    // harmless, the loader just skips it.
    for (let n = 1; n <= MAX_LEVEL_FILES; n++) {
      this.load.json(levelFileKey(n), levelFilePath(n));
    }
  }

  create() {
    this.buildPlayerAnimations();
    this.populateLevels();
    this.scene.start('Game');
  }

  // One Phaser animation per player state, built from the loaded frame
  // images (see assets.js's PLAYER_ANIM_FRAME_COUNTS) -- Player.js just
  // calls this.play('player-<state>'). idle/move loop; shot/dead play
  // once and Player.js switches back to idle/move itself when they end
  // (see Player.js's 'animationcomplete' handling).
  buildPlayerAnimations() {
    const LOOPING = new Set(['idle', 'move']);
    const FRAME_RATE = { idle: 1, move: 8, shot: 14, dead: 5 };
    for (const [state, count] of Object.entries(PLAYER_ANIM_FRAME_COUNTS)) {
      const frames = [];
      for (let frame = 1; frame <= count; frame++) frames.push({ key: playerTextureKey(state, frame) });
      this.anims.create({
        key: `player-${state}`,
        frames,
        frameRate: FRAME_RATE[state] ?? 8,
        repeat: LOOPING.has(state) ? -1 : 0,
      });
    }
  }

  // Collects every levels/level_NN.json that successfully loaded (see
  // preload's probe loop), in numeric order, into LevelManager's LEVELS --
  // mutated in place since GameScene/debug.js already hold that array
  // reference. LEVELS.length ends up exactly the number of level files
  // present, satisfying "as many levels as there are files" with no
  // manifest to keep in sync.
  populateLevels() {
    for (let n = 1; n <= MAX_LEVEL_FILES; n++) {
      const key = levelFileKey(n);
      if (this.cache.json.has(key)) LEVELS.push(this.cache.json.get(key));
    }
  }
}

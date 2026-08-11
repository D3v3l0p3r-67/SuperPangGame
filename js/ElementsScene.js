import { WEAPON_TYPES } from './config.js';
import { registerElement } from './elements.js';
import { LEVELS, PANIC_LEVEL } from './LevelManager.js';
import { AUDIO_CONFIG } from './audio.js';
import {
  ELEMENTS_INDEX_PATH, ELEMENTS_INDEX_KEY, elementFileKey, elementFilePath,
  levelFileKey, levelFilePath, MAX_LEVEL_FILES,
  PANIC_LEVEL_KEY, PANIC_LEVEL_PATH,
  AUDIO_CONFIG_PATH, AUDIO_CONFIG_KEY,
} from './assets.js';

// Runs before BootScene so every ball/obstacle/power-up "element" (see
// elements.js/elements/*.json) and every level (see levels/*.json) is
// registered before BootScene has to decide which graphic files to load
// for them -- BootScene's preload() reads BALL_ELEMENTS/OBSTACLE_TYPES/
// POWERUP_TYPE_KEYS, so those need to already be populated by the time it
// runs, which means this has to be a separate scene (Phaser scenes boot
// strictly one after another; a same-scene two-wave preload would race).
export class ElementsScene extends Phaser.Scene {
  constructor() {
    super('Elements');
  }

  preload() {
    // Elements are freely named (round-ball-1.json, powerup-stoptime-5s
    // .json, ...) with no fixed convention to probe like levels, so their
    // set is read from a small manifest instead -- see assets.js.
    this.load.json(ELEMENTS_INDEX_KEY, ELEMENTS_INDEX_PATH);

    // Levels DO follow a fixed level_NN name, so -- same as before -- just
    // probe a generous range and keep whichever files actually exist.
    for (let n = 1; n <= MAX_LEVEL_FILES; n++) {
      this.load.json(levelFileKey(n), levelFilePath(n));
    }

    this.load.json(PANIC_LEVEL_KEY, PANIC_LEVEL_PATH);

    // Single self-contained config -- unlike elements/index.json (a
    // manifest naming OTHER files still to be loaded), audio.json already
    // holds every sound's full playback config, so it needs no second
    // wave: BootScene's preload() reads AUDIO_CONFIG (populated below) to
    // know which .ogg files to load, same as it already does for
    // BALL_ELEMENTS/OBSTACLE_TYPES/POWERUP_TYPE_KEYS.
    this.load.json(AUDIO_CONFIG_KEY, AUDIO_CONFIG_PATH);
  }

  create() {
    for (let n = 1; n <= MAX_LEVEL_FILES; n++) {
      const key = levelFileKey(n);
      if (this.cache.json.has(key)) LEVELS.push(this.cache.json.get(key));
    }

    Object.assign(PANIC_LEVEL, this.cache.json.get(PANIC_LEVEL_KEY) || {});
    Object.assign(AUDIO_CONFIG, this.cache.json.get(AUDIO_CONFIG_KEY) || {});

    const elementIds = this.cache.json.get(ELEMENTS_INDEX_KEY) || [];
    for (const id of elementIds) {
      this.load.json(elementFileKey(id), elementFilePath(id));
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const id of elementIds) {
        const el = this.cache.json.get(elementFileKey(id));
        if (el) registerElement(el, WEAPON_TYPES.harpoon);
      }
      this.scene.start('Boot');
    });
    this.load.start();
  }
}

import { VIRTUAL_W, VIRTUAL_H } from './constants.js';
import { ElementsScene } from './ElementsScene.js';
import { BootScene } from './BootScene.js';
import { GameScene } from './GameScene.js';

export const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: VIRTUAL_W,
  height: VIRTUAL_H,
  pixelArt: true,
  backgroundColor: '#0b0e2a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // per-ball gravity is set individually (see Ball.js)
      debug: false,
    },
  },
  // NONE: the canvas never auto-resizes to the browser window. Display
  // size is one of exactly three discrete zoom levels instead (see
  // constants.js's ZOOM_LEVELS / DisplayZoom.js), applied by hand as a
  // CSS size on the canvas -- there is no continuous "fit to window"
  // scaling left in this game.
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [ElementsScene, BootScene, GameScene],
};

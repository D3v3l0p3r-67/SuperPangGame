import { VIRTUAL_W, VIRTUAL_H } from './constants.js';
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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
};

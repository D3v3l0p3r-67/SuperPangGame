import { GAME_CONFIG } from './GameConfig.js';

// Phaser owns the loop, canvas, and renderer entirely from here on --
// there is no manual requestAnimationFrame code left in this project.
// Exposed on window for devtools/debugging, same as most Phaser projects.
window.game = new Phaser.Game(GAME_CONFIG);

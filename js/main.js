import { GAME_CONFIG } from './GameConfig.js';
import { applyZoom, activeZoom, watchViewport } from './DisplayZoom.js';

// Phaser owns the loop, canvas, and renderer entirely from here on --
// there is no manual requestAnimationFrame code left in this project.
// Exposed on window for devtools/debugging, same as most Phaser projects.
window.game = new Phaser.Game(GAME_CONFIG);

// Scale mode is NONE (see GameConfig.js) -- the canvas is sized by hand to
// one of exactly three fixed zoom levels instead of continuously fitting
// the window (see DisplayZoom.js). #game-container is sized to match
// exactly, so #ui-layer's CSS `inset: 0` always lines up with the canvas
// with no letterboxing gap to correct for.
// activeZoom rather than the stored preference: a window too small for
// the chosen size (a phone in landscape, typically) is fitted to instead,
// so no part of the playfield -- or of the touch controls anchored to it
// -- can end up off the screen. watchViewport keeps a fitted canvas
// fitted through rotation, resize and fullscreen.
window.game.events.once(Phaser.Core.Events.READY, () => {
  applyZoom(activeZoom());
  watchViewport();
});

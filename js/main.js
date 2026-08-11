import { GAME_CONFIG } from './GameConfig.js';
import { applyZoom, getZoom, fittedZoom } from './DisplayZoom.js';
import { isMobileDevice } from './input.js';

// Phaser owns the loop, canvas, and renderer entirely from here on --
// there is no manual requestAnimationFrame code left in this project.
// Exposed on window for devtools/debugging, same as most Phaser projects.
window.game = new Phaser.Game(GAME_CONFIG);

// Scale mode is NONE (see GameConfig.js) -- the canvas is sized by hand to
// one of exactly three fixed zoom levels instead of continuously fitting
// the window (see DisplayZoom.js). #game-container is sized to match
// exactly, so #ui-layer's CSS `inset: 0` always lines up with the canvas
// with no letterboxing gap to correct for.
// On a phone the stored zoom preference is ignored in favour of whatever
// actually fits the screen (see fittedZoom) -- at 1x the canvas is taller
// than a typical landscape phone viewport, and since the touch controls
// are anchored to the canvas they'd be pushed off-screen with it. Re-run
// on rotation and on entering/leaving fullscreen, both of which change the
// viewport the fit was computed against.
const applyDisplayZoom = () => applyZoom(isMobileDevice() ? fittedZoom() : getZoom());

window.game.events.once(Phaser.Core.Events.READY, () => {
  applyDisplayZoom();
  if (!isMobileDevice()) return;
  window.addEventListener('resize', applyDisplayZoom);
  window.addEventListener('orientationchange', applyDisplayZoom);
  document.addEventListener('fullscreenchange', applyDisplayZoom);
});

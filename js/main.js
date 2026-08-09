import { GAME_CONFIG } from './GameConfig.js';

// Phaser owns the loop, canvas, and renderer entirely from here on --
// there is no manual requestAnimationFrame code left in this project.
// Exposed on window for devtools/debugging, same as most Phaser projects.
window.game = new Phaser.Game(GAME_CONFIG);

// #ui-layer (DOM menus/HUD/touch-controls) must exactly track the canvas's
// actual rendered bounds, not just fill #game-container. Scale.FIT
// letterboxes the canvas within its parent on any aspect-ratio mismatch
// between the game and the viewport, and #ui-layer's CSS `inset: 0`
// otherwise covers that empty letterbox space too -- throwing off every
// percentage-based position in style.css (most visibly the HUD bar,
// which would render past the canvas's real bottom edge, in the
// letterbox gap, instead of on it).
function syncUiLayerToCanvas() {
  const canvas = window.game.canvas;
  const uiLayer = document.getElementById('ui-layer');
  if (!canvas || !uiLayer) return;
  uiLayer.style.left = `${canvas.offsetLeft}px`;
  uiLayer.style.top = `${canvas.offsetTop}px`;
  uiLayer.style.width = `${canvas.offsetWidth}px`;
  uiLayer.style.height = `${canvas.offsetHeight}px`;
}

window.game.events.once(Phaser.Core.Events.READY, () => {
  syncUiLayerToCanvas();
  window.game.scale.on(Phaser.Scale.Events.RESIZE, syncUiLayerToCanvas);
});
window.addEventListener('resize', syncUiLayerToCanvas);

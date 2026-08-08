import { STEP_MS, MAX_FRAME_MS, VIRTUAL_W, VIRTUAL_H } from './constants.js';
import { initInput, input } from './input.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { Debug } from './debug.js';
import * as storage from './storage.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeCanvas() {
  const availW = window.innerWidth;
  const availH = window.innerHeight;
  let scale = Math.floor(Math.min(availW / VIRTUAL_W, availH / VIRTUAL_H));
  if (scale < 1) scale = Math.min(availW / VIRTUAL_W, availH / VIRTUAL_H);
  canvas.style.width = `${VIRTUAL_W * scale}px`;
  canvas.style.height = `${VIRTUAL_H * scale}px`;
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);
resizeCanvas();

const audio = new AudioEngine();
const settings = storage.loadSettings();
audio.applySettings(settings);

const originalResume = audio.resumeContext.bind(audio);
audio.resumeContext = () => {
  originalResume();
  audio.applySettings(storage.loadSettings());
};

const game = new Game(audio);
const ui = new UI(game, audio, storage);
const debugMode = new Debug(game);

initInput();
ui.showTouchControlsIfNeeded();

let last = 0;
let acc = 0;

function frame(ts) {
  if (!last) last = ts;
  let delta = ts - last;
  last = ts;
  if (delta > MAX_FRAME_MS) delta = MAX_FRAME_MS;
  debugMode.recordFrame(delta);

  acc += delta;
  while (acc >= STEP_MS) {
    game.update(STEP_MS / 1000, input);
    acc -= STEP_MS;
  }

  game.render(ctx);
  debugMode.render(ctx);
  ui.render();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

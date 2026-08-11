import { HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_FRAME } from './assets.js';
import { hexColor } from './colors.js';

const LIFESPAN_MS = 300;
const START_Y_OFFSET = 16; // appears this many px above the pop point -- clear of the pop effect (see assets.js's POP_FRAME_SCALE), which is centered right on the pop point
const RISE_PX = 10; // additional upward drift over LIFESPAN_MS, on top of START_Y_OFFSET
const START_SCALE = 1 / 3; // a further 1/3 smaller than the previous 0.5 (0.5 * 2/3)
const END_SCALE = 0.5; // 0.75 * 2/3, same growth ratio as before

// The floating "+N" score readout a popped ball leaves behind (see
// GameScene.popBall) -- built from the same tintable HUD score-digit
// spritesheet the HUD itself already uses (see Hud.js's DigitRow), just
// centered on the pop point instead of left-anchored in the HUD strip,
// and tinted to the popped ball's own color. Appears START_Y_OFFSET above
// the pop point, then over LIFESPAN_MS drifts up another RISE_PX, grows
// from START_SCALE to END_SCALE, and fades out (alpha 1 -> 0) -- pure
// visual flourish, no gameplay effect. GameScene owns the array of live
// instances (this.scorePopups), calling update(dt) every PLAYING frame
// and dropping any that report .dead.
export class ScorePopup {
  constructor(scene, x, y, value, colorHex) {
    const digits = String(Math.max(0, Math.round(value)));
    const frameW = HUD_DIGITS_LARGE_FRAME.frameWidth;
    const totalW = digits.length * frameW;

    this.container = scene.add.container(x, y - START_Y_OFFSET);
    this.container.setDepth(8);
    for (let i = 0; i < digits.length; i++) {
      const img = scene.add.image(-totalW / 2 + i * frameW, 0, HUD_DIGITS_LARGE_KEY, Number(digits[i]))
        .setOrigin(0, 0)
        .setTint(hexColor(colorHex));
      this.container.add(img);
    }

    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt * 1000;
    const t = Math.min(1, this.age / LIFESPAN_MS);
    this.container.y -= (RISE_PX / LIFESPAN_MS) * dt * 1000;
    this.container.setScale(START_SCALE + (END_SCALE - START_SCALE) * t);
    this.container.setAlpha(1 - t);
    if (this.age >= LIFESPAN_MS) this.destroy();
  }

  destroy() {
    this.container.destroy();
    this.dead = true;
  }
}

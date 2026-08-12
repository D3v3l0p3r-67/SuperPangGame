import { HUD_DIGITS_LARGE_KEY, HUD_DIGITS_LARGE_FRAME } from './assets.js';
import { BORDER_THICKNESS } from './constants.js';
import { hexColor } from './colors.js';

const LIFESPAN_MS = 500;
const RISE_PX = 64; // total upward drift over LIFESPAN_MS
const BALL_CLEARANCE_PX = 4; // gap between the ball's top edge and the readout's bottom edge at t=0
const START_SCALE = 1 / 3;
const END_SCALE = 1; // grows to full size on the way up

// The floating "+N" score readout a popped ball leaves behind (see
// GameScene.popBall) -- built from the same tintable HUD score-digit
// spritesheet the HUD itself already uses (see Hud.js's DigitRow), just
// centered on the pop point instead of left-anchored in the HUD strip,
// and tinted to the popped ball's own color.
//
// It starts just above the popped ball (clear of its top edge, so it never
// opens on top of the ball or of the pop effect that replaces it), then
// over LIFESPAN_MS rises RISE_PX, grows from START_SCALE to END_SCALE and
// fades out (alpha 1 -> 0) -- pure visual flourish, no gameplay effect.
//
// The digits are centred on the container in BOTH axes so the growth
// expands evenly around the readout rather than dragging it off its own
// anchor point. GameScene owns the array of live instances
// (this.scorePopups), calling update(dt) every PLAYING frame and dropping
// any that report .dead.
export class ScorePopup {
  constructor(scene, x, y, value, colorHex, ballRadius = 0) {
    this.scene = scene;
    const digits = String(Math.max(0, Math.round(value)));
    const frameW = HUD_DIGITS_LARGE_FRAME.frameWidth;
    const frameH = HUD_DIGITS_LARGE_FRAME.frameHeight;
    const totalW = digits.length * frameW;

    // Sits its bottom edge BALL_CLEARANCE_PX above the ball's top edge --
    // measured at START_SCALE, the size it actually opens at.
    this.startY = y - ballRadius - BALL_CLEARANCE_PX - (frameH * START_SCALE) / 2;
    // A ball popped just under the ceiling has less than RISE_PX of room
    // above it, and an unclamped rise would carry the readout off the top
    // of the playfield before it had finished fading. Stop it at the
    // ceiling instead -- it still grows and fades out, just in place.
    this.minY = BORDER_THICKNESS + (frameH * END_SCALE) / 2;
    this.container = scene.add.container(x, this.startY);
    this.container.setDepth(8);
    for (let i = 0; i < digits.length; i++) {
      const img = scene.add.image(-totalW / 2 + i * frameW, -frameH / 2, HUD_DIGITS_LARGE_KEY, Number(digits[i]))
        .setOrigin(0, 0)
        .setTint(hexColor(colorHex));
      this.container.add(img);
    }

    this.container.setScale(START_SCALE);
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    if (this.fading) return; // the level-clear fade owns alpha now
    this.age += dt * 1000;
    const t = Math.min(1, this.age / LIFESPAN_MS);
    // Driven off `t` rather than accumulated per-frame deltas, so the
    // readout has covered exactly RISE_PX by the time it fades out however
    // the frames happened to fall.
    this.container.y = Math.max(this.minY, this.startY - RISE_PX * t);
    this.container.setScale(START_SCALE + (END_SCALE - START_SCALE) * t);
    this.container.setAlpha(1 - t);
    if (this.age >= LIFESPAN_MS) this.destroy();
  }

  // Hands the remaining fade over to a tween running for `durationMs`,
  // for when a level is cleared (see GameScene.fadeOutLeftovers): the
  // last ball's popup is typically still on screen at that moment, and
  // GameScene stops calling update() outside PLAYING, so without this it
  // would simply hang frozen mid-air until the next level loaded.
  fadeOut(durationMs) {
    if (this.dead || this.fading) return;
    this.fading = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: durationMs,
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}

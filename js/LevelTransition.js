import { VIRTUAL_W, PLAYFIELD_H, COLORS } from './constants.js';
import { hexColor } from './colors.js';

const INK = hexColor(COLORS.hudBg);

// One entry per named transition effect, in the same mutable-registry
// style as elements.js's POWERUP_BEHAVIORS and config.js's WEAPON_TYPES:
// game code never names an effect, it only ever runs whichever one
// config.js's LEVEL_TRANSITION points at, so swapping the effect is a
// one-word edit and adding one is a new entry here and nothing else.
//
// Each effect is handed a Graphics already cleared for this frame, plus:
//   amount    0 -> 1, how far along this half of the transition is
//   covering  true while the screen is being hidden, false while it's
//             being given back
// The level is swapped at the moment amount first reaches 1 (see
// LevelTransition.update), so an effect only has to be opaque at amount 1
// and transparent at amount 0 -- everything between is its own business.
// Effects cover the playfield only, never the HUD bar below it, so the
// score/lives stay readable straight through the change.
export const LEVEL_TRANSITIONS = {
  // Straight cross-fade through black. The quiet default.
  fade: {
    label: 'Fade',
    durationSec: 0.8,
    draw(g, amount) {
      g.fillStyle(INK, amount);
      g.fillRect(0, 0, VIRTUAL_W, PLAYFIELD_H);
    },
  },

  // A solid edge sweeping down over the old level, then continuing on
  // down off the bottom to uncover the new one -- so the wipe travels one
  // way throughout rather than retracing its own path.
  wipe: {
    label: 'Wipe down',
    durationSec: 0.7,
    draw(g, amount, covering) {
      g.fillStyle(INK, 1);
      if (covering) g.fillRect(0, 0, VIRTUAL_W, amount * PLAYFIELD_H);
      else g.fillRect(0, (1 - amount) * PLAYFIELD_H, VIRTUAL_W, amount * PLAYFIELD_H);
    },
  },

  // Four edges closing in on the centre and opening back out. Square
  // rather than circular: a hard-edged box belongs to this art far better
  // than an antialiased circle would.
  iris: {
    label: 'Iris',
    durationSec: 0.8,
    draw(g, amount) {
      const mx = (amount * VIRTUAL_W) / 2;
      const my = (amount * PLAYFIELD_H) / 2;
      g.fillStyle(INK, 1);
      g.fillRect(0, 0, VIRTUAL_W, my);
      g.fillRect(0, PLAYFIELD_H - my, VIRTUAL_W, my);
      g.fillRect(0, 0, mx, PLAYFIELD_H);
      g.fillRect(VIRTUAL_W - mx, 0, mx, PLAYFIELD_H);
    },
  },

  // Horizontal slats drawing across from alternating sides, like a
  // shutter closing.
  shutter: {
    label: 'Shutter',
    durationSec: 0.7,
    slats: 8,
    draw(g, amount) {
      const h = PLAYFIELD_H / this.slats;
      const w = amount * VIRTUAL_W;
      g.fillStyle(INK, 1);
      for (let i = 0; i < this.slats; i++) {
        const x = i % 2 === 0 ? 0 : VIRTUAL_W - w;
        g.fillRect(x, i * h, w, Math.ceil(h));
      }
    },
  },
};

export function transitionEffect(name) {
  return LEVEL_TRANSITIONS[name] ?? LEVEL_TRANSITIONS.fade;
}

// Runs one transition: hides the playfield, hands control back at the
// covered moment so the caller can swap the level under it, then uncovers.
//
// Deliberately NOT a game state. The swap it wraps takes the scene from
// LEVEL_CLEAR to LEVEL_INTRO, so a transition state would have to be
// entered and left in the middle of itself. Instead this owns its own
// clock and is ticked from GameScene.update() on every frame whatever the
// state is, the same way the HUD and level-intro overlays are drawn
// regardless of state.
export class LevelTransition {
  constructor(scene) {
    this.scene = scene;
    // Above the level-intro overlay (25): the intro's title card comes up
    // while the screen is still covered, and the uncovering has to happen
    // over it, not under it.
    this.gfx = scene.add.graphics().setDepth(30).setVisible(false);
    this.effect = null;
    this.elapsed = 0;
    this.onCovered = null;
  }

  get active() {
    return this.effect !== null;
  }

  // `onCovered` runs once, at the frame the screen is fully hidden. A
  // transition already running is left alone rather than restarted, so a
  // double trigger can't swap two levels.
  start(name, onCovered) {
    if (this.active) return;
    this.effect = transitionEffect(name);
    this.elapsed = 0;
    this.onCovered = onCovered;
    this.gfx.setVisible(true);
    this.render(0, true);
  }

  update(dt) {
    if (!this.active) return;
    const half = this.effect.durationSec / 2;
    const wasCovering = this.elapsed < half;
    this.elapsed += dt;
    const covering = this.elapsed < half;

    if (wasCovering && !covering) {
      const swap = this.onCovered;
      this.onCovered = null;
      // Painted at full cover for this frame BEFORE the level changes, so
      // the swap itself can never show through as a flicker.
      this.render(1, true);
      swap?.();
      return;
    }

    if (this.elapsed >= this.effect.durationSec) {
      this.stop();
      return;
    }

    const amount = covering ? this.elapsed / half : 1 - (this.elapsed - half) / half;
    this.render(amount, covering);
  }

  render(amount, covering) {
    this.gfx.clear();
    this.effect.draw(this.gfx, amount, covering);
  }

  stop() {
    this.effect = null;
    this.onCovered = null;
    this.gfx.clear();
    this.gfx.setVisible(false);
  }
}

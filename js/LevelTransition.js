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

  // The one effect that hides nothing: the level being left slides up and
  // off the top while the next one follows it up from below, as though it
  // were shoving the old one out.
  //
  // It is the two levels themselves that move -- a photograph of each (see
  // LevelTransition.capture), not the ink the effects above paint with --
  // which is why this one implements `place` rather than `draw`. The two
  // pictures are always exactly one playfield apart, so between them they
  // cover it the whole way up and the live scene behind them never shows.
  push: {
    label: 'Push up',
    durationSec: 0.9,
    place(leaving, arriving, amount) {
      // Eased rather than linear: it leans into the move and settles out
      // of it, which reads as one shove instead of a constant scroll that
      // stops dead.
      const eased = amount < 0.5 ? 2 * amount * amount : 1 - 2 * (1 - amount) ** 2;
      const offset = eased * PLAYFIELD_H;
      leaving.y = -offset;
      arriving.y = PLAYFIELD_H - offset;
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
    // The two stills a sliding effect moves (see startSliding); null for
    // the overlay effects, which draw into this.gfx instead.
    this.leaving = null;
    this.arriving = null;
  }

  get active() {
    return this.effect !== null;
  }

  // Whether the effect running moves the levels themselves rather than
  // painting over them.
  get sliding() {
    return this.leaving !== null;
  }

  // How much of the effect is still to play. Read from inside `onCovered`,
  // which is where the next level is built: that moment is nowhere near
  // the end of the transition (halfway through for the overlay effects,
  // the very first frame for a sliding one), so anything that must not
  // start until the new level is actually in place has to wait this long.
  // GameScene.advanceLevel holds the "3, 2, 1, GO!" countdown for exactly
  // it -- otherwise READY sounds over a level still sliding off screen.
  get remainingSec() {
    if (!this.active) return 0;
    return Math.max(0, this.effect.durationSec - this.elapsed);
  }

  // `onCovered` runs once, at the frame the screen is fully hidden -- or,
  // for a sliding effect, immediately, since it has nothing to hide
  // behind until the next level exists. A transition already running is
  // left alone rather than restarted, so a double trigger can't swap two
  // levels.
  start(name, onCovered) {
    if (this.active) return;
    this.effect = transitionEffect(name);
    this.elapsed = 0;
    // Here rather than at the call site, so every effect gets it and a
    // new one cannot be added without: the sound belongs to the change of
    // level, not to any one way of showing it.
    this.scene.audio.play('leveltransition');
    if (this.effect.place) {
      this.startSliding(onCovered);
      return;
    }
    this.onCovered = onCovered;
    this.gfx.setVisible(true);
    this.render(0, true);
  }

  // Photograph the level being left, swap to the next one behind that
  // photograph, photograph the new one too -- from here the transition is
  // those two pictures moving, with the live scene hidden behind them.
  startSliding(swap) {
    this.leaving = this.capture();
    swap?.();
    this.arriving = this.capture();
    this.effect.place(this.leaving, this.arriving, 0);
  }

  // Keeps the sliding stills inside the playfield. They are a whole
  // playfield tall and spend the transition half in and half out of it,
  // so without this the one coming up would ride over the HUD bar on its
  // way -- the one thing every effect here promises not to touch. Owned
  // by the transition rather than by the effect: where the pictures go is
  // the effect's business, staying off the HUD is not.
  playfieldMask() {
    if (!this.mask) {
      // make (not add): the shape is the mask itself, never drawn.
      const shape = this.scene.make.graphics({}, false);
      shape.fillStyle(0xffffff, 1);
      shape.fillRect(0, 0, VIRTUAL_W, PLAYFIELD_H);
      this.maskShape = shape;
      this.mask = shape.createGeometryMask();
    }
    return this.mask;
  }

  // A still of the playfield exactly as it looks right now, as a game
  // object of its own. The texture is only PLAYFIELD_H tall, so the HUD
  // bar below it is never part of the picture and keeps showing straight
  // through -- the same promise the overlay effects keep by not painting
  // over it.
  capture() {
    const shot = this.scene.add.renderTexture(0, 0, VIRTUAL_W, PLAYFIELD_H).setOrigin(0, 0).setDepth(30);
    shot.setMask(this.playfieldMask());
    // What a camera would see, filtered by hand, because a render texture
    // is not a camera: draw() renders whatever it is handed REGARDLESS of
    // visibility, so the scene's hidden objects -- the world map, the
    // menus, every overlay waiting its turn -- have to be left out or the
    // photograph is of them rather than of the level. And this
    // transition's own objects are always out: a render texture drawn
    // into itself is a picture of nothing, and the still already taken
    // must not end up inside the next one.
    const subjects = this.scene.children.list.filter((child) => (
      child.visible && child.alpha > 0
      && child !== shot && child !== this.gfx && child !== this.leaving
    ));
    shot.draw(subjects);
    return shot;
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    if (this.sliding) {
      const amount = Math.min(1, this.elapsed / this.effect.durationSec);
      this.effect.place(this.leaving, this.arriving, amount);
      // Ends exactly where the arriving still lines up with the live
      // scene behind it, so dropping the stills changes nothing on screen.
      if (this.elapsed >= this.effect.durationSec) this.stop();
      return;
    }

    const half = this.effect.durationSec / 2;
    const wasCovering = this.elapsed - dt < half;
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
    this.leaving?.destroy();
    this.arriving?.destroy();
    this.leaving = null;
    this.arriving = null;
  }
}

import { VIRTUAL_W, PLAYFIELD_H, COLORS } from './constants.js';
import { hexColor } from './colors.js';
import * as assets from './assets.js';
import { REGIONS } from './regions.js';

const ACCENT = hexColor(COLORS.accent);
const DANGER = hexColor(COLORS.danger);
const REACHED = hexColor(COLORS.success);
const PALE = hexColor(COLORS.text);

// Phase lengths, in seconds. The flight is the point of the whole thing,
// so it gets the bulk; the beat either side is just enough to read where
// the plane started and where it landed before the screen changes again.
const SETTLE_SEC = 0.5;
const FLY_SEC = 2.2;
const ARRIVE_SEC = 0.7;
const FADE_SEC = 0.5;

const MARKER_R = 5;
// How far past the destination the landed plane is parked, so it doesn't
// sit on the marker it just arrived at.
const PARKED_PX = 22;
const DOTS = 26;          // dots making up the drawn route
const ARC_LIFT = 0.22;    // how far the route bows away from a straight line

// The between-continents interlude: a world map with the campaign's whole
// route marked on it, and a plane flying the leg the player has just
// earned. Runs while the screen is already hidden by a level transition
// (see GameScene.advanceLevel), so the transition uncovers onto THIS
// rather than onto the next level, which only appears once the plane has
// landed and the map has faded.
//
// Like LevelTransition, deliberately not a game state: it spans the same
// LEVEL_CLEAR-to-LEVEL_INTRO handover, and is ticked from GameScene.update
// on every frame whatever the state happens to be.
export class WorldMapInterlude {
  constructor(scene) {
    this.scene = scene;
    // Between the level (and its HUD) and the transition overlay at 30, so
    // a transition can uncover onto the map and later cover it again.
    this.container = scene.add.container(0, 0).setDepth(28).setVisible(false);

    this.map = scene.add.image(0, 0, assets.WORLDMAP_TEXTURE_KEY).setOrigin(0, 0);
    // The map is authored at half the playfield; read its real size rather
    // than assuming, so re-authoring it bigger or smaller still lines the
    // route markers up (their coordinates are in the map's own pixels).
    this.mapScale = VIRTUAL_W / this.map.width;
    this.map.setDisplaySize(VIRTUAL_W, this.map.height * this.mapScale);
    this.map.y = (PLAYFIELD_H - this.map.displayHeight) / 2;
    this.container.add(this.map);

    this.route = scene.add.graphics();
    this.container.add(this.route);

    this.plane = scene.add.image(0, 0, assets.PLANE_TEXTURE_KEY).setScale(2);
    this.container.add(this.plane);

    this.nameImages = [];
    this.active = false;
    this.onDone = null;
  }

  toScreen(point) {
    return {
      x: point.x * this.mapScale,
      y: this.map.y + point.y * this.mapScale,
    };
  }

  // The route bows rather than running straight, both because a great
  // circle drawn flat does and because a curve reads as travel where a
  // straight line reads as a ruler.
  arcPoint(from, to, t) {
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const lift = Math.sin(Math.PI * t) * Math.hypot(to.x - from.x, to.y - from.y) * ARC_LIFT;
    return { x, y: y - lift };
  }

  // `fromIndex`/`toIndex` are REGIONS indices. onDone runs once, after the
  // map has faded back out.
  start(fromIndex, toIndex, onDone) {
    if (this.active || !REGIONS[toIndex]) {
      onDone?.();
      return;
    }
    this.active = true;
    this.onDone = onDone;
    this.elapsed = 0;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
    this.from = this.toScreen(REGIONS[fromIndex]?.map ?? REGIONS[toIndex].map);
    this.to = this.toScreen(REGIONS[toIndex].map);
    // The engine, for as long as the map is up. One sound for the whole
    // interlude rather than a loop started and stopped: the interlude is
    // a fixed length, so the sound is authored to that length.
    this.scene.audio.play('planefly');

    for (const img of this.nameImages) img.destroy();
    this.nameImages = this.buildName(REGIONS[toIndex].name ?? '');

    this.container.setVisible(true).setAlpha(1);
    this.render(0);
  }

  // The destination's name, composed from the intro font the level-intro
  // already uses -- same "loaded images, never drawn text" rule as the HUD.
  buildName(text) {
    const advance = (assets.INTRO_FONT_FRAME.frameWidth + 1) * 2;
    const width = text.length === 0 ? 0
      : (text.length - 1) * advance + assets.INTRO_FONT_FRAME.frameWidth * 2;
    const startX = (VIRTUAL_W - width) / 2;
    const images = [];
    for (let i = 0; i < text.length; i++) {
      const idx = assets.INTRO_FONT_CHARS.indexOf(text[i].toUpperCase());
      const img = this.scene.add.image(startX + i * advance, PLAYFIELD_H - 40,
        assets.INTRO_FONT_KEY, idx === -1 ? 0 : idx)
        .setOrigin(0, 0).setScale(2).setTint(ACCENT);
      this.container.add(img);
      images.push(img);
    }
    return images;
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    const total = SETTLE_SEC + FLY_SEC + ARRIVE_SEC + FADE_SEC;

    if (this.elapsed >= total) {
      const done = this.onDone;
      this.onDone = null;
      this.stop();
      done?.();
      return;
    }

    // Only the fade phase touches alpha; everything before it is opaque.
    const intoFade = this.elapsed - (SETTLE_SEC + FLY_SEC + ARRIVE_SEC);
    this.container.setAlpha(intoFade > 0 ? 1 - intoFade / FADE_SEC : 1);

    const flown = Math.max(0, Math.min(1, (this.elapsed - SETTLE_SEC) / FLY_SEC));
    this.render(flown);
  }

  render(flown) {
    const g = this.route;
    g.clear();

    // Every stop on the itinerary, so the run reads as one journey rather
    // than a pair of unrelated places -- and each one says whether it has
    // been played: green for the continents the run has already been to,
    // red for the ones still ahead. The destination is red for the whole
    // flight and turns green as the plane lands on it, which is the one
    // moment the map exists to show.
    const reached = flown >= 1 ? this.toIndex : this.fromIndex;
    for (let i = 0; i < REGIONS.length; i++) {
      const p = this.toScreen(REGIONS[i].map);
      // The two ends of this leg carry a fatter core than the rest, so
      // the flight reads off the markers as well as off the trail.
      const onThisLeg = i === this.fromIndex || i === this.toIndex;
      g.fillStyle(0x000000, 0.5);
      g.fillCircle(p.x, p.y, MARKER_R + 2);
      g.fillStyle(PALE, 1);
      g.fillCircle(p.x, p.y, MARKER_R);
      g.fillStyle(i <= reached ? REACHED : DANGER, 1);
      g.fillCircle(p.x, p.y, onThisLeg ? MARKER_R - 1 : MARKER_R - 2);
    }

    // The leg being flown, drawn as a dotted trail that fills in behind the
    // plane -- so how far along it is readable from the trail alone.
    for (let i = 0; i <= DOTS; i++) {
      const t = i / DOTS;
      const p = this.arcPoint(this.from, this.to, t);
      const passed = t <= flown;
      g.fillStyle(passed ? ACCENT : PALE, passed ? 1 : 0.28);
      g.fillCircle(p.x, p.y, passed ? 2 : 1.5);
    }

    const at = this.arcPoint(this.from, this.to, flown);
    // A step ahead along the same arc gives the heading, so the plane
    // banks through the curve instead of pointing at the destination the
    // whole way. The artwork is authored nose-up, hence the +90 degrees.
    const ahead = this.arcPoint(this.from, this.to, Math.min(1, flown + 0.02));
    if (flown < 1) {
      this.plane.setPosition(at.x, at.y);
      this.plane.setRotation(Math.atan2(ahead.y - at.y, ahead.x - at.x) + Math.PI / 2);
    } else {
      // Landed: parked a little PAST the marker rather than on top of it.
      // The plane is three times the width of a marker, and the marker
      // turning green is the one thing the arrival has to show.
      const back = this.arcPoint(this.from, this.to, 1 - 0.02);
      const dx = at.x - back.x;
      const dy = at.y - back.y;
      const len = Math.hypot(dx, dy) || 1;
      this.plane.setPosition(at.x + (dx / len) * PARKED_PX, at.y + (dy / len) * PARKED_PX);
    }
    this.plane.setVisible(true);
  }

  stop() {
    this.active = false;
    this.onDone = null;
    this.route.clear();
    this.container.setVisible(false);
    for (const img of this.nameImages) img.destroy();
    this.nameImages = [];
  }
}

import { LEVELS_PER_REGION } from './config.js';

// A campaign run is a journey: every LEVELS_PER_REGION levels the player
// arrives on a new continent, and the background, the landmark in it and
// the music all change together (see GameScene.loadLevel and the
// between-regions interlude in js/WorldMapInterlude.js).
//
// Mutated in place at boot by ElementsScene from levels/regions.json --
// the same mutable-registry pattern as elements.js's BALL_ELEMENTS and
// LevelManager's LEVELS -- so the route, its artwork and its music are
// data, not code. Order IS the itinerary: regions are visited top to
// bottom. Each entry carries:
//
//   id, name    the region's key and the name shown on the map
//   background  the BASE name of the region's frame -- the file actually
//               shown is one of its times of day,
//               assets/backgrounds/<name>_<phase>.webp (see
//               DAYLIGHT_PHASES below)
//   music       an audio.json key (category "music")
//   map         where this region sits on assets/ui/worldmap.webp, in that
//               image's OWN pixels -- the interlude scales them to however
//               large it draws the map, so re-authoring the map at a
//               different size doesn't invalidate these.
export const REGIONS = [];

// Which region a campaign level belongs to. Clamped rather than wrapped:
// if there are ever more levels than the regions cover, the last continent
// is where the journey ends up staying, which is a duller run but never a
// broken one (a wrap would fly the player back to the start mid-campaign).
export function regionIndexForLevel(levelIndex) {
  if (REGIONS.length === 0) return 0;
  return Math.min(REGIONS.length - 1, Math.floor(levelIndex / LEVELS_PER_REGION));
}

export function regionForLevel(levelIndex) {
  return REGIONS[regionIndexForLevel(levelIndex)] ?? null;
}

// True when moving between these two levels means changing continents --
// what the world-map interlude keys off.
export function crossesRegion(fromLevelIndex, toLevelIndex) {
  return regionIndexForLevel(fromLevelIndex) !== regionIndexForLevel(toLevelIndex);
}

// A continent is one day long: the levels played on it run from morning to
// night, in this order, and the background changes with them. Each region's
// frame is authored once, at night, and relit into these five by
// tools/daylight_backgrounds.py -- so they are the same view of the same
// place under a different sun, written to
// assets/backgrounds/<region background>_<phase>.webp.
export const DAYLIGHT_PHASES = ['morning', 'noon', 'afternoon', 'dusk', 'night'];

// Which of those a campaign level is played at. Spread across the region
// rather than one phase per level, so the day still runs start-to-end if
// LEVELS_PER_REGION is ever something other than five: with more levels
// than phases a phase lasts several levels, with fewer the day skips some.
export function daylightPhaseForLevel(levelIndex) {
  const within = ((levelIndex % LEVELS_PER_REGION) + LEVELS_PER_REGION) % LEVELS_PER_REGION;
  const phase = Math.floor((within * DAYLIGHT_PHASES.length) / LEVELS_PER_REGION);
  return DAYLIGHT_PHASES[Math.min(phase, DAYLIGHT_PHASES.length - 1)];
}

// The background name (an assets.js texture key / file name, without the
// folder or the extension) of a region's frame at one time of day.
export function daylightBackground(base, phase) {
  return `${base}_${phase}`;
}

// Every background name the campaign can ask for: each region's frame at
// each of its times of day. What BootScene loads, and what the level
// editor offers alongside the plain backgrounds.
export function daylightBackgroundNames() {
  const names = [];
  for (const region of REGIONS) {
    if (!region.background) continue;
    for (const phase of DAYLIGHT_PHASES) names.push(daylightBackground(region.background, phase));
  }
  return names;
}

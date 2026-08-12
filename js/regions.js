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
//   background  an assets/backgrounds/<name>.webp
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

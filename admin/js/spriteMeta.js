// The catalogue behind the Graphics tab and the sprite studio: every
// image file the game loads, what it is called, whether it is a
// spritesheet (and at what cell size), which of the game's animations run
// on it, and whether a tool draws it.
//
// Nothing here is a list kept by hand. The files come from
// elements/*.json + js/assets.js, exactly what the game itself boots from
// (see ElementsScene/BootScene), and the animations come from
// js/animations.js -- the same registry BootScene builds its Phaser
// animations out of, so the studio plays a sheet back at the rate the
// game will actually play it.
import * as assets from '../../js/assets.js';
import { gameAnimations } from '../../js/animations.js';
import { WEAPON_TYPES } from '../../js/config.js';
import { DAYLIGHT_PHASES, daylightBackground } from '../../js/regions.js';
import { fetchJSON } from './util.js';

// Sheets nothing animates, but which are still cells rather than one
// picture -- the studio steps through them frame by frame the same way,
// which is the only way to look at digit 7 or the letter Q on its own.
const STATIC_SHEETS = {
  [assets.WEAPON_SHOTS_PATH]: assets.WEAPON_SHOTS_FRAME,
  [assets.HUD_DIGITS_LARGE_PATH]: assets.HUD_DIGITS_LARGE_FRAME,
  [assets.HUD_DIGITS_SMALL_PATH]: assets.HUD_DIGITS_SMALL_FRAME,
  [assets.INTRO_FONT_PATH]: assets.INTRO_FONT_FRAME,
};

// Which files a tool draws, and which one. Editing these by hand works
// exactly as well as editing any other file -- until that tool is run
// again, which overwrites it. The studio says so on the file rather than
// leaving it to be remembered (see CLAUDE.md / the README's "Graphics are
// generated").
const GENERATORS = [
  { test: (path) => path === assets.PLAYER_TEXTURE_PATH, tool: 'tools/player_sprite.py' },
  { test: (path) => path === assets.PLAYER_GHOST_TEXTURE_PATH, tool: 'tools/ghost_sprite.py', from: "the player sheet's DEAD frame" },
  { test: (path) => /\/(ball|pop)_(wave|hunter|heavy)_\d\.webp$/.test(path), tool: 'tools/ball_variants.py', from: 'the round ball of the same size' },
  {
    test: (path) => DAYLIGHT_PHASES.some((phase) => path.endsWith(`_${phase}.webp`)),
    tool: 'tools/daylight_backgrounds.py',
    from: "the region's own authored night frame",
  },
  { test: (path) => path.startsWith('assets/icons/'), tool: 'tools/app_icons.py' },
];

function generatorFor(path) {
  return GENERATORS.find((gen) => gen.test(path)) ?? null;
}

async function fetchElements() {
  const ids = await fetchJSON(assets.ELEMENTS_INDEX_PATH);
  const results = await Promise.all(ids.map(async (id) => {
    try {
      return await fetchJSON(assets.elementFilePath(id));
    } catch (err) {
      console.error(`Skipping ${id}:`, err);
      return null;
    }
  }));
  return results.filter(Boolean);
}

// Every distinct `background` a levels/level_NN.json actually uses, same
// probing convention levelsTab.js uses (no manifest, just try each slot up
// to MAX_LEVEL_FILES and keep whichever load) -- plus DEFAULT_BACKGROUND
// itself, since the level editor always starts pointed at it even before
// any level names it, and every region's five times of day, which are the
// ones a campaign level actually shows.
async function fetchBackgroundNames() {
  const names = new Set([assets.DEFAULT_BACKGROUND]);
  for (let n = 1; n <= assets.MAX_LEVEL_FILES; n++) {
    try {
      const level = await fetchJSON(assets.levelFilePath(n));
      if (level.background) names.add(level.background);
    } catch {
      // No file at this slot -- expected past the last level.
    }
  }
  try {
    const regions = await fetchJSON(assets.REGIONS_PATH);
    for (const region of regions) {
      names.add(region.background);
      for (const phase of DAYLIGHT_PHASES) names.add(daylightBackground(region.background, phase));
    }
  } catch (err) {
    console.error('Skipping region backgrounds:', err);
  }
  return names;
}

// path -> the animations that run on it, from the game's own registry.
function animationsByPath(ballElements) {
  const byPath = new Map();
  for (const anim of gameAnimations(ballElements)) {
    if (!byPath.has(anim.texturePath)) byPath.set(anim.texturePath, []);
    byPath.get(anim.texturePath).push({
      key: anim.key,
      label: anim.label,
      frames: anim.frames,
      frameRate: anim.frameRate,
      loop: anim.loop,
      frame: anim.frame,
    });
  }
  return byPath;
}

// The whole catalogue, in the order the tab shows it: one group per kind
// of graphic, each holding its files.
export async function buildCatalogue() {
  const elements = await fetchElements();
  const balls = elements.filter((item) => item.category === 'ball');
  const anims = animationsByPath(balls);
  const groups = [];
  const add = (title, items) => groups.push({ title, items: items.filter(Boolean) });

  const entry = (label, path) => {
    const animations = anims.get(path) ?? [];
    return {
      label,
      path,
      // A sheet's cell size comes from whichever animation runs on it;
      // for the ones nothing animates it is spelled out above. Everything
      // else is a single picture, and `frame` stays null.
      frame: animations[0]?.frame ?? STATIC_SHEETS[path] ?? null,
      animations,
      generator: generatorFor(path),
    };
  };

  add('Player', [
    entry('Player spritesheet', assets.PLAYER_TEXTURE_PATH),
    entry('Death ghost', assets.PLAYER_GHOST_TEXTURE_PATH),
    entry('Shield effect', assets.PLAYER_SHIELD_TEXTURE_PATH),
    entry('Hit burst', assets.PLAYER_HIT_TEXTURE_PATH),
    entry('Landing dust', assets.PLAYER_DUST_TEXTURE_PATH),
  ]);

  add('Balls', balls.flatMap((el) => [
    entry(`${el.label ?? el.id} -- ${el.shape} size ${el.size}`, assets.ballTexturePath(el.shape, el.size)),
    entry(`${el.label ?? el.id} -- pop effect`, assets.ballPopTexturePath(el.shape, el.size)),
  ]));

  const tileNames = new Set(elements.filter((item) => item.category === 'obstacle').map((item) => item.tileTexture));
  const ladderNames = new Set(elements.filter((item) => item.category === 'ladder').map((item) => item.texture));
  add('Obstacles and ladders', [
    ...[...tileNames].map((name) => entry(`Obstacle tile -- ${name}`, assets.obstacleTexturePath(name))),
    ...[...ladderNames].map((name) => entry(`Ladder -- ${name}`, assets.ladderTexturePath(name))),
  ]);

  add('Weapons and power-ups', [
    entry('Weapon shots (one 36x400 cell per weapon)', assets.WEAPON_SHOTS_PATH),
    entry('Machine-gun bullet', assets.BULLET_TEXTURE_PATH),
    entry('Bullet splash', assets.BULLET_HIT_TEXTURE_PATH),
    entry('Burst particle (tinted at runtime -- keep it white)', assets.PARTICLE_TEXTURE_PATH),
    ...elements.filter((item) => item.category === 'powerup')
      .map((item) => entry(`Power-up icon -- ${item.label} (${item.type})`, assets.powerupTexturePath(item.type))),
  ]);

  add('HUD', [
    entry('Score digits (large)', assets.HUD_DIGITS_LARGE_PATH),
    entry('Time/level/hi digits (small)', assets.HUD_DIGITS_SMALL_PATH),
    entry('"1-P" label', assets.HUD_1P_PATH),
    entry('"TIME" label', assets.HUD_TIME_LABEL_PATH),
    entry('"LEVEL" label', assets.HUD_LEVEL_LABEL_PATH),
    entry('"HI" label', assets.HUD_HI_LABEL_PATH),
    entry('Life icon', assets.HUD_LIFE_PATH),
    entry('Weapon socket frame', assets.HUD_WEAPON_FRAME_PATH),
    ...Object.keys(WEAPON_TYPES).map((type) => entry(`Weapon icon -- ${type}`, assets.hudWeaponIconPath(type))),
  ]);

  add('Screens and menus', [
    entry('Menu/level-intro pixel font (A-Z 0-9 ! : .)', assets.INTRO_FONT_PATH),
    entry('Loading splash', assets.LOADING_TEXTURE_PATH),
    entry('Loading "%" glyph', assets.PERCENT_TEXTURE_PATH),
    entry('World map', assets.WORLDMAP_TEXTURE_PATH),
    entry('World-map plane', assets.PLANE_TEXTURE_PATH),
  ]);

  const backgroundNames = await fetchBackgroundNames();
  add('Backgrounds', [...backgroundNames].sort()
    .map((name) => entry(`Background -- ${name}`, assets.backgroundTexturePath(name))));

  return groups;
}

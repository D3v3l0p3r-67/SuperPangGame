// Every file the game asks for at boot has to actually be there, and
// every sound it plays has to be a name audio.json knows. Both are
// answerable without running anything: the naming conventions live in
// js/assets.js, and the things that reference them are JSON and source
// text. A missing .webp or a mistyped sound name is otherwise a silent
// hole that only shows on the level where it is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elements, exists, readJSON, listFiles, readText } from './helpers.mjs';
import {
  ballTexturePath, ballPopTexturePath, obstacleTexturePath, ladderTexturePath,
  powerupTexturePath, backgroundTexturePath, audioPath, DEFAULT_BACKGROUND,
  MAX_LEVEL_FILES,
} from '../js/assets.js';
import { DAYLIGHT_PHASES, daylightBackground } from '../js/regions.js';

const EL = elements();
const AUDIO = readJSON('assets/audio/audio.json');

test('elements/index.json lists exactly the element files that exist', () => {
  const listed = new Set(readJSON('elements/index.json'));
  const onDisk = new Set(listFiles('elements')
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.slice(0, -'.json'.length)));
  for (const id of listed) assert.ok(onDisk.has(id), `elements/index.json lists "${id}", which has no file`);
  for (const id of onDisk) assert.ok(listed.has(id), `elements/${id}.json exists but is not in index.json`);
});

test('every element has the graphic BootScene will load for it', () => {
  for (const el of EL.balls) {
    assert.ok(exists(ballTexturePath(el.shape, el.size)), `${el.id}: missing ${ballTexturePath(el.shape, el.size)}`);
    assert.ok(exists(ballPopTexturePath(el.shape, el.size)), `${el.id}: missing its pop effect`);
  }
  for (const el of EL.obstacles) {
    assert.ok(exists(obstacleTexturePath(el.tileTexture)), `${el.id}: missing ${obstacleTexturePath(el.tileTexture)}`);
  }
  for (const el of EL.ladders) {
    assert.ok(exists(ladderTexturePath(el.texture)), `${el.id}: missing ${ladderTexturePath(el.texture)}`);
  }
  for (const el of EL.powerups) {
    assert.ok(exists(powerupTexturePath(el.type)), `${el.id}: missing ${powerupTexturePath(el.type)}`);
  }
  assert.ok(exists(backgroundTexturePath(DEFAULT_BACKGROUND)), 'the default background has no file');
});

test('every sound in audio.json has its file, and every file is in audio.json', () => {
  for (const [name, cfg] of Object.entries(AUDIO)) {
    assert.ok(exists(audioPath(cfg.file)), `audio.json's "${name}" points at a missing ${cfg.file}`);
    assert.ok(['sfx', 'ui', 'music'].includes(cfg.category), `"${name}": unknown category ${cfg.category}`);
    assert.ok(['once', 'loop'].includes(cfg.mode), `"${name}": unknown mode ${cfg.mode}`);
    assert.ok(cfg.volume > 0 && cfg.volume <= 1, `"${name}": volume ${cfg.volume} outside 0..1`);
  }
  const configured = new Set(Object.values(AUDIO).map((cfg) => cfg.file));
  for (const file of listFiles('assets/audio').filter((f) => f.endsWith('.ogg'))) {
    assert.ok(configured.has(file), `assets/audio/${file} is not named by audio.json, so nothing can play it`);
  }
});

test('every sound the code plays by name exists in audio.json', () => {
  // The call sites that name a sound as a literal -- audio.play('x') and
  // playMusic('x') -- read straight out of the source. A name that only
  // ever arrives as a variable (a weapon's, a power-up's) is covered by
  // the data checks below instead.
  const played = new Set();
  for (const file of listFiles('js').filter((name) => name.endsWith('.js'))) {
    const source = readText(`js/${file}`);
    for (const match of source.matchAll(/(?:audio\.play|audio\.playMusic|play)\(\s*'([a-z_0-9]+)'\s*\)/g)) {
      // Filter to names audio.json could plausibly own: `play('player-idle')`
      // is an animation, not a sound, and animation keys carry a dash.
      if (!match[1].includes('-')) played.add(match[1]);
    }
  }
  // Sanity: the scan has to be finding things, or it proves nothing.
  assert.ok(played.size > 5, 'the source scan found almost no sound names -- the pattern has drifted');
  for (const name of played) {
    assert.ok(AUDIO[name], `the code plays "${name}", which audio.json does not define`);
  }
});

test('every sound named by data exists too', () => {
  for (const el of EL.powerups) {
    if (!el.pickupSound) continue;
    assert.ok(AUDIO[el.pickupSound], `${el.id}: pickupSound "${el.pickupSound}" is not in audio.json`);
  }
  for (const region of readJSON('levels/regions.json')) {
    assert.ok(AUDIO[region.music], `region ${region.id}: music "${region.music}" is not in audio.json`);
    assert.equal(AUDIO[region.music].mode, 'loop', `region ${region.id}: its music must be a loop`);
  }
});

test('regions each have their continent background, and a marker on the map', () => {
  const regions = readJSON('levels/regions.json');
  assert.ok(regions.length > 0, 'the campaign has no regions');
  for (const region of regions) {
    // Every time of day, not just the authored night frame: a level lands
    // on one of the five by where it falls in its region, so a variant
    // that was never generated is a level with no background at all.
    for (const phase of DAYLIGHT_PHASES) {
      const name = daylightBackground(region.background, phase);
      assert.ok(exists(backgroundTexturePath(name)),
        `region ${region.id}: "${name}" has no file -- rerun tools/daylight_backgrounds.py`);
    }
    assert.ok(Number.isFinite(region.map?.x) && Number.isFinite(region.map?.y),
      `region ${region.id}: needs map x/y`);
    // The marker coordinates are in the map image's own pixels (see the
    // README's "Regions"), so they have to land inside it.
    assert.ok(region.map.x >= 0 && region.map.x <= MAP_W, `region ${region.id}: marker x is off the map`);
    assert.ok(region.map.y >= 0 && region.map.y <= MAP_H, `region ${region.id}: marker y is off the map`);
  }
});

// assets/ui/worldmap.webp's authored size (see scratchpad gen_map2.py /
// the README) -- half the playfield, which is what the interlude scales
// the markers against.
const MAP_W = 400;
const MAP_H = 210;

test('the level files stay within the range BootScene probes', () => {
  const count = listFiles('levels').filter((name) => /^level_\d{2}\.json$/.test(name)).length;
  assert.ok(count <= MAX_LEVEL_FILES,
    `there are ${count} levels but BootScene only probes ${MAX_LEVEL_FILES} -- raise MAX_LEVEL_FILES`);
});

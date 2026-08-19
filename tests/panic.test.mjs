// Panic Mode's balance, checked as arithmetic rather than by playing it.
//
// The hand-written table this replaced was not merely hard, it was
// impossible, and it had been impossible since wave 1 -- which nobody
// noticed, because the numbers looked reasonable one wave at a time. The
// point of these tests is that the mode's playability is a property of
// the file, provable without a browser: a ball costs a known number of
// shots, a shot takes a known time, and a wave that asks for more
// shooting than there is time to do it in can only ever grow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, readText } from './helpers.mjs';
import { buildWaves, checkWaves, waveWork, shotsToClear, ballElements } from '../tools/panic_waves.mjs';

const SPAWN = readJSON('levels/panic.json').panicSpawn;
const TUNING = SPAWN.tuning;

test('a ball costs what the split rule says it costs', () => {
  // Every hit turns one ball into two of the next size down, so clearing
  // a size-N ball away entirely is the whole tree: 2^N - 1 shots. This is
  // the number the whole table is derived from, so it is worth pinning
  // rather than trusting the formula to stay right.
  assert.deepEqual([1, 2, 3, 4, 5].map(shotsToClear), [1, 3, 7, 15, 31]);
});

test('the wave table is what the tuning says it is', () => {
  // Same contract as sw-precache.json: the file is generated, so the
  // check is that somebody reran the generator. Without this, editing
  // the tuning would silently change nothing at all.
  assert.deepEqual(SPAWN.waves, buildWaves(TUNING),
    'levels/panic.json\'s waves are stale -- rerun node tools/panic_waves.mjs');
});

test('every wave can actually be cleared', () => {
  // pressure = the share of the player's shooting time the spawner
  // claims. At 1.0 they would have to land every shot, forever, and
  // never move; over 1.0 the field grows no matter how well they play.
  // checkWaves also rejects a wave that arrives slower than the one
  // before it, and any (shape, size) with no element behind it.
  assert.deepEqual(checkWaves(SPAWN.waves, TUNING, ballElements()), []);
  assert.ok(TUNING.maxPressure < 1,
    'a limit of 1 or more is a mode that cannot be cleared by definition');
});

test('the difficulty ramp actually ramps', () => {
  const pressure = (wave) => waveWork(wave.shapes, TUNING) / wave.intervalSec;
  const first = SPAWN.waves[0];
  const last = SPAWN.waves[SPAWN.waves.length - 1];
  assert.ok(pressure(last) > pressure(first) * 1.5,
    `the last wave presses ${pressure(last).toFixed(2)} against the first's ${pressure(first).toFixed(2)}`
    + ' -- that is not a difficulty curve');
  // And it starts somewhere a player can breathe: the opening wave used
  // to demand 128% of what anyone could shoot.
  assert.ok(pressure(first) <= 0.5,
    `the opening wave already claims ${(pressure(first) * 100).toFixed(0)}% of the player's shooting time`);
});

test('balls keep arriving sooner, down to a floor that is still clearable', () => {
  const intervals = SPAWN.waves.map((w) => w.intervalSec);
  assert.equal(intervals[0], TUNING.startIntervalSec);
  assert.equal(intervals[intervals.length - 1], TUNING.endIntervalSec);
  assert.ok(TUNING.endIntervalSec < TUNING.startIntervalSec, 'the interval has to shrink');
  // The floor is not a number somebody liked the look of: the last wave
  // has to stay under maxPressure like every other, which is what
  // "as fast as it can go and still be survivable" means. checkWaves
  // above is what enforces it; this is the statement of intent.
  const last = SPAWN.waves[SPAWN.waves.length - 1];
  assert.ok(waveWork(last.shapes, TUNING) / last.intervalSec <= TUNING.maxPressure);
  // Holding down shortens the wait (GameScene.updatePanicSpawner), and
  // cannot bring two balls closer than PANIC_HURRY_MIN_GAP -- a floor
  // below that would make the key do nothing on the late waves.
  const floor = Number(readText('js/GameScene.js').match(/const PANIC_HURRY_MIN_GAP = ([\d.]+);/)[1]);
  assert.ok(TUNING.endIntervalSec > floor,
    `the shortest interval (${TUNING.endIntervalSec}s) is at or under the ${floor}s hurry floor`);
});

test('the field is given a chance to be emptied, and not forever', () => {
  assert.ok(SPAWN.restEveryWaves >= 1, 'panic.json needs restEveryWaves');
  assert.ok(SPAWN.restMaxSec > 0, 'a breather with no ceiling would stop the mode on a field nobody can clear');
  const scene = readText('js/GameScene.js');
  assert.match(scene, /panicRestLeft/, 'GameScene has to actually hold the breather');
  assert.match(scene, /restEveryWaves/, 'nothing reads restEveryWaves');
  assert.match(scene, /restMaxSec/, 'nothing reads restMaxSec');
});

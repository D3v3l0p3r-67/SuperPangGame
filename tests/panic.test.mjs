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
import {
  checkWaves, parsePattern, patternBeats, patternBallSteps, waveWork, waveAt, beatFor,
  shotsToClear, emergeSec, ballWork,
} from '../js/panicWaves.js';
import { ballElements } from '../tools/panic_waves.mjs';

const SPAWN = readJSON('levels/panic.json').panicSpawn;
const BALL = ballElements();
const steps = (wave) => parsePattern(wave.spawn, SPAWN.shapeCode, SPAWN.holdMaxSec);

test('a ball costs what the split rule says it costs', () => {
  // Every hit turns one ball into two of the next size down, so clearing
  // a size-N ball away entirely is the whole tree: 2^N - 1 shots. This is
  // the number every wave's cost is built from, so it is worth pinning
  // rather than trusting the formula to stay right.
  assert.deepEqual([1, 2, 3, 4, 5].map(shotsToClear), [1, 3, 7, 15, 31]);
});

test('a pattern says what it does', () => {
  const parsed = parsePattern('r1 . x2 |6 |', { r: 'round', x: 'hex' }, 8);
  assert.deepEqual(parsed, [
    { kind: 'ball', shape: 'round', size: 1 },
    { kind: 'rest' },
    { kind: 'ball', shape: 'hex', size: 2 },
    { kind: 'hold', maxSec: 6 },
    { kind: 'hold', maxSec: 8 }, // no number: the file's own default
  ]);
  // A hold is a condition, not a beat, and never counts towards length.
  assert.equal(patternBeats(parsed), 3);
  // A typo has to fail loudly. Silently skipping an unreadable token
  // would be a wave quietly getting easier, which nobody would notice.
  assert.throws(() => parsePattern('r1 q9', { r: 'round' }, 8), /no shape is coded "q"/);
  assert.throws(() => parsePattern('r1 nonsense', { r: 'round' }, 8), /not a ball/);
});

test('every wave can be cleared, at the tempo it ends up at', () => {
  const { problems, warnings } = checkWaves(SPAWN, BALL);
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
});

test('the check is made against the floor beat, not the authored one', () => {
  // The set repeats faster each time round, so every wave eventually runs
  // at loop.minBeat -- passing at the beat a wave was written at and
  // failing three cycles later would not be passing. This is the property
  // that makes minBeat the mode's one safety number.
  const worst = SPAWN.waves
    .map((wave) => {
      const parsed = steps(wave);
      const beats = patternBeats(parsed);
      return beats ? waveWork(parsed, SPAWN.tuning) / (SPAWN.loop.minBeat * beats) : 0;
    })
    .reduce((max, p) => Math.max(max, p), 0);
  assert.ok(worst <= SPAWN.tuning.maxPressure, `hardest wave presses ${worst.toFixed(2)}`);
  // And it is worth reaching: a floor nothing comes close to would mean
  // the mode never actually gets hard.
  assert.ok(worst > SPAWN.tuning.maxPressure * 0.9,
    `the hardest wave only reaches ${worst.toFixed(2)} of a ${SPAWN.tuning.maxPressure} limit`);
});

test('the difficulty ramp actually ramps', () => {
  const pressure = (wave) => {
    const parsed = steps(wave);
    const beats = patternBeats(parsed);
    return beats ? waveWork(parsed, SPAWN.tuning) / (wave.beat * beats) : null;
  };
  const played = SPAWN.waves.map(pressure).filter((p) => p !== null);
  assert.ok(played[played.length - 1] > played[0] * 2,
    `last wave ${played[played.length - 1].toFixed(2)} against first ${played[0].toFixed(2)}`);
  // And it starts somewhere a player can breathe: the opening wave of the
  // table this replaced demanded 128% of what anyone could shoot.
  assert.ok(played[0] <= 0.35, `the opening wave claims ${(played[0] * 100).toFixed(0)}% already`);
});

test('a beat is long enough for the ball to get through the ceiling', () => {
  // A ball creeps through the border at ceilingSpeedPx and has to travel
  // its own diameter before any of it is loose. A beat shorter than that
  // means the next ball starts through before the last one is out -- the
  // ceiling extruding a stream rather than dropping things. checkWaves
  // warns about it; this is the statement that the shipped set is clear
  // of it even at the floor beat.
  for (const wave of SPAWN.waves) {
    for (const step of steps(wave)) {
      if (step.kind !== 'ball') continue;
      const el = BALL(step.shape, step.size);
      assert.ok(el, `no ${step.shape} ball of size ${step.size}`);
      assert.ok(emergeSec(el.radius, SPAWN.ceilingSpeedPx) <= SPAWN.loop.minBeat,
        `${step.shape} ${step.size} needs ${emergeSec(el.radius, SPAWN.ceilingSpeedPx)}s`
        + ` to emerge, past the ${SPAWN.loop.minBeat}s floor beat`);
    }
  }
});

test('the run never runs out of waves', () => {
  // The counter does not stop at the end of the authored set, so waveAt
  // has to answer for any number at all -- and answer faster each time
  // round, down to the floor.
  const n = SPAWN.waves.length;
  assert.equal(waveAt(0, SPAWN).cycle, 0);
  assert.equal(waveAt(n, SPAWN).cycle, 1);
  assert.deepEqual(waveAt(n * 7 + 2, SPAWN).steps, waveAt(2, SPAWN).steps);
  assert.ok(waveAt(n, SPAWN).beat < waveAt(0, SPAWN).beat, 'a later cycle has to be faster');
  assert.equal(beatFor(3, 999, SPAWN.loop), SPAWN.loop.minBeat, 'and has to stop at the floor');
});

test('the game walks the pattern, and nothing still counts pops', () => {
  const scene = readText('js/GameScene.js');
  assert.match(scene, /waveAt\(this\.panicWaveIndex, spawn\)/, 'GameScene must resolve waves through the model');
  assert.match(scene, /nextPanicStep\(\)/, 'and step through the pattern');
  assert.match(scene, /panicHoldLeft/, 'and hold where a pattern says to');
  // popTarget/intervalSec/restEveryWaves were the old model's, and a
  // leftover reader would silently read undefined.
  for (const gone of ['popTarget', 'intervalSec', 'panicPopCount', 'restEveryWaves', 'panicRestLeft']) {
    assert.doesNotMatch(scene, new RegExp(gone), `GameScene still mentions ${gone}`);
  }
});

// A run of the mode, stepped exactly as GameScene steps it, against a
// player who clears `rate` seconds of shooting per second. 1.0 is the
// player the cost model assumes.
//
// This exists because rest-skipping took the safety property out of
// reach of arithmetic alone. With rests skippable the mode is a feedback
// loop: while the player is behind, the rests play and the wave runs at
// its authored pressure (under the limit, so the backlog drains); while
// they are ahead, the rests vanish and it runs at the pressure of its
// ball steps alone (over 1, so the backlog grows). It settles around the
// skip threshold, and it can only settle because the AUTHORED pressure
// is under 1 -- which is the thing checkWaves checks. This is the test
// that the loop really does settle.
function simulate(spawn, rate, waves) {
  const MIN_GAP = 0.6;
  const dt = 1 / 60;
  let t = 0, waveIndex = 0, step = -1, endsAt = spawn.initialDelaySec, startedAt = 0, hold = 0;
  let cache = null, owed = 0, peak = 0;
  const wave = () => {
    if (cache?.index !== waveIndex) cache = { index: waveIndex, ...waveAt(waveIndex, spawn) };
    return cache;
  };
  const clear = () => owed <= spawn.skipRestUnderSec;
  const next = () => {
    step += 1;
    if (step >= wave().steps.length) { waveIndex += 1; step = 0; }
    const w = wave(), s = w.steps[step];
    startedAt = t;
    if (s.kind === 'hold') { hold = s.maxSec; endsAt = Infinity; return; }
    if (s.kind === 'ball') owed += ballWork(s.shape, s.size, spawn.tuning);
    endsAt = t + w.beat;
  };
  while (waveIndex < waves && t < 40000) {
    t += dt;
    owed = Math.max(0, owed - dt * rate);
    peak = Math.max(peak, owed);
    if (hold > 0) { hold -= dt; if (!(hold > 0 && !clear())) { hold = 0; next(); } }
    else if (wave().steps[step]?.kind === 'rest' && clear() && t >= startedAt + MIN_GAP) next();
    else if (t >= endsAt) next();
  }
  return { minutes: t / 60, peak, finished: waveIndex >= waves };
}

test('skipping rests cannot run away with the field', () => {
  // Three cycles of the set, for players from below the model's
  // assumption to far above it. What must hold is that the backlog stays
  // BOUNDED -- if skipping could outpace recovery, a better player would
  // be buried by their own speed, which would be an absurd mode.
  for (const rate of [0.7, 1, 1.5, 3]) {
    const run = simulate(SPAWN, rate, SPAWN.waves.length * 3);
    assert.ok(run.finished, `a player clearing ${rate}x never got through three cycles`);
    // One straggler under the threshold plus the biggest single ball a
    // pattern holds is the most that can be owed at once.
    assert.ok(run.peak < 15, `a player clearing ${rate}x fell ${run.peak.toFixed(1)}s behind`);
  }
});

test('the authored pattern is what makes recovery possible', () => {
  // The ball steps alone -- every rest skipped -- run OVER the limit, and
  // that is fine: reaching that state means the field is clear, i.e. the
  // player is ahead. What matters is that the pattern they fall back to
  // when they are not ahead can dig them out again, which is the
  // maxPressure check. If the authored pressure were also over 1 there
  // would be no way back and the mode would be the old broken one.
  for (const wave of SPAWN.waves) {
    const parsed = steps(wave);
    const beats = patternBeats(parsed);
    if (!beats) continue;
    const work = waveWork(parsed, SPAWN.tuning);
    assert.ok(work / (SPAWN.loop.minBeat * beats) < 1,
      `wave with pattern "${wave.spawn}" cannot recover at the floor beat`);
    assert.ok(patternBallSteps(parsed) < beats,
      `pattern "${wave.spawn}" is all balls -- it has no rests to fall back on`);
  }
});

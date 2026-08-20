// Checks Panic Mode's wave patterns and prints what they add up to.
//
//     node tools/panic_waves.mjs
//
// Nothing is generated any more: levels/panic.json holds the waves as
// written, and this reads them. What it does is the part a person cannot
// do by looking -- work out what each pattern COSTS and say whether it
// can be cleared. Exits non-zero on a problem, so it can gate a release;
// tests/panic.test.mjs runs the same checks over the same file.
//
// The model itself is js/panicWaves.js, shared with the game so the
// thing being checked and the thing being played cannot come apart. See
// that file for what pressure means and why holds are left out of it.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  checkWaves, parsePattern, patternBeats, patternBallSteps, waveWork, emergeSec,
} from '../js/panicWaves.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The ball elements, so a token can be checked against a real ball and
// its radius (which is what decides how long it takes to squeeze through
// the ceiling).
export function ballElements() {
  const dir = join(ROOT, 'elements');
  const balls = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const el = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (el.category === 'ball') balls.push(el);
  }
  return (shape, size) => balls.find((el) => el.shape === shape && el.size === size) ?? null;
}

const spawn = JSON.parse(readFileSync(join(ROOT, 'levels', 'panic.json'), 'utf8')).panicSpawn;
const ball = ballElements();
const { problems, warnings } = checkWaves(spawn, ball);

// "rush" is the wave with every skippable rest skipped -- what a player
// who clears each ball as it lands actually gets. It is not a limit
// anything is checked against, because reaching it MEANS keeping up: the
// rests come back the instant they stop doing so (see panicWaves.js).
console.log('wave  beats  length  balls   work  now   floor   rush  pattern');
spawn.waves.forEach((wave, i) => {
  const steps = parsePattern(wave.spawn, spawn.shapeCode, spawn.holdMaxSec);
  const beats = patternBeats(steps);
  const n = String(i + 1).padStart(4);
  if (!beats) {
    console.log(`${n}      -       -      -      -    -       -      -  ${wave.spawn}   (breather)`);
    return;
  }
  const work = waveWork(steps, spawn.tuning);
  const balls = steps.filter((s) => s.kind === 'ball').length;
  // Two pressures, because a wave is played at two different tempos over
  // a long run: the beat it was written at (its first time round) and the
  // floor beat it ends up at once the set has looped enough times. The
  // second is the one that has to stay under the limit.
  console.log(`${n}  ${String(beats).padStart(5)}  ${`${(wave.beat * beats).toFixed(0)}s`.padStart(6)}`
    + `  ${String(balls).padStart(5)}  ${`${work.toFixed(1)}s`.padStart(5)}`
    + `  ${(work / (wave.beat * beats)).toFixed(2)}  ${(work / (spawn.loop.minBeat * beats)).toFixed(2).padStart(6)}`
    + `  ${(work / (spawn.loop.minBeat * patternBallSteps(steps))).toFixed(2).padStart(5)}`
    + `  ${wave.spawn}`);
});

const sizes = new Set();
for (const wave of spawn.waves) {
  for (const step of parsePattern(wave.spawn, spawn.shapeCode, spawn.holdMaxSec)) {
    if (step.kind === 'ball') sizes.add(`${step.shape} ${step.size}`);
  }
}
console.log('\nballs used, and how long each takes to come through the ceiling:');
for (const key of [...sizes].sort()) {
  const [shape, size] = key.split(' ');
  const el = ball(shape, Number(size));
  if (el) console.log(`  ${key}  ${emergeSec(el.radius, spawn.ceilingSpeedPx).toFixed(1)}s`);
}

for (const warning of warnings) console.log(`\nwarning: ${warning}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nok -- ${spawn.waves.length} waves, floor beat ${spawn.loop.minBeat}s,`
  + ` limit ${spawn.tuning.maxPressure}, rests skipped under ${spawn.skipRestUnderSec}s of work left`);

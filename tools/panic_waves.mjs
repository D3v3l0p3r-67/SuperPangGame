// Writes the wave table in levels/panic.json from the tuning block that
// sits beside it.
//
//     node tools/panic_waves.mjs
//
// Run it after editing `panicSpawn.tuning`. tests/panic.test.mjs
// recomputes the table and fails if it has drifted from the tuning, so a
// forgotten run is caught rather than shipped.
//
// WHY THE TABLE IS GENERATED
//
// It used to be written by hand, and it was not hard, it was arithmetic
// that could not be won. A ball of size N takes 2^N - 1 shots to clear
// away entirely -- 1, 3, 7, 15, 31 -- because every hit replaces one ball
// with two smaller ones. Hand-written, the table reached size 5 balls
// (31 shots, over a minute of shooting each) arriving every 1.9 seconds.
// Wave 1 asked for 128% of what a player could shoot; wave 50 asked for
// 2100%. No amount of skill closes a gap like that, and nothing in the
// file said so -- the numbers looked reasonable one at a time.
//
// So the interval is not authored any more. It is DERIVED from what the
// wave actually costs to clear, and the cost is derived from the split
// rule. What is authored is the pressure the mode is allowed to put on
// the player, which is the thing a designer actually has an opinion
// about.
//
// THE MODEL
//
//   cost(size)          = 2^size - 1          shots to clear it entirely
//   work(shape, size)   = cost * shotTimeSec * effort[shape]
//   waveWork            = the weighted mean of work over the wave's mix
//   pressure(wave)      = waveWork / intervalSec
//
// pressure is the fraction of the player's shooting time the spawner
// claims. At 1.0 they must land every shot, perfectly, forever, and
// never move. Below 1.0 the difference is what is left for dodging,
// missing, and walking somewhere -- so `maxPressure` is precisely "the
// point past which the field can no longer be cleared", and the build
// FAILS rather than crossing it.
//
// Note what the model forces, because it is not obvious: interval and
// ball size cannot both grow. A wave of bigger balls MUST arrive less
// often to stay clearable. Since the mode wants the opposite -- balls
// arriving sooner and sooner -- the mixes get SMALLER as the run goes
// on, and the escalation is carried by frequency and by evasiveness
// (weave, hunter: the same one shot, harder to land). A stream of size-1
// hunters every 2.6s is a harder thing to survive than a size-5 ball
// every 5s, and unlike the size-5 ball it is a thing that can be
// survived.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVEL = join(ROOT, 'levels', 'panic.json');

// Shots to take a ball of this size off the field entirely. Every hit
// splits one ball into two of the next size down, so this is the whole
// tree, not the one shot the player is aiming right now.
export const shotsToClear = (size) => 2 ** size - 1;

// One wave's expected seconds of shooting per ball, over its own mix.
export function waveWork(shapes, tuning) {
  const total = shapes.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  return shapes.reduce((sum, e) => {
    const effort = tuning.shapeEffort[e.shape] ?? 1;
    return sum + (e.weight ?? 1) * shotsToClear(e.size) * tuning.shotTimeSec * effort;
  }, 0) / total;
}

const lerp = (a, b, t) => a + (b - a) * t;
const round = (n, places = 3) => Number(n.toFixed(places));

// The stage covering this wave: the last one that has started. Stages are
// the authored part -- which balls turn up when -- and they carry no
// timing at all.
function stageFor(wave, stages) {
  let current = stages[0];
  for (const stage of stages) {
    if (stage.fromWave <= wave) current = stage;
  }
  return current;
}

export function buildWaves(tuning) {
  const waves = [];
  for (let i = 0; i < tuning.waveCount; i++) {
    // Both ramps run over the whole table, so the tuning's start/end
    // values are exactly what waves 1 and waveCount get.
    const t = tuning.waveCount === 1 ? 0 : i / (tuning.waveCount - 1);
    const intervalSec = round(lerp(tuning.startIntervalSec, tuning.endIntervalSec, t));
    const shapes = stageFor(i + 1, tuning.stages).shapes
      .map(([shape, size, weight]) => ({ shape, size, weight }));
    waves.push({
      popTarget: Math.round(lerp(tuning.popTargetStart, tuning.popTargetEnd, t)),
      intervalSec,
      shapes,
    });
  }
  return waves;
}

// Everything the generated table has to be true of, checked here so the
// tool refuses to write a table the mode cannot be played on. The test
// suite runs the same function over the shipped file.
export function checkWaves(waves, tuning, ballExists = () => true) {
  const problems = [];
  let previous = Infinity;
  for (const [i, wave] of waves.entries()) {
    const where = `wave ${i + 1}`;
    for (const { shape, size } of wave.shapes) {
      if (!ballExists(shape, size)) problems.push(`${where}: there is no ${shape} ball of size ${size}`);
    }
    const pressure = waveWork(wave.shapes, tuning) / wave.intervalSec;
    if (pressure > tuning.maxPressure) {
      problems.push(`${where}: pressure ${pressure.toFixed(2)} is over the ${tuning.maxPressure} limit`
        + ` -- its mix costs ${waveWork(wave.shapes, tuning).toFixed(1)}s of shooting per ball`
        + ` and it arrives every ${wave.intervalSec}s, so the field can only grow`);
    }
    if (wave.intervalSec > previous) {
      problems.push(`${where}: arrives every ${wave.intervalSec}s, slower than the ${previous}s before it`);
    }
    previous = wave.intervalSec;
  }
  return problems;
}

// Which (shape, size) pairs actually exist as elements, so a stage cannot
// name a ball the game would fail to spawn.
export function ballElements() {
  const dir = join(ROOT, 'elements');
  const have = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const el = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (el.category === 'ball') have.add(`${el.shape}-${el.size}`);
  }
  return (shape, size) => have.has(`${shape}-${size}`);
}

// Run as a script, not when imported -- tests/panic.test.mjs imports the
// functions above to recompute the table and compare, and must not write
// the file while doing it.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const level = JSON.parse(readFileSync(LEVEL, 'utf8'));
  const { tuning } = level.panicSpawn;
  const waves = buildWaves(tuning);

  const problems = checkWaves(waves, tuning, ballElements());
  if (problems.length) {
    console.error('panic tuning does not produce a playable table:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  level.panicSpawn.waves = waves;
  writeFileSync(LEVEL, `${JSON.stringify(level, null, 2)}\n`);

  // The curve, so a tuning change can be read rather than guessed at.
  console.log('wave  every  balls  work/ball  pressure  mix');
  for (const i of [0, 9, 24, 49, 74, tuning.waveCount - 1]) {
    const wave = waves[i];
    const work = waveWork(wave.shapes, tuning);
    const mix = wave.shapes.map((s) => `${s.shape}${s.size}x${s.weight}`).join(' ');
    console.log(`${String(i + 1).padStart(4)}  ${`${wave.intervalSec}s`.padStart(5)}`
      + `  ${String(wave.popTarget).padStart(5)}  ${`${work.toFixed(1)}s`.padStart(9)}`
      + `  ${(work / wave.intervalSec).toFixed(2).padStart(8)}  ${mix}`);
  }
}

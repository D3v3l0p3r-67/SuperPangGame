// Panic Mode's waves: what they are made of, how long they take, and
// whether they can be cleared.
//
// This is the whole model, and it lives here rather than in a build tool
// because three different things need it and none of them may disagree
// about it: GameScene runs the waves, tools/panic_waves.mjs checks and
// converts them, and the tests re-check what shipped. No Node imports,
// no Phaser -- a browser, a build script and a test runner can all load
// it.
//
// A WAVE IS A RHYTHM
//
// Each wave is a beat length and a pattern of tokens, one token per
// beat, which reads as what it does:
//
//   { "beat": 3, "spawn": "r1 . r1 . x2 . h1 . |8" }
//
//   r1     drop a round ball of size 1, then wait one beat
//   .      wait one beat, dropping nothing
//   |8     HOLD here while the field still has balls on it, up to 8s
//
// A PATTERN IS THE SLOWEST THE WAVE CAN GO
//
// Waiting on an empty field is the least interesting thing this mode can
// ask of anyone, so it does not: a rest is skipped, and a hold released,
// once the field holds less than `skipRestUnderSec` of shooting -- the
// same measure the patterns themselves are costed in, so "nearly clear"
// means one straggler rather than a ball count.
//
// That is a rule about the FIELD, not about where a token sits, which is
// what keeps the notation readable: `.` still means the same thing
// everywhere, and what a pattern describes is the wave at its slowest.
//
// It cannot run away with itself either, and the reason is worth
// stating: skipping is only possible while the player is ahead, and it
// stops the instant they are not. A wave cannot compress itself into
// something its player was not already clearing.
//
// Ball tokens and rests both take exactly one beat -- that is what makes
// the pattern a grid you can read down a column of. A hold is not a beat
// at all: it is a condition, it takes zero time on a field that is
// already clear, and it never counts towards the wave's length.
//
// WHY A HOLD IS A SEPARATE TOKEN
//
// The trailing silence of a wave exists so the player can finish what is
// on the field. Making `.` mean "a beat, unless the field is empty, in
// which case skip it" would have been the obvious shortcut and it would
// have ruined the notation: a symbol whose meaning depends on where it
// sits cannot be read. So the two are separate, and what a pattern says
// is what happens.
//
// The hold's cap is not a nicety. A field nobody can clear would
// otherwise stop the mode dead, which is the same reason the rest that
// came before this had a maximum.
//
// WHAT IT COSTS, AND WHY THAT IS CHECKABLE
//
// Every hit replaces one ball with two of the next size down, so taking
// a ball off the field entirely is the whole tree beneath it: 2^N - 1
// shots. At `shotTimeSec` a shot, a wave's pattern costs a known number
// of seconds of shooting, and it hands them over across a known number
// of beats:
//
//   pressure = work / (beat * beats in the pattern)
//
// which is the share of the player's shooting time the ceiling claims.
// At 1.0 they must land every shot, forever, and never move. Everything
// below 1.0 is what is left for dodging, missing, and walking somewhere.
//
// Holds are left out of that denominator ON PURPOSE. A hold can only
// ever give the player more time, so counting it would make the check
// optimistic -- and a check you only pass because the player was
// struggling is not a check. The same goes for the seconds a ball spends
// squeezing through the ceiling: it delays the threat, so it is slack,
// and slack is not counted.

// Shots to clear a ball of this size away entirely -- the whole split
// tree, not the one hit that is being aimed right now.
export const shotsToClear = (size) => 2 ** size - 1;

// How long a ball of this radius takes to come the whole way through the
// ceiling, creeping at `ceilingSpeedPx` (see GameScene.spawnPanicBall).
// It has to travel its own diameter before any of it is loose.
export const emergeSec = (radius, ceilingSpeedPx) => (radius * 2) / ceilingSpeedPx;

const BALL_TOKEN = /^([a-z])([1-9])$/;
const HOLD_TOKEN = /^\|(\d+(?:\.\d+)?)?$/;

// A pattern string into the steps it means. Throws on a token it cannot
// read rather than skipping it: a typo that silently dropped a ball
// would be a wave quietly getting easier, which is exactly the kind of
// thing nobody notices.
export function parsePattern(spawn, shapeCode, holdMaxSec) {
  return String(spawn).trim().split(/\s+/).filter(Boolean).map((token) => {
    if (token === '.') return { kind: 'rest' };
    const hold = HOLD_TOKEN.exec(token);
    if (hold) return { kind: 'hold', maxSec: hold[1] === undefined ? holdMaxSec : Number(hold[1]) };
    const ball = BALL_TOKEN.exec(token);
    if (!ball) throw new Error(`"${token}" is not a ball, a rest (.) or a hold (|)`);
    const shape = shapeCode[ball[1]];
    if (!shape) throw new Error(`"${token}": no shape is coded "${ball[1]}"`);
    return { kind: 'ball', shape, size: Number(ball[2]) };
  });
}

// The steps that take a beat each. A hold is not one of them.
export const patternBeats = (steps) => steps.filter((s) => s.kind !== 'hold').length;

// Seconds of shooting one ball is worth: its whole split tree, at the
// working average, weighted by how hard that shape is to actually hit.
// The game measures the LIVE field with this too (see
// GameScene.fieldWork), which is what lets it tell "nearly clear" from
// "there is still a size-2 up there".
export function ballWork(shape, size, tuning) {
  return shotsToClear(size) * tuning.shotTimeSec * (tuning.shapeEffort[shape] ?? 1);
}

// Seconds of shooting the whole pattern asks for.
export function waveWork(steps, tuning) {
  return steps.reduce((sum, step) => (
    step.kind === 'ball' ? sum + ballWork(step.shape, step.size, tuning) : sum
  ), 0);
}

// The beats a pattern would take if every rest it can skip WERE skipped
// -- see the note on skipping in checkWaves. Ball steps always take
// their beat; rests only take one when there is something left to rest
// for.
export const patternBallSteps = (steps) => steps.filter((s) => s.kind === 'ball').length;

// The beat an authored wave runs at on its `cycle`-th time round.
//
// The mode is endless and the authored set is not: rather than repeat it
// unchanged forever (which stops being a difficulty curve the moment it
// starts over), each cycle tightens the beat by `beatScale` until it
// reaches `minBeat` and stays there. So `minBeat` is where every wave
// eventually lives, which makes it THE safety number -- see checkWaves,
// which tests every wave at that floor rather than at what it was
// written at.
export function beatFor(beat, cycle, loop) {
  return Math.max(loop.minBeat, beat * loop.beatScale ** cycle);
}

// Any wave number at all, however far past the authored set it is: the
// counter does not stop (see GameScene.advancePanicProgress), so this
// cannot either.
export function waveAt(index, spawn) {
  const { waves } = spawn;
  const cycle = Math.floor(index / waves.length);
  const wave = waves[index % waves.length];
  const steps = parsePattern(wave.spawn, spawn.shapeCode, spawn.holdMaxSec);
  return { steps, beat: beatFor(wave.beat, cycle, spawn.loop), cycle };
}

// Everything a wave table has to be true of. Returns problems (a mode
// that cannot be played) and warnings (a mode that plays differently
// from how it reads) separately, because only one of the two should stop
// a build.
//
// `ball(shape, size)` gives the element behind a token, or null.
export function checkWaves(spawn, ball) {
  const problems = [];
  const warnings = [];
  const { tuning, loop } = spawn;

  spawn.waves.forEach((wave, i) => {
    const where = `wave ${i + 1}`;
    let steps;
    try {
      steps = parsePattern(wave.spawn, spawn.shapeCode, spawn.holdMaxSec);
    } catch (err) {
      problems.push(`${where}: ${err.message}`);
      return;
    }
    const beats = patternBeats(steps);
    if (beats === 0) {
      // A wave of nothing but holds never ends: no beats means no time
      // passing, and the wave only moves on when its pattern is spent.
      if (!steps.some((s) => s.kind === 'hold')) problems.push(`${where}: has no steps at all`);
      else if (steps.length !== 1) problems.push(`${where}: holds only -- a breather is one hold, not several`);
      return;
    }

    let biggest = 0;
    for (const step of steps) {
      if (step.kind !== 'ball') continue;
      const el = ball(step.shape, step.size);
      if (!el) {
        problems.push(`${where}: there is no ${step.shape} ball of size ${step.size}`);
        continue;
      }
      biggest = Math.max(biggest, emergeSec(el.radius, spawn.ceilingSpeedPx));
    }

    // Checked at the floor beat, not the authored one: every wave ends up
    // there, so that is the case that has to hold. Passing at the beat it
    // was written at and failing three cycles later is not passing.
    const work = waveWork(steps, tuning);
    const pressure = work / (loop.minBeat * beats);
    if (pressure > tuning.maxPressure) {
      problems.push(`${where}: at the ${loop.minBeat}s floor beat its pressure is ${pressure.toFixed(2)},`
        + ` over the ${tuning.maxPressure} limit -- ${work.toFixed(1)}s of shooting handed over in`
        + ` ${(loop.minBeat * beats).toFixed(1)}s, so the field can only grow`);
    }

    // A beat shorter than the biggest ball's emergence means the next
    // ball starts through the ceiling before the last one is out: the
    // ceiling extrudes a stream rather than dropping things. Legible, not
    // broken -- hence a warning.
    if (biggest > loop.minBeat) {
      warnings.push(`${where}: its biggest ball takes ${biggest.toFixed(1)}s to come through the ceiling,`
        + ` longer than the ${loop.minBeat}s floor beat -- late cycles will run them together`);
    }
    if (steps[steps.length - 1].kind !== 'hold') {
      // The last ball of a pattern is still emerging when the beats run
      // out, so without a hold the next wave starts on top of it.
      warnings.push(`${where}: ends on a ${steps[steps.length - 1].kind} rather than a hold,`
        + ' so the next wave starts while its last ball is still coming through');
    }
  });

  if (!(loop.beatScale > 0 && loop.beatScale <= 1)) {
    problems.push(`loop.beatScale ${loop.beatScale} must be over 0 and at most 1 -- above 1 would slow down`);
  }
  if (!(tuning.maxPressure < 1)) {
    problems.push('tuning.maxPressure of 1 or more is a mode that cannot be cleared by definition');
  }
  return { problems, warnings };
}

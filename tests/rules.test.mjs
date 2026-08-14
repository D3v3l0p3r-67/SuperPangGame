// The game's pure decisions, tested as functions rather than through a
// running game: the geometry every placement depends on, where a level
// says the player starts, and what the keyboard is bound to. None of
// these touch Phaser, a canvas or a DOM -- which is exactly why they are
// worth pinning here instead of in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIRTUAL_W, VIRTUAL_H, GROUND_Y, PLAYFIELD_H, HUD_H,
  BORDER_THICKNESS, OBSTACLE_BLOCK_SIZE, ZOOM_LEVELS, ZOOM_FIT, DEFAULT_ZOOM,
} from '../js/constants.js';
import { PLAYER_CONFIG, PLAYER_STEP_UP_PX, LEVEL_TRANSITION, LEVELS_PER_REGION } from '../js/config.js';
import { DEFAULT_BINDINGS, ACTIONS, keyLabel } from '../js/keys.js';
import { DAYLIGHT_PHASES, daylightPhaseForLevel } from '../js/regions.js';
import { formatLevelTime } from '../js/storage.js';
import { readJSON, levelFiles } from './helpers.mjs';

// The transition registry is data, but the module it lives in converts a
// palette colour at import time, and that conversion goes through Phaser
// (see js/colors.js -- deliberately the one file that needs the global).
// A three-line stand-in is enough to read the registry without a browser;
// the import has to be dynamic so it happens after the stub exists.
globalThis.Phaser ??= {
  Display: { Color: { HexStringToColor: (hex) => ({ color: parseInt(hex.slice(1), 16) }) } },
};
const { LEVEL_TRANSITIONS, LevelTransition } = await import('../js/LevelTransition.js');

// A scene thin enough to run a whole transition with no browser. The
// effects only ever touch a Graphics they paint into, or two stills they
// move; nothing below looks at what was drawn, because the test is about
// the CLOCK rather than the picture.
function stubScene() {
  const object = (extra = {}) => {
    const self = {
      x: 0, y: 0,
      setDepth: () => self, setVisible: () => self, setOrigin: () => self, setMask: () => self,
      clear: () => self, fillStyle: () => self, fillRect: () => self, draw: () => self,
      createGeometryMask: () => ({}), destroy: () => {},
      ...extra,
    };
    return self;
  };
  return {
    add: { graphics: () => object(), renderTexture: () => object() },
    make: { graphics: () => object() },
    children: { list: [] },
    audio: { play: () => {} },
  };
}

test('the playfield is a whole number of grid cells, ceiling to ground', () => {
  const interior = GROUND_Y - BORDER_THICKNESS;
  assert.equal(interior % OBSTACLE_BLOCK_SIZE, 0,
    'the interior must divide into whole cells, or one row ends up a different height from the rest '
    + '-- which breaks the step-up that makes a stack of blocks a staircase');
  assert.equal(PLAYFIELD_H, GROUND_Y + BORDER_THICKNESS);
  assert.equal(HUD_H, VIRTUAL_H - PLAYFIELD_H);
  assert.ok(HUD_H >= 80, `the HUD strip is down to ${HUD_H}px`);
  assert.equal(VIRTUAL_W % OBSTACLE_BLOCK_SIZE, 0);
});

test('a step is one block, and the player fits inside the playfield', () => {
  assert.equal(PLAYER_STEP_UP_PX, OBSTACLE_BLOCK_SIZE,
    'a step up is one obstacle block -- the two constants are the same rule seen twice');
  assert.ok(PLAYER_CONFIG.hitboxWidth <= PLAYER_CONFIG.spriteWidth);
  assert.ok(PLAYER_CONFIG.hitboxHeight <= PLAYER_CONFIG.spriteHeight);
  assert.ok(PLAYER_CONFIG.spriteHeight < GROUND_Y - BORDER_THICKNESS,
    'the player must fit standing between the floor and the ceiling');
});

test('the display sizes are the ones the options screen offers', () => {
  assert.ok(ZOOM_LEVELS.includes(DEFAULT_ZOOM), 'the default zoom must be one of the fixed levels');
  assert.ok(!ZOOM_LEVELS.includes(ZOOM_FIT), 'FIT is not a fixed level; it is resolved per window');
  assert.equal(typeof ZOOM_FIT, 'string', 'FIT has to be distinguishable from a number');
});

test('the configured level transition exists, and every effect is one kind or the other', () => {
  assert.ok(LEVEL_TRANSITIONS[LEVEL_TRANSITION],
    `config names "${LEVEL_TRANSITION}", which is not a LEVEL_TRANSITIONS entry`);
  for (const [name, effect] of Object.entries(LEVEL_TRANSITIONS)) {
    assert.ok(effect.label, `${name}: needs a label for the debug picker`);
    assert.ok(effect.durationSec > 0, `${name}: needs a duration`);
    const kinds = [typeof effect.draw === 'function', typeof effect.place === 'function'];
    assert.equal(kinds.filter(Boolean).length, 1,
      `${name}: an effect either paints over the playfield (draw) or moves the levels (place), not both or neither`);
  }
});

test('the level countdown never opens before the transition has finished', () => {
  // The level is swapped in at the COVERED moment, which is nowhere near
  // the end of the effect -- halfway through for the ones that paint over
  // the playfield, and the very first frame for a sliding one, which has
  // nothing to hide behind until the next level exists. So the "3, 2, 1,
  // GO!" countdown cannot simply start there: READY would sound, and SET
  // and GO! tick down, over a level still sliding off the screen.
  //
  // GameScene.advanceLevel holds the countdown for transition.remainingSec
  // and its LEVEL_INTRO case re-reads that every frame; this replays that
  // arrangement against every registered effect, in the order the real
  // update() runs the two clocks in -- the intro's first, the transition's
  // at the end of the frame.
  const DT = 1 / 60;
  const EPS = 1e-9;
  for (const name of Object.keys(LEVEL_TRANSITIONS)) {
    const transition = new LevelTransition(stubScene());
    let hold = null;
    transition.start(name, () => { hold = transition.remainingSec; });

    let frames = 0;
    while (transition.active) {
      assert.ok(++frames < 600, `${name}: the effect never ends`);
      if (hold !== null) {
        const left = transition.remainingSec;
        hold = Math.max(hold, left) - DT;
        // The frame the hold runs out is the frame READY sounds on, and
        // the transition's own clock is only ticked below -- so the
        // earliest it may honestly do that is the frame the effect ends.
        if (hold <= 0) {
          assert.ok(left <= DT + EPS,
            `${name}: READY opens with ${left.toFixed(3)}s of the effect still to play`);
        }
      }
      transition.update(DT);
    }
    assert.ok(hold !== null, `${name}: the next level is never swapped in`);
    // And not held past it either: a hold still worth more than the frame
    // the effect ended on would be dead air between the two.
    assert.ok(hold <= DT + EPS,
      `${name}: the countdown is still held ${hold.toFixed(3)}s after the effect finished`);
  }
});

test('there is a region for every block of levels the campaign plays', () => {
  const levelCount = levelFiles().length;
  const regions = readJSON('levels/regions.json');
  const needed = Math.ceil(levelCount / LEVELS_PER_REGION);
  assert.equal(regions.length, needed,
    `${levelCount} levels at ${LEVELS_PER_REGION} per region needs ${needed} regions, but regions.json has ${regions.length}`
    + ' -- a run that reaches a block with no region has nowhere to fly to');
});

test('a level time reads as a clock the pixel font can draw', () => {
  // The record is drawn with the intro font on the level cards, which has
  // digits, ":" and "." and nothing else (see assets.js INTRO_FONT_CHARS).
  const drawable = /^[0-9:.-]+$/;
  const cases = [
    [0, '0:00.00'], [9.5, '0:09.50'], [12.345, '0:12.35'], [59.999, '1:00.00'],
    [61.2, '1:01.20'], [125, '2:05.00'],
  ];
  for (const [seconds, expected] of cases) {
    assert.equal(formatLevelTime(seconds), expected, `${seconds}s`);
    assert.match(formatLevelTime(seconds), drawable);
  }
  assert.equal(formatLevelTime(12.99, false), '0:12', 'the level list drops the hundredths, it does not round up into them');
  assert.equal(formatLevelTime(null), '--:--', 'a level with no record still needs something to draw');
  assert.equal(formatLevelTime(-1), '--:--');
});

test('a region is one day long, and every region starts it over', () => {
  const phases = [];
  for (let i = 0; i < LEVELS_PER_REGION; i++) phases.push(daylightPhaseForLevel(i));
  assert.equal(phases[0], DAYLIGHT_PHASES[0], 'a region has to open in the morning');
  assert.equal(phases[phases.length - 1], DAYLIGHT_PHASES[DAYLIGHT_PHASES.length - 1],
    'and end at night -- the last level of a region is the last of its day');
  for (let i = 1; i < phases.length; i++) {
    assert.ok(DAYLIGHT_PHASES.indexOf(phases[i]) >= DAYLIGHT_PHASES.indexOf(phases[i - 1]),
      `level ${i + 1} of a region is ${phases[i]}, earlier in the day than the level before it`);
  }
  assert.equal(daylightPhaseForLevel(LEVELS_PER_REGION), DAYLIGHT_PHASES[0],
    'the next continent is a new day, not a continuation of the last one');
});

test('every action has exactly one default key, and no key does two jobs', () => {
  const seen = new Map();
  for (const { id, label } of ACTIONS) {
    assert.ok(label, `${id}: needs a label for the CONTROLS screen`);
    const code = DEFAULT_BINDINGS[id];
    assert.ok(typeof code === 'string' && code.length > 0, `${id}: has no default key`);
    assert.ok(!seen.has(code), `${code} is the default for both ${seen.get(code)} and ${id}`);
    seen.set(code, id);
  }
  assert.equal(Object.keys(DEFAULT_BINDINGS).length, ACTIONS.length,
    'DEFAULT_BINDINGS and ACTIONS must describe the same set of actions');
});

test('up climbs and does not shoot', () => {
  assert.notEqual(DEFAULT_BINDINGS.up, DEFAULT_BINDINGS.shoot,
    'sharing a key made shooting unreliable anywhere near a ladder');
});

test('every key label is something the menu font can actually draw', () => {
  // The font is letters, digits and three punctuation marks (see
  // assets.js INTRO_FONT_CHARS), so a label outside that set would render
  // as blanks on the CONTROLS screen.
  const drawable = /^[A-Z0-9 !:.]+$/;
  const codes = [...Object.values(DEFAULT_BINDINGS), 'KeyJ', 'Digit4', 'ShiftLeft', 'NumpadEnter', ''];
  for (const code of codes) {
    const label = keyLabel(code);
    assert.ok(label.length > 0, `${code}: empty label`);
    assert.ok(drawable.test(label) || label === '...', `${code}: label "${label}" has glyphs the font lacks`);
  }
});

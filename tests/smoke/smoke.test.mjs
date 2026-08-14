// The tests that need a real browser: does the game start, does every
// level it ships actually run, and do the few things a player does in the
// first minute still work.
//
//     npm install && npm run test:smoke
//
// Everything in ../ answers its question WITHOUT running the game, which
// is what makes that suite fast. This one exists because the bugs that
// have actually reached players were all of the other kind -- a
// spritesheet whose frames had moved, a ladder with no headroom at the
// top, a countdown that opened over a level still sliding off screen.
// None of those are visible in a JSON file; all of them are visible
// within a second of the game being on screen.
//
// It is deliberately shallow. It is not here to replace playing the game,
// it is here to notice that the game is broken -- so it presses on
// everything once rather than on anything twice, and each test says what
// a player would have seen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';
import { levelFiles } from '../helpers.mjs';

const LEVEL_COUNT = levelFiles().length;

// One browser for the file. Starting Chromium costs more than every test
// in here put together, and none of them leaves the game in a state the
// next one cannot set up from.
let game;
test.before(async () => { game = await openGame(); });
test.after(async () => { await game?.close(); });

// Anything thrown or logged as an error since the last check, cleared as
// it is read so each test only ever reports its own.
function drainErrors() {
  const found = game.errors.splice(0, game.errors.length);
  return found.join('\n');
}

test('the game boots into its menu with nothing thrown', async () => {
  const state = await game.scene((s) => s.state);
  assert.equal(state, 'MENU', 'the game should come up on the main menu');
  assert.equal(drainErrors(), '', 'nothing may be thrown or logged as an error on the way in');
});

test('every level in the campaign loads and runs', async () => {
  // The one test worth the whole file. A level is data, and the data
  // tests already check its shape -- what they cannot check is that it
  // BUILDS: that its background loaded under the name it asks for, that
  // its obstacles and balls become real objects, and that a few frames of
  // the real update loop over them throws nothing.
  const report = await game.scene(async (s, count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      s.levelIndex = i;
      s.loadLevel(i);
      s.state = 'PLAYING';
      // Two frames: one to build, one to simulate over what was built.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push({
        level: i + 1,
        name: s.currentLevelDef?.name ?? null,
        balls: s.balls.countActive(true),
        obstacles: s.obstacles.countActive(true),
        // The texture the background image actually ended up on. A level
        // naming one that never loaded shows here as the fallback
        // Phaser hands out, which no level should ever be sitting on.
        background: s.backgroundImage.texture.key,
        playerX: Math.round(s.player.x),
        playerY: Math.round(s.player.y),
      });
    }
    return out;
  }, LEVEL_COUNT);

  assert.equal(report.length, LEVEL_COUNT);
  for (const level of report) {
    assert.ok(level.name, `level ${level.level}: no name -- it did not load`);
    // A level with nothing to pop is already cleared the frame it opens.
    assert.ok(level.balls > 0, `level ${level.level} (${level.name}): no balls`);
    assert.ok(level.playerX > 0 && level.playerY > 0,
      `level ${level.level} (${level.name}): player at ${level.playerX},${level.playerY}`);
    assert.notEqual(level.background, '__MISSING',
      `level ${level.level} (${level.name}): its background never loaded`);
  }
  assert.equal(drainErrors(), '', 'loading every level threw or logged something');
});

test('the player walks, shoots, and pops what it hits', async () => {
  await game.scene((s) => { s.beginRun(0, null); });
  await game.page.waitForFunction(() => window.game.scene.getScene('Game').state === 'PLAYING', null, { timeout: 30000 });

  // Real key events through the real input layer, not a poke at the
  // entity: the binding, the input state and the movement code are all
  // part of what "the player walks" means.
  const startX = await game.scene((s) => s.player.x);
  await game.page.keyboard.down('ArrowRight');
  await game.frames(30);
  await game.page.keyboard.up('ArrowRight');
  const movedX = await game.scene((s) => s.player.x);
  assert.ok(movedX > startX + 10, `player barely moved: ${startX} -> ${movedX}`);

  await game.page.keyboard.press('Space');
  await game.frames(3);
  assert.ok(await game.scene((s) => s.projectiles.countActive(true)) > 0, 'pressing shoot fired nothing');

  // And a shot that reaches a ball pops it. Driven through popBall rather
  // than by waiting for a hit, because where the balls happen to be is
  // not what this is testing.
  const popped = await game.scene((s) => {
    const before = { balls: s.balls.countActive(true), score: s.score };
    s.popBall(s.balls.getChildren()[0]);
    return { before, score: s.score };
  });
  assert.ok(popped.score > popped.before.score, 'popping a ball scored nothing');
  assert.equal(drainErrors(), '');
});

test('losing a life sends the ghost up and restarts the level', async () => {
  // Its own run, and its own clean slate for it. A hit leaves the player
  // invulnerable for PLAYER_CONFIG.invulnMs, so a ball that happened to
  // catch them during the test before this one would make the hit below
  // do nothing at all -- and this would fail for a reason that has
  // nothing to do with ghosts.
  await game.scene((s) => { s.beginRun(0, null); });
  await game.page.waitForFunction(() => window.game.scene.getScene('Game').state === 'PLAYING', null, { timeout: 30000 });

  const flight = await game.scene(async (s) => {
    const ghost = () => s.children.list.find((c) => c.texture?.key === 'player-ghost');
    s.lives = 3;
    s.player.invulnTimer = 0;
    const startY = s.player.y;
    s.hitPlayer();
    const spawned = !!ghost();
    await new Promise((r) => setTimeout(r, 600));
    const mid = ghost();
    return {
      spawned,
      state: s.state,
      rose: mid ? Math.round(startY - mid.y) : null,
      lives: s.lives,
    };
  });
  assert.ok(flight.spawned, 'no ghost was spawned by a lost life');
  assert.equal(flight.state, 'HIT_FREEZE', 'the level should be frozen while the ghost leaves');
  assert.ok(flight.rose > 20, `the ghost is not rising (${flight.rose}px after 600ms)`);
  assert.equal(flight.lives, 2, 'a hit should cost exactly one life');

  await game.page.waitForFunction(
    () => window.game.scene.getScene('Game').state === 'LEVEL_INTRO', null, { timeout: 10000 },
  );
  assert.equal(drainErrors(), '');
});

test('clearing a level carries the run into the next one', async () => {
  // The whole hand-off in one go: celebration, tally, transition, and the
  // countdown that must not open until the transition has finished (see
  // GameScene.advanceLevel -- the rules suite pins the arithmetic, this
  // checks the real thing ends up on the next level).
  await game.scene((s) => {
    s.beginRun(0, null);
  });
  await game.page.waitForFunction(() => window.game.scene.getScene('Game').state === 'PLAYING', null, { timeout: 30000 });
  await game.scene((s) => {
    s.balls.clear(true, true);
    s.levelClear({ recordTime: false });
  });
  await game.page.waitForFunction(
    () => window.game.scene.getScene('Game').levelIndex === 1, null, { timeout: 20000 },
  );
  const after = await game.scene((s) => ({ level: s.levelIndex + 1, state: s.state, balls: s.balls.countActive(true) }));
  assert.equal(after.level, 2);
  assert.ok(after.balls > 0, 'the next level arrived empty');
  assert.equal(drainErrors(), '');
});

test('erasing progress takes the scores and leaves the settings', async () => {
  // Worth a browser test more than most things here: it is the one
  // button in the game that destroys something, and what it must NOT
  // take is as much of the point as what it must.
  await game.page.evaluate(() => {
    localStorage.setItem('balloonBuster.highscores', JSON.stringify({ schemaVersion: 1, entries: [{ id: 'x', name: 'ABC', score: 9999, level: 5, date: '2026-01-01' }] }));
    localStorage.setItem('balloonBuster.progress', JSON.stringify({ schemaVersion: 1, unlockedLevels: 12 }));
    localStorage.setItem('balloonBuster.levelTimes', JSON.stringify({ schemaVersion: 1, times: { 0: 12.5 } }));
    localStorage.setItem('balloonBuster.settings', JSON.stringify({ schemaVersion: 1, muted: true }));
    localStorage.setItem('balloonBuster.levelEdits', JSON.stringify({ levels: { 7: { id: 7, name: 'MINE' } } }));
  });
  const keys = () => game.page.evaluate(
    () => Object.keys(localStorage).filter((k) => k.startsWith('balloonBuster.')).sort(),
  );

  await game.scene((s) => s.showOptions());
  await game.frames(3);

  // Nothing happens on the first press but being asked, and answering no
  // has to leave every last thing alone.
  await game.page.click('#btn-erase');
  await game.frames(2);
  assert.equal(await game.page.evaluate(() => document.getElementById('erase-confirm').classList.contains('hidden')), false,
    'ERASE PROGRESS should ask before doing anything');
  await game.page.click('#btn-erase-no');
  await game.frames(2);
  assert.equal((await keys()).length, 5, 'cancelling erased something');

  await game.page.click('#btn-erase');
  await game.page.click('#btn-erase-yes');
  await game.frames(2);
  assert.deepEqual(await keys(), ['balloonBuster.levelEdits', 'balloonBuster.settings'],
    'erasing progress must take the scores, the unlocks and the times -- and nothing else');

  await game.scene((s) => s.goToMenu());
  await game.frames(2);
  await game.scene((s) => s.showOptions());
  await game.frames(2);
  assert.equal(await game.page.evaluate(() => document.getElementById('erase-done').classList.contains('hidden')), true,
    'reopening options should not still be announcing a previous erase');
  await game.scene((s) => s.goToMenu());
  assert.equal(drainErrors(), '');
});

test('pausing and leaving stops the run without breaking it', async () => {
  // Its own run, like every test above: leaning on whatever the previous
  // one happened to leave behind is how a suite starts failing for
  // reasons that have nothing to do with what it is testing.
  await game.scene((s) => { s.beginRun(0, null); });
  await game.page.waitForFunction(() => window.game.scene.getScene('Game').state === 'PLAYING', null, { timeout: 30000 });
  await game.page.keyboard.press('Escape');
  await game.frames(3);
  assert.equal(await game.scene((s) => s.state), 'PAUSED');

  await game.page.keyboard.press('Escape');
  await game.frames(3);
  assert.equal(await game.scene((s) => s.state), 'PLAYING', 'Escape should hand play back');

  await game.scene((s) => s.goToMenu());
  await game.frames(3);
  assert.equal(await game.scene((s) => s.state), 'MENU');
  assert.equal(drainErrors(), '');
});

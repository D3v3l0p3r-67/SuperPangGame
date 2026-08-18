// The level editor paints cells and saves obstacles, and js/obstaclePieces
// .js is the step between: it turns a field of 16px cells into the fewest
// rectangles that cover exactly those cells. Exactly matters -- the level
// that comes back has to be block for block the one that was painted, or
// the editor quietly moves a wall on save.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OBSTACLE_PIECES, obstaclePiece, mergeBlocks } from '../js/obstaclePieces.js';
import { OBSTACLE_BLOCK_SIZE, VIRTUAL_W, BORDER_THICKNESS, GROUND_Y } from '../js/constants.js';

const STEP = OBSTACLE_BLOCK_SIZE;
const cell = (col, row, type = 'crate', powerup = null) => ({ x: col * STEP, y: row * STEP, type, powerup });

// Every cell an obstacle entry covers -- the same split LevelManager's
// obstacleBlocks does when it loads one.
function covered(entries) {
  const cells = [];
  for (const entry of entries) {
    for (let y = entry.y; y < entry.y + entry.h; y += STEP) {
      for (let x = entry.x; x < entry.x + entry.w; x += STEP) cells.push(`${x},${y},${entry.type}`);
    }
  }
  return cells;
}

test('the pieces are the sizes the editor offers, in cells', () => {
  for (const piece of OBSTACLE_PIECES) {
    assert.ok(piece.cols >= 1 && piece.rows >= 1, `${piece.id}: a piece is at least one cell`);
    assert.equal(piece.label, `${piece.cols * STEP}x${piece.rows * STEP}`,
      `${piece.id}: the label says the pixel size, and this one disagrees with its own cells`);
  }
  // The ones the level format already uses (levels ship 16x64 pillars and
  // 64x16 and 96x16 beams) plus the single cell everything was painted
  // with before. Kept in one order, tall before wide at each size, so the
  // picker does not reshuffle under the hand when a size is added.
  assert.deepEqual(OBSTACLE_PIECES.map((p) => p.label),
    ['16x16', '16x64', '16x96', '64x16', '96x16']);
  assert.equal(obstaclePiece('tall').rows, 4);
  assert.equal(obstaclePiece('taller').rows, 6);
  assert.equal(obstaclePiece('wider').cols, 6);
  // Every piece has to FIT: the playfield is 48 cells across and 24 tall
  // (see constants.js), and a piece that did not would be silently pulled
  // back in at the right or bottom edge by the editor's pieceOrigin.
  for (const piece of OBSTACLE_PIECES) {
    assert.ok(piece.cols * STEP <= VIRTUAL_W - BORDER_THICKNESS * 2, `${piece.id}: wider than the playfield`);
    assert.ok(piece.rows * STEP <= GROUND_Y - BORDER_THICKNESS, `${piece.id}: taller than the playfield`);
  }
  assert.equal(obstaclePiece('nonsense').id, 'single', 'an unknown piece falls back to one cell');
});

test('a column of cells becomes one 16x64 obstacle', () => {
  const merged = mergeBlocks([cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)], STEP);
  assert.deepEqual(merged, [{ type: 'crate', x: 0, y: 0, w: 16, h: 64 }]);
});

test('a row of cells becomes one 64x16 obstacle', () => {
  const merged = mergeBlocks([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)], STEP);
  assert.deepEqual(merged, [{ type: 'crate', x: 0, y: 0, w: 64, h: 16 }]);
});

test('a solid block becomes one rectangle, not a row of them', () => {
  const cells = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) cells.push(cell(col, row, 'platform'));
  assert.deepEqual(mergeBlocks(cells, STEP), [{ type: 'platform', x: 0, y: 0, w: 80, h: 48 }]);
});

test('different materials never merge into each other', () => {
  const merged = mergeBlocks([cell(0, 0, 'crate'), cell(1, 0, 'platform'), cell(2, 0, 'crate')], STEP);
  assert.equal(merged.length, 3, 'a crate and a wall are not one obstacle');
  assert.deepEqual(merged.map((entry) => entry.type), ['crate', 'platform', 'crate']);
});

test('a cell holding a drop stays a one-block crate', () => {
  // The rule the saved file has to satisfy (see tests/levels.test.mjs): a
  // power-up on a four-block obstacle bursts four of them.
  const merged = mergeBlocks([cell(0, 0), cell(1, 0, 'crate', 'shield'), cell(2, 0), cell(3, 0)], STEP);
  const withDrop = merged.find((entry) => entry.powerup);
  assert.deepEqual(withDrop, { type: 'crate', x: 16, y: 0, w: 16, h: 16, powerup: 'shield' });
  for (const entry of merged) {
    if (!entry.powerup) assert.equal(entry.w * entry.h > 256 ? entry.powerup : undefined, undefined);
  }
  assert.deepEqual(covered(merged).sort(), covered([
    { type: 'crate', x: 0, y: 0, w: 16, h: 16 },
    { type: 'crate', x: 16, y: 0, w: 16, h: 16 },
    { type: 'crate', x: 32, y: 0, w: 32, h: 16 },
  ]).sort());
});

test('merging never moves, drops or duplicates a cell', () => {
  // A deliberately awkward field: an L, a hole, two materials touching,
  // and a lone cell -- the shapes a merge gets wrong if it assumes
  // rectangles. What is checked is the only thing that must never change:
  // the exact set of cells, and each of them once.
  const cells = [
    cell(0, 0), cell(1, 0), cell(2, 0),
    cell(0, 1), cell(2, 1, 'platform'),
    cell(0, 2), cell(1, 2), cell(2, 2, 'platform'),
    cell(5, 4, 'platform'),
  ];
  const merged = mergeBlocks(cells, STEP);
  const before = cells.map((c) => `${c.x},${c.y},${c.type}`).sort();
  const after = covered(merged).sort();
  assert.deepEqual(after, before, 'the merged obstacles do not cover exactly the painted cells');
  assert.equal(new Set(after).size, after.length, 'a cell came out of the merge twice');
  assert.ok(merged.length < cells.length, 'nothing merged at all');
});

test('the same painted level always saves as the same file', () => {
  const cells = [cell(1, 1), cell(2, 1), cell(1, 2), cell(2, 2), cell(4, 1, 'platform')];
  const first = mergeBlocks(cells, STEP);
  const shuffled = [cells[3], cells[0], cells[4], cells[2], cells[1]];
  assert.deepEqual(mergeBlocks(shuffled, STEP), first,
    'the order the cells happen to be in changed the file that came out');
});

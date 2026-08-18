// Obstacles bigger than one cell: the pieces the level editor can place,
// and the way a field of painted cells becomes them again on the way out.
//
// The level format has always had them -- an obstacle is {type, x, y, w,
// h} and LevelManager splits it into OBSTACLE_BLOCK_SIZE blocks, so the
// shipped levels are full of 96x16 walls and 16x64 pillars. The editor
// was the half that could not: it painted one cell per click and wrote
// one entry per cell, which is the same level in ten times the file.
//
// Nothing here needs Phaser (or a canvas), which is what lets the merge
// be tested directly -- see tests/obstacles.test.mjs.

// What one press of a tile brush puts down. Sizes are in CELLS, so the
// pixel size is whatever OBSTACLE_BLOCK_SIZE is (16 today), and the
// labels say the pixels because that is what a level author measures in.
export const OBSTACLE_PIECES = [
  { id: 'single', label: '16x16', cols: 1, rows: 1 },
  { id: 'tall', label: '16x64', cols: 1, rows: 4 },
  { id: 'taller', label: '16x96', cols: 1, rows: 6 },
  { id: 'wide', label: '64x16', cols: 4, rows: 1 },
  { id: 'wider', label: '96x16', cols: 6, rows: 1 },
];

export function obstaclePiece(id) {
  return OBSTACLE_PIECES.find((piece) => piece.id === id) ?? OBSTACLE_PIECES[0];
}

// Painted cells -> the fewest obstacle entries that cover exactly those
// cells. Greedy maximal rectangles, scanning top-left to bottom-right:
// take the widest run of matching cells to the right, then push it down
// as far as every cell of that width still matches. Each cell is emitted
// exactly once, and every entry is a rectangle on the grid, so the level
// LevelManager builds from the result is block for block the one that was
// painted.
//
// `cells` are {x, y, type, powerup} at grid positions; `step` is the cell
// size. The output keeps `powerup` only where there is one.
export function mergeBlocks(cells, step) {
  const at = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const used = new Set();
  const out = [];

  // Row by row, left to right: the order is what makes the result
  // deterministic -- the same painted level always saves as the same file.
  const ordered = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const cell of ordered) {
    const key = `${cell.x},${cell.y}`;
    if (used.has(key)) continue;

    // A cell holding a guaranteed drop is never merged into anything. The
    // drop belongs to a ONE-BLOCK crate: on a bigger obstacle the tag goes
    // onto every block it becomes and bursts one power-up per block, which
    // is a rule tests/levels.test.mjs enforces on the saved file.
    if (cell.powerup) {
      used.add(key);
      out.push({ type: cell.type, x: cell.x, y: cell.y, w: step, h: step, powerup: cell.powerup });
      continue;
    }

    const matches = (x, y) => {
      const other = at.get(`${x},${y}`);
      return Boolean(other) && !used.has(`${x},${y}`) && other.type === cell.type && !other.powerup;
    };

    let cols = 1;
    while (matches(cell.x + cols * step, cell.y)) cols++;

    let rows = 1;
    for (;;) {
      const y = cell.y + rows * step;
      let wholeRow = true;
      for (let i = 0; i < cols; i++) {
        if (!matches(cell.x + i * step, y)) { wholeRow = false; break; }
      }
      if (!wholeRow) break;
      rows++;
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) used.add(`${cell.x + col * step},${cell.y + row * step}`);
    }
    out.push({ type: cell.type, x: cell.x, y: cell.y, w: cols * step, h: rows * step });
  }

  return out;
}

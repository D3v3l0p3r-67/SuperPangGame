#!/usr/bin/env python3
"""Draws assets/player/ghost.png -- the winged ghost a lost life leaves.

    python3 tools/ghost_sprite.py

When the player loses a life the game spawns this where they were
standing and flies it off the top of the screen before the level restarts
(see GameScene.spawnDeathGhost). Two frames, wings up and wings down,
stacked vertically exactly like every other effect sheet in the game.

It is deliberately the PLAYER, not a generic ghost: same cap, same blue,
same face -- so what leaves is recognisably the life that was just lost
rather than a spooky decoration that happened to appear.

Authored the same way as the player's own sheet: ASCII art on a small
grid, one character per palette colour, scaled 2x with hard edges. The
palette and the renderer come from tools/player_sprite.py so the ghost
cannot drift away from the character it comes out of.

Needs Pillow (`pip install pillow`). An authoring tool, run by hand; the
game only ever loads the .png it writes.
"""

from pathlib import Path

from PIL import Image

from player_sprite import PALETTE, render

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'player' / 'ghost.png'

CELL = 16          # the grid the art is authored on
SCALE = 2          # -> the 32x32 cells the game loads
FRAMES = 2

# The body: cap, face, and a three-bump tail where the legs would be. The
# wings are stamped either side of it (see WING), at a different height
# per frame -- that difference IS the flap.
BODY = """
......oooo......
.....occcco.....
....ocllllco....
....oCCCCCCo....
...owwwwwwwwo...
...owwwwwwwwo...
...owewwwwewo...
...owwwwwwwwo...
...owwmmmmwwo...
...owwwwwwwwo...
...owwwwwwwwo...
...owwwwwwwwo...
...owwowwowwo...
....oo.oo.oo....
................
................
"""

# One wing, drawn against the body's own outline on its inner edge -- so
# the same block works on both sides without mirroring. Left/right
# symmetric on purpose: at 32px a mirrored feather shape reads as noise,
# while the up/down travel below is what actually says "flapping".
WING = [
    '.oo.',
    'oaao',
    'oaao',
    'oaao',
    '.oo.',
]

# The row each frame's wings sit at: up on the first, down on the second.
WING_ROWS = [2, 7]

# Where the wings attach, left and right. The inner column lands on the
# body's outline, which is what keeps them joined to it rather than
# floating alongside.
WING_X = [0, 12]


def parse(art):
    rows = art.strip('\n').split('\n')
    assert len(rows) == CELL, f'{len(rows)} rows, expected {CELL}'
    grid = []
    for y, row in enumerate(rows):
        assert len(row) == CELL, f'row {y} is {len(row)} wide, expected {CELL}'
        for ch in row:
            assert ch in PALETTE, f'row {y}: unknown colour "{ch}"'
        grid.append(list(row))
    return grid


def stamp(grid, x, y, art):
    for dy, row in enumerate(art):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            gx, gy = x + dx, y + dy
            if 0 <= gx < CELL and 0 <= gy < CELL:
                grid[gy][gx] = ch


def frames():
    out = []
    for row in WING_ROWS:
        grid = parse(BODY)
        for x in WING_X:
            stamp(grid, x, row, WING)
        out.append(grid)
    assert len(out) == FRAMES, f'{len(out)} frames, expected {FRAMES}'
    return out


def main():
    sheet = Image.new('RGBA', (CELL * SCALE, CELL * SCALE * FRAMES), (0, 0, 0, 0))
    for i, grid in enumerate(frames()):
        sheet.alpha_composite(render(grid, SCALE), (0, i * CELL * SCALE))
    sheet.save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {sheet.size[0]}x{sheet.size[1]}  {OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Draws assets/player/ghost.png -- the winged ghost a lost life leaves.

    python3 tools/ghost_sprite.py

When the player loses a life the game spawns this exactly where they are
lying and flies it off the top of the screen before the level restarts
(see GameScene.spawnDeathGhost). Two frames, wings up and wings down,
stacked vertically like every other effect sheet in the game.

IT IS THE DEAD PLAYER. The figure is not drawn here at all -- it is
player_sprite.py's own DEAD art, imported, so the ghost cannot drift away
from the frame it rises out of: redraw the player and the ghost is
redrawn with it. Only two things are added on top:

  * a washed-out, semi-transparent version of the palette (see GHOST), so
    it reads as a spirit of the body still lying there rather than as a
    second player, and
  * a pair of angel wings either side of it (see WING), the one part of
    the picture that is this file's own.

The cell is wider than the player's for the wings and exactly as tall,
with the figure centred in it -- so a ghost drawn at the player's own
position lines up with the body pixel for pixel.

Needs Pillow (`pip install pillow`). An authoring tool, run by hand; the
game only ever loads the .png it writes.
"""

from pathlib import Path

from PIL import Image

from player_sprite import DEAD, PALETTE, align_bottom, parse, render

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'player' / 'ghost.png'

# The player's own cell is 18 wide; the extra 14 columns are the wings,
# seven a side, and the figure is centred in what is left. Same height as
# the player's cell, so the two line up when drawn at the same point.
CELL_W, CELL_H = 32, 36
FIGURE_X = (CELL_W - 18) // 2
SCALE = 2                      # -> the 64x72 cells the game loads
FRAMES = 2

# The palette, washed out: every colour mixed most of the way to white and
# made partly see-through. Derived rather than typed out, so a recoloured
# player is a recoloured ghost with nothing to keep in step by hand.
GHOST_WHITE = 0.62             # how far towards white each colour is taken
GHOST_ALPHA = 200              # ...before the whole thing is made hazy


def washed(colour):
    if colour is None:
        return None
    return tuple(round(c + (255 - c) * GHOST_WHITE) for c in colour) + (GHOST_ALPHA,)


GHOST = {ch: washed(colour) for ch, colour in PALETTE.items()}

# The two wings, authored as the LEFT one with the body on its right and
# mirrored for the other side (see mirror()). Both are rooted at the same
# corner of the shoulder -- the up wing at its bottom-right, the down wing
# at its top-right -- so the flap swings around a fixed shoulder instead
# of sliding the whole wing up and down the back, which is what a wing
# merely redrawn a few rows lower looks like.
#
# The 'W' pixels are feather seams. Two or three of them read as a wing at
# this size; individually drawn feathers read as noise.
WING_UP = [
    'oo.......',
    'owo......',
    'owwo.....',
    'owwwo....',
    'owwwwo...',
    'owwwwwo..',
    'owwWwwwo.',
    'owwwwwwo.',
    'owwwwwwwo',
    'owwwwwwwo',
    '.owwWwwwo',
    '.owwwwwwo',
    '..owwwwwo',
    '..owwwwwo',
    '...owwwwo',
    '...oWwwwo',
    '....owwwo',
    '....owwwo',
    '.....owwo',
    '.....oooo',
]

WING_DOWN = [
    '.....oooo',
    '....owwwo',
    '....owwwo',
    '...owwwwo',
    '...oWwwwo',
    '..owwwwwo',
    '..owwwwwo',
    '.owwWwwwo',
    '.owwwwwwo',
    'owwwwwwwo',
    'owwwwwwo.',
    'owwWwwo..',
    'owwwwo...',
    'owwo.....',
    'oo.......',
]

# The shoulder the wings turn about, and each frame's (art, top row) --
# picked so both roots land on it. Looped by the game for the whole of the
# ghost's flight (see BootScene's PLAYER_GHOST_ANIM_KEY), which is what
# makes it beat its way up rather than drift.
SHOULDER_ROW = 21
WING_FRAMES = [
    (WING_UP, SHOULDER_ROW - len(WING_UP) + 1),  # rooted at its last row
    (WING_DOWN, SHOULDER_ROW),                   # ...and this one at its first
]

# The columns the wings attach at. The inner edge of each lands against
# the body, which is what joins them to it rather than leaving them
# floating alongside.
WING_LEFT_X = 0
WING_RIGHT_X = CELL_W - len(WING_UP[0])


def mirror(art):
    return [row[::-1] for row in art]


def blank():
    return [['.'] * CELL_W for _ in range(CELL_H)]


def stamp(grid, x, y, art):
    for dy, row in enumerate(art):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            gx, gy = x + dx, y + dy
            if 0 <= gx < CELL_W and 0 <= gy < CELL_H:
                grid[gy][gx] = ch


def frames():
    # The same grid the player's dead frame is drawn from, bottom-aligned
    # the same way, so the ghost starts out as an exact copy of the body.
    figure = align_bottom(parse(DEAD))
    out = []
    for art, row in WING_FRAMES:
        grid = blank()
        # Wings first: where they pass behind the shoulders the body wins,
        # which is what puts them behind it rather than across it.
        stamp(grid, WING_LEFT_X, row, art)
        stamp(grid, WING_RIGHT_X, row, mirror(art))
        for y, cells in enumerate(figure):
            for x, ch in enumerate(cells):
                if ch != '.':
                    grid[y][x + FIGURE_X] = ch
        out.append(grid)
    assert len(out) == FRAMES, f'{len(out)} frames, expected {FRAMES}'
    return out


def main():
    for art, _ in WING_FRAMES:
        assert all(len(row) == len(WING_UP[0]) for row in art), 'ragged wing art'
    sheet = Image.new('RGBA', (CELL_W * SCALE, CELL_H * SCALE * FRAMES), (0, 0, 0, 0))
    for i, grid in enumerate(frames()):
        sheet.alpha_composite(render(grid, SCALE, GHOST), (0, i * CELL_H * SCALE))
    sheet.save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {sheet.size[0]}x{sheet.size[1]}  {OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()

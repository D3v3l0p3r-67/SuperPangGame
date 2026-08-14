#!/usr/bin/env python3
"""Draws assets/player/player.png -- the player's 16-frame spritesheet.

    python3 tools/player_sprite.py

The frames, their order and their meaning are fixed by the game (see
js/assets.js's PLAYER_ANIM_FRAMES): idle, shot, 4 walk, victory, dead,
2 climb, 2 ladder-exit, 2 step-up, 2 step-down and the celebration jump,
each PLAYER_FRAME (36x72). This script only draws them; nothing here
decides what any of them is used for.

WHICH WAY THE PLAYER FACES. The game is played into the screen -- balls
come down at you -- so the player is drawn from BEHIND for everything
that happens facing the playfield: standing, shooting, climbing, and
stepping off a ladder. Walking left or right, and stepping up onto or
down off a block, are seen from the SIDE (authored facing LEFT; Player.js
mirrors the sprite for the other direction). Winning and losing a life
turn to face the player: those two are the only frames with a face in
them.

HOW IT IS DRAWN. Each frame is authored as ASCII art on a 16x32 grid --
one character per drawn pixel, one letter per palette colour -- and
scaled 2x into its 32x64 cell, which is exactly how the sprite it
replaces was built (every pixel in it is a 2x2 block). Editing the art is
editing these strings.

Needs Pillow (`pip install pillow`). An authoring tool, run by hand when
the character changes; the game only ever loads the .png it writes.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'player' / 'player.png'

CELL_W, CELL_H = 18, 36        # the grid the art is authored on
SCALE = 2                      # -> the 32x64 cells the game loads
FRAMES = 17

# The palette, one letter per colour. Blue cap, blue pack and blue
# trousers over a light shirt: the same blue the game is built out of
# (COLORS.accent's counterpart in js/constants.js), read as one character
# rather than as a blue silhouette on a blue-black sky.
PALETTE = {
    '.': None,                 # transparent
    'o': (18, 16, 42),         # outline, and the darkest shadow
    'c': (52, 87, 213),        # cap
    'C': (35, 58, 122),        # cap band / shadow
    'p': (46, 74, 168),        # backpack
    'P': (28, 44, 104),        # backpack straps and shadow
    'w': (238, 232, 213),      # shirt
    'W': (188, 180, 158),      # shirt shadow
    't': (52, 87, 213),        # trousers
    'T': (35, 58, 122),        # trousers shadow
    'b': (92, 60, 38),         # boots
    's': (244, 195, 154),      # skin
    'S': (206, 150, 110),      # skin shadow
    'h': (91, 58, 41),         # hair
    'e': (46, 43, 50),         # eyes
    'm': (176, 92, 92),        # mouth
    'g': (128, 131, 140),      # gun barrel
    'G': (40, 40, 48),         # gun barrel shadow
    'a': (206, 210, 224),      # armour plate, boots
    'A': (138, 144, 166),      # armour shadow
    'O': (232, 140, 58),       # webbing and straps
    'l': (108, 158, 246),      # helmet highlight
}

# ---------------------------------------------------------------- views
# Each view is 32 rows of 16 characters. The bodies below are complete
# frames; the per-frame variations (an arm up, a leg forward, the whole
# body a pixel lower) are applied as stamps afterwards -- see FRAMES_SPEC.

# Standing, seen from behind: the cap, the back of the pack, both arms
# down, the gun held up in the left hand.
BACK = """
......ogggo.......
......ogggo.......
......ogggo.......
......ogggo.......
......oGGGo.......
....oooooooooo....
...occcccccccco...
..occcccccccccco..
..oclllcccccccco..
..oclllcccccccco..
..occlccccccccco..
..occcccccccccco..
..occcccccccccco..
..occcccccccccco..
..occcccccccccco..
..oCCCCCCCCCCCCo..
...oCCCCCCCCCCo...
....oooooooooo....
..oo.osoooooso.oo.
.oaaoosoggggosoaao
.oaaaosoggggosaaao
.oaaaosoGGGGosaaao
.oAAAoooooooooAAAo
..oaaoOOOOOOOOoao.
..oaaopppppppooao.
..oAAoPppppppOoAo.
..oaaopppppppooao.
..ossoPPPPPPPooso.
...ooOOOOOOOOOoo..
....ooooooooooo...
....oTttttttTo....
....oTtt..ttTo....
....oaaa..aaao....
....oaaa..aaao....
....oAAA..AAAo....
....ooo....ooo....
"""

# Walking, seen from the left: the helmet in profile with the face slot at
# the front, and the weapon held across the chest, under the head -- no
# barrel over the helmet, because from here it is in the hands.
SIDE = """
..................
..................
..................
..................
......oooooo......
....occcccccco....
...occcccccccco...
..occcccccccccco..
..oclllcccccccco..
.ooclllcccccccco..
.oscclecccccccco..
.ossccccccccccco..
.oesscccccccccco..
.ossscccccccccco..
.osmssccccccccco..
..osssCCCCCCCCo...
...ossCCCCCCCo....
....oooooooooo....
...oooOOOOOOooo...
..ogooowwwwwwoppo.
..oggoowwwwwwoppo.
.oGggowwwwwwwoPPo.
.oGgsowwwwwwwoppo.
..osaowwwwwwwoppo.
..oaaowwwwwwwoppo.
..oAAoowwwwwwoPPo.
...ooooOOOOOOooo..
.....owwwwwwwo....
.....oWwwwwwWo....
.....ooooooooo....
....oTttttttTo....
...oTtto..ttTo....
...oaaao..aaao....
...oaaao..aaao....
...oAAAo..AAAo....
...oooo....ooo....
"""

# Facing the player: the victory pose and the moment a life is lost.
FRONT = """
........ogo.......
........ogo.......
........ogo.......
........oGo.......
......oooooo......
....occcccccco....
...occcccccccco...
..occcccccccccco..
..oclllcccccccco..
..oclllcccccccco..
..occlccccccccco..
..occcccccccccco..
..oCCCCCCCCCCCCo..
..ossssssssssso...
..osseossoessso...
..ossssssssssso...
...osssmmmssso....
....oooooooooo....
..ooooOOOOOOoooo..
.oaaoowwwwwwwooao.
.oaaowwwwwwwwwoao.
.oaaowwwwwwwwwoao.
.oAAowwwwwwwwwoAo.
.oaaowwwwwwwwwoao.
.oaaowwwwwwwwwoao.
.oAAoowwwwwwwooAo.
.ossooOOOOOOOooso.
..oo.owwwwwwwo.o..
...o.oWwwwwwWo....
.....ooooooooo....
....oTttttttTo....
....oTtt..ttTo....
....oaaa..aaao....
....oaaa..aaao....
....oAAA..AAAo....
....ooo....ooo....
"""

# Down: sitting where the hit put them, facing out, helmet tipped back.
DEAD = """
..................
..................
..................
..................
..................
..................
..................
..................
..................
..................
......oooooo......
....occcccccco....
...occcccccccco...
..occcccccccccco..
..oclllcccccccco..
..occcccccccccco..
..oCCCCCCCCCCCCo..
..ossssssssssso...
..osseossoessso...
..ossssssssssso...
...osssmmmssso....
...ooosssssooo....
..owwooOOOOOoowo..
..owwwwwwwwwwwwo..
..oswwwwwwwwwwso..
..osowwwwwwwwoso..
..oo.owwwwwwwo.o..
.....oWwwwwwWo....
.....oOOOOOOOo....
.....ooooooooo....
....oTttttttTo....
....otttttttto....
....oaaaaaaaao....
....oaaaaaaaao....
....oAAAAAAAAo....
....oooooooooo....
"""

# The celebration: facing out, both arms thrown up, and off the ground --
# the only frame in the sheet whose feet are NOT on the cell floor,
# because that is what makes it a jump (see frames(), which pairs it with
# the standing victory pose).
JUMP = """
..................
..................
..................
........ogo.......
......oooooo......
....occcccccco....
...occcccccccco...
..occcccccccccco..
..oclllcccccccco..
..oclllcccccccco..
..occlccccccccco..
..occcccccccccco..
..oCCCCCCCCCCCCo..
..ossssssssssso...
..osseossoessso...
..ossssssssssso...
...osssmmmssso....
....oooooooooo....
oaao.oOOOOOOo.oaao
oaaoowwwwwwwooaao.
oAAowwwwwwwwwoAAo.
.ooowwwwwwwwwooo..
...owwwwwwwwwo....
...owwwwwwwwwo....
...oowwwwwwwoo....
....oOOOOOOOo.....
....owwwwwwwo.....
.....oWwwwwWo.....
.....ooooooo......
....oTttttttTo....
...oTtto..ttTo....
...oaaao..aaao....
...oAAAo..AAAo....
....ooo....ooo....
..................
..................
"""


def parse(art):
    """ASCII art -> a 32x16 grid of palette letters, checked for shape."""
    rows = [row for row in art.strip('\n').split('\n')]
    assert len(rows) == CELL_H, f'{len(rows)} rows, expected {CELL_H}'
    grid = []
    for y, row in enumerate(rows):
        assert len(row) == CELL_W, f'row {y} is {len(row)} wide, expected {CELL_W}'
        for ch in row:
            assert ch in PALETTE, f'row {y}: unknown colour "{ch}"'
        grid.append(list(row))
    return grid


def align_bottom(grid):
    """Drops the whole figure so its lowest pixel is the cell's last row --
    the line the player stands on."""
    drawn = [y for y in range(CELL_H) if any(ch != '.' for ch in grid[y])]
    return shift(grid, CELL_H - 1 - max(drawn))


def blank():
    return [['.'] * CELL_W for _ in range(CELL_H)]


def copy(grid):
    return [row[:] for row in grid]


def stamp(grid, x, y, art, transparent='.'):
    """Draws a small block of art at (x, y), leaving '.' cells alone."""
    for dy, row in enumerate(art):
        for dx, ch in enumerate(row):
            if ch == transparent:
                continue
            gx, gy = x + dx, y + dy
            if 0 <= gx < CELL_W and 0 <= gy < CELL_H:
                grid[gy][gx] = ch


def erase(grid, x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < CELL_W and 0 <= y < CELL_H:
                grid[y][x] = '.'


def shift(grid, dy):
    """The whole figure a pixel or two down -- the bob every cycle needs."""
    out = blank()
    for y, row in enumerate(grid):
        ny = y + dy
        if 0 <= ny < CELL_H:
            out[ny] = row[:]
    return out


def render(grid):
    img = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            colour = PALETTE[ch]
            if colour:
                px[x, y] = colour + (255,)
    return img.resize((CELL_W * SCALE, CELL_H * SCALE), Image.NEAREST)


# ------------------------------------------------------------- the frames
# The sprite's BOTTOM EDGE is the line the player stands on (the physics
# body is anchored there, see Player.js), so every frame has to be drawn
# down to it -- art that stops a row short is a player hovering. The base
# views above are bottom-aligned on parsing, and every pose below that
# lowers the body keeps the feet where they are by drawing SHORTER legs
# rather than by moving the whole figure down.
LEG_TOP = 30        # the row the legs start at, in every standing view

# Legs, bottom-aligned: the last row of each of these lands on the last
# row of the cell. A pose whose body sits `n` rows lower uses legs `n`
# rows shorter, which is what makes the bob a bob and not a sink.
LEGS_BACK_STAND = [
    '....oTttttttTo....',
    '....oTtt..ttTo....',
    '....oaaa..aaao....',
    '....oaaa..aaao....',
    '....oAAA..AAAo....',
    '....ooo....ooo....',
]
LEGS_BACK_CROUCH = [
    '....oTtt..ttTo....',
    '....oaaa..aaao....',
    '....oaaa..aaao....',
    '....oAAA..AAAo....',
    '....ooo....ooo....',
]
LEGS_FRONT = LEGS_BACK_STAND

# The walk: two strides and the two passing poses between them, where the
# legs come together and the body rides a pixel lower.
LEGS_STRIDE_A = [
    '...oTttttttTo.....',
    '..oTtto..ttTo.....',
    '..oaaao..oaaao....',
    '..oaaao..oaaao....',
    '..oAAAo..oAAAo....',
    '..oooo....oooo....',
]
LEGS_STRIDE_B = [
    '....oTttttttTo....',
    '....oTtto.ttTo....',
    '...oaaao..oaaao...',
    '..oaaao....oaaao..',
    '..oAAAo....oAAAo..',
    '..oooo......oooo..',
]
LEGS_PASSING = [
    '....oTtttttTo.....',
    '.....oaaaaao......',
    '.....oaaaaao......',
    '.....oAAAAAo......',
    '.....ooooooo......',
]
LEGS_SIDE_STAND = [
    '....oTttttttTo....',
    '...oTtto..ttTo....',
    '...oaaao..aaao....',
    '...oaaao..aaao....',
    '...oAAAo..AAAo....',
    '...oooo....ooo....',
]

# One 16px block up: the leading knee is high and the trailing leg is
# straight under the body.
LEGS_STEP_UP = [
    '...oTttttttTo.....',
    '..oTtto...oTto....',
    '..oaaao...otto....',
    '..oaaao...oaaao...',
    '...ooo....oaaao...',
    '..........oAAAo...',
    '...........oooo...',
]
# ...and one down: the leading foot is reaching for the step below.
LEGS_STEP_DOWN = [
    '...oTttttttTo.....',
    '..oTtto..ottTo....',
    '..oaaao...otto....',
    '..oaaao...oaaao...',
    '..oAAAo...oaaao...',
    '..oooo....oAAAo...',
    '...........oooo...',
]


def pose(base, legs):
    """A frame: the base view's body over `legs`, feet on the cell floor.

    How far the body drops falls out of how tall the legs are, so a
    shorter pair IS a crouch -- there is no separate offset to keep in
    step with the art.
    """
    body = copy(base)
    erase(body, 0, LEG_TOP, CELL_W - 1, CELL_H - 1)
    body = shift(body, CELL_H - len(legs) - LEG_TOP)
    stamp(body, 0, CELL_H - len(legs), legs)
    return body


def frames():
    back = align_bottom(parse(BACK))
    side = align_bottom(parse(SIDE))
    front = align_bottom(parse(FRONT))
    dead = align_bottom(parse(DEAD))
    # NOT bottom-aligned, unlike every other frame: the celebration jump is
    # drawn off the ground, and pushing it back down would land it.
    jump = parse(JUMP)
    out = []

    # 0 idle -- standing, seen from behind.
    out.append(pose(back, LEGS_BACK_STAND))

    # 1 shot: the gun kicks, so the free hand comes up to the barrel too.
    # The recoil goes into the knees: the same pose, taken a little lower.
    # (Shorter legs are how every lower pose here is drawn -- see pose().)
    out.append(pose(back, LEGS_BACK_CROUCH))

    # 2-5 walk, from the side: stride, pass, stride, pass.
    for legs in (LEGS_STRIDE_A, LEGS_PASSING, LEGS_STRIDE_B, LEGS_PASSING):
        out.append(pose(side, legs))

    # 6 victory, 7 dead: the two frames that turn round.
    out.append(pose(front, LEGS_FRONT))
    out.append(dead)

    # 8-9 climb: the arms alternate up the ladder. The whole figure moves
    # here -- on a ladder the feet are on rungs, not on the floor.
    for i in range(2):
        # One arm reaches for the next rung while the other holds: the
        # plate on the reaching side is drawn four rows higher.
        climb = pose(back, LEGS_BACK_STAND)
        high, low = (1, 15) if i == 0 else (15, 15)
        erase(climb, 1, 15, 3, 27)
        erase(climb, 14, 15, 16, 27)
        left = ['oss', 'oaa', 'oaa', 'oAA', 'oaa', 'oaa', 'oAA', '.oo']
        right = ['sso', 'aao', 'aao', 'AAo', 'aao', 'aao', 'AAo', 'oo.']
        stamp(climb, 1, 15 if i == 0 else 19, left)
        stamp(climb, 15, 19 if i == 0 else 15, right)
        out.append(shift(climb, i))

    # 10-11 stepping off the top of a ladder: the weight comes down
    # through a crouch and straightens back up, feet planted throughout.
    out.append(pose(back, LEGS_BACK_CROUCH))
    out.append(pose(back, LEGS_BACK_CROUCH + ['.....oo.ooo.....']))

    # 12-13 step up: the leading knee comes up, then the body follows it
    # onto it: by the second frame the feet are back under the body, on
    # the block the physics has already put them on.
    out.append(pose(side, LEGS_STEP_UP))
    out.append(pose(side, LEGS_SIDE_STAND))

    # 14-15 step down: the leading foot reaches down, then the body dips
    # after it.
    out.append(pose(side, LEGS_STEP_DOWN))
    out.append(pose(side, LEGS_STEP_DOWN[1:]))

    # 16 the celebration jump: the level-clear animation alternates it with
    # the standing victory pose (see assets.js's PLAYER_ANIM_FRAMES), so
    # the player hops on the spot facing out rather than turning round and
    # back again.
    out.append(jump)

    assert len(out) == FRAMES, f'{len(out)} frames, expected {FRAMES}'
    return out


def main():
    sheet = Image.new('RGBA', (CELL_W * SCALE, CELL_H * SCALE * FRAMES), (0, 0, 0, 0))
    for i, grid in enumerate(frames()):
        sheet.alpha_composite(render(grid), (0, i * CELL_H * SCALE))
    sheet.save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {sheet.size[0]}x{sheet.size[1]}  {OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()

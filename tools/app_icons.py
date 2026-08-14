#!/usr/bin/env python3
"""Draws the app icons the installed game is identified by.

    python3 tools/app_icons.py

Writes assets/icons/*.png, apple-touch-icon.png and favicon.ico -- the set
manifest.webmanifest and index.html point at (tests/pwa.test.mjs checks
that every one of them is there, and that it is the size it claims).

The motif is the game seen from the outside: a ball hanging over the
harpoon that is about to pop it, on the same night sky the first
background is painted on. It is drawn on a 16x16 pixel-art grid rather
than resampled from a photo of the game, so each size comes out crisp at
its own resolution instead of blurry at all but one of them -- the grid
unit is size/16 and every edge is rounded to a whole pixel, so a 512 icon
is the same picture as a 180 one, drawn with bigger blocks.

Two shapes are produced from that one drawing:

  plain      the whole square, with the playfield's own border frame
             around it -- what a browser tab and an iOS home screen show
  maskable   the same picture at 72%, centred, on a full-bleed
             background. Android crops a maskable icon to whatever shape
             the launcher uses (circle, squircle, rounded square), and
             only the middle 80% is guaranteed to survive -- so the frame
             is dropped and the motif is kept well inside that circle.

Needs Pillow (`pip install pillow`); it is an authoring tool run by hand
when the icon changes, not part of the game or of any build.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / 'assets' / 'icons'

# The game's own palette (see js/constants.js COLORS and the ball art).
SKY_TOP = (18, 15, 52)
SKY_BOTTOM = (32, 23, 70)
FRAME = (61, 90, 168)
FRAME_LIGHT = (109, 152, 214)
BALL = (240, 90, 90)
BALL_DARK = (176, 48, 60)
BALL_SHINE = (255, 158, 158)
BEAM = (255, 210, 63)
BEAM_DARK = (214, 160, 24)
STAR = (244, 241, 222)

GRID = 16  # the drawing is authored on a 16x16 pixel-art grid


def icon(size, maskable):
    """One icon, drawn at `size` px."""
    img = Image.new('RGBA', (size, size), SKY_TOP + (255,))
    draw = ImageDraw.Draw(img)
    unit = size / GRID

    def box(x0, y0, x1, y1, fill):
        """A rectangle in grid units, snapped to whole pixels.

        Never thinner than one pixel: the smallest details here are half a
        grid unit, which at favicon sizes rounds to nothing at all.
        """
        left, top = round(x0 * unit), round(y0 * unit)
        right, bottom = max(round(x1 * unit) - 1, left), max(round(y1 * unit) - 1, top)
        draw.rectangle([left, top, right, bottom], fill=fill)

    def disc(cx, cy, r, fill):
        left, top = round((cx - r) * unit), round((cy - r) * unit)
        right, bottom = max(round((cx + r) * unit) - 1, left), max(round((cy + r) * unit) - 1, top)
        draw.ellipse([left, top, right, bottom], fill=fill)

    # Sky: a couple of bands rather than a smooth gradient, in keeping
    # with the backgrounds (see tools/daylight_backgrounds.py).
    box(0, GRID / 2, GRID, GRID, SKY_BOTTOM)

    # Everything below is placed in grid units around the centre, and
    # shrunk towards it for the maskable shape.
    scale = 0.72 if maskable else 1.0

    def at(x, y):
        return (GRID / 2 + (x - GRID / 2) * scale, GRID / 2 + (y - GRID / 2) * scale)

    def sbox(x0, y0, x1, y1, fill):
        a = at(x0, y0)
        b = at(x1, y1)
        box(a[0], a[1], b[0], b[1], fill)

    def sdisc(cx, cy, r, fill):
        c = at(cx, cy)
        disc(c[0], c[1], r * scale, fill)

    if not maskable:
        # The playfield's border frame, one grid unit thick.
        box(0, 0, GRID, 1, FRAME)
        box(0, GRID - 1, GRID, GRID, FRAME)
        box(0, 0, 1, GRID, FRAME)
        box(GRID - 1, 0, GRID, GRID, FRAME)
        for i in range(1, GRID - 1, 2):
            box(i, 0.25, i + 1, 0.75, FRAME_LIGHT)
            box(i, GRID - 0.75, i + 1, GRID - 0.25, FRAME_LIGHT)
            box(0.25, i, 0.75, i + 1, FRAME_LIGHT)
            box(GRID - 0.75, i, GRID - 0.25, i + 1, FRAME_LIGHT)

    for x, y in ((2.5, 2.5), (12.5, 3), (4.5, 5), (13, 7.5), (3, 8.5)):
        sbox(x, y, x + 0.5, y + 0.5, STAR)

    # The ball, with the same dark rim and off-centre shine the in-game
    # art has.
    sdisc(8, 6, 3.6, BALL_DARK)
    sdisc(8, 6, 3.1, BALL)
    sdisc(6.8, 4.8, 1.0, BALL_SHINE)

    # The harpoon under it: a beam standing on the floor, its head stopped
    # just short of the ball -- the icon is the moment before the pop, not
    # a ball on a stick.
    sbox(7.5, 11, 8.5, GRID - 1, BEAM_DARK)
    sbox(7.75, 11, 8.25, GRID - 1, BEAM)
    sbox(7, 10.5, 9, 11.25, BEAM)
    sbox(7.25, 10, 8.75, 10.5, BEAM_DARK)
    return img.convert('RGB')


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    written = []
    for size in (192, 512):
        for maskable in (False, True):
            name = f'icon-maskable-{size}.png' if maskable else f'icon-{size}.png'
            path = ICONS / name
            icon(size, maskable).save(path)
            written.append(path)

    apple = ICONS / 'apple-touch-icon.png'
    # iOS puts its own rounded mask over this one and never crops as far
    # in as Android's maskable shape, so it gets the framed drawing.
    icon(180, False).save(apple)
    written.append(apple)

    # The tab icon: the same drawing at the three sizes a .ico carries.
    # Drawn at each size rather than downscaled from one, for the same
    # reason every other size is.
    favicon = ROOT / 'favicon.ico'
    sizes = (16, 32, 48)
    frames = [icon(s, False) for s in sizes]
    frames[0].save(favicon, format='ICO', sizes=[(s, s) for s in sizes],
                   append_images=frames[1:])
    written.append(favicon)

    for path in written:
        print(f'  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()

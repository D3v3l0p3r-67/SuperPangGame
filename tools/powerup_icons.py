"""Draws the pickup icons for the power-ups that have a glyph here.

    python3 tools/powerup_icons.py

Same shape as every other power-up icon (assets/powerups/<type>.webp,
18x18): a round disc in the power-up's own colour with a glyph cut into
it in a darker tone of the same hue. The glyph says what is in the box --
a barbed spear, a two-pronged hook, a bank of barrels, a stick of
dynamite, an hourglass -- because "something drops" is not useful to a
player who cannot tell WHICH thing from across the playfield.

Only the types in GLYPHS below are written, so the icons drawn by hand
(shield, the fruit, and the rest) are never overwritten by running this.
The disc colours come from each type's own elements/powerup-*.json rather
than being repeated here. For the weapons they are deliberately not
simply copied from WEAPON_TYPES: the grapple and the machine gun share
one colour there (#4ecdc4), which is fine for a HUD slot that also
carries the weapon's name and useless for an 18px disc that has to be
told apart in a hurry.
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ELEMENTS = ROOT / 'elements'
OUT = ROOT / 'assets' / 'powerups'
SIZE = 18

# 7x9 pixel glyphs, drawn on the disc. Small on purpose: the icon is
# looked at as a shape at speed, not read.
GLYPHS = {
    'weapon_harpoon': [
        '...#...',
        '..###..',
        '.#.#.#.',
        '#..#..#',
        '...#...',
        '...#...',
        '...#...',
        '...#...',
        '..###..',
    ],
    'weapon_grapple': [
        '#.....#',
        '#.....#',
        '.#...#.',
        '.##.##.',
        '...#...',
        '...#...',
        '...#...',
        '...#...',
        '..###..',
    ],
    'weapon_machinegun': [
        '.......',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '.#####.',
        '...#...',
        '...#...',
        '..###..',
    ],
    # A stick with a lit fuse: the fuse leaves the top right and the spark
    # sits off the end of it, which is what says "about to go off" at this
    # size -- a plain cylinder would read as a barrel or a battery.
    'dynamite': [
        '.....#.',
        '....#..',
        '..###..',
        '..###..',
        '.#####.',
        '..###..',
        '..###..',
        '..###..',
        '..###..',
    ],
    # Two triangles meeting at the waist, with the sand in the top half:
    # the shape reads as an hourglass even where the grains do not, and
    # the frame lines are what keep it from looking like a bow tie.
    'hourglass': [
        '#######',
        '.#####.',
        '..###..',
        '..###..',
        '...#...',
        '..#.#..',
        '.#...#.',
        '#.....#',
        '#######',
    ],
}


def shade(color: tuple, factor: float) -> tuple:
    return tuple(max(0, min(255, round(channel * factor))) for channel in color)


def hex_to_rgb(value: str) -> tuple:
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def icon(color: tuple) -> Image.Image:
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    centre = (SIZE - 1) / 2
    radius = SIZE / 2 - 0.5
    rim = shade(color, 0.55)
    for y in range(SIZE):
        for x in range(SIZE):
            distance = ((x - centre) ** 2 + (y - centre) ** 2) ** 0.5
            if distance > radius:
                continue
            # A one-pixel darker rim, and a lift towards the top left,
            # which is where everything in this game is lit from.
            if distance > radius - 1.2:
                px[x, y] = (*rim, 255)
            else:
                lift = 1.0 + 0.18 * ((centre - x) + (centre - y)) / SIZE
                px[x, y] = (*shade(color, lift), 255)
    return img


def draw_glyph(img: Image.Image, rows: list, color: tuple) -> None:
    px = img.load()
    width = len(rows[0])
    height = len(rows)
    left = (SIZE - width) // 2
    top = (SIZE - height) // 2
    for y, row in enumerate(rows):
        for x, mark in enumerate(row):
            if mark == '#':
                px[left + x, top + y] = (*color, 255)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(ELEMENTS.glob('powerup-*.json')):
        element = json.loads(path.read_text())
        if element['type'] not in GLYPHS:
            continue
        color = hex_to_rgb(element['color'])
        img = icon(color)
        draw_glyph(img, GLYPHS[element['type']], shade(color, 0.28))
        out = OUT / f"{element['type']}.webp"
        img.save(out, 'WEBP', lossless=True)
        print(f'{out.relative_to(ROOT)}: {element["label"]}')


if __name__ == '__main__':
    main()

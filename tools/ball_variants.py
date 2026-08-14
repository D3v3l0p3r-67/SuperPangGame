#!/usr/bin/env python3
"""Draws the ball kinds that move differently, and writes their elements.

    python3 tools/ball_variants.py

A ball's KIND is what you have to read at a glance, because it tells you
what the thing is about to do -- and you get one glance, while it is
already falling at you. So each kind is a colour: the ordinary bouncer is
red, the weaver is green, the one that comes after you is blue, and the
heavy one that barely leaves the floor is purple.

Everything here is DERIVED from the round ball rather than drawn beside
it. The art is `assets/balls/ball_round_N.webp` and its pop sheet with
the hue turned, which keeps the shading and the highlight exactly as
authored -- redraw the round ball and every kind is redrawn with it. The
elements are `elements/round-ball-N.json` with this file's per-kind
overrides applied, so a kind is a short table here rather than five JSON
files kept in step by hand.

What each kind DOES lives in js/elements.js's BALL_MOVEMENTS -- except
`heavy`, which needs no code at all: barely bouncing and moving slowly is
entirely a matter of the numbers below.

Needs Pillow (`pip install pillow`). An authoring tool, run by hand; the
game only ever loads the files it writes.
"""

import colorsys
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BALLS = ROOT / 'assets' / 'balls'
ELEMENTS = ROOT / 'elements'

SIZES = [1, 2, 3, 4, 5]

# One entry per kind. `hue` is where the round ball's red is taken to, in
# degrees around the wheel; `movement` names its BALL_MOVEMENTS entry; and
# `element` is merged over the round ball's own numbers for that size.
#
# The numbers are deliberately gentle. Each of these is harder to deal
# with than a plain bouncer at the same size, so they are worth fewer
# surprises elsewhere: a weaver and a hunter both give up horizontal
# speed for what they do, and the heavy one gives up almost all its
# bounce for being slow and low.
KINDS = {
    'wave': {
        'hue': 128,             # green
        'label': 'Wave',
        'movement': 'wave',
        'element': {'speed_scale': 0.8},
    },
    'hunter': {
        'hue': 214,             # blue
        'label': 'Hunter',
        'movement': 'hunter',
        'element': {'speed_scale': 0.7},
    },
    'heavy': {
        'hue': 278,             # purple
        'label': 'Heavy',
        'movement': 'standard',
        # Half the bounce and two thirds the speed: it stays down where
        # the player is, which is a different problem from a ball flying
        # over their head rather than a harder version of the same one.
        'element': {'speed_scale': 0.65, 'bounce_scale': 0.5},
    },
}


def turn_hue(image, degrees):
    """The same picture in another colour: hue moved, saturation and value
    left alone. Doing it per pixel rather than by tinting is what keeps
    the highlight a highlight instead of flattening it into the fill."""
    out = image.convert('RGBA').copy()
    px = out.load()
    shift = (degrees % 360) / 360
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r, g, b = colorsys.hsv_to_rgb((h + shift) % 1.0, s, v)
            px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return out


def turn_hex(colour, degrees):
    r, g, b = (int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    r, g, b = colorsys.hsv_to_rgb((h + (degrees % 360) / 360) % 1.0, s, v)
    return '#{:02x}{:02x}{:02x}'.format(round(r * 255), round(g * 255), round(b * 255))


def element_for(kind, spec, size):
    base = json.loads((ELEMENTS / f'round-ball-{size}.json').read_text())
    el = dict(base)
    el['id'] = f'{kind}-ball-{size}'
    el['shape'] = kind
    el['label'] = f'{spec["label"]} {size}'
    el['movement'] = spec['movement']
    el['color'] = turn_hex(base['color'], spec['hue'])
    el['highlight'] = turn_hex(base['highlight'], spec['hue'])
    over = spec['element']
    if 'speed_scale' in over:
        el['speed'] = round(base['speed'] * over['speed_scale'])
    if 'bounce_scale' in over:
        el['bounceVelocity'] = round(base['bounceVelocity'] * over['bounce_scale'])
    # Radius, gravity and points stay the round ball's: a kind is what a
    # ball DOES, not how big it is or what it is worth. Levels place these
    # interchangeably with round balls, and a variant that quietly took up
    # more room would not be interchangeable.
    return el


def main():
    written = 0
    for kind, spec in KINDS.items():
        for size in SIZES:
            for prefix in ('ball', 'pop'):
                source = Image.open(BALLS / f'{prefix}_round_{size}.webp')
                turn_hue(source, spec['hue']).save(BALLS / f'{prefix}_{kind}_{size}.webp', lossless=True)
                written += 1
            path = ELEMENTS / f'{kind}-ball-{size}.json'
            path.write_text(f'{json.dumps(element_for(kind, spec, size), indent=2)}\n')
            written += 1
        print(f'{kind:8} hue {spec["hue"]:3}  {turn_hex("#ff6b6b", spec["hue"])}  {len(SIZES)} sizes')
    print(f'{written} files under assets/balls/ and elements/')
    print('remember: elements/index.json lists what is loaded -- add new ids there')


if __name__ == '__main__':
    main()

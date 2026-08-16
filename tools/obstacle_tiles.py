"""Draws the obstacle material tiles.

    python3 tools/obstacle_tiles.py

A tile here is the MATERIAL an obstacle is made of and nothing else: a
flat mid tone with a little grain, and no border of its own. That is the
whole point of redrawing them. The tiles used to carry a bevel around
every 16px cell, which is fine for one block and wrong for every piece
bigger than one -- a 16x64 pillar came out as four stacked boxes with
seams down the middle of a thing that is supposed to be one piece.

The bevel is drawn at runtime instead, around the OUTSIDE of whatever
shape the blocks actually form (js/Obstacle.js's drawObstacleEdges, from
the exposed faces refreshObstacleSeams already works out). A pillar, an
L, a lone crate and a wall painted by dragging then all read as one
object, and none of them needs its own artwork.

The grain is deterministic (seeded) so rerunning this writes the same
file, and it is per-pixel rather than a gradient so the tile still
repeats seamlessly in any direction -- the border frame tiles the wall
across the whole playfield edge.
"""

import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'obstacles'
SIZE = 16

# Sampled from the tiles these replace, so the materials keep the colours
# the levels were balanced and the backgrounds were drawn against. `body`
# is the fill; `light` and `dark` are what the runtime bevel uses, and
# they live in elements/obstacle-*.json as edgeLight/edgeDark -- the same
# numbers, in the place the game reads its element data from.
TILES = {
    'crate': {'body': (142, 90, 32), 'grain': ((133, 86, 15), (150, 98, 40))},
    'wall': {'body': (48, 72, 135), 'grain': ((40, 62, 120), (56, 82, 146))},
}

# How much of the tile gets a grain pixel. Enough that a big wall is not a
# flat rectangle of one colour, little enough that the material still
# reads as one colour rather than as noise.
GRAIN_SHARE = 0.22


def tile(spec: dict, seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new('RGB', (SIZE, SIZE), spec['body'])
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if rng.random() < GRAIN_SHARE:
                px[x, y] = spec['grain'][rng.randrange(len(spec['grain']))]
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for seed, (name, spec) in enumerate(TILES.items()):
        path = OUT / f'{name}.webp'
        tile(spec, seed).save(path, 'WEBP', lossless=True)
        print(f'{path.relative_to(ROOT)}: {SIZE}x{SIZE} {name} material')


if __name__ == '__main__':
    main()

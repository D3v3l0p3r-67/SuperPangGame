"""Draws the puff a BEAM leaves where it stops on something unbreakable.

    python3 tools/impact_puffs.py

Two frames, stacked vertically like every other effect sheet in the game
(frame 0 on top), written to assets/weapons/beam_hit.webp.

It is deliberately not the bullet's puff. A machine gun throws four darts
that strike in a scatter, so four small teal sparks read as one event; a
beam is one thick shaft arriving in one place, and the same small spark
under it looked like a dart had gone off by mistake. This one is half
again as wide and grey -- dust knocked off the block rather than a spark
-- which is also what tells the two apart at a glance while the machine
gun's own sparks are still on screen.

The two frames are a cloud and then the same cloud coming apart: solid
with a lit middle, then wider, hollow and dimmer. Nothing here is
random at runtime -- the lumps come from a seeded generator, so rerunning
this writes the same file.

The bullet's sheet (assets/weapons/bullet_hit.webp) is NOT written here:
it was drawn by hand, it still reads exactly right for what it marks, and
regenerating it would be a redraw nobody asked for.
"""

import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'weapons' / 'beam_hit.webp'
SIZE = 24

# Stone rather than spark: a lit middle, the body of the cloud in mid
# grey, and a darker rim so it has a shape against a pale wall as well as
# against the night sky.
CORE = (238, 240, 244)
BODY = (168, 174, 184)
EDGE = (104, 110, 122)

# How many directions the outline is lumped in. Sixteen is enough that the
# cloud is not a disc and few enough that each lump is several pixels wide
# at this size.
BUMPS = 16


def cloud(radius: float, hollow: float, seed: int) -> Image.Image:
    """One frame: a lumpy round cloud of `radius`, hollow inside `hollow`
    (as a fraction of the radius; 0 draws it solid with a lit middle)."""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    mid = (SIZE - 1) / 2
    rng = random.Random(seed)
    lumps = [radius + rng.uniform(-1.2, 1.2) for _ in range(BUMPS)]

    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = x - mid, y - mid
            distance = math.hypot(dx, dy)
            # Which lump this pixel falls under, blended with the next one
            # so the outline turns rather than steps.
            at = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * BUMPS
            i = int(at) % BUMPS
            edge = lumps[i] * (1 - (at % 1)) + lumps[(i + 1) % BUMPS] * (at % 1)
            if distance > edge or distance < edge * hollow:
                continue
            if not hollow and distance < edge * 0.4:
                px[x, y] = (*CORE, 255)
            elif distance < edge * 0.78:
                px[x, y] = (*BODY, 255)
            else:
                px[x, y] = (*EDGE, 255)
    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (SIZE, SIZE * 2), (0, 0, 0, 0))
    sheet.paste(cloud(8.5, 0, seed=1), (0, 0))        # the strike
    sheet.paste(cloud(10.5, 0.45, seed=2), (0, SIZE))  # coming apart
    sheet.save(OUT, 'WEBP', lossless=True)
    print(f'{OUT.relative_to(ROOT)}: {SIZE}x{SIZE} x2 beam impact')


if __name__ == '__main__':
    main()

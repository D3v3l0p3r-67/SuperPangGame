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
# Wider than it is tall, and not for decoration: the cloud has to cover
# the width of the weapon that made it and then spread ALONG the surface,
# because that is what dust knocked off a wall does. A round puff the same
# width would have stood as far out from the wall as it did across it.
WIDTH = 32
HEIGHT = 20

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


def cloud(spread: float, rise: float, hollow: float, seed: int) -> Image.Image:
    """One frame: a lumpy cloud `spread` wide and `rise` tall, hollow
    inside `hollow` (a fraction of the way out; 0 draws it solid with a
    lit middle).

    Drawn from the TOP of the cell down, not from its middle: the puff is
    placed with its top edge on the surface it came off (see
    GameScene.playShotImpact), so what is drawn here is the half of a
    cloud that is outside the wall. Any of it above that line would be
    dust inside solid stone."""
    img = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    px = img.load()
    midX = (WIDTH - 1) / 2
    rng = random.Random(seed)
    lumps = [1 + rng.uniform(-0.12, 0.12) for _ in range(BUMPS)]

    for y in range(HEIGHT):
        for x in range(WIDTH):
            # Measured in ellipse units -- 1.0 is the outline -- so one
            # shape can be wide and shallow without the lumps stretching
            # with it.
            dx, dy = (x - midX) / spread, y / rise
            distance = math.hypot(dx, dy)
            # Which lump this pixel falls under, blended with the next one
            # so the outline turns rather than steps.
            at = (math.atan2(dy, dx) + math.pi) / (2 * math.pi) * BUMPS
            i = int(at) % BUMPS
            edge = lumps[i] * (1 - (at % 1)) + lumps[(i + 1) % BUMPS] * (at % 1)
            if distance > edge or distance < edge * hollow:
                continue
            if not hollow and distance < edge * 0.45:
                px[x, y] = (*CORE, 255)
            elif distance < edge * 0.78:
                px[x, y] = (*BODY, 255)
            else:
                px[x, y] = (*EDGE, 255)
    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (WIDTH, HEIGHT * 2), (0, 0, 0, 0))
    sheet.paste(cloud(12.0, 13.0, 0, seed=1), (0, 0))          # the strike
    sheet.paste(cloud(15.5, 17.0, 0.45, seed=2), (0, HEIGHT))  # coming apart
    sheet.save(OUT, 'WEBP', lossless=True)
    print(f'{OUT.relative_to(ROOT)}: {WIDTH}x{HEIGHT} x2 beam impact')


if __name__ == '__main__':
    main()

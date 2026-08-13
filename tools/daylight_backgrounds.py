#!/usr/bin/env python3
"""Relight a night skyline into the five times of day the campaign plays.

Every region background (assets/backgrounds/<region>.webp) is authored
once, at night. This script takes that one frame and writes the five
variants the game asks for -- <region>_morning.webp, _noon, _afternoon,
_dusk, _night -- keeping the artwork identical and changing only the
light: the sky gradient, how the buildings are lit, whether the windows
are on, whether the stars are out, and whether the disc in the sky is the
moon or the sun.

    python3 tools/daylight_backgrounds.py            # every region
    python3 tools/daylight_backgrounds.py europe     # just one

It works because the backgrounds are flat pixel art with a smooth
vertical sky ramp, which makes them separable back into layers:

    sky        pixels that match the ramp for their row (fitted from the
               rows the buildings do not reach, then extrapolated down)
    window     the small warm-yellow squares on the silhouettes
    disc       the one large bright blob in the top half -- moon or sun
    star       every other tiny bright speck
    glow       bright cool-green pixels (the arctic aurora)
    surface    the remaining large bright shapes (snow, sails)
    silhouette everything else: the skyline and the landmarks

Only the light is per-phase; which pixel belongs to which layer is read
off the source image, so a redrawn or brand-new region background needs
no change here -- rerun the script and its five variants follow.

Needs Pillow and NumPy (`pip install pillow numpy`), neither of which the
game itself uses -- this is an authoring tool, run by hand when the art
changes, not part of the build (there isn't one).
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BACKGROUNDS = ROOT / 'assets' / 'backgrounds'

# The source frames to relight. Deliberately explicit rather than "every
# .webp in the folder", so the generated variants are never themselves
# taken as sources. Kept in step with levels/regions.json's `background`
# fields (tests/assets.test.mjs checks every name a region asks for).
REGIONS = [
    'europe', 'africa', 'middle_east', 'india', 'asia', 'oceania',
    'pacific', 'south_america', 'america', 'arctic',
]

# Layer ids (see the module docstring).
SILHOUETTE, SKY, WINDOW, BRIGHT, GLOW = range(5)

# The silhouette luminance range the relighting maps onto each phase's
# building tones. Fixed rather than measured per image so the same
# skyline tone comes out the same shade in every region: the darkest tone
# in the set of authored backgrounds is the near band (~22) and the
# lightest is a lit landmark (~55).
SILHOUETTE_LUM = (20.0, 56.0)

# Rows per band of the regenerated sky gradient. The source art bands its
# own ramp about this coarsely; a perfectly smooth ramp would look out of
# place next to the flat shapes in front of it (and compress worse).
SKY_BAND_PX = 5

# phase -> the light in it.
#   sky           three gradient stops: top of frame, middle, horizon
#   build         the two ends of the silhouette ramp (darkest, lightest)
#   window        how lit the windows are, and what colour they burn
#   star / glow   how much of the night's specks and aurora survive
#   disc          the sky's disc: its core and its shaded side
#   surface       multiplier over the bright surfaces (snow, sails)
PHASES = {
    'morning': {
        'sky': [(46, 66, 124), (92, 110, 168), (214, 150, 132)],
        'build': [(48, 44, 80), (112, 104, 144)],
        'window': (0.30, (255, 208, 128)),
        'star': 0.20,
        'glow': 0.15,
        'disc': [(255, 238, 180), (255, 208, 132)],
        'surface': (0.90, 0.90, 1.00),
    },
    'noon': {
        'sky': [(36, 104, 190), (74, 146, 216), (150, 196, 232)],
        'build': [(74, 74, 104), (168, 170, 186)],
        'window': (0.0, (255, 208, 128)),
        'star': 0.0,
        'glow': 0.0,
        'disc': [(255, 252, 230), (255, 240, 186)],
        'surface': (1.00, 1.00, 1.00),
    },
    'afternoon': {
        'sky': [(44, 92, 168), (110, 140, 196), (232, 186, 132)],
        'build': [(86, 68, 86), (186, 158, 132)],
        'window': (0.10, (255, 214, 140)),
        'star': 0.0,
        'glow': 0.0,
        'disc': [(255, 228, 150), (255, 198, 104)],
        'surface': (1.00, 0.96, 0.88),
    },
    'dusk': {
        'sky': [(26, 26, 72), (86, 48, 102), (208, 96, 72)],
        'build': [(30, 24, 54), (88, 58, 94)],
        'window': (0.80, (255, 206, 110)),
        'star': 0.35,
        'glow': 0.50,
        'disc': [(255, 246, 214), (240, 226, 190)],
        'surface': (0.86, 0.74, 0.80),
    },
    # Night is the source frame itself -- written out unchanged so the
    # five variants are one uniform set and the game never has to know
    # that one of them is the original.
    'night': None,
}

PHASE_ORDER = ['morning', 'noon', 'afternoon', 'dusk', 'night']


def luminance(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def fit_sky_ramp(img):
    """The sky colour per row, as a straight line fitted to the top rows.

    The authored ramp is linear in y, so fitting it where nothing occludes
    it (the upper part of the frame, where the median pixel of a row IS
    the sky) and extrapolating down gives the sky colour even behind the
    buildings -- which is what makes the silhouettes separable at all.
    """
    height = img.shape[0]
    rows = np.arange(int(height * 0.6))
    medians = np.median(img[rows], axis=1)
    ramp = np.zeros((height, 3))
    for channel in range(3):
        slope, intercept = np.polyfit(rows, medians[:, channel], 1)
        ramp[:, channel] = slope * np.arange(height) + intercept
    return ramp


def label_components(mask):
    """4-connected components of a boolean mask, as lists of pixels."""
    height, width = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            pixels = []
            while stack:
                cy, cx = stack.pop()
                pixels.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            out.append(pixels)
    return out


def split_layers(img):
    """Sort every pixel into one of the layers, and find the sky's disc."""
    height, width, _ = img.shape
    ramp = fit_sky_ramp(img)
    lum = luminance(img)
    red, green, blue = img[..., 0], img[..., 1], img[..., 2]

    # Within 7 of the fitted ramp is the ramp itself: the flat shapes in
    # front of it are all further away than that, and the one background
    # with a dithered (rather than banded) sky stays inside it.
    sky = np.linalg.norm(img - ramp[:, None, :], axis=2) <= 7.0
    window = (red > 150) & (blue < 160) & (red > blue + 60) & ~sky
    # Cool and bright is the aurora; the purple landmarks are just as
    # saturated but far darker, and their green channel never leads.
    glow = (lum >= 65) & (green > red * 1.15) & ~sky & ~window
    bright = (lum >= 85) & ~sky & ~window & ~glow

    layers = np.full((height, width), SILHOUETTE, dtype=np.uint8)
    layers[sky] = SKY
    layers[window] = WINDOW
    layers[bright] = BRIGHT
    layers[glow] = GLOW

    # The moon (or sun): the one big bright blob in the top half of the
    # frame. Everything else bright stays a star (a speck) or a surface
    # (snow, sails), which are lit differently.
    disc = np.zeros((height, width), dtype=bool)
    stars = np.zeros((height, width), dtype=bool)
    for pixels in label_components(layers == BRIGHT):
        rows = np.array([p[0] for p in pixels])
        cols = np.array([p[1] for p in pixels])
        if len(pixels) >= 40 and rows.mean() < height * 0.45:
            disc[rows, cols] = True
        elif len(pixels) <= 8:
            # A speck in the sky is a star; the same speck on a building is
            # a window with the blinds open (the art draws some of them in
            # the moon's own pale colour), and windows go out at noon while
            # stars go out at dawn -- so what is around it decides.
            if surrounded_by_sky(layers, pixels):
                stars[rows, cols] = True
            else:
                layers[rows, cols] = WINDOW
    return layers, ramp, disc, stars


def surrounded_by_sky(layers, pixels):
    """True when a blob's immediate surroundings are more sky than not."""
    height, width = layers.shape
    own = set(pixels)
    sky_count = other = 0
    for y, x in pixels:
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if not (0 <= ny < height and 0 <= nx < width) or (ny, nx) in own:
                continue
            if layers[ny, nx] == SKY:
                sky_count += 1
            else:
                other += 1
    return sky_count >= other


def gradient(stops, height):
    """Three-stop vertical gradient, banded to SKY_BAND_PX rows."""
    top, mid, horizon = (np.array(s, dtype=float) for s in stops)
    out = np.zeros((height, 3))
    for y in range(height):
        band = (min(y // SKY_BAND_PX * SKY_BAND_PX + SKY_BAND_PX // 2, height - 1)) / (height - 1)
        if band <= 0.5:
            t = band / 0.5
            out[y] = top + (mid - top) * t
        else:
            t = (band - 0.5) / 0.5
            out[y] = mid + (horizon - mid) * t
    return out


def relight(img, layers, ramp, disc, stars, phase):
    height, width, _ = img.shape
    sky = gradient(phase['sky'], height)
    out = np.repeat(sky[:, None, :], width, axis=1).copy()

    # Silhouettes: the source's own luminance ordering, remapped onto this
    # phase's two building tones, so a hazy far skyline stays behind a
    # dark near one however the light changes.
    dark, light = (np.array(c, dtype=float) for c in phase['build'])
    lo, hi = SILHOUETTE_LUM
    t = np.clip((luminance(img) - lo) / (hi - lo), 0.0, 1.0)[..., None]
    building = dark + (light - dark) * t
    mask = layers == SILHOUETTE
    out[mask] = building[mask]

    # Windows sit on a silhouette, so they fade towards the glass tone of
    # this phase's buildings rather than towards its sky.
    lit_amount, lit_color = phase['window']
    glass = dark + (light - dark) * 0.35
    lit = glass + (np.array(lit_color, dtype=float) - glass) * lit_amount
    out[layers == WINDOW] = lit

    for mask, amount in ((stars, phase['star']), (layers == GLOW, phase['glow'])):
        if amount <= 0:
            continue
        blended = out + (img - out) * amount
        out[mask] = blended[mask]

    surface = layers == BRIGHT
    surface[disc] = False
    surface[stars] = False
    out[surface] = np.clip(img * np.array(phase['surface']), 0, 255)[surface]

    # The disc keeps its own shading: its brightest tone becomes the core
    # of the sun/moon, everything darker becomes the shaded side.
    if disc.any():
        core, shade = (np.array(c, dtype=float) for c in phase['disc'])
        disc_lum = luminance(img)[disc]
        out[disc] = np.where((disc_lum >= disc_lum.max() - 1)[:, None], core, shade)

    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def write(path, array):
    Image.fromarray(array).save(path, format='webp', lossless=True)
    print(f'  {path.name}  {path.stat().st_size / 1024:.1f} KB')


def main(names):
    for name in names:
        source = BACKGROUNDS / f'{name}.webp'
        if not source.exists():
            raise SystemExit(f'no such background: {source}')
        print(name)
        img = np.array(Image.open(source).convert('RGB')).astype(float)
        layers, ramp, disc, stars = split_layers(img)
        for phase in PHASE_ORDER:
            settings = PHASES[phase]
            out = img.astype(np.uint8) if settings is None else relight(img, layers, ramp, disc, stars, settings)
            write(BACKGROUNDS / f'{name}_{phase}.webp', out)


if __name__ == '__main__':
    main(sys.argv[1:] or REGIONS)

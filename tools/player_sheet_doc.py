"""Builds the player sprite reference.

    python3 tools/player_sheet_doc.py

Writes docs/player-sprite.html: every frame in assets/player/player.png,
shown at 4x with what it is FOR -- which state plays it, in what order, at
what rate, which way it faces, and what the game is doing when it is on
screen.

Generated rather than written, because a reference that is kept by hand
is a reference that is wrong. The frames come out of the sheet itself,
the states and the frame order out of js/assets.js's PLAYER_ANIM_FRAMES,
and the rates and looping out of js/animations.js -- the same registry
BootScene builds Phaser's animations from. Only the prose per frame lives
here, and it is prose about what the picture shows.

The page embeds the frames as data URIs, so it is one file that can be
opened anywhere with nothing beside it.
"""

import base64
import io
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'assets' / 'player' / 'player.png'
OUT = ROOT / 'docs' / 'player-sprite.html'
ZOOM = 4

# What the game is doing while a frame is on screen. Keyed by frame index,
# which is the one thing the sheet, the animations and this file all agree
# on. Everything else on the page is read out of the code.
PURPOSE = {
    0: 'Standing still. Held whenever the player is on the ground and not '
       'walking, climbing or recovering from a shot -- the frame the game '
       'spends most of its time in.',
    1: 'Firing. On screen for exactly as long as the shot holds the player '
       'still (config.js\'s SHOT_LOCK_SEC), so the pose and the pause end '
       'together.',
    2: 'Walk, contact: the leading foot lands and takes the weight.',
    3: 'Walk, double support: both feet down. Drawn with the upper body 2px '
       'lower, which is the dip in the gait -- the bob is in the ART, not in '
       'the sprite\'s position.',
    4: 'Walk, contact on the other foot -- the mirror of frame 2 within the '
       'same cycle.',
    5: 'Walk, double support again, the other way round.',
    6: 'Victory. Played once when a run ends without a game over, and every '
       'other frame of the level-clear hop.',
    7: 'Dead. Played once per hit taken. It is also the frame the death '
       'ghost is derived from -- tools/ghost_sprite.py washes this pose out '
       'and adds the wings rather than drawing a second figure.',
    8: 'Climbing, reach: the free hand changes rung and the body rises.',
    9: 'Climbing, pull: the legs have swapped and the body settles. Loops '
       'with frame 8 while the player climbs, and freezes on whichever one '
       'is showing when they stop partway up -- they are still on the '
       'ladder, so the standing idle would be wrong.',
    10: 'Stepping off the TOP of a ladder: the weight comes down through a '
        'crouch. Only at the top -- at the bottom the player simply stands '
        'off it.',
    11: 'Stepping off the top, straightening back up into the idle stance.',
    12: 'Stepping UP onto a block: the leading knee comes up.',
    13: 'Stepping up, the body following the knee onto the ledge.',
    14: 'Stepping DOWN off a block: the leading foot reaches for the floor '
        'below.',
    15: 'Stepping down, the body dipping after the foot. Separate from the '
        'step up because going up and coming down do not look alike.',
    16: 'The level-clear hop, airborne: the victory pose with the boots off '
        'the cell\'s last row. That gap under them is the jump.',
}

# Which way a frame is drawn, and why. The game is played INTO the screen,
# so most of it is the player's back.
FACING = {
    'idle': ('from behind', 'played facing the playfield'),
    'shot': ('from behind', 'played facing the playfield'),
    'move': ('from the side, facing LEFT', 'mirrored with setFlipX for the other direction'),
    'stepup': ('from the side, facing LEFT', 'mirrored with setFlipX for the other direction'),
    'stepdown': ('from the side, facing LEFT', 'mirrored with setFlipX for the other direction'),
    'climb': ('from behind', 'both hands on the ladder'),
    'ladderoff': ('from behind', 'still facing the ladder'),
    'victory': ('facing out', 'turns round to face the player'),
    'dead': ('facing out', 'turns round to face the player'),
    'levelclear': ('facing out', 'turns round to face the player'),
}


def read_registry() -> dict:
    """The frame layout and every animation that runs on the player sheet,
    straight out of the game's own modules."""
    script = """
      import { PLAYER_FRAME, PLAYER_ANIM_FRAMES, PLAYER_TEXTURE_PATH } from './js/assets.js';
      import { gameAnimations } from './js/animations.js';
      const anims = gameAnimations().filter((a) => a.texturePath === PLAYER_TEXTURE_PATH);
      console.log(JSON.stringify({ frame: PLAYER_FRAME, states: PLAYER_ANIM_FRAMES, anims }));
    """
    out = subprocess.run(
        ['node', '--input-type=module', '-e', script],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def frame_pngs(cell_w: int, cell_h: int) -> list:
    sheet = Image.open(SHEET).convert('RGBA')
    out = []
    for top in range(0, sheet.height, cell_h):
        cell = sheet.crop((0, top, cell_w, top + cell_h))
        cell = cell.resize((cell_w * ZOOM, cell_h * ZOOM), Image.NEAREST)
        buffer = io.BytesIO()
        cell.save(buffer, 'PNG')
        out.append(base64.b64encode(buffer.getvalue()).decode('ascii'))
    return out


def escape(text: str) -> str:
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main() -> None:
    registry = read_registry()
    cell_w = registry['frame']['frameWidth']
    cell_h = registry['frame']['frameHeight']
    frames = frame_pngs(cell_w, cell_h)
    sheet = Image.open(SHEET)

    # frame index -> the states that play it, in the order the states are
    # declared. A frame can belong to more than one (the victory pose is
    # also every other frame of the level-clear hop).
    used_by = {i: [] for i in range(len(frames))}
    for state, indices in registry['states'].items():
        for position, index in enumerate(indices):
            used_by[index].append((state, position + 1, len(indices)))

    by_key = {anim['key']: anim for anim in registry['anims']}

    rows = []
    for index, data in enumerate(frames):
        states = used_by[index]
        # One line per STATE, not per appearance: the victory pose is
        # frames 1, 3 and 5 of the level-clear hop, and saying so three
        # times over says less than saying it once.
        positions = {}
        for state, position, total in states:
            positions.setdefault(state, (total, []))[1].append(position)
        labels = []
        for state, (total, at) in positions.items():
            anim = by_key.get(f'player-{state}')
            rate = round(anim['frameRate'], 2) if anim else '?'
            loops = ', loops' if anim and anim['loop'] else ''
            step = f" -- {', '.join(str(p) for p in at)} of {total}" if total > 1 else ''
            labels.append(
                f"<li><b>{escape(anim['label'] if anim else state)}</b> "
                f"<code>{escape(state)}</code>{escape(step)} "
                f"<span class=rate>{rate} fps{loops}</span></li>"
            )
        facing, why = FACING.get(states[0][0], ('', '')) if states else ('unused', 'nothing plays it')
        rows.append(f"""
    <figure>
      <img src="data:image/png;base64,{data}" width="{cell_w * ZOOM}" height="{cell_h * ZOOM}" alt="frame {index}">
      <figcaption>
        <h3>Frame {index}</h3>
        <ul class="states">{''.join(labels) or '<li class=unused>nothing plays it</li>'}</ul>
        <p>{escape(PURPOSE.get(index, ''))}</p>
        <p class="facing">Drawn <b>{escape(facing)}</b> -- {escape(why)}.</p>
      </figcaption>
    </figure>""")

    sequences = []
    for anim in registry['anims']:
        strip = ''.join(
            f'<img src="data:image/png;base64,{frames[i]}" width="{cell_w * 2}" height="{cell_h * 2}" '
            f'alt="frame {i}" title="frame {i}">'
            for i in anim['frames']
        )
        loops = 'loops' if anim['loop'] else 'plays once'
        sequences.append(f"""
    <div class="sequence">
      <h3>{escape(anim['label'])} <code>{escape(anim['key'])}</code></h3>
      <p class="rate">{round(anim['frameRate'], 2)} fps, {loops} -- frames {', '.join(str(i) for i in anim['frames'])}</p>
      <div class="strip">{strip}</div>
    </div>""")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(PAGE.format(
        sheet_w=sheet.width, sheet_h=sheet.height,
        cell_w=cell_w, cell_h=cell_h, count=len(frames),
        frames=''.join(rows), sequences=''.join(sequences),
    ))
    print(f'{OUT.relative_to(ROOT)}: {len(frames)} frames, {len(registry["anims"])} animations')


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Player sprite reference</title>
<style>
  :root {{ --bg: #0b0916; --panel: #1c1042; --border: #6d5fa0; --text: #f4f1de; --accent: #ffd23f; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 24px; background: var(--bg); color: var(--text);
         font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5; }}
  .wrap {{ max-width: 1100px; margin: 0 auto; }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  h2 {{ font-size: 14px; letter-spacing: .05em; text-transform: uppercase; opacity: .8;
       border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 34px 0 14px; }}
  h3 {{ font-size: 14px; margin: 0 0 6px; }}
  code {{ font-size: 12px; opacity: .75; }}
  .lede {{ opacity: .85; max-width: 78ch; }}
  .facts {{ display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 13px; margin: 14px 0 0;
           padding: 12px 14px; border: 1px solid var(--border); border-radius: 6px; }}
  .facts b {{ color: var(--accent); }}
  figure {{ display: flex; gap: 16px; margin: 0 0 14px; padding: 12px 14px;
           border: 1px solid var(--border); border-radius: 6px; background: var(--panel); }}
  figure img {{ image-rendering: pixelated; flex: none; align-self: flex-start;
               background-color: #1a1530;
               background-image:
                 linear-gradient(45deg, #2a2350 25%, transparent 25%),
                 linear-gradient(-45deg, #2a2350 25%, transparent 25%),
                 linear-gradient(45deg, transparent 75%, #2a2350 75%),
                 linear-gradient(-45deg, transparent 75%, #2a2350 75%);
               background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0;
               border: 1px solid var(--border); border-radius: 4px; }}
  figcaption p {{ margin: 6px 0 0; font-size: 13px; }}
  .states {{ list-style: none; padding: 0; margin: 0; font-size: 13px; }}
  .states li {{ margin-bottom: 2px; }}
  .rate {{ opacity: .65; font-size: 12px; }}
  .unused {{ opacity: .5; font-style: italic; }}
  .facing {{ opacity: .7; font-size: 12px; }}
  .sequence {{ margin-bottom: 16px; }}
  .strip {{ display: flex; gap: 6px; flex-wrap: wrap; }}
  .strip img {{ image-rendering: pixelated; background: #1a1530;
               border: 1px solid var(--border); border-radius: 3px; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Player sprite reference</h1>
  <p class="lede">Every frame in <code>assets/player/player.png</code> and what it is for. Generated by
    <code>tools/player_sheet_doc.py</code> from the sheet itself, <code>js/assets.js</code>'s
    <code>PLAYER_ANIM_FRAMES</code> and <code>js/animations.js</code> -- rerun it after redrawing the
    character and this page follows.</p>

  <div class="facts">
    <span><b>Sheet</b> {sheet_w} x {sheet_h} px</span>
    <span><b>Cell</b> {cell_w} x {cell_h} px</span>
    <span><b>Frames</b> {count}, stacked vertically, frame 0 on top</span>
    <span><b>Drawn by</b> tools/player_sprite.py</span>
    <span><b>Shown here at</b> 4x</span>
  </div>

  <h2>Frame by frame</h2>
  {frames}

  <h2>The animations, in order</h2>
  {sequences}
</div>
</body>
</html>
"""


if __name__ == '__main__':
    main()

# Working on Balloon Buster

A Phaser 3 arcade game, no build step: `index.html` loads `js/` directly
and `js/vendor/phaser.min.js` is committed. `npm` is for the tests only —
nothing under `js/` imports a line of it.

The README is the reference (1700 lines, written to be grepped, not
read). This file is only the things you would otherwise re-derive.

## Commands

```bash
node --test tests/*.test.mjs          # data + rules. No install. ~0.2s
npm install                           # Playwright, once, for the below
node --test tests/smoke/*.test.mjs    # the real game in Chromium. ~40s
node tools/build_precache.mjs         # AFTER changing any precached file
```

**`build_precache.mjs` is not optional.** It rewrites `sw-precache.json`
and the `CACHE_VERSION` line in `service-worker.js` from a hash of every
precached file. Skip it and `tests/pwa.test.mjs` fails — and worse,
players keep being served the old build, because the worker answers from
a cache named after its version. Never edit that line by hand.

Where a pre-installed Chromium exists, point Playwright at it:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`.

## Driving the game from a test or a probe

The scene key is `Game`, not `GameScene`:

```js
const s = window.game.scene.getScene('Game');
s.beginRun(levelIndex, null);   // start a campaign run (0-based)
s.editLevel(levelIndex);        // open the editor on a level
s.hitPlayer();                  // cost a life
s.levelClear({ recordTime: false });
s.popBall(s.balls.getChildren()[0]);
```

Two traps, both of which have cost real debugging time:

- **Physics is paused** through `LEVEL_INTRO` and `HIT_FREEZE`. A probe
  that sets `state = 'PLAYING'` by hand still needs `s.physics.resume()`,
  or positions never move while velocities appear to change.
- **A `await import(...)` mid-probe lets real frames run.** Long enough
  for an empty field to fire `levelClear()` and advance the level under
  you. Import once, up front.

`tests/smoke/game.mjs` wraps all of this; prefer it over hand-rolling.

## Where things are

| | |
|---|---|
| gameplay tunables | `js/config.js` |
| geometry, colours, states | `js/constants.js` |
| balls / obstacles / power-ups / ladders | `elements/*.json`, registered by `js/elements.js` |
| every file path + texture key | `js/assets.js` — the one place both loader and consumer read |
| every animation (frames, fps, loop) | `js/animations.js` — `BootScene` iterates it, the admin's sprite studio replays it |
| levels | `levels/level_NN.json`, probed 1..`MAX_LEVEL_FILES` (50) |
| writing a level back | `js/levelFile.js` -> `admin/save.php`, only where PHP runs and the admin session exists; `localStorage` otherwise |
| regions | `levels/regions.json`, one per `LEVELS_PER_REGION` levels |

**Registries, not switches.** `BALL_MOVEMENTS`, `POWERUP_BEHAVIORS`,
`WEAPON_TYPES`, `LEVEL_TRANSITIONS`, `OBSTACLE_TYPES` all work the same
way: data names a key, code iterates generically. Adding a kind is an
entry plus (usually) a JSON file — never an `if` on a name.

**A new `elements/*.json` must be listed in `elements/index.json`** or it
is silently never loaded.

## Graphics are generated, not hand-drawn

Run these by hand; the game only loads what they write.

```
tools/player_sprite.py       the player's 17-frame sheet
tools/ghost_sprite.py        the death ghost — imports player_sprite's DEAD art
tools/ball_variants.py       every non-round ball kind, from the round one
tools/daylight_backgrounds.py  a region's five times of day, from its night frame
tools/app_icons.py           the PWA icons
```

Each derives from something else on purpose, so a redraw propagates.
Editing the generated `.webp`/`.png` directly gets overwritten — the
admin tool's sprite studio (`admin/js/spriteStudio.js`) will paint them
anyway, and says so in a banner on the file.

## Two things that constrain UI work

- **The pixel font draws uppercase, digits, and `!`, `:`, `.` only**
  (`INTRO_FONT_CHARS`). No commas, apostrophes or arrows in any menu
  string, or the glyph is simply missing.
- **The debug and editor panels are exactly the canvas's width**, and the
  editor's is also a fixed-height band. It is full: adding a control
  costs another one its place, and adding a row overflows the band. The
  balls are one brush plus a name/size picker rather than a button each,
  only the readout group is allowed to shrink, and a revealed row must
  *replace* one rather than add one. `tests/smoke/` measures the panel
  against the width and the band height it actually has.

## Conventions

- All code — filenames, identifiers, comments — in **English**.
- Comments say *why*, and name the thing that would otherwise be
  re-derived. Match the density around you.
- Tests: if it is answerable from the files it goes in `tests/`; if it
  needs the game running it goes in `tests/smoke/`. See
  `tests/README.md` for which half sees what.
- The remote reports the repository as moved; pushes to the configured
  URL still succeed. Not a problem to fix.

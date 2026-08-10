# Balloon Buster

A retro pixel-art arcade game inspired by the classic *Pang* / *Buster Bros.*
gameplay: walk left and right along the ground, fire a harpoon straight up,
and pop balls before they pop you. There are two ball shapes -- round balls
(8x8px up to 48x48px, sizes 1-5) that fall under gravity and bounce, and hex
balls (8x8px up to 24x24px, sizes 1-3 only) that ignore gravity and drift at
a constant diagonal speed. Hitting a ball splits it into two balls one size
smaller, one sent left and one right; size-1 balls are destroyed outright.

Every ball's motion is fully deterministic: each size has fixed speed,
bounce height, and gravity, so two balls of the same size always move and
bounce identically no matter how they got there -- a landing always resets
vertical speed to that size's standard bounce velocity rather than
reflecting whatever speed it fell in at (size 1's bounce, for example,
always takes it from a resting center 4px off the ground up to a peak
96px higher). Levels can also contain obstacles built from 8x8 blocks
(horizontal, vertical, rectangular, or stepped/staircase shapes) that
balls bounce off from any side, correctly, with no clipping or tunneling
even at high speed; breakable obstacles lose only the individual block
that's actually shot, leaving the rest of the shape intact.

All graphics are original pixel art, loaded from `.webp` files under
`assets/` (see "Swapping graphics" below), and all sound effects and music
are synthesized at runtime with the Web Audio API. No copied assets of any
kind — nothing from the original games is reused.

Built on **Phaser 3** (Arcade Physics), vendored locally in
`js/vendor/phaser.min.js` so the game still runs with no build step and no
network dependency. Phaser owns the render loop, the canvas, keyboard
input, and collision/overlap detection; the game only sets explicit
velocities in its own collision callbacks to keep the deterministic
Pang-style bounce feel, rather than leaning on generic physics
restitution.

## Play it

A live build is deployed automatically to GitHub Pages on every push to
`main`. Check the repository's **Settings → Pages** for the published URL
(or the deployment step's output in the Actions tab).

## Run it locally

The game is plain HTML/CSS/JavaScript with no build step. Two ways to run it:

- **Simplest**: open `index.html` directly in a modern desktop browser
  (Chrome, Firefox, Edge, Safari).
- **If your browser blocks ES module imports over `file://`**: serve the
  folder with any static file server, e.g.

  ```bash
  python3 -m http.server 8000
  # or
  npx serve .
  ```

  then open `http://localhost:8000`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow Left/Right or A/D | On-screen left/right buttons |
| Shoot | Space, Arrow Up, or W | On-screen shoot button |
| Pause | Esc or P | On-screen pause button |
| Fullscreen | Button in menu/pause screen | Same |

Touch controls appear automatically on devices with a coarse pointer
(phones/tablets); they're always available in fullscreen too.

## Features

- 10 hand-tuned levels with increasing difficulty (more/larger balls, more
  hex balls and obstacles mixed in, tighter time bonuses). Level 1 has no
  obstacles at all -- 8 smallest-size balls (4 heading left, 4 right, each
  bouncing off a wall before its path can ever reach the player) for a
  gentle but active first look at movement, shooting, and ball physics.
- 2 ball shapes: round (sizes 1-5) and hex (sizes 1-3 only), each with
  fixed, deterministic physics; splitting one size smaller (one left, one
  right) per hit.
- Obstacles: indestructible platforms and shootable crates, built from
  8x8 blocks (rectangular or stepped shapes), blocking ball movement from
  every side with proper anti-tunneling collision; a multi-block crate
  loses only the block that's actually shot.
- 8 power-ups: bonus fruit, rapid shot, wide harpoon, speed boost, extra
  life, score multiplier, time freeze, shield.
- A shield absorbs one hit with no life lost and no interruption; without
  a shield, a hit costs a life and restarts the *current* level from
  scratch (score and remaining lives carry over). Zero lives ends the run.
- HUD always shows remaining level time, lives, and the current weapon
  (plus score, level, and active timed effects).
- Score, lives, and a locally-persisted top-10 high score table
  (`localStorage`, with a versioned schema for safe future upgrades).
- Full menu flow: main menu, level intro, pause, game over, victory,
  high score entry/table, restart.
- 17 sounds (sfx, ui, and 2 looping music tracks) driven entirely by
  `assets/audio/audio.json` through a central `AudioManager` -- see
  "Swapping / adding sounds". Music never overlaps itself, doesn't
  duplicate on level restart, and mute/`musicVolume`/`sfxVolume` are
  global settings persisted the same way as high scores.

## Debug mode

Useful while tuning levels or ball behavior:

- Toggle with **Shift+D**, or load the page with `?debug=1` in the URL.
- Shows an FPS counter, the current game state/level, remaining time,
  score/lives/weapon, and live entity counts.
- Draws collision bounds for the player, balls, projectiles, power-ups,
  and obstacles directly over the game.
- A clearly labeled spawn panel: pick a ball shape + size and spawn it, or
  clear every ball on the field instantly with **Remove all balls**; one
  quick-spawn button per power-up (bonus fruit, shield, every weapon
  power-up, and all the others); jump straight to any level -- all without
  replaying the whole game or affecting normal play when the panel is off.

## Project structure

```
index.html          Phaser injects its own canvas into #game-container;
                      DOM overlay for menus/HUD/touch controls sits on top
style.css            All visual styling, responsive/touch layout
assets/              Every graphic and sound in the game, as real files --
                      see "Swapping graphics" / "Swapping sounds" below
  balls/             ball_<shape>_<size>.webp
  player/            player_<state>_<frame>.webp
  obstacles/         wall.webp, crate.webp
  powerups/          <powerup type>.webp
  projectile.webp, particle.webp
  audio/             audio.json (every sound's config) + one .ogg file per
                      sound named there -- see "Swapping sounds" below
elements/            One JSON file per ball size/shape, obstacle type, or
                      power-up, plus index.json listing which to load --
                      see "Adding elements" below
levels/              One level_NN.json per level, in level-editor Export
                      format -- see "Adding levels" below
js/
  vendor/phaser.min.js  Phaser 3 (Arcade Physics build), vendored locally
  main.js            One line: new Phaser.Game(GAME_CONFIG) -- no manual
                      requestAnimationFrame loop anywhere in the project
  GameConfig.js      Phaser.Game config (resolution, Arcade Physics,
                      pixel-art scaling, scene list: Elements -> Boot ->
                      Game)
  assets.js          Maps every externally-loaded graphic, element, and
                      level file to its texture/cache key and file path --
                      the one place every loader/consumer reads from, so
                      they can't disagree
  elements.js        BALL_ELEMENTS/OBSTACLE_TYPES/POWERUP_TYPES -- empty
                      until ElementsScene populates them from elements/
                      *.json (see registerElement); also POWERUP_BEHAVIORS,
                      the small set of generic (game, params) => void
                      power-up effects a JSON element's `kind` picks from
  ElementsScene.js   Boots first: loads every elements/*.json (see
                      elements/index.json) and every levels/*.json (see
                      "Adding levels"), registers them, then starts Boot
  BootScene.js       Boots second (registries are populated by now, so it
                      knows exactly which files to ask for): loads every
                      graphic (see assets.js) and builds the player's
                      Phaser animations -- nothing is drawn procedurally,
                      everything is a loaded file
  GameScene.js       The whole game: state machine, Arcade colliders/
                      overlaps, keyboard input, particle bursts, and the
                      public API (startNewGame/pause/etc.) ui.js talks to
  Player.js          Phaser.Physics.Arcade.Sprite: explicit per-frame
                      velocity from input, shield outline, and 4 Phaser
                      animations (idle/move/shot/dead, see assets.js) --
                      facing is setFlipX, never a separate left/right asset
  Ball.js            Phaser.Physics.Arcade.Sprite: reads its one
                      BALL_ELEMENTS entry (shape+size) for every physical
                      parameter, deterministic landOnTop()/bounce methods,
                      split-children descriptors
  Projectile.js      Phaser.Physics.Arcade.Sprite for the harpoon shot
  Obstacle.js         Phaser.GameObjects.Rectangle + static Arcade body,
                      representing one obstacle block; destructible via
                      takeHit()
  Bonus.js           Phaser.Physics.Arcade.Sprite for power-up pickups
  LevelManager.js    Owns the LEVELS array (populated by ElementsScene
                      from levels/*.json) and loads a level definition
                      into a GameScene's groups; decomposes each obstacle
                      into independent 8x8 Obstacle blocks (see
                      OBSTACLE_BLOCK_SIZE)
  config.js          Static gameplay tuning that isn't per-element data
                      (player movement, weapon base stats, power-up drop
                      chance/fall speed/ttl)
  constants.js        Technical constants (resolution, ground line,
                      obstacle block size, palette)
  weapons.js         Weapon state + power-up effect timers (EffectManager
                      calls each active POWERUP_TYPES entry's apply()/
                      revert(), never needs to know what they actually do)
  audio.js           AUDIO_CONFIG (empty until ElementsScene populates it
                      from assets/audio/audio.json) + AudioManager, the
                      only thing in the game allowed to call Phaser's
                      Sound Manager -- every trigger elsewhere is
                      audio.play('<name>') / audio.playMusic('<name>'),
                      never a filename/volume/loop flag
  input.js           Thin DOM bridge for the on-screen touch buttons only
                      (keyboard is native Phaser input, see GameScene)
  ui.js              DOM menus/HUD/screens
  storage.js         Versioned localStorage persistence
  editor.js          In-browser level editor (grid-snapped painting,
                      Export/Import) -- see "Adding levels" below
  debug.js           Debug overlay (Phaser Graphics) and dev tools
```

### Adding elements

A ball size/shape, obstacle type, or power-up is a JSON file under
`elements/`, freely named (`round-ball-1.json`, `powerup-stoptime-5s
.json`, ...) -- `js/elements.js`'s `registerElement()` reads its
`category` field to know which registry to put it in. To add one: drop
the file in `elements/`, then add its filename (no `.json`) to
`elements/index.json`'s array. The level editor's brushes and powerup
dropdown, and the debug panel's spawn controls, are all driven directly
by these registries, so a new element shows up there automatically.

**Ball** (`category: "ball"`) -- one file per (shape, size) pair, fully
resolved (no shared/derived values):
```json
{
  "id": "round-ball-1", "category": "ball", "shape": "round", "size": 1,
  "label": "Round 1", "hasGravity": true, "gravityAccel": 260,
  "radius": 4, "speed": 40, "bounceVelocity": 221, "points": 800,
  "color": "#ff6b6b", "highlight": "#ffb3b3"
}
```
`hasGravity: false` (e.g. a hex ball) ignores `gravityAccel`/
`bounceVelocity` and instead drifts at a constant diagonal speed,
reflecting off walls/floor/ceiling/platforms. However many size entries a
shape has *is* that shape's max size -- there's no separate cap to keep in
sync. Needs an `assets/balls/ball_<shape>_<size>.webp` image at exactly
`radius * 2` square (see "Swapping graphics").

**Obstacle** (`category: "obstacle"`) -- one file per obstacle type:
```json
{
  "id": "obstacle-crate", "category": "obstacle", "type": "crate",
  "label": "Crate", "destructible": true, "hitPoints": 1,
  "color": "#8b5a2b", "tileTexture": "crate"
}
```
`hitPoints: null` means indestructible (infinite hit points, like
`obstacle-platform.json`). `tileTexture` names an
`assets/obstacles/<name>.webp` file (8x8, see "Swapping graphics").

**Power-up** (`category: "powerup"`) -- one file per power-up. Unlike
balls/obstacles, a power-up needs actual *behavior* (what happens when
it's collected), which a JSON file can't express -- so it names a `kind`
from the fixed set in `js/elements.js`'s `POWERUP_BEHAVIORS`
(`instant_score`, `weapon_max_shots`, `weapon_wide_pierce`,
`player_speed_multiplier`, `extra_life`, `score_multiplier`,
`freeze_balls`, `player_shield`) plus a `params` object with that kind's
own numbers:
```json
{
  "id": "powerup-stoptime-6s", "category": "powerup", "type": "time_freeze",
  "label": "Time Freeze", "color": "#48dbfb",
  "durationMs": 6000, "instant": false,
  "kind": "freeze_balls", "params": {}, "pickupSound": "itempick"
}
```
Two power-ups can share a `kind` and just differ in `durationMs`/`params`
-- e.g. `powerup-stoptime-6s.json` and a hypothetical
`powerup-stoptime-12s.json` (with its own `type`, since that's the key
used everywhere else -- effects tracking, HUD, level `powerup` fields) can
both use `kind: "freeze_balls"`. Needs an
`assets/powerups/<type>.webp` icon (9x9, see "Swapping graphics"). Adding
a genuinely new *behavior* (not just a new tuning of an existing one) does
need a new `POWERUP_BEHAVIORS` entry in `js/elements.js`. `pickupSound`
names an `assets/audio/audio.json` entry to play on pickup (falls back to
`"itempick"` if omitted) -- see "Swapping / adding sounds".

### Adding levels

Levels live under `levels/`, one JSON file per level -- `LEVELS.length`
(and the built-in level count) is always exactly how many files are
there, no separate count or manifest to keep in sync. The easiest way to
create one: open the in-game **LEVEL EDITOR**, paint it, then click
**Export** to download a `.json` file already in the right shape, and
drop that file into `levels/` as `level_NN.json` (the next free number,
zero-padded to 2 digits -- `level_11.json`, `level_12.json`, ...).

The file format is exactly `editor.js`'s `buildDef()` output:
```json
{
  "id": 11,
  "name": "My Level",
  "timeLimitSec": 80,
  "obstacles": [{ "type": "crate", "x": 176, "y": 152, "w": 8, "h": 8, "powerup": "shield" }],
  "balls": [{ "shape": "hex", "size": 2, "x": 192, "y": 60, "vx": 45, "vy": -45, "powerup": "extra_life" }]
}
```
`powerup` on an obstacle or ball is optional -- when set, that exact
crate/ball guarantees that power-up drop when destroyed/popped, instead of
the usual random chance. An obstacle can also use `{ "cells": [[dx, dy],
...] }` instead of `w`/`h` for a non-rectangular/stepped shape (the level
editor never produces this itself, but `LevelManager.js` still reads it,
so it's still available for hand-edited files). `type`/`shape` values
must match a `type`/`shape` from some loaded element (see "Adding
elements" above).

`BootScene.js` probes `levels/level_01.json` up to `MAX_LEVEL_FILES` (see
`js/assets.js`) at boot and keeps whichever ones actually exist -- static
hosting can't list a folder's contents, so a 404 for an unused slot is
expected. Raise `MAX_LEVEL_FILES` if the level count ever gets close to it.

### Swapping graphics

Every graphic is a real image file, not code, specifically so it can be
replaced without touching anything else. `js/assets.js` is the single
place each one's filename/texture-key convention is defined (used by both
`BootScene.js`, which loads them, and the entity that displays them). To
swap one, replace the file in place, keeping the same filename and pixel
dimensions:

- **Balls**: `assets/balls/ball_<shape>_<size>.webp` (e.g. `ball_round_1
  .webp`) -- one per `elements/*-ball-*.json` (see "Adding elements"),
  exactly 2x that element's `radius` square (8/16/24/32/48px for round
  sizes 1-5, 8/16/24px for hex sizes 1-3), used at native resolution with
  no runtime scaling -- that's also the ball's physics collision diameter.
- **Player**: `assets/player/player_<state>_<frame>.webp`, each exactly
  `PLAYER_CONFIG.spriteWidth x spriteHeight` (16x32) from `js/config.js`.
  States and frame counts are `PLAYER_ANIM_FRAME_COUNTS` in `js/assets.js`
  -- idle (1 frame), move (2, the walk cycle), shot (2, fired once per
  shot), dead (3, played once per hit). Only right-facing frames are
  needed; Player.js mirrors them for left via `setFlipX`.
- **Obstacles**: `assets/obstacles/<tileTexture>.webp` (`wall.webp`,
  `crate.webp`) -- named by each `elements/obstacle-*.json`'s
  `tileTexture` field, 8x8px, tiled across whatever area a block (or the
  playfield border) covers.
- **Power-ups**: `assets/powerups/<type>.webp` (e.g. `shield.webp`) -- one
  per `elements/powerup-*.json`'s `type`, 9x9px.
- **Projectile / particle**: `assets/projectile.webp` (4x7, stretched to
  the active weapon's width) and `assets/particle.webp` (2x2, always
  tinted at runtime to whatever color a burst effect needs, so keep it
  plain white).

`GameScene.js`, `Ball.js`, `Player.js`, `Obstacle.js`, `Bonus.js`, and
`LevelManager.js` all read `js/elements.js`'s registries and `js/assets.js`
generically, so nothing else needs to change.

### Swapping / adding sounds

Every sound is a real `.ogg` file under `assets/audio/`, driven entirely by
`assets/audio/audio.json` -- game code never hardcodes a filename, volume,
or loop flag; it only ever calls `audio.play('<name>')` or
`audio.playMusic('<name>')` by the sound's config key (see `js/audio.js`'s
`AudioManager`). To swap a sound, just replace its `.ogg` file in place
(same name). To retune one (volume, whether it can overlap itself, ...) or
add a new named sound, edit `audio.json` -- no code change needed either
way as long as the call sites already use that name.

Each entry in `audio.json` looks like:
```json
"balldestroy": { "file": "balldestroy.ogg", "category": "sfx", "volume": 0.7, "mode": "once", "overlap": true }
```
- `file` -- the `.ogg` filename under `assets/audio/`.
- `category` -- `music`, `sfx`, or `ui`. `music`/`sfx`/`ui` volumes are
  bucketed under the two global sliders: `music` uses `musicVolume`,
  `sfx`/`ui` both use `sfxVolume`.
- `volume` -- this sound's own base volume (0-1), multiplied by its
  category's global volume when played.
- `mode` -- `"once"` (a one-shot sfx/ui sound, played via `audio.play()`)
  or `"loop"` (a looping track, played via `audio.playMusic()` -- only
  `category: "music"` entries currently use this).
- `overlap` -- whether the same sound can have more than one instance
  playing at once (e.g. several balls popping the same frame). When
  `false`, a repeat trigger stops the previous instance first, so it never
  stacks.
- `maxDurationMs` (optional) -- hard-stops playback after this many
  milliseconds even if the file itself is longer.

`AudioManager` guarantees, regardless of what individual sounds do:
**music** is always a singleton (`playMusic()` stops whatever track was
playing before starting a new one, and is a no-op if the requested track is
already playing -- so a level restart with the same music group never
duplicates the loop or briefly overlaps two tracks); mute
(`audio.setMuted()`) and the two volume sliders (`audio.setSfxVolume()` /
`audio.setMusicVolume()`) apply globally and update the currently-playing
music track live; short sfx/ui sounds overlap or not purely based on their
own `overlap` flag.

The 17 sounds currently shipped (`assets/audio/*.ogg`) are placeholder
tones/noise bursts generated offline (see the synthesis style used
elsewhere in this file) rather than original audio -- drop in real files
with the same names to replace them, one for one, no other changes needed:
`weaponshoot`, `weaponshootm` (a boosted/rapid shot), `balldestroy`,
`walldestroy`, `playerlifeloose`, `playerlifeget`, `itempick`,
`itemscorerpick` (fruit/bonus-score pickups), `itemshieldget`,
`itemshieldloose` (shield absorbs a hit), `hurryup` (low time remaining),
`gameover`, `levelcomplete`, `superpang` (run-start jingle), `weaponhold`
(picking up a weapon-boosting power-up), and the two looping tracks
`music01`/`music02` (`GameScene.loadLevel()` splits `LEVELS` into two
halves, one track per half, so adding levels keeps both tracks in use).

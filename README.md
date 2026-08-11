# Balloon Buster

A retro pixel-art arcade game inspired by the classic *Pang* / *Buster Bros.*
gameplay: walk left and right along the ground, fire a harpoon straight up,
and pop balls before they pop you. There are two ball shapes -- round balls
(16x16px up to 96x96px, sizes 1-5) that fall under gravity and bounce, and
hex balls (16x16px up to 48x48px, sizes 1-3 only) that ignore gravity and
drift at a constant diagonal speed. Hitting a ball splits it into two balls
one size smaller, one sent left and one right; size-1 balls are destroyed
outright.

Every ball's motion is fully deterministic: each size has fixed speed,
bounce height, and gravity, so two balls of the same size always move and
bounce identically no matter how they got there -- a landing always resets
vertical speed to that size's standard bounce velocity rather than
reflecting whatever speed it fell in at (size 1's bounce, for example,
always takes it from a resting center 8px off the ground up to a peak
96px higher). Levels can also contain obstacles built from 16x16 blocks
(horizontal, vertical, rectangular, or stepped/staircase shapes) that
balls bounce off from any side, correctly, with no clipping or tunneling
even at high speed; breakable obstacles lose only the individual block
that's actually shot, leaving the rest of the shape intact. A single
bounce only ever changes the *direction* of one axis of a ball's velocity
-- a corner hit (a vertical and a horizontal surface both touched in the
same collision) resolves as a vertical bounce, never both axes reversing
at once (see GameScene.js's `onWorldBounds`/`onBallHitObstacle`). Arcade
Physics still zeroes *both* axes' velocity while separating a corner
collision though, so the non-bouncing horizontal axis is explicitly
reasserted to its unchanged direction afterwards (`Ball.reassertHorizontal
()`, tracked via `Ball.hDir`) rather than being left at zero -- without
that, a ball could get stuck bouncing in place on one spot forever.

All graphics and sound are original: pixel art loaded from `.webp` files
under `assets/` (see "Swapping graphics" / "Swapping HUD graphics" below)
and `.ogg` sound loaded through a central `AudioManager` (see "Swapping /
adding sounds"). No copied assets of any kind — nothing from the original
games is reused.

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
(or the deployment step's output in the Actions tab). The deploy
workflow deliberately excludes `admin/` (see "Admin tool" below) --
GitHub Pages can't execute PHP, so publishing it there would just serve
its source as plain static text instead of running it.

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

Holding Shoot fires once per press -- release and press again for another
shot -- unless the `rapid_shot` power-up is active, which auto-fires the
whole time it's held (see `GameScene.updatePlaying`'s `wasShooting`
tracking). Either way, an actual shot still only leaves if under the
active weapon's `maxActiveShots` (see `tryFire`).

## Display size

The playing surface is a fixed 800x420px, bordered on all four sides
(top/left/right/floor) by a 16px wall (`BORDER_THICKNESS` in
`js/constants.js`) -- independent of the 8x8 obstacle/ball placement grid
(`OBSTACLE_BLOCK_SIZE`, 16x16 -- also the smallest ball's size), which is
unaffected. A dedicated 80px HUD strip sits below the bordered playfield
(`HUD_H`), never overlapping gameplay -- 800x500px total.

The canvas does **not** continuously resize with the browser window --
there's no "fit to window" scaling. Instead, Options -> Size picks one of
exactly three fixed display sizes: **0.5x**, **1x** (original), or **2x**
(double), persisted the same way as mute/volume. `js/DisplayZoom.js` sets
the canvas's (and `#game-container`'s) CSS size directly to
`VIRTUAL_W/VIRTUAL_H` times the chosen zoom; `js/PixelText.js`'s DOM menu
text reads that same rendered size back out, so it scales in lockstep
without any separate logic. At 2x the canvas can be larger than the
browser window -- the page scrolls rather than clipping it.

Wherever the game's own background is black (the HUD strip, the page
around/outside the canvas at any zoom level) it's the exact same color
(`COLORS.hudBg` / `style.css`'s `--bg`, `#05040a`), so there's no visible
seam between the canvas and the page behind it.

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
  16x16 blocks (rectangular or stepped shapes), blocking ball movement from
  every side with proper anti-tunneling collision; a multi-block crate
  loses only the block that's actually shot.
- 8 power-ups: bonus fruit, rapid shot, wide harpoon, speed boost, extra
  life, score multiplier, time freeze, shield. A dropped power-up falls
  until it either lands on an obstacle's top surface or reaches the
  ground -- either way it can be collected by walking into it *or*
  shooting it with the harpoon.
- A shield absorbs one hit with no life lost and no interruption; without
  a shield, a hit costs a life and restarts the *current* level from
  scratch (score and remaining lives carry over). Zero lives ends the run.
  Running out of time on a timed level (`GameScene.onTimeUp()`) is exactly
  the same hit -- same shield absorption, same life loss/restart, checked
  every frame the clock stays expired the same way an overlapping ball
  would keep re-triggering a hit.
- A graphic HUD (1-P, life icons, score, weapon socket, time/world/hi-score
  -- see "Swapping HUD graphics") always shows remaining level time, lives,
  and the current weapon (plus score, level, top score, and active timed
  effects in a small DOM overlay).
- Score, lives, a locally-persisted top-10 high score table, and per-level
  unlock progress (`localStorage`, with a versioned schema for safe future
  upgrades) -- see "Start Campaign vs. Start Level" below.
- Full menu flow: main menu, options (mute/volume/fullscreen, split out
  onto its own screen), level select, a graphic level-intro screen (see
  "Swapping intro graphics"), pause, game over, victory, high score
  entry/table, restart. Every screen's headings/buttons/labels are drawn
  with the same bitmap font the HUD uses (`js/PixelText.js`, see "Swapping
  intro graphics") rather than a separate vector CSS font, so the DOM
  overlay and the in-canvas HUD read as one consistent look.
- A graphic level-intro screen -- "LEVEL n", the level's name, then a
  blinking "READY" for 2s and a solid "GO!" for 1s -- entirely composed
  from loaded images (`js/LevelIntro.js`), same as the HUD.
- 18 sounds (sfx, ui, and 3 looping music tracks) driven entirely by
  `assets/audio/audio.json` through a central `AudioManager` -- see
  "Swapping / adding sounds". Music starts exactly when the balls do
  (right as "GO!" ends), switches to a more urgent loop with 15s left on
  the level clock, and stops (for the level-complete/life-lost jingle) the
  instant either happens -- never overlapping itself, and never
  duplicating a loop on level restart. Mute/`musicVolume`/`sfxVolume` are
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
                      DOM overlay for menus/powerup timers/touch controls
                      sits on top -- the always-visible stat bar itself is
                      drawn in Phaser, see js/Hud.js below
style.css            All visual styling, responsive/touch layout
assets/              Every graphic and sound in the game, as real files --
                      see "Swapping graphics" / "Swapping sounds" /
                      "Swapping HUD graphics" below
  balls/             ball_<shape>_<size>.webp
  player/            player.png, a single spritesheet (idle, shot, 4 walk,
                      victory, dead) + shield.webp, the looping shield
                      effect -- see "Swapping graphics" below
  obstacles/         wall.webp, crate.webp
  powerups/          <powerup type>.webp
  backgrounds/       <name>.webp, one per distinct levels/*.json
                      `background` field -- see "Swapping graphics" below
  projectile.webp, particle.webp
  audio/             audio.json (every sound's config) + one .ogg file per
                      sound named there -- see "Swapping sounds" below
  hud/               Fixed labels, two digit spritesheets, the life icon,
                      weapon socket frame, and weapon icon(s) -- see
                      "Swapping HUD graphics" below
  intro/             font_alpha.webp, the A-Z+digits font spritesheet
                      the level-intro screen AND every DOM menu's text
                      are drawn from -- see "Swapping intro graphics" below
elements/            One JSON file per ball size/shape, obstacle type, or
                      power-up, plus index.json listing which to load --
                      see "Adding elements" below
levels/              One level_NN.json per level, in level-editor Export
                      format -- see "Adding levels" below
admin/               A separate, PHP-backed, login-gated site for editing
                      graphics/sounds/elements/levels without touching
                      code -- see "Admin tool" below. Not linked from the
                      game itself; open admin/index.php directly (needs a
                      PHP-capable server, see "Running it locally").
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
                      velocity from input, the shield effect sprite, and
                      5 Phaser animations (idle/move/shot/victory/dead,
                      see assets.js) -- facing is setFlipX, never a
                      separate left/right asset
  Ball.js            Phaser.Physics.Arcade.Sprite: reads its one
                      BALL_ELEMENTS entry (shape+size) for every physical
                      parameter, deterministic landOnTop()/bounce methods,
                      split-children descriptors; hex balls play a looping
                      spin animation (setFrozen pauses/resumes it for
                      time_freeze)
  Projectile.js      Phaser.Physics.Arcade.Sprite for the harpoon shot
  Obstacle.js         Phaser.GameObjects.Rectangle + static Arcade body,
                      representing one obstacle block; destructible via
                      takeHit()
  Bonus.js           Phaser.Physics.Arcade.Sprite for power-up pickups
  LevelManager.js    Owns the LEVELS array (populated by ElementsScene
                      from levels/*.json) and loads a level definition
                      into a GameScene's groups; decomposes each obstacle
                      into independent 16x16 Obstacle blocks (see
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
  Hud.js             The graphic status bar (see "Swapping HUD graphics")
                      -- Phaser Images/digit spritesheets drawn into the
                      HUD_H strip, entirely from loaded files, no drawn
                      text
  ScorePopup.js      The floating "+N" points readout a popped ball
                      leaves behind (see "Swapping graphics"'s "Score
                      popup") -- reuses the HUD's own digit spritesheet,
                      tinted to the ball's color; GameScene owns the live
                      instances (this.scorePopups)
  LevelIntro.js      The graphic level-intro overlay (see "Swapping intro
                      graphics") -- "LEVEL n" + the level's name composed
                      from a loaded A-Z font, then blinking READY/GO!
  PixelText.js       The DOM equivalent of LevelIntro.js's text -- renders
                      any string to a <canvas> from the same font_alpha
                      .webp spritesheet, sized off the game canvas's own
                      current scale (see "Swapping intro graphics")
  ui.js              DOM menus/screens/powerup-timer chips -- every
                      heading/button/score/list label goes through
                      PixelText.js, not plain CSS text
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
  "label": "Round 1", "hasGravity": true, "gravityAccel": 520,
  "radius": 8, "speed": 80, "bounceVelocity": 442, "points": 200,
  "color": "#ff6b6b", "highlight": "#ffb3b3"
}
```
`hasGravity: false` (e.g. a hex ball) ignores `gravityAccel`/
`bounceVelocity` and instead drifts at a constant diagonal speed,
reflecting off walls/floor/ceiling/platforms. However many size entries a
shape has *is* that shape's max size -- there's no separate cap to keep in
sync. `points` is what popping that exact ball awards (`GameScene.popBall`,
scaled by `scoreMultiplier` if active) -- bigger balls are worth more
(200/400/800/1600/3200 for sizes 1-5 today), shown as a floating "+N"
readout (see "Swapping graphics"'s "Score popup" below). `color` also
tints that readout. Needs an `assets/balls/ball_<shape>_<size>.webp` image
at exactly `radius * 2` square (see "Swapping graphics") -- for `hasGravity:
false` shapes this is instead a spin spritesheet, see below.

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
  "background": "default",
  "weapon": "harpoon",
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

`background` names an `assets/backgrounds/<name>.webp` image (see
"Swapping graphics" below) drawn behind the whole playfield; `weapon`
names a `js/config.js` `WEAPON_TYPES` key the player starts the level
with (currently only `"harpoon"` exists, so every level uses it, but the
field is real and level-specific -- adding a second weapon type is purely
a new `WEAPON_TYPES` entry plus an `assets/hud/weapon_<key>.webp` icon, no
per-level plumbing needed). Both are optional and default to
`"default"`/`"harpoon"` respectively if omitted, so older hand-written
level files without them still load. The in-game **LEVEL EDITOR** has a
**Background**/**Weapon** dropdown for both (top panel) -- picking a
background updates the live preview immediately.

`BootScene.js` probes `levels/level_01.json` up to `MAX_LEVEL_FILES` (see
`js/assets.js`) at boot and keeps whichever ones actually exist -- static
hosting can't list a folder's contents, so a 404 for an unused slot is
expected. Raise `MAX_LEVEL_FILES` if the level count ever gets close to it.

### Start Campaign vs. Start Level

The main menu has two ways into `LEVELS`: **Start Campaign**
(`GameScene.startNewGame()`) always begins at level 1; **Start Level**
opens a level-select screen (built by `ui.js`'s `renderLevelSelect()`)
listing every level, and jumps straight into whichever one you pick via
`GameScene.startAtLevel(levelIndex)` -- same fresh score/lives reset as
Start Campaign, just a different starting index. Both are ordinary
(non-custom) runs, so either one can unlock further levels.

A level only shows up as pickable once it's unlocked. Progress is tracked
in `localStorage` (`storage.js`'s `loadProgress()`/`markLevelCleared()`,
same versioned-schema pattern as high scores/settings) as a single
`unlockedLevels` count -- level 1 is always unlocked; clearing level `n`
(`GameScene.levelClear()`, skipped entirely for custom/editor levels)
raises the count to at least `n + 2`, unlocking level `n + 1`. The
level-select screen re-reads this every time it opens, so a level you
just cleared is immediately pickable the next time you back out to it.

### Swapping graphics

Every graphic is a real image file, not code, specifically so it can be
replaced without touching anything else. `js/assets.js` is the single
place each one's filename/texture-key convention is defined (used by both
`BootScene.js`, which loads them, and the entity that displays them). To
swap one, replace the file in place, keeping the same filename and pixel
dimensions:

- **Balls**: `assets/balls/ball_<shape>_<size>.webp` (e.g. `ball_round_1
  .webp`) -- one per `elements/*-ball-*.json` (see "Adding elements"),
  exactly 2x that element's `radius` square (16/32/48/64/96px for round
  sizes 1-5, 16/32/48px for hex sizes 1-3), used at native resolution with
  no runtime scaling -- that's also the ball's physics collision diameter.
  A shape with `hasGravity: false` (hex today) spins, so its file is
  instead a `HEX_SPIN_FRAMES`-frame (3) spritesheet stacked vertically,
  each frame that same square, one rotation phase spaced across the
  shape's own rotational symmetry so the last frame loops back into the
  first seamlessly (see `js/assets.js`'s `ballSpinAnimKey` and
  `BootScene.js`'s `hexSpinFrameRate` for the fixed per-size playback
  speed) -- a `hasGravity: true` shape (round today) never spins, so it
  stays one plain static image.
- **Ball pop effect**: `assets/balls/pop_<shape>_<size>.webp` -- one
  `BALL_POP_FRAMES`-frame (2) spritesheet per ball element, played once
  exactly where that ball popped (`GameScene.popBall`/`playBallPopEffect`)
  in place of the game's generic burst particles. Each frame is
  `POP_FRAME_SCALE` (1.6x) that ball's own diameter square, centered on
  the ball, so the effect has room to expand past the ball's own edges.
- **Score popup**: not a separate asset -- the floating "+N" points
  readout a pop leaves behind (see `js/ScorePopup.js`) reuses the HUD's
  own large score-digit spritesheet (`assets/hud/digits_large.webp`, see
  "Swapping HUD graphics" below), tinted to the popped ball's `color`,
  drawn at half that spritesheet's native size (so it doesn't dominate
  over a small ball's pop effect). Appears 16px above the pop point --
  clear of the pop effect above, which is centered right on the pop point
  -- then over 300ms drifts up another 10px, grows slightly, and fades
  out, all tuned in `js/ScorePopup.js`'s constants.
- **Player**: `assets/player/player.png`, a single spritesheet (not one
  file per frame) of `PLAYER_CONFIG.spriteWidth x spriteHeight` (32x64)
  cells stacked vertically. Frame order is fixed (`PLAYER_ANIM_FRAMES` in
  `js/assets.js`): idle (1), shot
  (1, fired once per shot), 4 walk frames (the walk cycle), victory (1,
  played once when a run ends without a game over), dead (1, played once
  per hit). Every frame is authored facing LEFT; Player.js mirrors it for
  right via `setFlipX`, so swapping the sheet only needs left-facing (or,
  for this game's straight-on chibi style, direction-neutral) art -- keep
  the same 32x(64 x 8) total size and frame order.
- **Shield effect**: `assets/player/shield.webp` -- a `PLAYER_SHIELD_FRAMES`
  -frame (3) looping spritesheet, `PLAYER_CONFIG.shieldSize` (64) square
  per frame, drawn centered on the player the whole time the `shield`
  power-up is active (`Player.js`'s `shieldEffect`). Distinct from the
  power-up's own pickup icon (`assets/powerups/shield.webp`, see below).
- **Obstacles**: `assets/obstacles/<tileTexture>.webp` (`wall.webp`,
  `crate.webp`) -- named by each `elements/obstacle-*.json`'s
  `tileTexture` field, 16x16px (matching `OBSTACLE_BLOCK_SIZE`/
  `BORDER_THICKNESS`, see "Display size" above, so a block/the border
  reads as one clean tile), tiled across whatever area a block (or the
  playfield border) covers.
- **Power-ups**: `assets/powerups/<type>.webp` (e.g. `shield.webp`) -- one
  per `elements/powerup-*.json`'s `type`, 9x9px.
- **Projectile / particle**: `assets/projectile.webp` (8x14, stretched to
  the active weapon's width) and `assets/particle.webp` (2x2, always
  tinted at runtime to whatever color a burst effect needs, so keep it
  plain white).
- **Level backgrounds**: `assets/backgrounds/<name>.webp` -- one per
  distinct `background` value used across `levels/*.json` (see "Adding
  levels"), exactly `VIRTUAL_W x GROUND_Y` (800x404 from `js/constants.js`)
  -- covers the sky area behind obstacles/balls/player; the floor strip and
  HUD bar below it stay solid color regardless (`GameScene.drawBackground`).
  `assets/backgrounds/default.webp` is the one every level ships with today
  (a generated night sky/skyline, see below) and what the level editor
  starts a new level pointed at -- adding a second background is dropping
  a same-size file in this folder and setting some level's `background`
  field (or the editor's dropdown) to its name, no code change.

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
already playing -- so re-requesting the track that's already playing never
duplicates the loop or briefly overlaps two tracks); mute
(`audio.setMuted()`) and the two volume sliders (`audio.setSfxVolume()` /
`audio.setMusicVolume()`) apply globally and update the currently-playing
music track live; short sfx/ui sounds overlap or not purely based on their
own `overlap` flag.

Background music itself follows a small state machine in `GameScene.js`,
all built from that same `playMusic()`/`stopMusic()` pair: `loadLevel()`
only *picks* the level's track (`music01` for the first half of `LEVELS`,
`music02` for the rest) without starting it, so the level-intro's "READY"/
"GO!" stays silent; the LEVEL_INTRO -> PLAYING transition (right as "GO!"
ends) is what actually calls `playMusic()`, so the music starts exactly
when the balls do. From there, `updatePlaying()` switches to the more
urgent `music_hurry` loop the moment 15s are left on a timed level's clock
(a one-time flag reset per `loadLevel()`, same pattern as the older
`hurryup` one-shot ping at 10s), and both `levelClear()` and a life-losing
hit in `onPlayerHitBall()` call `stopMusic()` right before playing their
own jingle (`levelcomplete` / `playerlifeloose`) -- so completing a level
or losing a life always cuts the music first. Every one of those paths
funnels back through the same LEVEL_INTRO -> PLAYING start, so a restarted
or advanced level always begins silent-then-music, never two tracks
overlapping.

The 18 sounds currently shipped (`assets/audio/*.ogg`) are placeholder
tones/noise bursts generated offline (see the synthesis style used
elsewhere in this file) rather than original audio -- drop in real files
with the same names to replace them, one for one, no other changes needed:
`weaponshoot`, `weaponshootm` (a boosted/rapid shot), `balldestroy`,
`walldestroy`, `playerlifeloose`, `playerlifeget`, `itempick`,
`itemscorerpick` (fruit/bonus-score pickups), `itemshieldget`,
`itemshieldloose` (shield absorbs a hit), `hurryup` (a short low-time
ping, independent of the `music_hurry` track switch above), `gameover`,
`levelcomplete`, `superpang` (run-start jingle), `weaponhold` (picking up
a weapon-boosting power-up), and the three looping tracks `music01` /
`music02` (`GameScene.loadLevel()` splits `LEVELS` into two halves, one
track per half, so adding levels keeps both tracks in use) and
`music_hurry` (the last 15s of a timed level).

### Swapping HUD graphics

The always-visible stat bar (score, lives, time, current weapon, world/
level, top score) is drawn entirely from files under `assets/hud/` by
`js/Hud.js`, inside the dedicated `HUD_H` strip below the playfield --
nothing there is drawn text. `js/assets.js`'s `HUD_*` constants are the
single place each file's texture key/path/frame size is defined (used by
both `BootScene.js`, which loads them, and `Hud.js`, which displays them),
same convention as every other graphic. To swap a piece, replace its file
in place, keeping the same filename and pixel dimensions:

- **Digits**: two spritesheets, `assets/hud/digits_large.webp` (used only
  for the score, 12x18px per frame) and `assets/hud/digits_small.webp`
  (used for time/world/hi, 8x12px per frame) -- each exactly 10 frames
  side by side, frame index = the digit it shows (`0`-`9`). Every digit
  and label image ships as plain white pixel art so `Hud.js` can
  `setTint()` each usage independently (e.g. the time value turns red in
  the last 10 seconds) -- swap in colored art instead and the tint just
  multiplies over it, so keep replacements white/light if you want the
  same tinting behavior.
- **Fixed labels**: `assets/hud/hud_1p.webp`, `hud_time_label.webp`,
  `hud_world_label.webp`, `hud_hi_label.webp` -- one static image each,
  12px tall to match the small digit strip.
- **Life icon**: `assets/hud/hud_life.webp` (10x10), drawn once per
  remaining life (up to `Hud.js`'s `MAX_LIVES_ICONS`, currently 5).
- **Weapon socket**: `assets/hud/hud_weapon_frame.webp` (22x22, always
  shown) and one icon per `WEAPON_TYPES` key in `js/config.js` --
  `assets/hud/weapon_<type>.webp` (14x14, e.g. `weapon_harpoon.webp`) --
  named via `assets.js`'s `hudWeaponIconKey()`/`hudWeaponIconPath()`, same
  per-key-file convention as obstacle tiles/power-up icons. Adding a
  second weapon type later is just dropping in its icon file, once
  `WEAPON_TYPES` actually has more than one entry to choose from.

All 9 files currently under `assets/hud/` are placeholder pixel art
(hand-authored bitmap glyphs and simple shapes, generated offline) rather
than final art -- replace any of them with real graphics at the same
filename/dimensions, no code change needed either way.

### Swapping intro graphics (and every DOM menu's text)

The level-intro screen ("LEVEL n", the level's name, then "READY"/"GO!")
is composed entirely by `js/LevelIntro.js` from
`assets/intro/font_alpha.webp` plus the HUD's own large digit strip (for
the level number) -- nothing there is drawn text either. Level names are
arbitrary per-level text (see `levels/*.json`'s `name` field), unlike
every other HUD-style label in this game, so instead of one baked image
per fixed word, this is a real (if uppercase-only) font: a 40-frame
monospaced spritesheet covering space, `A`-`Z`, `!`, `0`-`9`, `:`, and
`.`, each frame a fixed 5x6px cell (see `assets.js`'s `INTRO_FONT_CHARS`
for the exact frame order -- digits/punctuation were appended after the
original letter set so existing frame indices never shifted). `LevelIntro
.js`'s `buildTextRow()` looks up each character's frame and lays the
images out left to right, so composing new fixed text (or a level name
with different characters) needs no new art, only characters this font
already covers -- extend `INTRO_FONT_CHARS`/the generation script's glyph
table for anything else (accented letters, more punctuation, ...). Each
row is drawn at its own `setScale()` (3 for "LEVEL"/"READY"/"GO!", 2 for
the level name) off the one base spritesheet, rather than baking separate
image sizes, since Phaser's pixel-art nearest-neighbor scaling keeps any
integer scale crisp.

**The same spritesheet is also the entire DOM menu system's font.**
`js/PixelText.js` is the DOM equivalent of `LevelIntro.js`'s `buildTextRow
()`: it loads `font_alpha.webp` as a plain `<img>` (outside Phaser
entirely) and renders any string to a `<canvas class="pixel-text">`
(`renderPixelText()`), or replaces an element's whole content with one
(`setPixelText()`, which also sets `aria-label` to the original string,
since a canvas has no text of its own for assistive tech to read). Every
heading, button label, settings-row label, and dynamic score/list text
across the main menu, options, level select, pause, game over, victory,
and high-score screens goes through this -- see `ui.js`'s `STATIC_LABELS`
table and its `renderLevelSelect()`/`renderHighScores()`/`setScreen()`.
The two deliberate exceptions are the live-editable high-score initials
`<input>` (nothing to render ahead of time) and the per-frame powerup-
timer chips (rebuilt every frame; real CSS text is cheaper there than a
fresh canvas 60 times a second) -- both stay plain styled CSS text
instead, see `style.css`.

Sizing is unified too: `PixelText.js`'s named tiers (`h1`/`h2`/`button`/
`body`) are plain multipliers on top of the *actual* game canvas's
current CSS size (read straight from the DOM, not re-derived from the
viewport), so DOM text sits at the same visual scale as its Phaser
counterparts and grows/shrinks in lockstep with the game canvas on
resize/fullscreen -- a `ResizeObserver` on the canvas element (not a
plain `window` resize listener, since Phaser's own Scale Manager can
still be mid-layout on the very first paint) re-renders every live
pixel-text element whenever that size actually changes.

To swap the whole font's look (menus included), replace `assets/intro
/font_alpha.webp` (same 200x6 dimensions, same 40 5x6px frames in the
same order) with new art -- no code change needed. "READY" blinks for
`LEVEL_INTRO_READY_SEC` (2s) then "GO!" holds solid for
`LEVEL_INTRO_GO_SEC` (1s) -- both live in `constants.js`, shared with
`GameScene.js`'s own countdown timer so the two never drift out of sync.

## Admin tool

`admin/` is a second, completely standalone site (its own login, its own
CSS, not linked from the game) for editing the game's content --
graphics, sounds, elements, levels -- without writing any code. It edits
the very same files described above and reuses `js/assets.js`/
`js/config.js` directly (both plain data modules, no Phaser dependency)
so its file paths/naming can never drift out of sync with what the game
actually loads. There's still no database -- but unlike the rest of this
project, **the admin tool itself needs a PHP-capable host to run at
all**, since real login and real server-side saves (see below) both need
a server. The game proper is untouched by this and still needs nothing
but static file hosting (GitHub Pages, any plain web server, or even
`file://`).

```
admin/
  index.php           Requires login (includes/auth.php), then renders
                       the app shell (header, four tab buttons, four
                       empty tab panels filled in by js/main.js) with a
                       CSRF token embedded for js/fsSave.js to use
  login.php            Login form (GET) + handler (POST) -- see "Login"
                       below
  logout.php            Destroys the session, redirects to login.php
  save.php               The only thing any tab's Save button ultimately
                       calls (via js/fsSave.js) -- see "Saving" below
  includes/
    config.php          PROJECT_ROOT + the save whitelist (allowed top-
                       level dirs/extensions) save.php checks against
    auth.php             Session bootstrap, login check/attempt, CSRF
                       token issue/verify -- every one of the *.php pages
                       above starts with `require_once` on this
    .htaccess            Blocks direct requests into this folder on
                       Apache hosts (defense in depth -- these files
                       produce no output if requested directly anyway,
                       see "Login" below)
  style.css            A plain, readable admin-tool look (not the game's
                       pixel font -- this page is dense with JSON text and
                       forms, where a proportional font reads better)
  js/
    fsSave.js          The one function every tab's Save calls: POSTs to
                       save.php (see "Saving" below). One destination, no
                       fallback -- a save either lands on the server or
                       throws with the server's own reason
    util.js            Small shared helpers (fetch-relative-to-project-
                       root JSON loading, DOM element builders)
    graphicsTab.js      Lists every image the game loads (built from
                       elements/*.json + js/assets.js, so it can't go
                       stale) with a live preview and a file-replace +
                       Save button per image
    soundsTab.js        Lists every sound from assets/audio/audio.json --
                       edit category/mode/volume/overlap/max-duration per
                       sound (kept in memory, written back as one
                       audio.json via a page-level Save button), or
                       replace a sound's .ogg file directly
    elementsTab.js       Raw-JSON editor, one card per elements/*.json file
                       (see "Adding elements" above for the field
                       reference), plus an "Add new element" form
                       (per-category starting template) -- saving a new id
                       also rewrites elements/index.json to match
    levelsTab.js          Raw-JSON editor, one card per levels/level_NN.json
                       (see "Adding levels" above), an "Add blank level"
                       button, an "Import" file input for a level-editor
                       Export straight from the game's own Level Editor,
                       and a link to open that Level Editor
    main.js             Tab switching + lazy per-tab loading (each tab
                       only fetches its data the first time it's opened)
```

### Running it locally

```
php -S localhost:8000
```
from the project root, then open `http://localhost:8000/admin/`. Any
real PHP host (Apache + mod_php, Nginx + PHP-FPM, ...) works the same
way, pointed at the project root -- just make sure the web server's user
can write to `elements/`, `levels/`, and `assets/` (that's what
`save.php` actually needs; nothing needs write access to `admin/`
itself).

### "Saves will fail" (write permissions)

`index.php` checks on every load that the account PHP runs as can write
to `elements/`, `levels/` and `assets/`. If it can't, the header turns
red and a banner names the exact problem: which account PHP is
(`webServerUser()` in `includes/config.php`), which folders block it,
who owns them, their mode, and a ready-to-paste `chown`/`chmod` for
those exact paths. This is the one setup problem that would otherwise
make every single Save fail identically, so it's reported once up front
rather than per-card.

The usual cause is that the files were uploaded as a different account
(over SMB/File Station/git) than the one the web server runs as. On a
Synology NAS serving from `/volume1/web/...` that's typically `http`;
on Debian/Ubuntu + Apache it's `www-data`. Fix it over SSH with the
command the banner prints, or in DSM via **File Station → right-click
the folder → Properties → Permission**, adding that account with
Read/Write and ticking "Apply to this folder, sub-folders and files".
Reload the admin page afterwards -- the check re-runs every time.

Nothing needs write access to `admin/` itself; `save.php` deliberately
refuses to write there at all (see "Saving" below).

### Login

Username `bos`, password stored as a bcrypt hash in `includes/auth.php`
(`ADMIN_PASSWORD_HASH`, currently `newpass`) -- change the credential by
generating a new hash (`php -r "echo password_hash('newpass',
PASSWORD_DEFAULT);"`) and pasting the result in. `login.php` sets a real
PHP session on success (`session_regenerate_id()`, `httponly` +
`SameSite=Strict` cookie); `index.php` and `save.php` both call
`requireLogin()`/check the session before doing anything. This is still
a minimal, single-shared-account setup meant for one or two trusted
admins -- there's no per-user accounts, no rate limiting/lockout, no
password reset. Don't expose it beyond a small trusted group without
adding something sturdier in front of it.

### Saving

Every Save button ultimately POSTs to `save.php` as
`multipart/form-data`: a `path` field (project-root-relative, e.g.
`elements/round-ball-1.json`), a `csrf` field (read from `index.php`'s
embedded token), and the new content as a `file` upload (works
identically for text -- elements/levels JSON, audio.json -- and binary --
images -- content, both just become a Blob client-side). `save.php`
rejects anything that isn't logged in, doesn't carry a valid CSRF token,
or targets a path outside `elements/`, `levels/`, or `assets/`, or with
an extension outside `.json`/`.webp`/`.png`/`.ogg` (see
`includes/config.php`'s `ALLOWED_SAVE_DIRS`/`ALLOWED_SAVE_EXTENSIONS`) --
that whitelist is also what stops the endpoint from ever being used to
write a `.php` file somewhere the server would execute it, deliberately
including `admin/` itself being outside the writable set. Path
validation is one regex covering traversal (`..`), the directory
whitelist, and the extension whitelist all at once, plus a second
`realpath()`-based check that the resolved directory is still actually
inside the project root before anything is written.

**Where saves go is fixed in code** -- `PROJECT_ROOT` in
`includes/config.php`, resolved from `admin/`'s own location. The admin
is never asked to pick a folder, and there is no client-side fallback:
an earlier version quietly downloaded the file instead whenever the
server save failed, which made a failed save look exactly like a
successful one. Now a save either lands on the server or the card says
`Save failed: <the server's reason>`. `index.php` also checks up front
that the web server user can actually write to `elements/`, `levels/`
and `assets/`, and shows a red warning in the header if it can't --
that's the one setup problem that would otherwise make every single
Save fail identically.

**If a change doesn't show up in the game**, the save almost certainly
worked -- replacing an image or a sound leaves its URL unchanged, so a
browser that already cached it keeps serving the old copy (the game
loads its assets without any cache-busting query, deliberately, so real
players get normal caching). Hard-refresh the game tab
(<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>); the graphics/sounds
tabs say so in their own "Saved." message. The admin's own preview
re-reads the written file from the server after each save, so what it
shows is what's actually on disk.

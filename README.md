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
- Procedurally generated 8-bit style sound effects and background music.

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
assets/              Every graphic in the game, as real files -- see
                      "Swapping graphics" below
  balls/             ball_<shape>_<size>.webp
  player/            player_<state>_<frame>.webp
  obstacles/         wall.webp, crate.webp
  powerups/          <powerup type>.webp
  projectile.webp, particle.webp
levels/              One level_NN.json per level, in level-editor Export
                      format -- see "Adding levels" below
js/
  vendor/phaser.min.js  Phaser 3 (Arcade Physics build), vendored locally
  main.js            One line: new Phaser.Game(GAME_CONFIG) -- no manual
                      requestAnimationFrame loop anywhere in the project
  GameConfig.js      Phaser.Game config (resolution, Arcade Physics,
                      pixel-art scaling, scene list)
  assets.js          Maps every externally-loaded graphic and every level
                      file to its texture/cache key and file path -- the
                      one place BootScene (loading) and the entities that
                      use them (Ball, Player, Obstacle, ...) both read
                      from, so they can't disagree
  BootScene.js       Loads every graphic and every levels/*.json file (see
                      assets.js), builds the player's Phaser animations,
                      and populates LevelManager's LEVELS -- nothing is
                      drawn procedurally, everything is a loaded file
  GameScene.js       The whole game: state machine, Arcade colliders/
                      overlaps, keyboard input, particle bursts, and the
                      public API (startNewGame/pause/etc.) ui.js talks to
  Player.js          Phaser.Physics.Arcade.Sprite: explicit per-frame
                      velocity from input, shield outline, and 4 Phaser
                      animations (idle/move/shot/dead, see assets.js) --
                      facing is setFlipX, never a separate left/right asset
  Ball.js            Phaser.Physics.Arcade.Sprite: round/hex shape x size
                      1-5, deterministic landOnTop()/bounce methods,
                      split-children descriptors
  Projectile.js      Phaser.Physics.Arcade.Sprite for the harpoon shot
  Obstacle.js         Phaser.GameObjects.Rectangle + static Arcade body,
                      representing one obstacle block; destructible via
                      takeHit()
  Bonus.js           Phaser.Physics.Arcade.Sprite for power-up pickups
  LevelManager.js    Owns the LEVELS array (populated by BootScene from
                      levels/*.json) and loads a level definition into a
                      GameScene's groups; decomposes each obstacle into
                      independent 8x8 Obstacle blocks (see
                      OBSTACLE_BLOCK_SIZE)
  config.js          Gameplay tuning values + extensibility registries
                      (ball shapes/sizes, weapon, power-ups, obstacles) --
                      engine-agnostic, untouched by the Phaser migration
  constants.js        Technical constants (resolution, ground line,
                      obstacle block size, palette)
  weapons.js         Weapon state + power-up effect timers
  audio.js           Synthesized SFX + procedural music (Web Audio API --
                      there are no audio files, so Phaser's file-based
                      Sound Manager doesn't apply here)
  input.js           Thin DOM bridge for the on-screen touch buttons only
                      (keyboard is native Phaser input, see GameScene)
  ui.js              DOM menus/HUD/screens
  storage.js         Versioned localStorage persistence
  editor.js          In-browser level editor (grid-snapped painting,
                      Export/Import) -- see "Adding levels" below
  debug.js           Debug overlay (Phaser Graphics) and dev tools
```

### Adding content

The architecture is data-driven so new content doesn't require touching
core game logic:

- **New ball shape**: add an entry to `BALL_SHAPES` in `js/config.js`, plus
  an image per size it supports -- see "Swapping graphics".
- **New ball size tier**: append an entry to `BALL_SIZES` in `js/config.js`
  (radius, speed, bounceVelocity, gravity, points), plus an image for it
  per shape that uses it.
- **New obstacle type** (e.g. more hit points, or indestructible): add an
  entry to `OBSTACLE_TYPES` in `js/config.js`, with a `tileTexture` name
  pointing at a file under `assets/obstacles/`.
- **New power-up**: add an entry (with its own `apply()`/`revert()`) to
  `POWERUP_TYPES` in `js/config.js` and an icon under `assets/powerups/`
  -- it also shows up automatically as a quick-spawn button in debug mode
  and as an option in the level editor's powerup dropdown.
- **New level**: drop a new `levels/level_NN.json` file in -- see "Adding
  levels" below.

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
so it's still available for hand-edited files).

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
  .webp`) -- one per `BALL_SHAPES` x `BALL_SIZES` entry in `js/config.js`,
  exactly 2x that size's `radius` square (8/16/24/32/48px for round sizes
  1-5, 8/16/24px for hex sizes 1-3), used at native resolution with no
  runtime scaling -- that's also the ball's physics collision diameter.
- **Player**: `assets/player/player_<state>_<frame>.webp`, each exactly
  `PLAYER_CONFIG.spriteWidth x spriteHeight` (16x32) from `js/config.js`.
  States and frame counts are `PLAYER_ANIM_FRAME_COUNTS` in `js/assets.js`
  -- idle (1 frame), move (2, the walk cycle), shot (2, fired once per
  shot), dead (3, played once per hit). Only right-facing frames are
  needed; Player.js mirrors them for left via `setFlipX`.
- **Obstacles**: `assets/obstacles/<tileTexture>.webp` (`wall.webp`,
  `crate.webp`) -- named by each `OBSTACLE_TYPES` entry's `tileTexture`
  field in `js/config.js`, 8x8px, tiled across whatever area a block (or
  the playfield border) covers.
- **Power-ups**: `assets/powerups/<type>.webp` (e.g. `shield.webp`) -- one
  per `POWERUP_TYPES` entry, 9x9px.
- **Projectile / particle**: `assets/projectile.webp` (4x7, stretched to
  the active weapon's width) and `assets/particle.webp` (2x2, always
  tinted at runtime to whatever color a burst effect needs, so keep it
  plain white).

`GameScene.js`, `Ball.js`, `Player.js`, `Obstacle.js`, `Bonus.js`, and
`LevelManager.js` all read these registries/`js/assets.js` generically, so
nothing else needs to change.

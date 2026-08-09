# Balloon Buster

A retro pixel-art arcade game inspired by the classic *Pang* / *Buster Bros.*
gameplay: walk left and right along the ground, fire a harpoon straight up,
and pop balls before they pop you. There are two ball shapes -- round balls
that fall under gravity and bounce, and hex balls that ignore gravity and
drift at a constant diagonal speed -- each in sizes 1 (smallest) to 5
(largest). Hitting a ball of size 2-5 splits it into two balls one size
smaller, one sent left and one right; size-1 balls are destroyed outright.

Every ball's motion is fully deterministic: each size has fixed speed,
bounce height, and gravity, so two balls of the same size always move and
bounce identically no matter how they got there -- a landing always resets
vertical speed to that size's standard bounce velocity rather than
reflecting whatever speed it fell in at. Levels can also contain solid
obstacles that balls bounce off from any side (top/bottom/left/right,
correctly, with no clipping or tunneling even at high speed); some
obstacle types can be shot down by the player, after which balls pass
freely through the space they occupied.

All graphics are original, hand-authored pixel art (drawn from plain JS
pixel-grid data, not image files), and all sound effects and music are
synthesized at runtime with the Web Audio API. No copied assets of any
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
- 2 ball shapes (round, hex) x 5 sizes, each with fixed, deterministic
  physics; splitting one size smaller (one left, one right) per hit.
- Obstacles: indestructible platforms and shootable crates, both blocking
  ball movement from every side with proper anti-tunneling collision.
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

- Toggle with **F1** or the **`** (backtick) key, or load the page with
  `?debug=1` in the URL.
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
js/
  vendor/phaser.min.js  Phaser 3 (Arcade Physics build), vendored locally
  main.js            One line: new Phaser.Game(GAME_CONFIG) -- no manual
                      requestAnimationFrame loop anywhere in the project
  GameConfig.js      Phaser.Game config (resolution, Arcade Physics,
                      pixel-art scaling, scene list)
  BootScene.js       Generates every texture procedurally at boot (pixel
                      grids, Graphics-drawn shapes, glyph icons) and
                      registers them with Phaser's texture manager
  GameScene.js       The whole game: state machine, Arcade colliders/
                      overlaps, keyboard input, particle bursts, and the
                      public API (startNewGame/pause/etc.) ui.js talks to
  Player.js          Phaser.Physics.Arcade.Sprite: explicit per-frame
                      velocity from input, shield outline, walk animation
  Ball.js            Phaser.Physics.Arcade.Sprite: round/hex shape x size
                      1-5, deterministic landOnTop()/bounce methods,
                      split-children descriptors
  Projectile.js      Phaser.Physics.Arcade.Sprite for the harpoon shot
  Obstacle.js         Phaser.GameObjects.Rectangle + static Arcade body;
                      destructible via takeHit()
  Bonus.js           Phaser.Physics.Arcade.Sprite for power-up pickups
  LevelManager.js    Loads a levels.js definition into a GameScene's groups
  config.js          Gameplay tuning values + extensibility registries
                      (ball shapes/sizes, weapon, power-ups, obstacles) --
                      engine-agnostic, untouched by the Phaser migration
  constants.js        Technical constants (resolution, ground line, palette)
  levels.js          The 10 level definitions (untouched by the migration)
  weapons.js         Weapon state + power-up effect timers
  audio.js           Synthesized SFX + procedural music (Web Audio API --
                      there are no audio files, so Phaser's file-based
                      Sound Manager doesn't apply here)
  input.js           Thin DOM bridge for the on-screen touch buttons only
                      (keyboard is native Phaser input, see GameScene)
  ui.js              DOM menus/HUD/screens
  storage.js         Versioned localStorage persistence
  sprites.js         Hand-authored pixel-grid data + canvas builders,
                      consumed by BootScene
  debug.js           Debug overlay (Phaser Graphics) and dev tools
```

### Adding content

The architecture is data-driven so new content doesn't require touching
core game logic:

- **New ball shape**: add an entry to `BALL_SHAPES` in `js/config.js`.
- **New ball size tier**: append an entry to `BALL_SIZES` in `js/config.js`
  (radius, speed, bounceVelocity, gravity, points).
- **New obstacle type** (e.g. more hit points, or indestructible): add an
  entry to `OBSTACLE_TYPES` in `js/config.js`.
- **New power-up**: add an entry (with its own `apply()`/`revert()`) to
  `POWERUP_TYPES` in `js/config.js` -- it also shows up automatically as a
  quick-spawn button in debug mode.
- **New level**: append a new object to `LEVELS` in `js/levels.js`, with
  its own `obstacles` and `balls` arrays.

`GameScene.js`, `Ball.js`, and `LevelManager.js` all read these registries
generically, so nothing else needs to change.

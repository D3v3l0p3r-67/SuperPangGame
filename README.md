# Balloon Buster

A retro pixel-art arcade game inspired by the classic *Pang* / *Buster Bros.*
gameplay: walk left and right along the ground, fire a harpoon straight up,
and pop balloons before they pop you. Every balloon splits into smaller
ones when hit, until the smallest size disappears for good.

All graphics are original, hand-authored pixel art (drawn from plain JS
pixel-grid data, not image files), and all sound effects and music are
synthesized at runtime with the Web Audio API. No copied assets of any
kind — nothing from the original games is reused.

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

- 10 hand-tuned levels with increasing difficulty (more balloons, new
  balloon behaviors, tighter time bonuses).
- 4 balloon kinds (normal, zigzag, heavy, splitter) layered on top of 4
  size tiers.
- 7 power-ups: rapid shot, wide harpoon, speed boost, extra life, score
  multiplier, time freeze, shield.
- Score, lives, and a locally-persisted top-10 high score table
  (`localStorage`, with a versioned schema for safe future upgrades).
- Full menu flow: main menu, level intro, pause, game over, victory,
  high score entry/table, restart.
- Procedurally generated 8-bit style sound effects and background music.

## Debug mode

Useful while tuning levels or balloon behavior:

- Toggle with **F1** or the **`** (backtick) key, or load the page with
  `?debug=1` in the URL.
- Shows an FPS counter, the current game state/level, and live entity
  counts.
- Draws collision bounds for the player, balloons, projectiles, power-ups,
  and platforms directly over the game.
- Includes a small panel to spawn any balloon kind or power-up on demand,
  or jump straight to any level, without replaying the whole game.

## Project structure

```
index.html          Canvas + DOM overlay (menus, HUD, touch controls)
style.css            All visual styling, responsive/touch layout
js/
  main.js            Bootstrap + fixed-timestep game loop
  config.js          Gameplay tuning values + extensibility registries
                      (balloon kinds, weapon, power-ups)
  constants.js        Technical constants (resolution, physics, palette)
  game.js            State machine, update/render orchestration
  entities.js        Player, Projectile, Balloon, PowerUp, Platform, Particle
  levels.js          The 10 level definitions
  weapons.js         Weapon firing + power-up effect timers
  physics.js         Collision math (circle-based for balloons, AABB elsewhere)
  audio.js           Synthesized SFX + procedural music
  input.js           Unified keyboard + touch input state
  ui.js              DOM menus/HUD/screens
  storage.js         Versioned localStorage persistence
  sprites.js         Hand-authored pixel-art sprite data
  debug.js           Debug overlay and dev tools
```

### Adding content

The architecture is data-driven so new content doesn't require touching
core game logic:

- **New balloon kind**: add an entry to `BALLOON_KINDS` in `js/config.js`.
- **New power-up**: add an entry (with its own `apply()`/`revert()`) to
  `POWERUP_TYPES` in `js/config.js`.
- **New level**: append a new object to `LEVELS` in `js/levels.js`.

`game.js`, `entities.js`, and `physics.js` all read these registries
generically, so nothing else needs to change.

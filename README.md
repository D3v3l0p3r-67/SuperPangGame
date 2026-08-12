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
248px higher). Levels can also contain obstacles built from 16x16 blocks
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
| Move | Arrow Left/Right or A/D | Joystick left/right |
| Climb a ladder | Arrow Up/Down or W/S | Joystick up/down |
| Shoot | Space, Arrow Up, or W | On-screen shoot button |
| Pause | Esc or P | On-screen pause button |
| Fullscreen | Button in menu/pause screen | Same |

Touch controls appear automatically on devices with a coarse pointer
(phones/tablets); they're always available in fullscreen too.

Shoot fires once per press, for every weapon and power-up alike -- the
key/button has to be released and pressed again for another shot, so
holding it down does nothing (see `GameScene.updatePlaying`'s
`wasShooting` tracking). A shot still only leaves if under the active
weapon's `maxActiveShots` (see `tryFire`), which is what `rapid_shot`
raises -- it changes how many shots may be in the air at once, never how
the trigger reads.

**Up is both the shoot key and the climb key.** A press of it means climb
whenever there is a ladder to spend it on -- standing at the foot of one,
or already holding one -- and means shoot otherwise, so away from ladders
nothing about shooting has changed. Space and the touch button mean
nothing but "shoot", which is what keeps shooting available with both
hands on a ladder; they carry their own separate press-tracking for
exactly that reason (see `GameScene.updatePlaying`).

## Weapons

Two of the three are BEAMS: the foot stays on the ground the player fired
from and the head climbs (`js/Projectile.js`). The whole length is lethal,
not just the leading edge, so a ball drifting into the middle of an
already-extended shot still pops. Which weapon a level gives the player is
the level file's `weapon` field; all three are offered by the **LEVEL
EDITOR**'s Weapon dropdown and the debug panel's **Give weapon** row, so
any can be tried without editing a file.

| | Harpoon | Grapple | Machine Gun |
|---|---|---|---|
| kind | beam | beam | volley of darts |
| speed | 440 px/s | 400 px/s | 520 px/s |
| in the air at once | 1 shot | 1 shot | 3 volleys (12 darts) |
| on reaching the ceiling | ends | anchors for 4s | splashes and stops |

The **grapple** is the reason the beam has phases. Topping out doesn't end
it: it catches hold for `ceilingStickSec` (4s), staying lethal
along its full ground-to-ceiling length the whole time, which makes it a
standing barrier balls cannot cross rather than a single strike. It
catches under an indestructible obstacle the same way it catches under the
ceiling -- a block it could never shoot through is something to hang from,
not something to waste the shot on -- so a level's layout gives the player
places to string a barrier at other heights. Destructible blocks still
take the hit and stop the shot, so the grapple can't be used to skip
breaking them open. Its last
`ceilingReleaseWarnSec` (1s) is spent in a third, "letting go" state --
still solid, just drawn differently, so the barrier's expiry is
telegraphed instead of sudden. Each phase has its own cell in the shot
spritesheet (`assets.js`'s `WEAPON_SHOT_FRAMES`), so the three states are
visibly different rather than something the player has to infer. All three
cells draw the same rope and shank and differ only in the head -- a closed
point while it climbs, the claws thrown flat against the ceiling while it
holds, and sprung off it as it lets go -- so the phases read as one object
changing rather than three unrelated shots. The two live states are drawn
in the harpoon's own pale slate; only the release frame carries colour, so
the one thing on the rope that stands out is the warning.

One shot in the air at a time is the base state for both weapons; the
`rapid_shot` power-up grants a second slot for its duration. For the
grapple that means an anchored shot is normally the player's only shot
until it lets go -- putting up a barrier costs the next four seconds of
shooting, unless rapid_shot is running.

Giving a weapon `ceilingStickSec` is all it takes to make it stick --
`js/Projectile.js` reads it off the weapon definition.

The **machine gun** is the one that isn't a beam. A `volley` block on its
weapon entry is what marks it, and `js/Bullet.js` takes over from
`Projectile.js`: one press puts up four short darts, fanned a few degrees
apart so the group covers more ground the higher it climbs rather than
staying a 4-wide comb. What it limits is how many VOLLEYS are in the air
(three), not how many darts -- counting darts would mean the first press
spent the whole allowance. A dart that stops on something it cannot break
-- the ceiling, a side wall, an indestructible block -- leaves a splash
(`assets/weapons/bullet_hit.webp`, the same two-frame sheet layout as
every other effect in the game).

Bullet.js deliberately answers the same calls GameScene already makes on a
beam (`updateBeam`, `registerHit`, `isAnchored`/`anchorAt`), so both kinds
share one projectile group and every collider set up for beams works for
darts untouched -- only `tryFire` knows the difference.

`rapid_shot` adds one shot to whatever is held rather than setting an
absolute number: an absolute value would have NERFED the machine gun,
whose own base of three is higher than the power-up's.

## Regions

A campaign run travels. Every `LEVELS_PER_REGION` (`js/config.js`, 5)
levels it arrives on a new continent, and the background -- built around
that continent's landmark -- and the background music change together, so
five levels in a row read as one place rather than five unrelated screens.

The itinerary is `levels/regions.json`, read at boot into `js/regions.js`'s
`REGIONS`, the same kind of registry as `LEVELS` and `BALL_ELEMENTS`. Order
is the route. Each entry names an `assets/backgrounds/<background>.webp`,
an `audio.json` music key, and where the region sits on the world map:

| # | region | landmark | levels |
|---|---|---|---|
| 1 | Europe | Eiffel Tower | 1-5 |
| 2 | Africa | pyramids and sphinx | 6-10 |
| 3 | Middle East | dome and minarets | 11-15 |
| 4 | India | Taj Mahal | 16-20 |
| 5 | Asia | pagoda and Mt Fuji | 21-25 |
| 6 | Oceania | Opera House and harbour bridge | 26-30 |
| 7 | Pacific | moai and a volcano | 31-35 |
| 8 | South America | terraced peaks | 36-40 |
| 9 | America | Statue of Liberty | 41-45 |
| 10 | Arctic | icebergs under an aurora | 46-50 |

Each region has its own track: the same three-voice chiptune as the
generic ones, but each in its own scale and tempo (Europe minor, Asia
pentatonic, Africa percussion-led, America a blues shuffle, Middle East
harmonic minor, Arctic the slowest and sparsest of the ten), so the change
of place is audible as well as visible. They are encoded at 22 kHz --
square/triangle/noise material has nothing above ~8 kHz to lose, and ten
tracks at full rate came to over 8 MB, which is a lot to put in front of a
browser game.

Adding a continent is an entry in `regions.json` plus its background and
its `.ogg` -- no code. `regionIndexForLevel` clamps rather than wraps, so
levels past the end of the route stay on the last continent instead of
flying back to the start mid-run.

The 50 levels and 10 regions line up exactly: five levels on each
continent, nine flights across a run.

Panic Mode and editor playtests are not on the itinerary and keep the
default background and the generic `music02`/`music01`.

### The flight between them

Crossing to a new continent doesn't just cut. The level transition covers
the screen as usual, but uncovers onto a world map
(`js/WorldMapInterlude.js`) with the whole route marked on it, and a plane
flies the leg just earned along a bowed dotted trail that fills in behind
it. The destination's name is composed from the same loaded font the
level-intro uses. Once the plane lands the map fades, and only then does
the new level's own "LEVEL n / READY / SET / GO" begin.

Like the transition it wraps, the interlude is not a game state -- it
spans the same `LEVEL_CLEAR`-to-`LEVEL_INTRO` handover and is ticked from
`update()` outside the state switch. Marker positions in `regions.json`
are in the map image's **own** pixels; the interlude scales them to
however large it draws the map, so re-authoring `assets/ui/worldmap.webp`
at another size doesn't invalidate them.

## Level transitions

Clearing a campaign level doesn't cut straight to the next one: the
playfield is hidden with an effect, the next level is built underneath it,
and the effect is drawn back off. The swap happens on the single frame the
screen is fully covered, so it can never be seen happening.

Effects live in `js/LevelTransition.js`'s `LEVEL_TRANSITIONS`, the same
kind of named registry as `WEAPON_TYPES` and `POWERUP_BEHAVIORS`, and
`js/config.js`'s `LEVEL_TRANSITION` names the one that plays. Changing the
effect is that one word; each effect carries its own `durationSec`, so
there is nothing else to keep in step.

| name | what it does |
|---|---|
| `fade` | cross-fade through black |
| `wipe` | a solid edge sweeping down, then off the bottom |
| `iris` | four edges closing in on the centre and opening out |
| `shutter` | horizontal slats drawing in from alternating sides |

Adding one is a new entry with a `label`, a `durationSec` and a
`draw(graphics, amount, covering)` -- `amount` runs 0 to 1 across each half
and `covering` says which half it is, so an effect only has to be opaque at
1 and transparent at 0. Effects cover the playfield and not the HUD bar, so
the score and lives stay readable straight through. The debug panel's
**Level transition** row plays any of them on demand, without having to
clear a level to see it.

Only the level-to-level step gets one. Finishing the run doesn't -- there
is no next level to reveal, just the victory screen -- and neither does a
level restarting after a lost life.

## Display size

The canvas is a fixed 800x500px. It splits into the bordered playing
surface and a HUD strip below it, and the split is derived rather than
picked: the interior -- ceiling to ground -- is rounded down to a whole
number of 16x16 obstacle/ball placement cells (`OBSTACLE_BLOCK_SIZE`, also
the smallest ball's size), which works out to 800x384, or 24 rows. Add the
16px wall on all four sides (`BORDER_THICKNESS` in `js/constants.js`,
deliberately its own constant) and the playfield is 800x416 with the ground
line at y=400; whatever is left over goes to the HUD strip, which never
overlaps gameplay.

Rounding the interior to whole cells is what makes the placement grid line
up with the drawn border at both ends. A leftover fraction of a cell would
have to show somewhere -- a gap under the ceiling, or obstacles unable to
rest on the floor -- and it would leave one row a different height from
every other, which would break the player's step-up (every row has to be
exactly one step above the one below).

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

- 50 levels of increasing difficulty (more and larger balls, more hex
  balls and obstacles mixed in, tighter clocks), grouped five to a
  continent with a structural idea of its own for each: arches in the
  Middle East, strict left-right symmetry in India, pagoda tiers in Asia,
  a rising swell of shelves in Oceania, standing stones in the Pacific,
  climbing terraces in South America, a grid of slabs in America, long ice
  overhangs in the Arctic. Level 1 has no obstacles at all -- 8
  smallest-size balls (4 heading left, 4 right, each bouncing off a wall
  before its path can ever reach the player) for a gentle but active first
  look at movement, shooting, and ball physics.
- Every level is checked for solvability before it ships. The player
  cannot jump: the beam leaves their feet and climbs straight up, so a
  ball is shootable exactly when the column between it and the floor is
  clear. Two layout mistakes break that -- an obstacle standing on the
  ground (which could never be shot, and would split the floor for good)
  and a run of obstacles spanning wall to wall (which would trap whatever
  rests on it out of reach) -- and neither is allowed. On top of the
  geometry check, every level's balls are simulated with no player and no
  shooting, and each one must reach a position where that column is
  clear. A level file gives a hex ball only its horizontal speed and the
  vertical direction is drawn at random when it spawns, so whether a level
  works must not depend on that coin flip: the simulation is run twice,
  once with every hex ball starting upward and once downward. Balls never
  collide with each other, so their paths are independent and those two
  runs cover every ball in both of its possible states.
- 2 ball shapes: round (sizes 1-5) and hex (sizes 1-3 only), each with
  fixed, deterministic physics; splitting one size smaller (one left, one
  right) per hit.
- Obstacles: indestructible platforms and shootable crates, built from
  16x16 blocks (rectangular or stepped shapes), blocking ball movement from
  every side with proper anti-tunneling collision; a multi-block crate
  loses only the block that's actually shot.
- The **LEVEL EDITOR** places obstacles on rows counted up from the
  ground, so the bottom row rests on the floor and a stack of them is a
  staircase the player can climb. The interior is a whole number of rows
  (see "Display size"), so the top row is flush against the ceiling too.
- **Ladders** (48x96, three by six blocks) are climbable scenery rather
  than obstacles: nothing collides with one, so balls and shots pass
  straight through, and so does the player -- which is what lets a ladder
  carry them up through the platform it ends against. Press up at the foot
  of one (or down from its top, or from any platform it runs past) to take
  hold; up and down then climb it, left and right do nothing, and shooting
  still works with Space. The player stays on until an end: at the bottom
  they step off onto whatever is under it, at the top onto whatever is up
  there -- and if there is nothing to stand on at the top they simply stop
  and keep holding rather than being dropped the whole way back down.
  Ladders stack, so a taller run is several of them end to end and the
  seams are invisible to the climb.
- The player walks up a ledge one obstacle block (`PLAYER_STEP_UP_PX`,
  16px) high without jumping -- it cannot jump at all -- so a run of
  stacked blocks is a staircase. Anything taller, or without room to
  stand on top, is still a wall it stops at: that headroom test is what
  keeps a wall built of stacked blocks from being a ladder.
- The level-select screen lists all 50 at once in three columns filled
  top-to-bottom (1-17, 18-34, 35-50) with no scrollbar -- a scroller would
  hide exactly the later levels you are most likely looking for.
- 50 campaign levels across 10 continents: every `LEVELS_PER_REGION` (5)
  levels the background, the landmark in it and the music all change
  together, and the leg between them is flown on a world map (see
  "Regions" below).
- A level-to-level transition effect in campaign runs (fade / wipe / iris
  / shutter, see "Level transitions" below) -- swappable by name.
- 3 weapons, chosen per level (`js/config.js`'s `WEAPON_TYPES`, see
  "Weapons" below): the **harpoon**, which ends the moment it tops out,
  the **grapple**, which anchors to the ceiling for 4s and keeps killing
  along its whole length while it hangs there, and the **machine gun**,
  which fires fanned volleys of four darts, three volleys at a time.
  `rapid_shot` adds one more shot to whichever is in hand.
- 7 power-ups: bonus fruit, rapid shot, speed boost, extra life, score
  multiplier, time freeze, shield. A dropped power-up falls
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
- A graphic HUD (1-P, life icons, score, weapon socket, time/level/hi-score,
  active power-up icons + countdowns -- see "Swapping HUD graphics")
  always shows remaining level time, lives, score, level, top score, and
  every currently active power-up -- entirely drawn in Phaser, no DOM
  overlay for any of it. Picking up `rapid_shot` swaps the weapon socket's
  own icon to match for as long as it's active.
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
  power-up, and all the others); one button per weapon under **Give
  weapon**, which hands it to the player directly -- a weapon is a
  property of the level rather than something that drops, so there is no
  pickup to spawn -- without cancelling a weapon power-up that happens to
  be running; jump straight to any level -- all without replaying the
  whole game or affecting normal play when the panel is off. The power-up
  and weapon rows are both built from their registries (`POWERUP_TYPES`,
  `WEAPON_TYPES`), so a new entry appears in the panel on its own, as does
  the **Level transition** picker's list (`LEVEL_TRANSITIONS`), which plays
  any transition effect on demand.
- Lives above the playfield's own ceiling, in a `#tool-bar` row shared
  with the level editor's own panel (editor on the left, debug on the
  right, see index.html/style.css) -- never overlapping actual gameplay
  the way an in-canvas overlay would.

## Project structure

```
index.html          Phaser injects its own canvas into #game-container;
                      DOM overlay for menus/touch controls sits on top --
                      the always-visible stat bar (including active
                      power-up timers) is drawn in Phaser, see js/Hud.js
                      below
style.css            All visual styling, responsive/touch layout
assets/              Every graphic and sound in the game, as real files --
                      see "Swapping graphics" / "Swapping sounds" /
                      "Swapping HUD graphics" below
  balls/             ball_<shape>_<size>.webp
  player/            player.png, a single spritesheet (idle, shot, 4 walk,
                      victory, dead) + shield.webp, the looping shield
                      effect -- see "Swapping graphics" below
  obstacles/         wall.webp, crate.webp
  ladders/           <ladder texture>.webp, the whole element at its
                      authored size (48x96) rather than a repeating tile,
                      but drawn to be seamless top-to-bottom so stacked
                      ladders keep their rung spacing across the join
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
  Ladder.js          Climbable scenery: a rectangle and a picture, with no
                      physics body at all -- see Player.js for the climb
  elements.js        BALL_ELEMENTS/OBSTACLE_TYPES/LADDER_TYPES/
                      POWERUP_TYPES -- empty
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
  LevelTransition.js The LEVEL_TRANSITIONS effect registry plus the
                      overlay that runs one between campaign levels (see
                      "Level transitions")
  regions.js         The REGIONS registry (populated by ElementsScene from
                      levels/regions.json) and which region a level is in
  WorldMapInterlude.js The world map + plane flight played when a campaign
                      run crosses to a new continent (see "Regions")
  LevelIntro.js      The graphic level-intro overlay (see "Swapping intro
                      graphics") -- "LEVEL n" + the level's name composed
                      from a loaded A-Z font, then blinking READY/GO!
  PixelText.js       The DOM equivalent of LevelIntro.js's text -- renders
                      any string to a <canvas> from the same font_alpha
                      .webp spritesheet, sized off the game canvas's own
                      current scale (see "Swapping intro graphics")
  ui.js              DOM menus/screens -- every heading/button/score/list
                      label goes through PixelText.js, not plain CSS text
  storage.js         Versioned localStorage persistence
  editor.js          In-browser level editor (grid-snapped painting,
                      Export/Import) -- see "Adding levels" below
  debug.js           Debug overlay (Phaser Graphics) and dev tools
```

### Adding elements

A ball size/shape, obstacle type, ladder, or power-up is a JSON file under
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
  "radius": 8, "speed": 80, "bounceVelocity": 508, "points": 200,
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

A `"category": "ladder"` element instead names a `texture` and its own
`width`/`height` (whole obstacle blocks -- the editor snaps to them and
`Player.js` measures the climb against them), backed by an
`assets/ladders/<texture>.webp` image. It gets an editor brush of its own
automatically, same as a ball size does.

**Power-up** (`category: "powerup"`) -- one file per power-up. Unlike
balls/obstacles, a power-up needs actual *behavior* (what happens when
it's collected), which a JSON file can't express -- so it names a `kind`
from the fixed set in `js/elements.js`'s `POWERUP_BEHAVIORS`
(`instant_score`, `weapon_max_shots`,
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
`assets/powerups/<type>.webp` icon (18x18, see "Swapping graphics"). Adding
a genuinely new *behavior* (not just a new tuning of an existing one) does
need a new `POWERUP_BEHAVIORS` entry in `js/elements.js`. `pickupSound`
names an `assets/audio/audio.json` entry to play on pickup (falls back to
`"itempick"` if omitted) -- see "Swapping / adding sounds".

### Adding levels

Levels live under `levels/`, one JSON file per level -- `LEVELS.length`
(and the built-in level count) is always exactly how many files are
there, no separate count or manifest to keep in sync. The easiest way to
create one: open the in-game **LEVEL EDITOR**, paint it (left-click/drag
places whatever brush is selected; right-click always erases whatever's
under the cursor instead, regardless of the selected brush, alongside the
dedicated **Erase** brush), then click **Export** to download a `.json`
file already in the right shape, and drop that file into `levels/` as
`level_NN.json` (the next free number, zero-padded to 2 digits --
`level_11.json`, `level_12.json`, ...).

The file format is exactly `editor.js`'s `buildDef()` output:
```json
{
  "id": 11,
  "name": "My Level",
  "timeLimitSec": 80,
  "background": "default",
  "weapon": "harpoon",
  "obstacles": [{ "type": "crate", "x": 368, "y": 288, "w": 16, "h": 16, "powerup": "shield" }],
  "ladders": [{ "type": "ladder", "x": 368, "y": 304 }],
  "balls": [{ "shape": "hex", "size": 2, "x": 400, "y": 120, "vx": 45, "vy": -45, "powerup": "extra_life" }]
}
```
`ladders` is optional and only written when there is one -- every level
that predates ladders simply has no such key. A ladder entry is a type and
a top-left corner; its size comes from the element (see "Adding elements"),
so a taller run is several entries stacked rather than a height field.
An obstacle's `x`/`y`/`w`/`h` are on the 16x16 grid, and so is a ball,
though a ball's `x`/`y` is its CENTRE rather than a corner -- the grid cell
is its bounding box's top-left, so a ball sits on the grid when `x - radius`
and `y - radius` do. Every shipped level follows both rules, which is what
makes opening one in the **LEVEL EDITOR** and saving it back give the same
level: the editor snaps whatever it loads, so anything off the grid would
quietly move.

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
with -- `"harpoon"` or `"grapple"` (see "Weapons" below); adding a third
is purely a new `WEAPON_TYPES` entry plus an `assets/hud/weapon_<key>.webp`
icon, no per-level plumbing needed. Both are optional and default to
`"default"`/`"harpoon"` respectively if omitted, so older hand-written
level files without them still load. The in-game **LEVEL EDITOR** has a
**Background**/**Weapon** dropdown for both (top panel) -- picking a
background updates the live preview immediately.

Clicking **Play** starts the level exactly like real gameplay, except
it's a playtest, not a run: clearing it or pressing Escape/P pauses on
the usual pause screen with an extra **Restart Level** button instead of
advancing to a next level or a victory screen (there's nothing to
advance *to* -- an editor level isn't part of `LEVELS`), and a hit never
costs a life or ends in game over (`GameScene.hitPlayer`/`advanceLevel`
both branch on `isCustomLevel`) -- the point is testing the layout you
just built, not beating it.

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
  "Swapping HUD graphics" below), tinted to the popped ball's `color`.
  It opens just clear of the popped ball's top edge (the pop point plus
  the ball's own radius, so a big ball never has its readout appear inside
  it) at a third of the spritesheet's native size, then over 500ms rises
  64px, grows to full size and fades to nothing -- clamped at the ceiling,
  since a ball popped right under the border has less than 64px of room
  above it. All tuned in `js/ScorePopup.js`'s constants.
- **Player**: `assets/player/player.png`, a single spritesheet (not one
  file per frame) of `PLAYER_CONFIG.spriteWidth x spriteHeight` (32x64)
  cells stacked vertically. Frame order is fixed (`PLAYER_ANIM_FRAMES` in
  `js/assets.js`): idle (1), shot
  (1, fired once per shot), 4 walk frames (the walk cycle), victory (1,
  played once when a run ends without a game over), dead (1, played once
  per hit). The walk cycle carries its own vertical bob: the two
  double-support frames (both feet down) are drawn with the whole upper
  body 2px lower and the legs correspondingly shorter, so the head rides
  up and down as it does in a real gait. It is baked into the art, not
  applied to the sprite's position -- the entity and its hitbox never
  move, and the weapon barrel is still drawn to the top of the cell on
  every frame (it is a long pole running past the sprite, so its visible
  top edge belongs at the cell boundary however the hand holding it
  moves). Every frame is authored facing LEFT; Player.js mirrors it for
  right via `setFlipX`, so swapping the sheet only needs left-facing (or,
  for this game's straight-on chibi style, direction-neutral) art -- keep
  the same 32x(64 x 8) total size and frame order.
- **Shield effect**: `assets/player/shield.webp` -- a `PLAYER_SHIELD_FRAMES`
  -frame (3) looping spritesheet, `PLAYER_CONFIG.shieldSize` (64) square
  per frame, drawn centered on the player the whole time the `shield`
  power-up is active (`Player.js`'s `shieldEffect`). Distinct from the
  power-up's own pickup icon (`assets/powerups/shield.webp`, see below).
- **Player hit burst**: `assets/player/hit.webp` -- a `PLAYER_HIT_FRAMES`
  -frame (2) spritesheet, `PLAYER_HIT_SIZE` (32) square per frame stacked
  vertically (frame 0 on top), played once where a ball actually touches
  the player (`GameScene.onPlayerHitBall` -> `playPlayerHitEffect`). The
  counterpart to the ball-pop burst below, and authored the same way: one
  beat for the impact, one for it dissipating. It is centred on the point
  of the ball's rim facing the player, not on either body's centre, so a
  big ball bursts at the edge the two actually met at. Swapping it is just
  replacing the file, as long as the new art keeps that 32x64 layout.
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

The always-visible stat bar (score, lives, time, current weapon, level,
top score, active power-up timers) is drawn entirely from files under
`assets/hud/` by
`js/Hud.js`, inside the dedicated `HUD_H` strip below the playfield --
nothing there is drawn text. `js/assets.js`'s `HUD_*` constants are the
single place each file's texture key/path/frame size is defined (used by
both `BootScene.js`, which loads them, and `Hud.js`, which displays them),
same convention as every other graphic. To swap a piece, replace its file
in place, keeping the same filename and pixel dimensions:

- **Digits**: two spritesheets, `assets/hud/digits_large.webp` (used only
  for the score, 12x18px per frame) and `assets/hud/digits_small.webp`
  (used for time/level/hi, 8x12px per frame) -- each exactly 10 frames
  side by side, frame index = the digit it shows (`0`-`9`). Every digit
  and label image ships as plain white pixel art so `Hud.js` can
  `setTint()` each usage independently (e.g. the time value turns red in
  the last 10 seconds) -- swap in colored art instead and the tint just
  multiplies over it, so keep replacements white/light if you want the
  same tinting behavior.
- **Fixed labels**: `assets/hud/hud_1p.webp`, `hud_time_label.webp`,
  `hud_level_label.webp`, `hud_hi_label.webp` -- one static image each,
  12px tall to match the small digit strip. HI sits directly under the
  score (same left edge) rather than alongside TIME/LEVEL, so it reads as
  "current score / best score" together.
- **Life icon**: `assets/hud/hud_life.webp` (10x10), drawn once per
  remaining life (up to `Hud.js`'s `MAX_LIVES_ICONS`, currently 5).
- **Weapon socket**: `assets/hud/hud_weapon_frame.webp` (33x33, always
  shown) and one icon per `WEAPON_TYPES` key in `js/config.js` --
  `assets/hud/weapon_<type>.webp` (21x21, e.g. `weapon_harpoon.webp`) --
  named via `assets.js`'s `hudWeaponIconKey()`/`hudWeaponIconPath()`, same
  per-key-file convention as obstacle tiles/power-up icons. The icon is
  always centered on the frame (`Hud.js` reads the frame's own width/
  height), so the two can be swapped independently as long as the icon
  stays smaller than the frame. Adding a weapon type is just dropping in
  its icon file alongside its `WEAPON_TYPES` entry. While `rapid_shot` is
  active, the socket
  shows that power-up's own icon (from
  `assets/powerups/`, see "Adding elements" below) instead, reverting to
  the plain weapon icon once it expires.
- **Active power-up row**: no separate art of its own -- reuses each
  power-up's existing `assets/powerups/<type>.webp` icon plus the small
  digit strip for a whole-seconds countdown, one pooled slot per
  currently-active `EffectManager` entry (`Hud.js`'s `powerupSlots`, up
  to `MAX_POWERUP_SLOTS`). Sits in the HUD bar's own spare vertical room
  below the rest of the layout -- entirely in Phaser, not a DOM overlay.

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

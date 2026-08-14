# Balloon Buster

A retro pixel-art arcade game inspired by the classic *Pang* / *Buster Bros.*
gameplay: walk left and right along the ground, fire a harpoon straight up,
and pop balls before they pop you. Hitting a ball splits it into two balls
one size smaller, one sent left and one right; size-1 balls are destroyed
outright.

**A ball's colour is what it does.** You get one glance at it while it is
already falling at you, so every kind that moves differently looks
different:

| | kind | what it does |
|---|---|---|
| 🔴 | **round** | falls under gravity and bounces to a fixed height. Sizes 1-5, 16x16px up to 96x96px |
| 🟡 | **hex** | ignores gravity, drifts at a constant diagonal speed, and spins. Sizes 1-3 |
| 🟢 | **wave** | bounces like a round ball, but weaves hard enough across its own path that it doubles back |
| 🔵 | **hunter** | bounces like a round ball, and turns to follow you -- slowly enough to be outrun and led away |
| 🟣 | **heavy** | slow, and barely leaves the floor: a quarter of a round ball's bounce, so it stays down where you are |

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

The service worker (see "Install it on a phone" below) needs `https://`
or `localhost` -- over `file://` it simply doesn't register and the game
runs exactly as it always did.

## Install it on a phone

The game is a PWA: on Android it can be installed from the browser and on
iOS added to the home screen, and either way it opens fullscreen, in
landscape, with no address bar -- and plays with the network off.

**Installing.** Chrome decides when a site is installable and fires
`beforeinstallprompt`; `js/pwa.js` catches it, keeps the prompt, and shows
the **INSTALL GAME** button in the main menu. The button exists only while
there is something to install: it never appears before that event, and it
goes away once the game has been installed or is already running from the
home screen. iOS has no such event, so an iPhone or iPad that is not
already running the installed copy gets one line of instructions instead
(**INSTALL: SHARE MENU. ADD TO HOME SCREEN**) -- and nothing at all once
it is.

**What the phone is told.** `manifest.webmanifest` names the game, points
at the icons, and asks for `display: fullscreen` and
`orientation: landscape`; `index.html` carries the same in the tags iOS
reads instead (`apple-mobile-web-app-capable`, its status-bar style and
title, and the `apple-touch-icon`). Every path in both is **relative**
(`"start_url": "./"`, `"scope": "./"`), because a GitHub Pages project
site serves the game from `/<repo>/` rather than from the domain root --
an absolute path would work on a custom domain and break everywhere else.

**On screen.** The playfield is 800x500 and it stays that shape: the
canvas is centred and scaled to whole CSS pixels with
`image-rendering: pixelated`, never stretched (see "Display size"), and it
is re-fitted on resize, rotation and entering/leaving fullscreen. The
viewport is `viewport-fit=cover` and the game is laid out inside
`env(safe-area-inset-*)`, so a notch or a home indicator never covers a
corner of the playfield -- `DisplayZoom.fitScale` subtracts those insets
too, since the window it is fitting into is bigger than the part of it
that can be seen. Selection, the long-press callout, double-tap zoom and
scroll-bouncing are all off. Held upright, a phone gets **ROTATE YOUR
PHONE** over the whole screen rather than a squashed game.

On the first touch the game asks for fullscreen and then for a landscape
orientation lock (`js/pwa.js`'s `lockLandscape`) -- both from inside that
gesture, which is the only time a browser will grant either. Both are
allowed to fail: iOS Safari has no orientation lock at all, and the game
plays the same without one.

**Offline.** `service-worker.js` takes the whole game into one versioned
cache the first time it is opened -- HTML, CSS, every module, the
vendored Phaser build, every graphic, every sound including the music,
all the level and element JSON, the manifest and the icons. After that
first visit the game starts and plays with no network at all; a page load
offline is answered with `index.html` and the game routes itself from
there.

**The cache is named after what is in it.** `CACHE_VERSION` is not
hand-bumped -- `tools/build_precache.mjs` hashes every precached file's
contents and writes the result into `service-worker.js`. That matters
more than it sounds: this worker answers from its cache first, so a
version that only moves when someone remembers to move it means players
go on being served whatever they downloaded on their first visit. It is
how three consecutive redraws of the player sprite reached nobody who
already had the game open. Because the version lives in the worker's own
bytes, changing any file also changes the worker, which is the only thing
a browser checks to decide whether to install a new one at all. The old
cache is deleted the moment the new worker activates, so a release is
never served half from the previous one.

**Updating costs only what changed.** `sw-precache.json` is
`{ version, files: { path: hash } }`, and the worker keeps that manifest
inside its own cache. On install it finds the cache it is replacing,
reads that cache's manifest, and copies every file whose hash is
unchanged straight across instead of fetching it. A release that redraws
one sprite therefore downloads one sprite, not the ~7MB whole game --
which is the difference between an update a phone applies unnoticed and
one that stalls on whatever connection it happens to be on.

```bash
node tools/build_precache.mjs     # writes sw-precache.json + CACHE_VERSION
```

Rerun it whenever any precached file changes, is added, renamed or
removed -- `tests/pwa.test.mjs` compares the manifest against the folder,
hash by hash, and fails if they have drifted apart. That is what stops
"works offline" from quietly becoming "works offline except the one level
you added", and what stops a release from shipping under the previous
release's cache name. Only what the browser actually fetches is in it:
never `admin/` (PHP, and not part of the game), the tests or the tools.
Requests to other origins, and anything that isn't a GET, are passed
straight through and never cached, so an online scoreboard would fail
offline while the game itself carried on keeping scores locally
(`js/storage.js`).

On load `js/pwa.js` also calls `registration.update()` rather than
waiting for the browser's own schedule, and if a new worker takes over
during the first few seconds of a visit the page reloads once so the new
version is the one being played -- not the one after next.

**Icons.** `tools/app_icons.py` draws them, all from one 16x16 pixel-art
grid so each size is crisp rather than resampled: `icon-192`/`icon-512`
(plain), `icon-maskable-192`/`icon-maskable-512` (the motif kept inside
the middle 80% that survives Android's circular crop),
`apple-touch-icon.png` at 180, and `favicon.ico`. `tests/pwa.test.mjs`
reads each PNG's own header to check it is the size the manifest claims.

## Tests

```bash
node --test tests/*.test.mjs
```

No install step and no test framework -- Node's own runner against the
project's own files, since the game has no dependencies and neither does
this half of its test suite. It checks the things that can be answered
without running the game: every level file (grid alignment, no two
obstacles in one cell, everything it names existing), every asset the
boot sequence asks for, every sound played by name, and the pure rules
the rest is built on (the playfield geometry, the key bindings, the
transition registry).

And the other half, which runs the game for real:

```bash
npm install                          # Playwright, the project's only dependency
node --test tests/smoke/*.test.mjs
```

That one opens the game in Chromium and presses on it: it boots, loads
and runs **every** level it ships, walks and shoots with real key events,
loses a life, clears a level into the next, pauses and quits -- failing
on anything the game throws or logs along the way. It takes about 35
seconds against a fifth of one, which is why it is a separate command and
a separate CI job.

The split is not tidiness, it is what each half can see. Set
`PLAYER_CONFIG.speed` to 0 and every test in the first half still passes;
the smoke suite fails with `player barely moved: 400 -> 400`. Every bug
that has actually reached a player was of that kind. See
[`tests/README.md`](tests/README.md) for what each file covers and which
half a new test belongs in. `.github/workflows/tests.yml` runs both on
every push.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow Left/Right | Joystick left/right |
| Climb a ladder | Arrow Up/Down | Joystick up/down |
| Shoot | Space | On-screen shoot button |
| Pause | Esc | On-screen pause button |
| Fullscreen | Button in menu/pause screen | Same |

Every keyboard control is rebindable on the **CONTROLS** screen (Options
-> CONTROLS): one key per action, click it and press the key you want,
Esc to cancel, and a **RESET TO DEFAULTS** button. Binding a key another
action holds takes it from that action rather than leaving two owners.
Bindings are the physical key (`KeyboardEvent.code`), so a layout that
puts Z where Y is binds the key actually pressed, and they persist with
the rest of the settings (see `js/keys.js`). Up only climbs -- it used to
shoot as well, which made shooting unreliable anywhere near a ladder.

Touch controls appear automatically on devices with a coarse pointer
(phones/tablets); they're always available in fullscreen too.

A run also pauses itself the moment the window goes away -- switching tab,
clicking another window, or (on a phone) leaving the app -- onto the same
screen Esc opens (`GameScene.pauseFromFocusLoss`). Both cases need
catching, because the browser treats them differently: a hidden tab stops
Phaser's game loop on its own, but a window that merely loses focus does
not, and the level clock would keep counting down while nobody is
playing. Coming back never resumes by itself: the pause screen waits, so
you are not dropped back in front of a ball you cannot see coming.

Shoot fires once per press, for every weapon and power-up alike -- the
key/button has to be released and pressed again for another shot, so
holding it down does nothing (see `GameScene.updatePlaying`'s
`wasShooting` tracking). A shot still only leaves if under the active
weapon's `maxActiveShots` (see `tryFire`), which is what `rapid_shot`
raises -- it changes how many shots may be in the air at once, never how
the trigger reads.

**Firing plants you.** For `SHOT_LOCK_SEC` (`js/config.js`, 0.15s) after a
shot the held direction does nothing: the player stands where they fired
from, on the ground or on a ladder alike, and moves again the moment it
ends (`Player.update`, which drops the directions out of the input while
the lock runs). That is exactly as long as the shot pose is on screen --
`BootScene` derives the animation's frame rate from the same constant, so
the pose and the pause always end together. Only the directions are
dropped: gravity still applies, the shot itself still travels, and the
trigger is read separately, so the lock can never swallow a shot.

The shot leaves from the middle of the player, which is where the weapon
is drawn -- `tryFire` uses `player.x`, and the sprite has the barrel on
its own centre line (see "Swapping graphics").

**Up is both the shoot key and the climb key.** A press of it means climb
whenever there is a ladder to spend it on -- standing at the foot of one,
or already holding one -- and means shoot otherwise, so away from ladders
nothing about shooting has changed. Space and the touch button mean
nothing but "shoot", which is what keeps shooting available with both
hands on a ladder; they carry their own separate press-tracking for
exactly that reason (see `GameScene.updatePlaying`).

## Weapons

Two of the three are BEAMS: the foot stays planted where the player fired
from and the head climbs (`js/Projectile.js`). The whole length is lethal,
not just the leading edge, so a ball drifting into the middle of an
already-extended shot still pops.

That foot is the firing player's FEET, not the ground line. On the floor
the two are the same thing, which is why it was written as the ground to
begin with -- but standing on a platform or holding a ladder they are not,
and a beam anchored to the ground sprouted from the floor far below the
player and swept everything in between. A shot now spans exactly from
where it was fired up to whatever stops it, at any height. Which weapon a level gives the player is
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
is the route. Each entry names a background (the base name of a frame in
`assets/backgrounds/`, see "A day per continent" below), an `audio.json`
music key, and where the region sits on the world map:

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

### A day per continent

The five levels on a continent are five times of day in the same place.
`daylightPhaseForLevel` (`js/regions.js`) spreads `DAYLIGHT_PHASES` --
morning, noon, afternoon, dusk, night -- across `LEVELS_PER_REGION`, so a
region opens in the morning, ends at night, and the next continent starts
the day over. The background a level shows is
`assets/backgrounds/<region background>_<phase>.webp`.

Only the light changes; the view does not. Each region's frame is drawn
once, at night (`<region>.webp`), and
`tools/daylight_backgrounds.py` writes the five variants from it: the sky
gradient is repainted, the silhouettes are relit onto that phase's
building tones (keeping their own light-to-dark ordering, so the hazy far
skyline stays behind the dark near one), the windows go out during the
day, the stars fade with them, the aurora only burns at night, and the
moon becomes the sun. It reads the layers back out of the source image
rather than being told them, so a redrawn or brand-new region background
is still one file to draw:

```
python3 tools/daylight_backgrounds.py            # every region
python3 tools/daylight_backgrounds.py europe     # just one
```

It needs Pillow and NumPy, which the game itself does not -- it is an
authoring tool run by hand when the art changes, not a build step (there
is no build). `tests/assets.test.mjs` checks that all five variants of
every region exist, so a forgotten rerun fails the tests rather than
showing up as a missing background mid-run.

### The flight between them

Crossing to a new continent doesn't just cut. The level transition covers
the screen as usual, but uncovers onto a world map
(`js/WorldMapInterlude.js`) with the whole route marked on it, and a plane
flies the leg just earned along a bowed dotted trail that fills in behind
it, with its engine running for as long as the map is up (`planefly`).
The destination's name is composed from the same loaded font the
level-intro uses. Once the plane lands the map fades, and only then does
the new level's own "LEVEL n / READY / SET / GO" begin.

Every continent on the itinerary is marked, and each marker says whether
the run has been there: **green** for the ones already played, **red**
for the ones still ahead. The destination stays red for the whole flight
and turns green as the plane lands on it -- which is the moment the
interlude exists to show, so the landed plane parks just past the marker
rather than on top of it.

The map itself (`assets/ui/worldmap.webp`, 400x210 -- exactly half the
playfield, so it scales 2x with no resampling) is drawn from real
coastlines: landmasses given as lon/lat outlines, projected
equirectangular at one scale on both axes and rasterised onto a 4px cell
grid, which keeps the chunky look while leaving the continents their own
shapes, down to the big islands.

Like the transition it wraps, the interlude is not a game state -- it
spans the same `LEVEL_CLEAR`-to-`LEVEL_INTRO` handover and is ticked from
`update()` outside the state switch. Marker positions in `regions.json`
are in the map image's **own** pixels; the interlude scales them to
however large it draws the map, so re-authoring `assets/ui/worldmap.webp`
at another size doesn't invalidate them.

## What each level is made of

The 50 levels are not all walls, balls and a harpoon. What the engine has
is used across the run, and where it is used is a property of the level
file, not of any code:

| feature | levels | what it does there |
|---|---|---|
| **ladders** | 3, 5, 7, 10, 13, 16, 20, 26, 27, 28, 30, 37, 38, 40, 50 | a climb from the floor to a shelf worth shooting from -- a level is always solvable from the ground (see "Features"), so a ladder is a route, never the route |
| **stepped shapes** | 37, 38 | the shelf a ladder lands on is a staircase you walk up, built from `cells` rather than `w`/`h` |
| **player starts** | 42 of 50 | where the level puts you, chosen so nothing can reach you for about two seconds -- a few levels used to open with a ball sitting exactly on the middle of the floor, which is where a level with no start of its own puts the player |
| **machine gun** | 12, 22, 29, 34, 42, 47 | levels with several small/hex balls at once, where a fanned volley is worth more than one beam |
| **grapple** | 15, 25, 31, 39, 45, 49 | levels with open sky to hang a shot in; each is given a quarter more clock, since a grapple holds its one shot against the ceiling for four seconds |
| **guaranteed drops** | 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 (ball), 13, 28, 44 (crate) | the last level of each region hands out something for the region ahead -- a shield, an extra life, time freeze -- and three levels hide one in a one-block crate to shoot open |

A ladder has to reach the floor in whole elements (they are 96px tall, so
its top is 304, 208 or 112), land on a platform wide enough to step off
onto, keep a clear column below it, and -- the one that is easy to miss --
leave room to STAND at the top. The player only lets go up there if their
whole body fits above the surface (`Player.canStandOn`), so a landing with
something overhanging it is a ladder that is climbed and never left: level
24's pagoda had exactly that, its tiers 32px apart against a 50px player,
and it lost its ladder for it. `tests/levels.test.mjs` checks all four,
plus that no start is inside an obstacle or a ball and that a guaranteed
drop sits on a single breakable block.

## Level transitions

Clearing a campaign level doesn't cut straight to the next one: an effect
carries the playfield from one level to the next, and the swap itself is
never visible -- either because the screen is covered at the moment it
happens, or because the levels on screen are photographs taken either
side of it.

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
| `push` | the old level slides up and off while the next one follows it up from below (the default) |

Whichever effect is running, the change of level itself is heard:
`LevelTransition.start` plays `leveltransition`, so the sound belongs to
the level changing rather than to any one way of showing it.

**The countdown waits for the effect to finish.** The next level is built
at the *covered* moment, which is nowhere near the end of the transition:
halfway through for an overlay effect, and the very first frame for a
sliding one, which has nothing to hide behind until the next level
exists. Starting the level intro there would put READY -- and then SET and
GO!, sounds and all -- over a level still sliding off the screen.
`GameScene.advanceLevel` instead holds the countdown for
`transition.remainingSec`, reusing the same lead-in that lets the
run-start fanfare finish (`startLevelIntro`'s `leadInSec`): only the
LEVEL/name title card shows until the effect is done. The hold is
re-read from the transition every frame rather than trusted from the one
estimate taken at the swap, because the two clocks are ticked at
different points in the frame and an estimate alone drifts a frame or two
ahead. `tests/rules.test.mjs` replays that arrangement against every
registered effect and fails if any of them lets the countdown open early.

There are two kinds of effect, and which one an entry is depends only on
the method it carries:

- An **overlay** effect implements `draw(graphics, amount, covering)`. It
  paints over the playfield; `amount` runs 0 to 1 across each half and
  `covering` says which half it is, so it only has to be opaque at 1 and
  transparent at 0. The level swap happens on the single frame it is
  fully opaque.
- A **sliding** effect implements `place(leaving, arriving, amount)` and
  hides nothing: it is handed a still photograph of each level (see
  `LevelTransition.capture`) and moves them, with `amount` running 0 to 1
  once across the whole duration. The swap happens at the START here --
  the next level has to exist before it can be photographed -- and the
  two stills have to cover the playfield between them the whole way, or
  the live scene shows through behind them. `push` keeps them exactly one
  playfield apart, which does that by construction.

Either way the HUD bar stays clear: overlay effects simply don't paint
over it, and the stills are masked to the playfield, so the score and
lives stay readable straight through. The debug panel's **Level
transition** row plays any of them on demand, without having to clear a
level to see it.

Only the level-to-level step gets one. Finishing the run doesn't -- there
is no next level to reveal, just the victory screen -- and neither does a
level restarting after a lost life.

## Load

Everything the game needs to reach the menu is fetched up front, with one
deliberate exception: **music**. The 13 tracks are 4.7MB against 141KB for
every sound effect in the game, only one of them ever plays at a time, and
eight belong to continents a given run may never reach -- so loading them
all before the menu can open spends most of the first load on audio that
may never be heard.

Instead `AudioManager.ensureMusicLoaded()` fetches a track the first time
it is wanted, and `GameScene.loadLevel` asks for the coming level's track
(and the hurry-up one, which cuts in mid-play with no cover of its own) as
soon as the level is known -- so the fetch runs under the fanfare, the
READY/SET/GO countdown, and on a continent change the whole world-map
flight. `playMusic()` records the request first and honours it when the
file lands, and only if that track is still the one wanted by then.

Measured on this repo: **1796KB to the menu instead of 6456KB**, of which
1327KB is Phaser itself. Each continent's track then arrives during the
levels leading into it.

## Frame rate

Arcade Physics advances in a fixed 1/60s step whatever the display is
doing, and that is the one number any exact movement has to be measured
against -- never the render frame. A velocity worked out as "distance
divided by this frame's delta" is right only when a frame and a step are
the same length: on a 144Hz display the frame is 6.9ms and the step is
still 16.7ms, so every such correction lands 2.4x past its target, and the
next one overshoots back further. That reads as the player skidding
sideways on a ladder, or bouncing up and down on a stair tread, and it
happens on faster displays only -- which is exactly the kind of fault that
never shows up on the machine it was written on.

So the player's movement splits in two. Travel is velocity, because it
should take time. Arriving somewhere exact -- on a tread, on a ladder's
centre line, at either end of one -- is a placement instead, and Player.js
does it through `teleport()`, which is deliberately more than
`body.reset()`: reset drops the body onto the game object's corner
ignoring the body's own offset, and Arcade would then read that
discrepancy as motion and shove the SPRITE by it on the next step (about
6px sideways and 20px down, every time). `teleport()` restores the body's
relationship to the sprite and re-baselines the previous-position record
that the write-back is measured from. Everything it takes is read off the
body, never the sprite, which lags it by a frame mid-step.

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

Options -> Size picks the display size: the fixed **0.5x**, **1x**
(original) and **2x** (double), or **FIT**, which scales the canvas to
the window. Fitting keeps the true 8:5 shape and takes whichever of width
and height runs out first, so the whole playfield is always on screen --
filling the other dimension instead would push part of it off the edge,
and in this game balls arrive from every edge. The debug panel's height
is counted out of what is available, so opening it re-fits rather than
pushing the floor off the bottom.

A fitted canvas follows the window from then on (resize, rotation,
fullscreen -- see `DisplayZoom.watchViewport`), and a fixed size that
does not fit the window is fitted too: a phone in landscape is usually
shorter than 500 CSS px, so even 1x would overflow it and take the
canvas-anchored touch controls off the screen with it (see
`DisplayZoom.activeZoom`). The choice itself is persisted the same way as
mute/volume, so the fallback never overwrites it.

`js/DisplayZoom.js` sets the canvas's (and `#game-container`'s) CSS size
directly to `VIRTUAL_W/VIRTUAL_H` times the resolved scale;
`js/PixelText.js`'s DOM menu text reads that same rendered size back out,
so it scales in lockstep without any separate logic. At 2x the canvas can
be larger than the browser window -- the page scrolls rather than
clipping it.

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
- The campaign uses what the engine has rather than only walls and balls:
  **15 levels have ladders** up to a shelf worth shooting from (two of
  them, 37 and 38, onto a stepped staircase you then walk up), **42 name
  their own player start** so no level opens with a ball already on top of
  you, **12 are played with the machine gun or the grapple** instead of the
  harpoon, and **13 hold a guaranteed power-up** -- ten on a ball, three
  in a one-block crate to shoot open. See "What each level is made of".
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
- 5 ball kinds -- round, hex, wave, hunter, heavy (see the table at the
  top) -- each with fixed, deterministic physics, splitting one size
  smaller (one left, one right) per hit. What a kind DOES beyond bouncing
  is an entry in `js/elements.js`'s `BALL_MOVEMENTS`, named by the ball's
  own element file; what it LOOKS like is the round ball's art with its
  hue turned. Both are written by `tools/ball_variants.py` from the round
  ball, so a kind's colour and its behaviour cannot come apart, and
  redrawing the round ball redraws every kind. `heavy` needs no code at
  all -- barely bouncing and moving slowly is entirely a matter of its
  numbers. The campaign introduces them one at a time: green from level
  11, purple from 16, blue from 26, and never a level made only of one.
- Obstacles: indestructible platforms and shootable crates, built from
  16x16 blocks (rectangular or stepped shapes), blocking ball movement from
  every side with proper anti-tunneling collision; a multi-block crate
  loses only the block that's actually shot.
- The **LEVEL EDITOR** places obstacles on rows counted up from the
  ground, so the bottom row rests on the floor and a stack of them is a
  staircase the player can climb. The interior is a whole number of rows
  (see "Display size"), so the top row is flush against the ceiling too.
  It also places where the player starts the level (the **Start** brush,
  saved as the level's `playerStart` -- see "Adding levels"); a level that
  places none starts them in the middle of the floor as before.
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
  seams are invisible to the climb. The player has their own animations
  for it: a climbing cycle that freezes rather than reverting to the
  standing idle when they stop partway up, and a step-off played when they
  leave the TOP of a ladder.
- The player walks up a ledge one obstacle block (`PLAYER_STEP_UP_PX`,
  16px) high without jumping -- it cannot jump at all -- so a run of
  stacked blocks is a staircase. Anything taller, or without room to
  stand on top, is still a wall it stops at: that headroom test is what
  keeps a wall built of stacked blocks from being a ladder. Steps up and
  down have their own animations and their own small sounds; a real FALL
  ends in a puff of dust at the feet and a thud, which a 16px step down
  deliberately does not (a stair tread is a step, not a landing). Climbing
  is neither -- it ticks a rung per cycle of the climb animation, and
  raises no dust at all.
- The level-select screen lists all 50 at once in three columns filled
  top-to-bottom (1-17, 18-34, 35-50) with no scrollbar -- a scroller would
  hide exactly the later levels you are most likely looking for.
- 50 campaign levels across 10 continents: every `LEVELS_PER_REGION` (5)
  levels the background, the landmark in it and the music all change
  together, and the leg between them is flown on a world map (see
  "Regions" below).
- A level-to-level transition effect in campaign runs (fade / wipe / iris
  / shutter / push, see "Level transitions" below) -- swappable by name.
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
- Score, lives, a locally-persisted top-10 high score table, per-level
  unlock progress, and a **record per level** -- its fastest clear, lower
  being better, shown before the level starts, when it is cleared, and
  next to it in the level list (`localStorage`, with a versioned schema
  for safe future upgrades) -- see "Start Campaign vs. Start Level" and
  "Records: fastest time per level" below.
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
- 24 sounds (sfx, ui, and 3 looping music tracks) driven entirely by
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
  score/lives/weapon, and live entity counts -- all on ONE line. Every
  line the panel takes is height pushed onto the game below it, so the
  readout is written short (`L6/50`, `t90`, power-ups by the first word
  of their type) and is allowed to ellipsize rather than wrap, which
  keeps an unusually long tail from growing the panel.
- Draws collision bounds for the player, balls, projectiles, power-ups,
  and obstacles directly over the game -- switched on and off with the
  **Colliders** button under **VIEW**, or the **C** key, alongside the
  **16x16 grid** (**G**). Both start out matching what debug mode has
  always shown: outlines on, grid off. Either button carries the outline
  the editor's selected brush does while its overlay is showing, so what
  is on is visible in the panel itself.
- A clearly labeled spawn panel, all of it without replaying the whole
  game or affecting normal play when the panel is off:
  - **BALL** -- pick a shape + size and **Spawn** it; **Remove all** takes
    every ball off the field with nothing happening; **Pop all** instead
    gives every ball the hit it would take from a shot, score, sound,
    burst, drop roll and splits included, so one press is one volley and
    the big ones come apart rather than vanishing.
  - **POWER-UP** -- one button per type, and a mode above them deciding
    what a press does: **Drop pickup** spawns the bonus to be collected
    (the way to check that it falls, lands and can be picked up), **Use
    now** applies the effect to the player outright (the way to check what
    it then does, without chasing a bonus that has bounced onto a ledge).
  - **GIVE WEAPON** -- one button per weapon, handed to the player
    directly, since a weapon is a property of the level rather than
    something that drops. It won't cancel a weapon power-up that happens
    to be running.
  - **CAMPAIGN** -- **To start** plays the chosen level from the
    beginning; **To end** clears it on the spot and carries on into the
    next, so a hand-off between two levels -- celebration, time tally,
    transition, and across a region boundary the world map -- can be
    watched without beating the level before it. It does not write a
    record: it didn't play the level, and the fraction of a second it
    took would otherwise stand as that level's time forever. (Clearing a
    level with **Pop all** does count, because that really is clearing
    it.) The **Level transition** picker plays any effect on demand.

  The power-up and weapon rows are both built from their registries
  (`POWERUP_TYPES`, `WEAPON_TYPES`), so a new entry appears in the panel
  on its own, as does the transition picker's list (`LEVEL_TRANSITIONS`).
- Lives entirely above the playfield's own ceiling, in its own
  `#tool-bar` row (see index.html/style.css) -- never overlapping actual
  gameplay the way an in-canvas overlay would. It spans the canvas's exact
  width and is as tall as its contents need, laid out as labelled columns
  of rows -- **BALL**, **POWER-UP**, **GIVE WEAPON**, **CAMPAIGN**,
  **VIEW**, and a **STATE** readout -- which wrap onto a second line when
  they don't all fit across.
- It is styled as the same tool as the level editor's panel: both are
  built from `js/panelUi.js` and share style.css's `.panel-*` rules, so
  the two have identical controls, grouping and size. Everything in them
  is measured in `--panel-unit`, a hundredth of the canvas's rendered
  height published by `DisplayZoom.js`, so both scale with the display
  zoom. (A container query unit would cover the editor's panel, which
  is inside `#game-container` -- but not the debug one, which sits
  outside it, and the two have to match.)

## Project structure

```
index.html          Phaser injects its own canvas into #game-container;
                      DOM overlay for menus/touch controls sits on top --
                      the always-visible stat bar (including active
                      power-up timers) is drawn in Phaser, see js/Hud.js
                      below
style.css            All visual styling, responsive/touch layout
manifest.webmanifest The installed app's name, icons, colours, and its
                      fullscreen/landscape wishes -- see "Install it on a
                      phone" above
service-worker.js    The offline cache: one store, named after a hash of
                      everything in it, filled on the first visit and
                      updated file by file after that
sw-precache.json     What that worker caches and a hash per file --
                      generated by tools/build_precache.mjs, never
                      hand-edited
favicon.ico          The tab icon (browsers ask for it by that name
                      whether it is linked or not)
assets/              Every graphic and sound in the game, as real files --
                      see "Swapping graphics" / "Swapping sounds" /
                      "Swapping HUD graphics" below
  balls/             ball_<shape>_<size>.webp
  player/            player.png, a single spritesheet, drawn by
                      tools/player_sprite.py (idle, shot, 4 walk,
                      victory, dead, 2 climb, 2 ladder-exit, 2 step-up,
                      2 step-down, jump) + shield.webp, the looping shield
                      effect, + hit.webp and dust.webp, the hit burst and
                      the landing puff, + ghost.png, the winged ghost a
                      lost life leaves -- see "Swapping graphics" below
  obstacles/         wall.webp, crate.webp
  ladders/           <ladder texture>.webp, the whole element at its
                      authored size (48x96) rather than a repeating tile,
                      but drawn to be seamless top-to-bottom so stacked
                      ladders keep their rung spacing across the join
  powerups/          <powerup type>.webp
  backgrounds/       <name>.webp, one per distinct levels/*.json
                      `background` field, plus <region>_<time of day>.webp
                      for each region's five (see "A day per continent")
                      -- see "Swapping graphics" below
  projectile.webp, particle.webp
  audio/             audio.json (every sound's config) + one .ogg file per
                      sound named there -- see "Swapping sounds" below
  hud/               Fixed labels, two digit spritesheets, the life icon,
                      weapon socket frame, and weapon icon(s) -- see
                      "Swapping HUD graphics" below
  intro/             font_alpha.webp, the A-Z+digits font spritesheet
                      the level-intro screen AND every DOM menu's text
                      are drawn from -- see "Swapping intro graphics" below
  icons/             The installed app's icons (plain, maskable, Apple)
                      -- drawn by tools/app_icons.py
elements/            One JSON file per ball size/shape, obstacle type, or
                      power-up, plus index.json listing which to load --
                      see "Adding elements" below
levels/              One level_NN.json per level, in level-editor Export
                      format -- see "Adding levels" below
tests/               Node's own test runner against the data and the pure
                      rules -- no framework, no dependencies, no browser
                      (see "Tests" above and tests/README.md)
tools/               Scripts run by hand, never by the game:
                      daylight_backgrounds.py relights a region's night
                      frame into its five times of day (see "A day per
                      continent"), ball_variants.py turns the round
                      ball's hue into every other ball kind and writes
                      their elements with it, player_sprite.py draws the
                      player's
                      17-frame sheet and ghost_sprite.py the winged ghost
                      a lost life leaves (it imports that sheet's own dead
                      frame, palette and renderer, and adds only the wash
                      and the wings, so the two cannot drift apart),
                      app_icons.py draws the app icons, and
                      build_precache.mjs writes the offline file list
                      and the cache version (see "Install it on a phone")
admin/               A separate, PHP-backed, login-gated site for editing
                      graphics/sounds/elements/levels without touching
                      code -- see "Admin tool" below. Not linked from the
                      game itself; open admin/index.php directly (needs a
                      PHP-capable server, see "Running it locally").
js/
  vendor/phaser.min.js  Phaser 3 (Arcade Physics build), vendored locally
  main.js            Two things: new Phaser.Game(GAME_CONFIG) -- no
                      manual requestAnimationFrame loop anywhere in the
                      project -- and registering the service worker
  pwa.js             The installable side: registering that worker, the
                      INSTALL GAME button's rules, the iOS instructions
                      that stand in for it, and the landscape lock (see
                      "Install it on a phone")
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
                      "Adding levels"), lays any level saved in the
                      editor over its shipped file, registers them all,
                      then starts Boot
  BootScene.js       Boots second (registries are populated by now, so it
                      knows exactly which files to ask for): loads every
                      graphic (see assets.js) and builds the player's
                      Phaser animations -- nothing is drawn procedurally,
                      everything is a loaded file
  GameScene.js       The whole game: state machine, Arcade colliders/
                      overlaps, keyboard input, particle bursts, and the
                      public API (startNewGame/pause/etc.) ui.js talks to
  Player.js          Phaser.Physics.Arcade.Sprite: explicit per-frame
                      velocity from input, the step-up and the ladder
                      climb, the shield effect sprite, and 5 Phaser
                      animations (idle/move/shot/victory/dead, see
                      assets.js) -- facing is setFlipX, never a separate
                      left/right asset. Travel is velocity; landing on an
                      exact spot (a tread, a ladder's centre line or its
                      ends) is a placement -- see teleport/placeFeet and
                      the note under "Frame rate" below
  Ball.js            Phaser.Physics.Arcade.Sprite: reads its one
                      BALL_ELEMENTS entry (shape+size) for every physical
                      parameter, deterministic landOnTop()/bounce methods,
                      split-children descriptors; hex balls play a looping
                      spin animation (setFrozen pauses/resumes it for
                      time_freeze)
  Projectile.js      Phaser.Physics.Arcade.Sprite for the harpoon shot
  Obstacle.js         Phaser.GameObjects.TileSprite + static Arcade body,
                      representing one obstacle block -- one object that
                      both collides and draws itself; destructible via
                      takeHit()
  Bonus.js           Phaser.Physics.Arcade.Sprite for power-up pickups
  LevelManager.js    Owns the LEVELS array (populated by ElementsScene
                      from levels/*.json) and loads a level definition
                      into a GameScene's groups; decomposes each obstacle
                      into independent 16x16 Obstacle blocks (see
                      OBSTACLE_BLOCK_SIZE) and reads the level's optional
                      player start point (playerSpawn/DEFAULT_PLAYER_SPAWN)
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
                      never a filename/volume/loop flag. Music is fetched
                      on demand rather than at boot -- see "Load" below
  input.js           Thin DOM bridge for the on-screen touch buttons only
  keys.js            The keyboard: the one physical key each action is
                      bound to (rebindable, see the CONTROLS screen), the
                      live pressed state GameScene reads, and the capture
                      the rebinding screen uses
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
                      from a loaded A-Z font, the level's record, then
                      blinking READY/GO!
  LevelClearCard.js  The cleared-level card: the run's own time and a
                      blinking NEW RECORD when it beat the level's (see
                      "Records: fastest time per level")
  introText.js       The font rows both cards are composed of -- one
                      Image per character from the intro font sheet
  PixelText.js       The DOM equivalent of introText.js -- renders
                      any string to a <canvas> from the same font_alpha
                      .webp spritesheet, sized off the game canvas's own
                      current scale (see "Swapping intro graphics")
  ui.js              DOM menus/screens -- every heading/button/score/list
                      label goes through PixelText.js, not plain CSS text
  storage.js         Versioned localStorage persistence (high scores,
                      settings including the key bindings, unlock
                      progress, the per-level records, and the levels
                      saved in the editor -- see "Adding levels"), plus
                      eraseProgress(), which takes the first three and
                      deliberately none of the rest
  editor.js          In-browser level editor: opens one campaign level
                      (picked from the same list as Start Level),
                      grid-snapped painting, New/Save/Revert/Export/Import
                      -- see "Adding levels" below
  debug.js           Debug overlay (Phaser Graphics) and dev tools
  panelUi.js         The five DOM pieces both developer toolbars (the
                      editor's and the debug one) are built from, so the
                      two read as one tool -- see style.css's .panel-*
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
there, no separate count or manifest to keep in sync.

**The editor always edits one specific campaign level.** Opening **LEVEL
EDITOR** from the main menu asks which one first, on the same screen and
the same fifty levels as **START LEVEL** (`ui.js`'s `renderLevelSelect`,
in its `edit` mode -- see `GameScene.showLevelSelect`). Unlike playing,
editing ignores unlock progress: authoring level 40 shouldn't require
playing to it first, and every level's name is shown rather than hidden
behind `???`. A level this browser has its own saved version of is named
in the accent color instead of white.

Picking one opens it exactly as it currently stands, and the panel's
**LEVEL n** heading says which. Then paint it: left-click/drag places
whatever brush is selected; right-click always erases whatever's under
the cursor instead, regardless of the selected brush, alongside the
dedicated **Erase** brush.

The **FILE** buttons all act on that same level:
- **Save** stores the level under its own number. Nothing in a browser can
  write `levels/level_NN.json`, so the save goes to `localStorage` (see
  `storage.js`'s `levelEdits`) and `ElementsScene` lays it over the
  shipped file on every boot -- which makes the saved version the one the
  game actually plays, in the campaign and in Start Level alike. It also
  replaces the live `LEVELS` entry immediately (`LevelManager.setLevel`),
  so playing the level right after saving doesn't need a reload.
- **Revert** drops this browser's saved version and puts the shipped file
  back -- in storage, in `LEVELS` and on screen. `SHIPPED_LEVELS` keeps
  every level as its file had it for exactly this.
- **Export** downloads the level as `level_NN.json`, already named for
  the file it belongs in: that is how an edit gets out of one browser and
  into the project (drop it into `levels/` over the old one, or paste/
  import it in the admin tool's Levels tab, see "Admin tool").
- **Import** replaces what is being edited with a level file from disk,
  and **Clear all** empties it -- neither writes anything until Save.
- **New** starts a BLANK level in the slot this session has open, which is
  what lets the editor author a level rather than only edit one. Not the
  same thing as Clear all: that empties the field but leaves everything
  the level IS -- its name, time limit, background and weapon all still
  come from whatever was opened, so what you are left with is that level
  with its contents removed. New resets those too. It writes nothing
  either; Save puts it in the slot and the game plays it from then on,
  Export downloads it as the level file, and Revert is still the way back
  to what shipped. It discards more than any other button in the panel,
  so it is the one that asks first -- and the question takes the place of
  the row it was asked from rather than appearing under it, because the
  panel is a fixed band across the HUD strip and a group that grew a row
  while asking would push its own answer out of it.
- **Play** playtests what is on screen without saving it. Trying a change
  is not committing it; Save is the only thing that writes. The unsaved
  buffer travels with the playtest (`GameScene.editorDraft`), so leaving
  it through the pause menu's **LEVEL EDITOR** resumes those exact edits.

Adding a *new* level is still a file: Export a level, save it into
`levels/` as the next free number (zero-padded to 2 digits --
`level_51.json`, `level_52.json`, ...) and give it that `id`.

The editor's controls occupy the **HUD strip**: the game's own HUD is
hidden while editing (see Hud.js's `VISIBLE_STATES`), so that band across
the bottom of the canvas is free, and using it leaves the whole playfield
visible with nothing pushing the canvas down the page. They are laid out
as labelled columns of rows -- **BRUSH** (what the pointer paints, split
into level structure and the balls to pop), **NEXT PLACED** (direction and
guaranteed drop for the next ball/crate), **LEVEL n** (background, weapon,
clock -- and which level all of it belongs to), **FILE**, **GO**, and a
**COUNT** readout -- so what each control belongs to is readable at a
glance. The panel is sized from the canvas (`HUD_H`/`VIRTUAL_H` for the
height, container query units for everything inside), so it scales with
the display zoom; at 0.5x the strip is only 42 CSS px and the panel
scrolls rather than clipping anything out of reach.

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
  "playerStart": { "x": 328, "y": 368 },
  "balls": [{ "shape": "hex", "size": 2, "x": 400, "y": 120, "vx": 45, "vy": -45, "powerup": "extra_life" }]
}
```
`ladders` is optional and only written when there is one -- every level
that predates ladders simply has no such key. A ladder entry is a type and
a top-left corner; its size comes from the element (see "Adding elements"),
so a taller run is several entries stacked rather than a height field.

`playerStart` is optional the same way: it says where the player begins
the level (and where they come back after losing a life), and a level
without it starts them in the middle of the floor, exactly as every level
did before the field existed. It is stored as the FEET -- `x` the sprite's
centre line, `y` the surface they stand on -- which is the pair
`Player.placeFeet` takes, so the file says literally where the player is
put. `LevelManager.js`'s `playerSpawn` clamps whatever it reads into the
playfield, so a hand-edited start can't put the player inside the border,
and falls back to the default for a missing or malformed one. Place it in
the **LEVEL EDITOR** with the **Start** brush: the click's grid cell is
where the player stands, centred across it with their feet on its bottom
edge, and the scene's real player sprite moves there so what you see is
what the level will spawn. Erasing that cell (**Erase** or right-click)
drops the start again and the player returns to the default position; the
**COUNT** readout shows `Start 1` or `Start 0` for which of the two the
level is on. A start with nothing under it is allowed and means what it
looks like: the player stands there through the READY/GO countdown and
falls to whatever is below the moment play begins.
An obstacle's `x`/`y`/`w`/`h` are on the 16x16 grid, and so is a ball,
though a ball's `x`/`y` is its CENTRE rather than a corner -- the grid cell
is its bounding box's top-left, so a ball sits on the grid when `x - radius`
and `y - radius` do. Every shipped level follows both rules, which is what
makes opening one in the **LEVEL EDITOR** and saving it back give the same
level: the editor snaps whatever it loads, so anything off the grid would
quietly move.

A level's `id` and `name` are left exactly as they were: the editor has
no control for either, so saving one writes its own fields over the
definition it opened rather than replacing it (`editor.js`'s `buildDef`),
and anything a hand-edited file carries that the editor doesn't know
about survives being edited too.

`powerup` on an obstacle or ball is optional -- when set, that exact
crate/ball guarantees that power-up drop when destroyed/popped, instead of
the usual random chance. On an obstacle the tag goes onto **every block**
it becomes (`LevelManager.js`'s `obstacleBlocks`), so a power-up belongs on
a one-block crate: a four-block one bursts four of them. `tests/levels
.test.mjs` holds that rule, along with the crate having to be breakable at
all. An obstacle can also use `{ "cells": [[dx, dy], ...] }` instead of
`w`/`h` for a non-rectangular/stepped shape -- the level editor never
produces this itself, but `LevelManager.js` reads it, and the campaign
uses it for the staircases in levels 37 and 38. `type`/`shape` values must
match a `type`/`shape` from some loaded element (see "Adding elements"
above).

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
advancing to a next level or a victory screen, and a hit never costs a
life or ends in game over (`GameScene.hitPlayer`/`advanceLevel` both
branch on `isCustomLevel`) -- the point is testing the layout you just
built, not beating it, and it never touches unlock progress even though
the level being tried is a campaign one.

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

### Records: fastest time per level

Every campaign level keeps its own record: **how long it took to clear,
lower is better**. That is the one thing a level can be replayed to beat
-- a score mostly measures what dropped, and the unlock only ever happens
once.

The time is the level's own clock (`GameScene.levelTimer`), the one the
HUD counts down, so what is recorded is the run you just made: it restarts
with the level, including when a lost life restarts it, and a record is
therefore always a single clean run through the level rather than a total
across attempts. `levelClear()` hands it to `storage.saveLevelTime()`,
which only writes a faster one -- so replaying a level you have already
beaten can improve the record but never spoil it -- and returns whether
this run set it. Editor playtests and Panic Mode keep nothing: neither is
a level records are held for.

They are stored under their own `localStorage` key (`balloonBuster.
levelTimes`, `{ "<level index>": seconds }`) with the same versioned
schema as everything else, in hundredths of a second, and read back
defensively -- an entry that isn't a sane number is dropped rather than
shown as a record no run could beat.

**Erasing it.** Options has an **ERASE PROGRESS** button, because a
player who cannot clear what they have done is stuck with it forever --
and the debug panel and the level editor can both write into these. It
takes the high score table, the campaign unlocks and every record time
(`storage.eraseProgress`). It deliberately leaves everything that is a
preference rather than an achievement: volume, mute, display size, the
key bindings (those have their own reset, on the controls screen), and
the levels saved in the editor -- which are somebody's authoring, not
their score, and would be a cruel thing to take away under that name.
The keys are listed one at a time rather than cleared by namespace, so a
key added later has to be thought about before it can be erased by
accident.

It is irreversible, so the button only ever reveals a confirmation and
nothing is written until the second press. `tests/smoke/` presses both
answers and checks what survived each -- which is as much the point as
what did not.

The record shows up in three places, all of them where it is useful:

- the **level-intro card** (`LevelIntro.js`), under the level's name, so
  the target is on screen before the level starts. A level with no record
  yet simply doesn't show the line.
- the **cleared-level card** (`LevelClearCard.js`), which states the run's
  own time and blinks **NEW RECORD** when it beat the old one.
- the **Start Level list**, right-aligned on each row (`M:SS` there, where
  the row is narrow; the cards show hundredths).

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
  file per frame) of `PLAYER_CONFIG.spriteWidth x spriteHeight` (36x72)
  cells stacked vertically. Frame order is fixed (`PLAYER_ANIM_FRAMES` in
  `js/assets.js`): idle (1), shot
  (1, fired once per shot), 4 walk frames (the walk cycle), victory (1,
  played once when a run ends without a game over), dead (1, played once
  per hit), then four two-frame states the player's own movement plays:
  **climb** (looping, while on a ladder -- both hands stay on it, the legs
  alternate, and the body rises and falls with the effort), **ladderoff**
  (stepping off the TOP of a ladder onto the ground, through a crouch;
  only at the top -- at the bottom the player simply stands off it), and
  **stepup**/**stepdown**, one 16px block up onto a ledge and one down off
  it. Those last two are separate states because a step up and a step down
  do not look alike: going up the leading knee comes up and the body
  follows it, going down the leading foot reaches down and the body dips
  after it. The walk cycle carries its own vertical bob: the two
  double-support frames (both feet down) are drawn with the whole upper
  body 2px lower and the legs correspondingly shorter, so the head rides
  up and down as it does in a real gait. It is baked into the art, not
  applied to the sprite's position -- the entity and its hitbox never
  move, and the weapon barrel is still drawn to the top of the cell on
  every frame (it is a long pole running past the sprite, so its visible
  top edge belongs at the cell boundary however the hand holding it
  moves).

  **Which way each frame faces.** The game is played into the screen, so
  the player is drawn from BEHIND for everything done facing the
  playfield: idle, shot, both climb frames and both ladder-exit frames.
  The walk cycle and the step up/down frames are seen from the SIDE, and
  are the ones authored facing LEFT -- `Player.js` mirrors those for the
  other direction via `setFlipX`. Victory, the celebration jump and dead
  turn round to face the player.

  The weapon is drawn on the sprite's own centre line in the frames that
  face away or towards you, because that is where a shot leaves from
  (`tryFire` uses `player.x`). The side frames have no barrel over the
  helmet at all: from there the weapon is in the hands, held across the
  chest, which is what it looks like from the side. **The climb frames
  have no barrel either**, for the opposite reason: both hands are on the
  rungs, and a barrel still standing over the head of a player who is
  plainly not holding it reads as scenery stuck to the sprite. It comes
  back on the ladder-exit frames, which is the moment the gun comes back
  up.

  **The back-view arms stop at the elbows.** From behind, the upper arms
  angle down and inward from the shoulders and the forearms disappear
  behind the body, because they are holding something in front of the
  chest -- the two hands the same frame shows on the weapon. Arms drawn
  all the way down to hands at the hips would contradict them.

  **Clearing a level** alternates the standing victory pose with frame 16,
  the same pose airborne -- the player faces out, throws their arms up and
  hops on the spot. Frame 16 is the one frame in the sheet whose feet are
  deliberately NOT on the cell's last row: that gap under the boots is the
  jump.

  The art is drawn by `tools/player_sprite.py`, which authors each frame
  as ASCII art on an 18x36 grid (one letter per palette colour) and scales
  it 2x into its 36x72 cell -- so editing the character is editing those
  strings and rerunning the script. Replacing the .png by hand works just
  as well: keep the same 36x(72 x 17) total size and frame order.
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
- **Landing dust**: `assets/player/dust.webp` -- a `PLAYER_DUST_FRAMES`
  -frame (2) spritesheet, `PLAYER_DUST_SIZE x PLAYER_DUST_HEIGHT` (32x16)
  per frame stacked vertically, played once at the feet whenever the
  player lands from a FALL, together with the `playerland` thud
  (`Player.followGround` -> `GameScene.playLandingDust`, which does both
  so neither can happen without the other). A step down is not a fall:
  a drop of one 16px block or less has its own animation and its own
  small `playerstepdown` sound, and adding the landing to it doubles both
  on every single stair tread. Climbing raises none either -- a ladder is
  not a fall, and both of its ends put the feet exactly on the surface
  they arrive at so no leftover fraction of a pixel reads as one. Unlike
  the bursts above it is deliberately not square (dust spreads sideways
  along the ground rather than billowing up) and it is anchored by its
  BOTTOM edge, so the cloud sits on the surface instead of straddling it,
  drawn just under the player so they stand in it.
- **Death ghost**: `assets/player/ghost.png` -- a `PLAYER_GHOST_FRAMES`
  -frame (2) spritesheet, `PLAYER_GHOST_FRAME` (64x72) per frame stacked
  vertically, drawn by `tools/ghost_sprite.py`. When a hit costs a life,
  this beats its way up out of the body still lying there in its dead
  frame and fades away over `DEATH_GHOST_SEC` (1.2s) and
  `DEATH_GHOST_RISE_PX` (150) -- and only then does the level restart or
  the run end, because `startHitFreeze` holds the freeze for at least as
  long as the flight (`GameScene.spawnDeathGhost`).

  **It is the dead frame itself.** `ghost_sprite.py` does not draw a
  figure at all: it imports `player_sprite.py`'s own `DEAD` art, so a
  redrawn player is a redrawn ghost with nothing to keep in step by hand.
  Only two things are added. The palette is derived from the player's,
  mixed 62% towards white and dropped to alpha 200, which is what makes
  it read as the spirit of the body under it rather than as a second
  player. And a pair of angel wings is stamped either side -- the one
  part of the picture that file draws for itself, authored as the left
  wing and mirrored.

  The cell is the player's cell widened by the wings and exactly as tall,
  with the figure centred in it, so drawing the ghost at the player's own
  position lands it on the body pixel for pixel with no offset to keep
  right. `tests/assets.test.mjs` checks that relationship, and the sheet's
  real dimensions against it.

  Unlike every other effect sheet its animation LOOPS: the two frames are
  wings up and wings down, and both are rooted at the same shoulder --
  the up wing at its bottom corner, the down wing at its top -- so the
  flap swings about a fixed point instead of sliding the whole wing up
  and down the back, which is what a wing merely redrawn a few rows lower
  looks like. It beats at 7fps for the whole flight while a tween carries
  it up. A tween and not a physics body, because `startHitFreeze` pauses
  the physics on the very next line and anything with a velocity would
  just hang there; tweens are not paused with it, which is what lets the
  ghost keep moving through an otherwise frozen picture.
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
  levels"), plus five per region (`<region>_morning.webp` and its four
  siblings, see "A day per continent"). Authored at 384x200 and drawn
  stretched over the sky area, `VIRTUAL_W x GROUND_Y` (`js/constants.js`),
  behind obstacles/balls/player; the floor strip and HUD bar below it stay
  solid color regardless (`GameScene.drawBackground`).
  `assets/backgrounds/default.webp` is what the level editor starts a new
  level pointed at -- adding a background is dropping a same-size file in
  this folder and setting some level's `background` field (or the editor's
  dropdown) to its name, no code change. A campaign level ignores its own
  `background` field: it shows its region's frame at its time of day.

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

The 24 sounds currently shipped (`assets/audio/*.ogg`) are placeholder
tones/noise bursts generated offline (see the synthesis style used
elsewhere in this file) rather than original audio -- drop in real files
with the same names to replace them, one for one, no other changes needed:
`weaponshoot`, `weaponshootm` (a boosted/rapid shot), `balldestroy`,
`walldestroy`, `playerlifeloose`, `playerlifeget`, `itempick`,
`itemscorerpick` (fruit/bonus-score pickups), `itemshieldget`,
`itemshieldloose` (shield absorbs a hit), `hurryup` (a short low-time
ping, independent of the `music_hurry` track switch above), `gameover`,
`levelcomplete`, `superpang` (run-start jingle), `weaponhold` (picking up
a weapon-boosting power-up), `leveltransition` (the swoosh of one level
being replaced by the next, see "Level transitions"), `planefly` (the
engine, authored to the exact length of the world-map interlude rather
than looped), the player's own movement -- `playerland`
(the thud under the landing dust), `playerclimb` (one rung, played once
per cycle of the climb animation, so it keeps time with the legs and
stops when they do), `playerstepup` and `playerstepdown` (a 16px block
walked up or down; the step up also plays when stepping off the top of a
ladder) -- and the three looping tracks `music01` /
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

# Tests

```
node --test tests/*.test.mjs
```

No install step, no test framework, no `node_modules`: Node's own test
runner (`node --test`, built in) against the project's own files. The
game has no dependencies and neither does this.

Everything here answers a question **without running the game**, which is
what makes it fast and worth having in CI (`.github/workflows/tests.yml`
runs exactly the line above on every push):

| file | what it pins down |
|---|---|
| `levels.test.mjs` | every `levels/level_NN.json`: numbering, required fields, obstacles and balls on the 16px grid and inside the playfield, no two obstacles in one cell, every ladder reaching a footing below and a landing above with room to stand on it, player starts that are in bounds and not inside an obstacle or a ball, guaranteed drops on a single breakable block, and every type/shape/powerup/background/weapon it names actually existing |
| `assets.test.mjs` | the files the game asks for at boot are there, `elements/index.json` matches the element files on disk, the player's spritesheet holds every frame its animations name, and every sound played by name -- from code, from element data, from `regions.json` -- is defined in `audio.json` (and every `.ogg` is reachable) |
| `rules.test.mjs` | the pure decisions: the playfield geometry that the placement grid and the step-up depend on, the display sizes, the transition registry's shape, a region's day running morning to night, level times reading as a clock, one default key per action with no key doing two jobs, and key labels the menu font can actually draw |

These are not hypothetical rules. Each one is something that has already
been broken at least once: 108 balls off the grid (which made opening a
level in the editor and saving it back move them), three levels with two
obstacles in the same cell, a level pointing at a background with no
file, and up being bound to both climbing and shooting.

## The other half: the smoke tests

```
npm install && node --test tests/smoke/*.test.mjs
```

Everything above answers its question without running the game. `smoke/`
does the opposite: it opens the real game in a real browser (Playwright)
and presses on it. That is slower -- about 35 seconds against a fifth of
one -- which is exactly why the two are separate commands and separate CI
jobs. It is also the only part of this project with a dependency; the
game has none, and `node --test tests/*.test.mjs` still has none either.

| file | what it does |
|---|---|
| `smoke.test.mjs` | boots the game; loads and runs **every** level it ships; walks, shoots and pops with real key events; loses a life and watches the ghost leave and the level restart; clears a level and lands on the next; erases progress and checks what survived; starts a blank level in the editor; checks a save with no admin tool says it is local, and that every ball brush is labelled distinctly in a panel that fits; pauses, resumes and quits |
| `game.mjs` | opens the game past its loading screen and hands back the page, a reader into the live scene, a frame stepper, and everything it threw or logged as an error |
| `server.mjs` | thirty lines of `node:http` serving the repo, so running the tests is one command instead of two |

The split is not tidiness, it is what each kind can see. Set
`PLAYER_CONFIG.speed` to 0 and all the tests above still pass -- a player
who cannot move is not a fact about any JSON file. The smoke suite fails
with `player barely moved: 400 -> 400`.

Every bug that has actually reached a player was of that kind: a
spritesheet served from a cache that never expired, a ladder with 32px of
headroom for a 50px player, a countdown that opened over a level still
sliding off the screen. So the rule for a new test is which half can see
it -- if it is answerable from the files, it belongs above, because it
will run in a fifth of a second forever.

## Adding a test

A new `tests/*.test.mjs` is picked up by the command above with nothing
else to register. `helpers.mjs` has the file readers (`readJSON`,
`exists`, `levelFiles`, `elements`); importing from `../js/` works
directly for any module that does not touch Phaser, the DOM or a canvas
at import time -- `constants.js`, `config.js`, `assets.js`, `keys.js`,
`storage.js` and `elements.js` are all safe. For one that does, stub the
global first and import it dynamically (see `rules.test.mjs`, which needs
three lines of Phaser to read the transition registry).

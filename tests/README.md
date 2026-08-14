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
| `levels.test.mjs` | every `levels/level_NN.json`: numbering, required fields, obstacles and balls on the 16px grid and inside the playfield, no two obstacles in one cell, every ladder reaching a footing below and a landing above, player starts that are in bounds and not inside an obstacle or a ball, guaranteed drops on a single breakable block, and every type/shape/powerup/background/weapon it names actually existing |
| `assets.test.mjs` | the files the game asks for at boot are there, `elements/index.json` matches the element files on disk, the player's spritesheet holds every frame its animations name, and every sound played by name -- from code, from element data, from `regions.json` -- is defined in `audio.json` (and every `.ogg` is reachable) |
| `rules.test.mjs` | the pure decisions: the playfield geometry that the placement grid and the step-up depend on, the display sizes, the transition registry's shape, a region's day running morning to night, level times reading as a clock, one default key per action with no key doing two jobs, and key labels the menu font can actually draw |

These are not hypothetical rules. Each one is something that has already
been broken at least once: 108 balls off the grid (which made opening a
level in the editor and saving it back move them), three levels with two
obstacles in the same cell, a level pointing at a background with no
file, and up being bound to both climbing and shooting.

## What is deliberately not here

Anything that needs a browser: rendering, physics, input, the editor's
own behaviour. Those are checked by driving the real game in Chromium
(Playwright), which is a truer test of them than a headless stand-in
would be -- and a slower one, which is why the split exists.

## Adding a test

A new `tests/*.test.mjs` is picked up by the command above with nothing
else to register. `helpers.mjs` has the file readers (`readJSON`,
`exists`, `levelFiles`, `elements`); importing from `../js/` works
directly for any module that does not touch Phaser, the DOM or a canvas
at import time -- `constants.js`, `config.js`, `assets.js`, `keys.js`,
`storage.js` and `elements.js` are all safe. For one that does, stub the
global first and import it dynamically (see `rules.test.mjs`, which needs
three lines of Phaser to read the transition registry).

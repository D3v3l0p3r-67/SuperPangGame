// Registries for every ball/obstacle/power-up "element" -- populated by
// BootScene.populateElements() from elements/*.json (see assets.js's
// ELEMENTS_DIR/MAX_ELEMENT_FILES) before GameScene ever starts. Every
// array/object here is mutated in place (never reassigned), so existing
// importers (Ball.js, Obstacle.js, editor.js, debug.js, weapons.js, ui.js,
// Bonus.js, GameScene.js) keep the same reference the whole game long,
// same pattern as LevelManager's LEVELS.
//
// Adding a new ball size/shape, obstacle type, or power-up is purely a new
// elements/<id>.json file -- nothing here needs to change. A power-up's
// *behavior* is the one thing a JSON file can't express; each element
// instead names a `kind` from POWERUP_BEHAVIORS below (plus a `params`
// object for that kind's own numbers), so e.g. two power-ups that both
// freeze balls but for different durations can share the 'freeze_balls'
// kind and just differ in `durationMs`.

export const BALL_ELEMENTS = []; // [{id, shape, size, label, hasGravity, radius, speed, bounceVelocity, points, color, highlight}]
export const BALL_SHAPE_KEYS = []; // distinct shapes across BALL_ELEMENTS, in first-seen order

export const OBSTACLE_TYPES = {}; // type -> {label, destructible, hitPoints, color, tileTexture}
export const OBSTACLE_TYPE_KEYS = [];

export const POWERUP_TYPES = {}; // type -> {label, color, durationMs, instant, apply(game), revert(game)}
export const POWERUP_TYPE_KEYS = [];

export function getBallElement(shape, size) {
  return BALL_ELEMENTS.find((el) => el.shape === shape && el.size === size);
}

export function maxBallSize(shape) {
  return BALL_ELEMENTS.filter((el) => el.shape === shape).reduce((max, el) => Math.max(max, el.size), 0);
}

// One entry per power-up `kind` a JSON element can reference. Each is a
// plain (game, params) => void pair -- params comes straight from that
// element's own `params` object, so the same kind can back any number of
// differently-tuned power-ups (different duration, different magnitude).
export const POWERUP_BEHAVIORS = {
  instant_score: {
    apply(game, params) { game.score += params.amount; },
    revert() {},
  },
  weapon_max_shots: {
    apply(game, params) { game.weaponState.maxActiveShots = params.maxActiveShots; },
    revert(game, params, base) { game.weaponState.maxActiveShots = base.baseMaxActiveShots; },
  },
  weapon_wide_pierce: {
    apply(game, params) { game.weaponState.widthMultiplier = params.widthMultiplier; game.weaponState.pierce = Infinity; },
    revert(game, params, base) { game.weaponState.widthMultiplier = 1; game.weaponState.pierce = base.basePierce; },
  },
  player_speed_multiplier: {
    apply(game, params) { game.player.speedMultiplier = params.multiplier; },
    revert(game) { game.player.speedMultiplier = 1; },
  },
  extra_life: {
    apply(game) { game.lives += 1; },
    revert() {},
  },
  score_multiplier: {
    apply(game, params) { game.scoreMultiplier = params.multiplier; },
    revert(game) { game.scoreMultiplier = 1; },
  },
  freeze_balls: {
    apply(game) { game.ballsFrozen = true; },
    revert(game) { game.ballsFrozen = false; },
  },
  player_shield: {
    apply(game) { game.player.shielded = true; },
    revert(game) { game.player.shielded = false; },
  },
};

// Dispatches a loaded elements/*.json payload into the right registry
// above -- called once per file by BootScene.populateElements(). `harpoon`
// is WEAPON_TYPES.harpoon (see config.js), passed through so
// weapon_max_shots/weapon_wide_pierce can revert to its base values
// without importing config.js here (kept element-registry-only).
export function registerElement(el, harpoon) {
  if (el.category === 'ball') {
    BALL_ELEMENTS.push(el);
    if (!BALL_SHAPE_KEYS.includes(el.shape)) BALL_SHAPE_KEYS.push(el.shape);
  } else if (el.category === 'obstacle') {
    OBSTACLE_TYPES[el.type] = {
      label: el.label,
      destructible: el.destructible,
      hitPoints: el.hitPoints == null ? Infinity : el.hitPoints,
      color: el.color,
      tileTexture: el.tileTexture,
    };
    OBSTACLE_TYPE_KEYS.push(el.type);
  } else if (el.category === 'powerup') {
    const behavior = POWERUP_BEHAVIORS[el.kind];
    const params = el.params || {};
    POWERUP_TYPES[el.type] = {
      label: el.label,
      color: el.color,
      durationMs: el.durationMs,
      instant: el.instant,
      apply: (game) => behavior.apply(game, params, harpoon),
      revert: (game) => behavior.revert(game, params, harpoon),
    };
    POWERUP_TYPE_KEYS.push(el.type);
  }
}

// Gameplay tuning values and extensibility registries.
// Adding a new ball shape, weapon, or power-up means adding an entry here
// (plus an optional visual case in sprites.js/game.js) -- no changes needed
// in game.js's core loop, physics.js, or entities.js, which all iterate
// these registries generically.

export const PLAYER_CONFIG = {
  width: 12,
  height: 18,
  speed: 90,
  startLives: 3,
  invulnMs: 1500,
};

export const WEAPON_TYPES = {
  harpoon: {
    label: 'Harpoon',
    shotSpeed: 220,
    width: 2,
    color: '#ffd23f',
    baseMaxActiveShots: 1,
    basePierce: 1,
  },
};

// Two ball shapes: round balls fall under gravity and bounce; hex balls
// ignore gravity and drift at a constant diagonal speed, reflecting off
// walls/floor/ceiling/platforms.
export const BALL_SHAPES = {
  round: {
    label: 'Round',
    gravity: true,
    color: '#ff6b6b',
    highlight: '#ffb3b3',
  },
  hex: {
    label: 'Hex',
    gravity: false,
    color: '#4ecdc4',
    highlight: '#a8f0ea',
  },
};

export const BALL_SHAPE_KEYS = Object.keys(BALL_SHAPES);

// Sizes 1-5: size 1 is the smallest (destroyed on hit, worth the most),
// size 5 is the largest (worth the least, splits the most times).
export const BALL_SIZES = [
  { size: 1, radius: 4, baseSpeed: 150, points: 800 },
  { size: 2, radius: 8, baseSpeed: 120, points: 400 },
  { size: 3, radius: 12, baseSpeed: 95, points: 200 },
  { size: 4, radius: 16, baseSpeed: 70, points: 100 },
  { size: 5, radius: 20, baseSpeed: 50, points: 50 },
];

export const MIN_BALL_SIZE = 1;
export const MAX_BALL_SIZE = BALL_SIZES.length;

export const POWERUP_DROP_CHANCE = 0.14;
export const POWERUP_FALL_SPEED = 26;
export const POWERUP_TTL_MS = 7000;

// Each power-up owns its own apply()/revert() so the effect is fully
// self-contained -- Game just calls these, it doesn't know what they do.
export const POWERUP_TYPES = {
  bonus_fruit: {
    label: 'Bonus Fruit',
    color: '#ff9ff3',
    icon: 'B',
    durationMs: 0,
    instant: true,
    apply(game) { game.score += 500; },
    revert() {},
  },
  rapid_shot: {
    label: 'Rapid Shot',
    color: '#ff9f43',
    icon: 'R',
    durationMs: 12000,
    apply(game) { game.weaponState.maxActiveShots = 3; },
    revert(game) { game.weaponState.maxActiveShots = WEAPON_TYPES.harpoon.baseMaxActiveShots; },
  },
  wide_harpoon: {
    label: 'Wide Harpoon',
    color: '#54a0ff',
    icon: 'W',
    durationMs: 10000,
    apply(game) { game.weaponState.widthMultiplier = 4; game.weaponState.pierce = Infinity; },
    revert(game) { game.weaponState.widthMultiplier = 1; game.weaponState.pierce = WEAPON_TYPES.harpoon.basePierce; },
  },
  speed_boost: {
    label: 'Speed Boost',
    color: '#1dd1a1',
    icon: 'S',
    durationMs: 10000,
    apply(game) { game.player.speedMultiplier = 1.5; },
    revert(game) { game.player.speedMultiplier = 1; },
  },
  extra_life: {
    label: 'Extra Life',
    color: '#ff6b81',
    icon: '+',
    durationMs: 0,
    instant: true,
    apply(game) { game.lives += 1; },
    revert() {},
  },
  score_multiplier: {
    label: '2x Score',
    color: '#feca57',
    icon: '2',
    durationMs: 15000,
    apply(game) { game.scoreMultiplier = 2; },
    revert(game) { game.scoreMultiplier = 1; },
  },
  time_freeze: {
    label: 'Time Freeze',
    color: '#48dbfb',
    icon: 'F',
    durationMs: 6000,
    apply(game) { game.ballsFrozen = true; },
    revert(game) { game.ballsFrozen = false; },
  },
  shield: {
    label: 'Shield',
    color: '#c8d6e5',
    icon: 'D',
    durationMs: 8000,
    apply(game) { game.player.shielded = true; },
    revert(game) { game.player.shielded = false; },
  },
};

export const POWERUP_TYPE_KEYS = Object.keys(POWERUP_TYPES);

// Gameplay tuning values and extensibility registries.
// Adding a new balloon kind, weapon, or power-up means adding an entry here
// (plus an optional visual case in sprites.js) -- no changes needed in
// game.js / physics.js / entities.js, which all iterate these registries generically.

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

// Balloon size tiers: tier 0 = largest (starting size), higher tier = smaller child.
export const BALLOON_TIERS = [
  { tier: 0, radius: 20, baseSpeed: 55, points: 100 },
  { tier: 1, radius: 14, baseSpeed: 75, points: 200 },
  { tier: 2, radius: 9, baseSpeed: 100, points: 400 },
  { tier: 3, radius: 5, baseSpeed: 130, points: 800 },
];

export const MAX_BALLOON_TIER = BALLOON_TIERS.length - 1;

// Balloon "kind" layers behavior/visual variants on top of a tier.
export const BALLOON_KINDS = {
  normal: {
    label: 'Normal',
    color: '#ff6b6b',
    highlight: '#ffb3b3',
    movement: 'standard',
    splitsInto: 2,
    bounceDamping: 1.0,
    speedMultiplier: 1.0,
  },
  zigzag: {
    label: 'Zigzag',
    color: '#4ecdc4',
    highlight: '#a8f0ea',
    movement: 'sine',
    splitsInto: 2,
    bounceDamping: 1.0,
    speedMultiplier: 1.0,
    sineAmplitude: 45,
    sineFrequency: 2.4,
  },
  heavy: {
    label: 'Heavy',
    color: '#8854d0',
    highlight: '#c3a6ec',
    movement: 'standard',
    splitsInto: 2,
    bounceDamping: 0.72,
    speedMultiplier: 0.85,
  },
  splitter3: {
    label: 'Splitter',
    color: '#f7b731',
    highlight: '#fde3a7',
    movement: 'standard',
    splitsInto: 3,
    bounceDamping: 1.0,
    speedMultiplier: 1.1,
  },
};

export const POWERUP_DROP_CHANCE = 0.14;
export const POWERUP_FALL_SPEED = 26;
export const POWERUP_TTL_MS = 7000;

// Each power-up owns its own apply()/revert() so the effect is fully
// self-contained -- Game just calls these, it doesn't know what they do.
export const POWERUP_TYPES = {
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
    apply(game) { game.balloonsFrozen = true; },
    revert(game) { game.balloonsFrozen = false; },
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
export const BALLOON_KIND_KEYS = Object.keys(BALLOON_KINDS);

// Static gameplay tuning values that aren't per-element data (see
// elements.js for BALL_ELEMENTS/OBSTACLE_TYPES/POWERUP_TYPES, populated at
// boot from elements/*.json).

// spriteWidth/Height is the logical size the player sprite is drawn/
// positioned at (matches the player_idle_1.webp etc. frames under
// assets/player/); hitboxWidth/Height is the smaller Arcade collision box,
// centered horizontally and anchored to the bottom of that sprite (see
// Player.js) -- every animation frame shares this one hitbox. P1 and P2
// (when added) use the same dimensions.
export const PLAYER_CONFIG = {
  spriteWidth: 16,
  spriteHeight: 32,
  hitboxWidth: 10,
  hitboxHeight: 22,
  shieldSize: 32,
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

export const MIN_BALL_SIZE = 1;

export const POWERUP_DROP_CHANCE = 0.14;
export const POWERUP_FALL_SPEED = 52;
export const POWERUP_TTL_MS = 7000;

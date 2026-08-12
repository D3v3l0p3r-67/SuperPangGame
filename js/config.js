// Static gameplay tuning values that aren't per-element data (see
// elements.js for BALL_ELEMENTS/OBSTACLE_TYPES/POWERUP_TYPES, populated at
// boot from elements/*.json).

// spriteWidth/Height is the logical size the player sprite is drawn/
// positioned at (matches each cell of the assets/player/player.png
// spritesheet); hitboxWidth/Height is the smaller Arcade collision box,
// centered horizontally and anchored to the bottom of that sprite (see
// Player.js) -- every animation frame shares this one hitbox. P1 and P2
// (when added) use the same dimensions.
export const PLAYER_CONFIG = {
  spriteWidth: 32,
  spriteHeight: 64,
  hitboxWidth: 20,
  hitboxHeight: 44,
  shieldSize: 64,
  speed: 180,
  startLives: 3,
  invulnMs: 1500,
};

// Every weapon fires the same way -- one shot per press, a beam whose foot
// stays on the ground and whose head climbs (see Projectile.js). What a
// weapon entry changes is how fast that head climbs, how wide the shot is,
// how many may be in the air at once, how many balls one shot survives
// (basePierce), and -- with ceilingStickSec -- whether reaching the
// ceiling ends the shot or anchors it there for a while.
//
// ceilingStickSec: 0/absent means the shot dies the moment it tops out
// (the harpoon). Above 0, the shot instead hangs from the ceiling for that
// long, staying lethal along its whole length the entire time, and spends
// its last ceilingReleaseWarnSec seconds drawn in its "letting go" frame
// so the release is telegraphed rather than sudden.
export const WEAPON_TYPES = {
  harpoon: {
    label: 'Harpoon',
    shotSpeed: 440,
    width: 4,
    color: '#ffd23f',
    baseMaxActiveShots: 2,
    basePierce: 1,
  },
  grapple: {
    label: 'Grapple',
    shotSpeed: 400,
    width: 4,
    color: '#4ecdc4',
    baseMaxActiveShots: 2,
    basePierce: 1,
    ceilingStickSec: 4,
    ceilingReleaseWarnSec: 1,
  },
};

export const MIN_BALL_SIZE = 1;

export const POWERUP_DROP_CHANCE = 0.14;
export const POWERUP_FALL_SPEED = 104;
export const POWERUP_TTL_MS = 7000;

// Clearing a level converts the time left on the clock into score, counted
// off visibly in the HUD rather than added in one jump (see GameScene's
// levelClear/updateLevelClear): TIME_BONUS_POINTS_PER_SEC is what each
// whole second left is worth, TIME_BONUS_COUNTDOWN_PER_SEC is how fast the
// clock is drained while tallying, in game-seconds per real second (so a
// full 90s clock takes 3s to count off at 30, whatever the level's limit).
// The second one is pure presentation -- it changes how long the tally
// takes to watch, never how many points it awards.
export const TIME_BONUS_POINTS_PER_SEC = 100;
export const TIME_BONUS_COUNTDOWN_PER_SEC = 30;
// Gap between the blips of the counting sound played while that tally
// runs. Deliberately its own interval rather than one per awarded point
// (which at 100/s x 30 would be 3000 sounds a second) or one per frame
// (which would change pitch with the frame rate).
export const TIME_BONUS_TICK_SEC = 0.07;

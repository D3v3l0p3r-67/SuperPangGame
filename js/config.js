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
  spriteWidth: 36,
  spriteHeight: 72,
  hitboxWidth: 22,
  hitboxHeight: 50,
  shieldSize: 64,
  speed: 180,
  startLives: 3,
  invulnMs: 1500,
  // How quickly the feet get what they are asking for on a surface that
  // is not solid footing (an obstacle whose element gives it a `grip`
  // below 1 -- the icy wall, see elements/obstacle-icy-wall.json). Per
  // second, multiplied by that grip: at the ice's 0.12 this works out at
  // 2.4, i.e. about four tenths of a second to lose or gain most of a
  // speed, which is long enough to slide past what you were aiming for
  // and short enough not to feel broken. Surfaces at full grip never
  // reach this at all -- they set the speed outright, exactly as every
  // surface in the game did before ice existed.
  slideResponsePerSec: 20,
};

// Every weapon fires the same way -- one shot per press, a beam whose foot
// stays on the ground and whose head climbs (see Projectile.js). What a
// weapon entry changes is how fast that head climbs, how wide the shot is,
// how many may be in the air at once, how many balls one shot survives
// (basePierce), and -- with ceilingStickSec -- whether reaching the
// ceiling ends the shot or anchors it there for a while.
//
// baseMaxActiveShots is 1 for every weapon: one shot in the air at a time
// is the base state, and a second slot is something the rapid_shot
// power-up grants for its duration (see elements/powerup-rapidshot-*.json).
//
// ceilingStickSec: 0/absent means the shot dies the moment it tops out
// (the harpoon). Above 0, the shot instead hangs from the ceiling for that
// long, staying lethal along its whole length the entire time, and spends
// its last ceilingReleaseWarnSec seconds drawn in its "letting go" frame
// so the release is telegraphed rather than sudden. On one slot that also
// means an anchored shot is the player's only shot until it lets go --
// the cost of putting up a barrier, not a bug.
export const WEAPON_TYPES = {
  harpoon: {
    label: 'Harpoon',
    shotSpeed: 440,
    width: 4,
    color: '#ffd23f',
    baseMaxActiveShots: 1,
    basePierce: 1,
  },
  // The odd one out: a volley weapon rather than a beam. `volley` is what
  // marks it -- GameScene.tryFire branches on it, and Bullet.js takes over
  // from Projectile.js. `baseMaxActiveShots` counts VOLLEYS in the air,
  // not bullets, so three presses put twelve darts up at once.
  //
  // The bullets are fanned rather than parallel: fired straight they would
  // stay a 4-wide comb the whole way up and cover no more than the beam
  // does, whereas a few degrees of spread makes the volley reach wider the
  // higher it gets, which is the whole point of the weapon.
  machinegun: {
    label: 'Machine Gun',
    shotSpeed: 520,
    width: 4,
    color: '#4ecdc4',
    baseMaxActiveShots: 3,
    basePierce: 1,
    volley: { count: 4, spreadDeg: 7, spacingPx: 8 },
  },
  grapple: {
    label: 'Grapple',
    shotSpeed: 400,
    width: 4,
    color: '#4ecdc4',
    baseMaxActiveShots: 1,
    basePierce: 1,
    ceilingStickSec: 4,
    ceilingReleaseWarnSec: 1,
  },
};

// Firing plants the player: for this long after a shot the held
// direction does nothing, so a shot is a decision to stand still rather
// than something done in passing (see Player.update's shotLock). It is
// also exactly how long the shot animation lasts -- BootScene derives the
// frame rate from this number, so the pose and the pause end together.
export const SHOT_LOCK_SEC = 0.15;

// How high a ledge the player can walk straight up, without jumping (it
// cannot jump at all). One obstacle block: anything taller is a wall to
// stop at, a stack of these is a staircase to climb. See Player.js's
// canStepOnto/supportSurface -- a step also needs room to stand on top,
// or a wall built of stacked blocks would be a ladder.
export const PLAYER_STEP_UP_PX = 16;

// How fast the player climbs a ladder, in px/sec. Slower than walking
// (PLAYER_CONFIG.speed): a ladder crosses the playfield's whole height,
// and being able to cover that faster than the ground it skips would make
// every ladder a shortcut rather than a route.
export const PLAYER_CLIMB_SPEED = 110;

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

// Which of js/LevelTransition.js's LEVEL_TRANSITIONS effects plays between
// campaign levels -- the screen is hidden with it, the next level is
// swapped in underneath, and it is drawn back off. Change the name to
// change the effect; each effect carries its own duration, so there is
// nothing else to keep in step.
export const LEVEL_TRANSITION = 'push';

// How many campaign levels are played on each continent before the run
// moves on to the next one (see js/regions.js and the world-map interlude
// that plays on the change). With the route in levels/regions.json this is
// what decides how far into a run each new place turns up.
export const LEVELS_PER_REGION = 5;

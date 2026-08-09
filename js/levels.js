import { VIRTUAL_W, GROUND_Y } from './constants.js';

function b(shape, size, x, y, vx) {
  return { shape, size, x, y, vx };
}

function o(type, x, y, w, h) {
  return { type, x, y, w, h };
}

// Data-driven level list: adding level 11+ means pushing a new object here,
// nothing in game.js needs to change. Obstacle `type` keys into
// OBSTACLE_TYPES in config.js ('platform' = indestructible ledge, 'crate'
// = destroyed by one shot). Obstacle y positions are written as
// `GROUND_Y - N` (not hardcoded absolute numbers) so every level's layout
// keeps the same gap to the ground line regardless of where GROUND_Y is
// set in constants.js.
//
// Every level is horizontally symmetric around VIRTUAL_W / 2, and every
// obstacle's x/y sits exactly on the OBSTACLE_BLOCK_SIZE (8px) grid --
// both left/right edges, not just its origin. For a mirrored pair, the
// left one's x and width are each grid-aligned (multiples of 8), so its
// right edge is too, and the mirror `VIRTUAL_W - (x + w)` is automatically
// grid-aligned as well. For a single centered obstacle, its width is
// rounded to a multiple of 16 (not just 8) specifically so that an exact
// center position (`VIRTUAL_W / 2 - w / 2`) also lands on the 8px grid --
// a width that's only a multiple of 8 would leave a 4px remainder on one
// side, which is exactly the misalignment this fixes. Ball x positions
// are mirrored directly (`VIRTUAL_W - x`); balls aren't grid-locked like
// obstacles are.
export const LEVELS = [
  {
    id: 1,
    name: 'Rooftop Start',
    timeLimitSec: 90,
    // Deliberately obstacle-free: 8 smallest/slowest balls, 4 moving left
    // and 4 moving right. Left-movers sit on the left half heading further
    // left (toward the left wall); right-movers sit on the right half
    // heading further right (toward the right wall) -- so every ball's
    // very first move is *away* from the player's center spawn, and each
    // one bounces off a side wall at least once before its path could
    // ever cross the player. Gives a moment to get oriented while still
    // keeping the level busy.
    obstacles: [],
    balls: [
      b('round', 1, 30, 40, -50),
      b('round', 1, 68, 60, -50),
      b('round', 1, 105, 45, -50),
      b('round', 1, 143, 65, -50),
      b('round', 1, 241, 65, 50),
      b('round', 1, 279, 45, 50),
      b('round', 1, 316, 60, 50),
      b('round', 1, 354, 40, 50),
    ],
  },
  {
    id: 2,
    name: 'Back Alley',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 8, GROUND_Y - 64, 64, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 64, 64, 8),
    ],
    balls: [b('round', 3, 60, 30, 45), b('round', 3, 192, 25, -35), b('round', 3, 324, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 8, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 64, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W / 2 - 24, GROUND_Y - 104, 48, 8),
    ],
    balls: [b('round', 3, 45, 25, 45), b('round', 3, 339, 25, 40), b('hex', 2, 192, 60, -50)],
  },
  {
    id: 4,
    name: 'Wind Tunnel',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 8, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 64, GROUND_Y - 64, 56, 8),
      o('crate', VIRTUAL_W / 2 - 16, GROUND_Y - 48, 32, 16),
    ],
    balls: [b('round', 4, 192, 25, -35), b('hex', 2, 60, 60, 50), b('hex', 2, 324, 60, -50)],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W - 80, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W / 2 - 32, GROUND_Y - 96, 64, 8),
    ],
    balls: [b('round', 3, 45, 25, 45), b('round', 3, 339, 25, 40), b('hex', 3, 120, 60, -45), b('hex', 3, 264, 60, 45)],
  },
  {
    id: 6,
    name: 'Iron Foundry',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W - 80, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W / 2 - 32, GROUND_Y - 96, 64, 8),
      o('platform', 32, GROUND_Y - 136, 48, 8),
      o('platform', VIRTUAL_W - 80, GROUND_Y - 136, 48, 8),
      o('crate', VIRTUAL_W / 2 - 16, GROUND_Y - 48, 32, 16),
    ],
    balls: [b('round', 4, 60, 25, 35), b('round', 4, 324, 25, -40), b('hex', 3, 192, 55, 40)],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W - 80, GROUND_Y - 48, 64, 8),
      o('platform', VIRTUAL_W / 2 - 32, GROUND_Y - 96, 64, 8),
      o('platform', 32, GROUND_Y - 136, 48, 8),
      o('platform', VIRTUAL_W - 80, GROUND_Y - 136, 48, 8),
    ],
    balls: [b('round', 4, 192, 20, -30), b('hex', 3, 105, 55, 45), b('round', 3, 279, 25, 40)],
  },
  {
    id: 8,
    name: 'Storm Deck',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 56, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 48, 56, 8),
      o('platform', VIRTUAL_W / 2 - 32, GROUND_Y - 88, 64, 8),
      o('platform', 24, GROUND_Y - 136, 48, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 136, 48, 8),
      o('crate', 48, GROUND_Y - 48, 24, 16),
      o('crate', VIRTUAL_W - 72, GROUND_Y - 48, 24, 16),
    ],
    balls: [b('round', 5, 192, 20, 30), b('hex', 3, 60, 55, 45), b('hex', 3, 324, 55, -40)],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 56, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 48, 56, 8),
      o('platform', VIRTUAL_W / 2 - 32, GROUND_Y - 88, 64, 8),
      o('platform', 24, GROUND_Y - 136, 48, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 136, 48, 8),
      o('crate', VIRTUAL_W / 2 - 16, GROUND_Y - 48, 32, 16),
    ],
    balls: [b('round', 4, 60, 25, 40), b('hex', 3, 324, 25, -40), b('round', 3, 192, 55, -35)],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 70,
    obstacles: [
      o('platform', 16, GROUND_Y - 48, 48, 8),
      o('platform', VIRTUAL_W - 64, GROUND_Y - 48, 48, 8),
      o('platform', VIRTUAL_W / 2 - 24, GROUND_Y - 88, 48, 8),
      o('platform', 24, GROUND_Y - 128, 48, 8),
      o('platform', VIRTUAL_W - 72, GROUND_Y - 128, 48, 8),
      o('platform', VIRTUAL_W / 2 - 24, GROUND_Y - 168, 48, 8),
      o('crate', 8, GROUND_Y - 48, 16, 16),
      o('crate', VIRTUAL_W - 24, GROUND_Y - 48, 16, 16),
    ],
    balls: [b('round', 5, 45, 20, 40), b('hex', 3, 339, 20, -45), b('round', 3, 135, 55, -35), b('hex', 3, 249, 55, 40)],
  },
];

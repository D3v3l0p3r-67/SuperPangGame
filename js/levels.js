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
// set in constants.js. All x positions (and the N in `VIRTUAL_W - N` /
// `VIRTUAL_W / 2 - N`) are scaled 1.5x from their original values, matching
// VIRTUAL_W's own 256->384 (46-block playfield) resize, so every layout
// keeps the same proportions and symmetry it always had.
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
      o('platform', 0, GROUND_Y - 64, 64, 8),
      o('platform', VIRTUAL_W - 96, GROUND_Y - 64, 64, 8),
    ],
    balls: [b('round', 3, 60, 30, 45), b('round', 3, 192, 25, -35), b('round', 3, 324, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 0, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 84, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W / 2 - 36, GROUND_Y - 104, 48, 8),
    ],
    balls: [b('round', 3, 45, 25, 45), b('round', 3, 339, 25, 40), b('hex', 2, 192, 60, -50)],
  },
  {
    id: 4,
    name: 'Wind Tunnel',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 0, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 84, GROUND_Y - 64, 56, 8),
      o('crate', VIRTUAL_W / 2 - 18, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 192, 25, -35), b('hex', 2, 60, 60, 50), b('hex', 2, 324, 60, -50)],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 105, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 45, GROUND_Y - 94, 60, 8),
    ],
    balls: [b('round', 3, 45, 25, 45), b('round', 3, 339, 25, 40), b('hex', 3, 120, 60, -45), b('hex', 3, 264, 60, 45)],
  },
  {
    id: 6,
    name: 'Iron Foundry',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 105, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 45, GROUND_Y - 94, 60, 8),
      o('platform', 30, GROUND_Y - 134, 50, 8),
      o('platform', VIRTUAL_W - 105, GROUND_Y - 134, 50, 8),
      o('crate', VIRTUAL_W / 2 - 18, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 60, 25, 35), b('round', 4, 324, 25, -40), b('hex', 3, 192, 55, 40)],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 105, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 45, GROUND_Y - 94, 60, 8),
      o('platform', 30, GROUND_Y - 134, 50, 8),
      o('platform', VIRTUAL_W - 105, GROUND_Y - 134, 50, 8),
    ],
    balls: [b('round', 4, 192, 20, -30), b('hex', 3, 105, 55, 45), b('round', 3, 324, 25, 40)],
  },
  {
    id: 8,
    name: 'Storm Deck',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W - 99, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W / 2 - 42, GROUND_Y - 89, 56, 8),
      o('platform', 24, GROUND_Y - 134, 46, 8),
      o('platform', VIRTUAL_W - 93, GROUND_Y - 134, 46, 8),
      o('crate', 45, GROUND_Y - 44, 20, 16),
      o('crate', VIRTUAL_W - 75, GROUND_Y - 44, 20, 16),
    ],
    balls: [b('round', 5, 192, 20, 30), b('hex', 3, 60, 55, 45), b('hex', 3, 324, 55, -40)],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W - 99, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W / 2 - 42, GROUND_Y - 89, 56, 8),
      o('platform', 24, GROUND_Y - 134, 46, 8),
      o('platform', VIRTUAL_W - 93, GROUND_Y - 134, 46, 8),
      o('crate', VIRTUAL_W / 2 - 18, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 60, 25, 40), b('hex', 3, 324, 25, -40), b('round', 3, 192, 55, -35)],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 70,
    obstacles: [
      o('platform', 15, GROUND_Y - 44, 50, 8),
      o('platform', VIRTUAL_W - 90, GROUND_Y - 44, 50, 8),
      o('platform', VIRTUAL_W / 2 - 38, GROUND_Y - 84, 50, 8),
      o('platform', 24, GROUND_Y - 124, 44, 8),
      o('platform', VIRTUAL_W - 90, GROUND_Y - 124, 44, 8),
      o('platform', VIRTUAL_W / 2 - 33, GROUND_Y - 164, 44, 8),
      o('crate', 6, GROUND_Y - 44, 18, 16),
      o('crate', VIRTUAL_W - 33, GROUND_Y - 44, 18, 16),
    ],
    balls: [b('round', 5, 45, 20, 40), b('hex', 3, 339, 20, -45), b('round', 3, 135, 55, -35), b('hex', 3, 249, 55, 40)],
  },
];

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
      b('round', 1, 20, 40, -50),
      b('round', 1, 45, 60, -50),
      b('round', 1, 70, 45, -50),
      b('round', 1, 95, 65, -50),
      b('round', 1, 161, 65, 50),
      b('round', 1, 186, 45, 50),
      b('round', 1, 211, 60, 50),
      b('round', 1, 236, 40, 50),
    ],
  },
  {
    id: 2,
    name: 'Back Alley',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 0, GROUND_Y - 64, 64, 8),
      o('platform', VIRTUAL_W - 64, GROUND_Y - 64, 64, 8),
    ],
    balls: [b('round', 3, 40, 30, 45), b('round', 3, 128, 25, -35), b('round', 3, 216, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 0, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 56, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W / 2 - 24, GROUND_Y - 104, 48, 8),
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 2, 128, 60, -50)],
  },
  {
    id: 4,
    name: 'Wind Tunnel',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 0, GROUND_Y - 64, 56, 8),
      o('platform', VIRTUAL_W - 56, GROUND_Y - 64, 56, 8),
      o('crate', VIRTUAL_W / 2 - 12, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 128, 25, -35), b('hex', 2, 40, 60, 50), b('hex', 2, 216, 60, -50)],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 70, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, GROUND_Y - 94, 60, 8),
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 3, 80, 60, -45), b('hex', 3, 176, 60, 45)],
  },
  {
    id: 6,
    name: 'Iron Foundry',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 70, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, GROUND_Y - 94, 60, 8),
      o('platform', 20, GROUND_Y - 134, 50, 8),
      o('platform', VIRTUAL_W - 70, GROUND_Y - 134, 50, 8),
      o('crate', VIRTUAL_W / 2 - 12, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 40, 25, 35), b('round', 4, 216, 25, -40), b('hex', 3, 128, 55, 40)],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W - 70, GROUND_Y - 44, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, GROUND_Y - 94, 60, 8),
      o('platform', 20, GROUND_Y - 134, 50, 8),
      o('platform', VIRTUAL_W - 70, GROUND_Y - 134, 50, 8),
    ],
    balls: [b('round', 4, 128, 20, -30), b('hex', 3, 70, 55, 45), b('round', 3, 216, 25, 40)],
  },
  {
    id: 8,
    name: 'Storm Deck',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W - 66, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W / 2 - 28, GROUND_Y - 89, 56, 8),
      o('platform', 16, GROUND_Y - 134, 46, 8),
      o('platform', VIRTUAL_W - 62, GROUND_Y - 134, 46, 8),
      o('crate', 30, GROUND_Y - 44, 20, 16),
      o('crate', VIRTUAL_W - 50, GROUND_Y - 44, 20, 16),
    ],
    balls: [b('round', 5, 128, 20, 30), b('hex', 3, 40, 55, 45), b('hex', 3, 216, 55, -40)],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W - 66, GROUND_Y - 44, 56, 8),
      o('platform', VIRTUAL_W / 2 - 28, GROUND_Y - 89, 56, 8),
      o('platform', 16, GROUND_Y - 134, 46, 8),
      o('platform', VIRTUAL_W - 62, GROUND_Y - 134, 46, 8),
      o('crate', VIRTUAL_W / 2 - 12, GROUND_Y - 44, 24, 16),
    ],
    balls: [b('round', 4, 40, 25, 40), b('hex', 3, 216, 25, -40), b('round', 3, 128, 55, -35)],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 70,
    obstacles: [
      o('platform', 10, GROUND_Y - 44, 50, 8),
      o('platform', VIRTUAL_W - 60, GROUND_Y - 44, 50, 8),
      o('platform', VIRTUAL_W / 2 - 25, GROUND_Y - 84, 50, 8),
      o('platform', 16, GROUND_Y - 124, 44, 8),
      o('platform', VIRTUAL_W - 60, GROUND_Y - 124, 44, 8),
      o('platform', VIRTUAL_W / 2 - 22, GROUND_Y - 164, 44, 8),
      o('crate', 4, GROUND_Y - 44, 18, 16),
      o('crate', VIRTUAL_W - 22, GROUND_Y - 44, 18, 16),
    ],
    balls: [b('round', 5, 30, 20, 40), b('hex', 3, 226, 20, -45), b('round', 3, 90, 55, -35), b('hex', 3, 166, 55, 40)],
  },
];

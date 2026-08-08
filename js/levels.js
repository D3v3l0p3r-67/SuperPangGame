import { VIRTUAL_W } from './constants.js';

function b(shape, size, x, y, vx) {
  return { shape, size, x, y, vx };
}

function o(type, x, y, w, h) {
  return { type, x, y, w, h };
}

// Data-driven level list: adding level 11+ means pushing a new object here,
// nothing in game.js needs to change. Obstacle `type` keys into
// OBSTACLE_TYPES in config.js ('platform' = indestructible ledge, 'crate'
// = destroyed by one shot).
export const LEVELS = [
  {
    id: 1,
    name: 'Rooftop Start',
    timeLimitSec: 90,
    // Deliberately obstacle-free, single smallest/slowest ball, spawned
    // off-center so it doesn't immediately threaten the player's spawn
    // point: just movement, shooting, and ball physics, nothing more.
    obstacles: [],
    balls: [b('round', 1, 70, 60, 50)],
  },
  {
    id: 2,
    name: 'Back Alley',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 0, 150, 64, 8),
      o('platform', VIRTUAL_W - 64, 150, 64, 8),
    ],
    balls: [b('round', 3, 40, 30, 45), b('round', 3, 128, 25, -35), b('round', 3, 216, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 90,
    obstacles: [
      o('platform', 0, 150, 56, 8),
      o('platform', VIRTUAL_W - 56, 150, 56, 8),
      o('platform', VIRTUAL_W / 2 - 24, 110, 48, 8),
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 2, 128, 60, -50)],
  },
  {
    id: 4,
    name: 'Wind Tunnel',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 0, 150, 56, 8),
      o('platform', VIRTUAL_W - 56, 150, 56, 8),
      o('crate', VIRTUAL_W / 2 - 12, 170, 24, 16),
    ],
    balls: [b('round', 4, 128, 25, -35), b('hex', 2, 40, 60, 50), b('hex', 2, 216, 60, -50)],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 85,
    obstacles: [
      o('platform', 10, 170, 60, 8),
      o('platform', VIRTUAL_W - 70, 170, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, 120, 60, 8),
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 3, 80, 60, -45), b('hex', 3, 176, 60, 45)],
  },
  {
    id: 6,
    name: 'Iron Foundry',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 10, 170, 60, 8),
      o('platform', VIRTUAL_W - 70, 170, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, 120, 60, 8),
      o('platform', 20, 80, 50, 8),
      o('platform', VIRTUAL_W - 70, 80, 50, 8),
      o('crate', VIRTUAL_W / 2 - 12, 170, 24, 16),
    ],
    balls: [b('round', 4, 40, 25, 35), b('round', 4, 216, 25, -40), b('hex', 3, 128, 55, 40)],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 80,
    obstacles: [
      o('platform', 10, 170, 60, 8),
      o('platform', VIRTUAL_W - 70, 170, 60, 8),
      o('platform', VIRTUAL_W / 2 - 30, 120, 60, 8),
      o('platform', 20, 80, 50, 8),
      o('platform', VIRTUAL_W - 70, 80, 50, 8),
    ],
    balls: [b('round', 4, 128, 20, -30), b('hex', 4, 70, 55, 45), b('round', 3, 216, 25, 40)],
  },
  {
    id: 8,
    name: 'Storm Deck',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 10, 170, 56, 8),
      o('platform', VIRTUAL_W - 66, 170, 56, 8),
      o('platform', VIRTUAL_W / 2 - 28, 125, 56, 8),
      o('platform', 16, 80, 46, 8),
      o('platform', VIRTUAL_W - 62, 80, 46, 8),
      o('crate', 30, 170, 20, 16),
      o('crate', VIRTUAL_W - 50, 170, 20, 16),
    ],
    balls: [b('round', 5, 128, 20, 30), b('hex', 3, 40, 55, 45), b('hex', 3, 216, 55, -40)],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 75,
    obstacles: [
      o('platform', 10, 170, 56, 8),
      o('platform', VIRTUAL_W - 66, 170, 56, 8),
      o('platform', VIRTUAL_W / 2 - 28, 125, 56, 8),
      o('platform', 16, 80, 46, 8),
      o('platform', VIRTUAL_W - 62, 80, 46, 8),
      o('crate', VIRTUAL_W / 2 - 12, 170, 24, 16),
    ],
    balls: [b('round', 4, 40, 25, 40), b('hex', 4, 216, 25, -40), b('round', 3, 128, 55, -35)],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 70,
    obstacles: [
      o('platform', 10, 170, 50, 8),
      o('platform', VIRTUAL_W - 60, 170, 50, 8),
      o('platform', VIRTUAL_W / 2 - 25, 130, 50, 8),
      o('platform', 16, 90, 44, 8),
      o('platform', VIRTUAL_W - 60, 90, 44, 8),
      o('platform', VIRTUAL_W / 2 - 22, 50, 44, 8),
      o('crate', 4, 170, 18, 16),
      o('crate', VIRTUAL_W - 22, 170, 18, 16),
    ],
    balls: [b('round', 5, 30, 20, 40), b('hex', 5, 226, 20, -45), b('round', 3, 90, 55, -35), b('hex', 3, 166, 55, 40)],
  },
];

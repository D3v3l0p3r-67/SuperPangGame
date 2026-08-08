import { VIRTUAL_W } from './constants.js';

function b(shape, size, x, y, vx) {
  return { shape, size, x, y, vx };
}

// Data-driven level list: adding level 11+ means pushing a new object here,
// nothing in game.js needs to change.
export const LEVELS = [
  {
    id: 1,
    name: 'Rooftop Start',
    timeLimitSec: 90,
    platforms: [
      { x: 0, y: 150, w: 64, h: 8 },
      { x: VIRTUAL_W - 64, y: 150, w: 64, h: 8 },
    ],
    balls: [b('round', 3, 60, 30, 40), b('round', 3, 196, 30, -40)],
  },
  {
    id: 2,
    name: 'Back Alley',
    timeLimitSec: 90,
    platforms: [
      { x: 0, y: 150, w: 64, h: 8 },
      { x: VIRTUAL_W - 64, y: 150, w: 64, h: 8 },
    ],
    balls: [b('round', 3, 40, 30, 45), b('round', 3, 128, 25, -35), b('round', 3, 216, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 90,
    platforms: [
      { x: 0, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W - 56, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 24, y: 110, w: 48, h: 8 },
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 2, 128, 60, -50)],
  },
  {
    id: 4,
    name: 'Wind Tunnel',
    timeLimitSec: 85,
    platforms: [
      { x: 0, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W - 56, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 24, y: 110, w: 48, h: 8 },
    ],
    balls: [b('round', 4, 128, 25, -35), b('hex', 2, 40, 60, 50), b('hex', 2, 216, 60, -50)],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 85,
    platforms: [
      { x: 10, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W - 70, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W / 2 - 30, y: 120, w: 60, h: 8 },
    ],
    balls: [b('round', 3, 30, 25, 45), b('round', 3, 226, 25, 40), b('hex', 3, 80, 60, -45), b('hex', 3, 176, 60, 45)],
  },
  {
    id: 6,
    name: 'Iron Foundry',
    timeLimitSec: 80,
    platforms: [
      { x: 10, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W - 70, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W / 2 - 30, y: 120, w: 60, h: 8 },
      { x: 20, y: 80, w: 50, h: 8 },
      { x: VIRTUAL_W - 70, y: 80, w: 50, h: 8 },
    ],
    balls: [b('round', 4, 40, 25, 35), b('round', 4, 216, 25, -40), b('hex', 3, 128, 55, 40)],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 80,
    platforms: [
      { x: 10, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W - 70, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W / 2 - 30, y: 120, w: 60, h: 8 },
      { x: 20, y: 80, w: 50, h: 8 },
      { x: VIRTUAL_W - 70, y: 80, w: 50, h: 8 },
    ],
    balls: [b('round', 4, 128, 20, -30), b('hex', 4, 70, 55, 45), b('round', 3, 216, 25, 40)],
  },
  {
    id: 8,
    name: 'Storm Deck',
    timeLimitSec: 75,
    platforms: [
      { x: 10, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W - 66, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 28, y: 125, w: 56, h: 8 },
      { x: 16, y: 80, w: 46, h: 8 },
      { x: VIRTUAL_W - 62, y: 80, w: 46, h: 8 },
    ],
    balls: [b('round', 5, 128, 20, 30), b('hex', 3, 40, 55, 45), b('hex', 3, 216, 55, -40)],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 75,
    platforms: [
      { x: 10, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W - 66, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 28, y: 125, w: 56, h: 8 },
      { x: 16, y: 80, w: 46, h: 8 },
      { x: VIRTUAL_W - 62, y: 80, w: 46, h: 8 },
    ],
    balls: [b('round', 4, 40, 25, 40), b('hex', 4, 216, 25, -40), b('round', 3, 128, 55, -35)],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 70,
    platforms: [
      { x: 10, y: 170, w: 50, h: 8 },
      { x: VIRTUAL_W - 60, y: 170, w: 50, h: 8 },
      { x: VIRTUAL_W / 2 - 25, y: 130, w: 50, h: 8 },
      { x: 16, y: 90, w: 44, h: 8 },
      { x: VIRTUAL_W - 60, y: 90, w: 44, h: 8 },
      { x: VIRTUAL_W / 2 - 22, y: 50, w: 44, h: 8 },
    ],
    balls: [b('round', 5, 30, 20, 40), b('hex', 5, 226, 20, -45), b('round', 3, 90, 55, -35), b('hex', 3, 166, 55, 40)],
  },
];

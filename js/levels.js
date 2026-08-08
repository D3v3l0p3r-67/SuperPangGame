import { VIRTUAL_W } from './constants.js';

function b(tier, kind, x, y, vx) {
  return { tier, kind, x, y, vx };
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
    balloons: [b(0, 'normal', 60, 30, 40), b(0, 'normal', 196, 30, -40)],
  },
  {
    id: 2,
    name: 'Back Alley',
    timeLimitSec: 90,
    platforms: [
      { x: 0, y: 150, w: 64, h: 8 },
      { x: VIRTUAL_W - 64, y: 150, w: 64, h: 8 },
    ],
    balloons: [b(0, 'normal', 40, 30, 45), b(0, 'normal', 128, 25, -35), b(0, 'normal', 216, 30, 40)],
  },
  {
    id: 3,
    name: 'Market Square',
    timeLimitSec: 85,
    platforms: [
      { x: 0, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W - 56, y: 150, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 24, y: 110, w: 48, h: 8 },
    ],
    balloons: [
      b(0, 'normal', 30, 25, 45),
      b(0, 'normal', 128, 20, -30),
      b(0, 'normal', 226, 25, 40),
      b(1, 'normal', 80, 60, -50),
    ],
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
    balloons: [
      b(0, 'zigzag', 40, 25, 45),
      b(0, 'normal', 128, 20, -35),
      b(0, 'zigzag', 216, 25, 40),
      b(1, 'normal', 70, 60, -50),
    ],
  },
  {
    id: 5,
    name: 'Clocktower',
    timeLimitSec: 80,
    platforms: [
      { x: 10, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W - 70, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W / 2 - 30, y: 120, w: 60, h: 8 },
    ],
    balloons: [
      b(0, 'normal', 30, 25, 45),
      b(0, 'zigzag', 128, 20, -40),
      b(0, 'normal', 226, 25, 40),
      b(1, 'zigzag', 80, 60, -45),
      b(1, 'normal', 176, 60, 45),
    ],
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
    balloons: [
      b(0, 'heavy', 40, 25, 35),
      b(0, 'normal', 128, 20, -40),
      b(0, 'zigzag', 216, 25, 40),
      b(1, 'heavy', 80, 55, -40),
    ],
  },
  {
    id: 7,
    name: 'Sky Bridge',
    timeLimitSec: 75,
    platforms: [
      { x: 10, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W - 70, y: 170, w: 60, h: 8 },
      { x: VIRTUAL_W / 2 - 30, y: 120, w: 60, h: 8 },
      { x: 20, y: 80, w: 50, h: 8 },
      { x: VIRTUAL_W - 70, y: 80, w: 50, h: 8 },
    ],
    balloons: [
      b(0, 'zigzag', 30, 25, 45),
      b(0, 'heavy', 128, 20, -30),
      b(0, 'normal', 226, 25, 40),
      b(1, 'zigzag', 70, 55, -45),
      b(1, 'heavy', 186, 55, 40),
    ],
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
    balloons: [
      b(0, 'splitter3', 128, 20, 30),
      b(0, 'normal', 40, 25, 45),
      b(0, 'zigzag', 216, 25, -40),
      b(1, 'heavy', 80, 55, -35),
    ],
  },
  {
    id: 9,
    name: 'Lightning Spire',
    timeLimitSec: 70,
    platforms: [
      { x: 10, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W - 66, y: 170, w: 56, h: 8 },
      { x: VIRTUAL_W / 2 - 28, y: 125, w: 56, h: 8 },
      { x: 16, y: 80, w: 46, h: 8 },
      { x: VIRTUAL_W - 62, y: 80, w: 46, h: 8 },
    ],
    balloons: [
      b(0, 'splitter3', 40, 25, 40),
      b(0, 'zigzag', 128, 20, -35),
      b(0, 'heavy', 216, 25, 45),
      b(1, 'splitter3', 80, 55, -40),
      b(1, 'normal', 176, 55, 40),
    ],
  },
  {
    id: 10,
    name: 'Final Ascent',
    timeLimitSec: 65,
    platforms: [
      { x: 10, y: 170, w: 50, h: 8 },
      { x: VIRTUAL_W - 60, y: 170, w: 50, h: 8 },
      { x: VIRTUAL_W / 2 - 25, y: 130, w: 50, h: 8 },
      { x: 16, y: 90, w: 44, h: 8 },
      { x: VIRTUAL_W - 60, y: 90, w: 44, h: 8 },
      { x: VIRTUAL_W / 2 - 22, y: 50, w: 44, h: 8 },
    ],
    balloons: [
      b(0, 'splitter3', 30, 20, 40),
      b(0, 'heavy', 90, 20, -35),
      b(0, 'zigzag', 166, 20, 40),
      b(0, 'splitter3', 226, 20, -45),
      b(1, 'heavy', 60, 55, 45),
      b(1, 'zigzag', 196, 55, -45),
    ],
  },
];

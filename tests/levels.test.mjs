// The rules every level file has to keep, checked against all of them at
// once. These are the ones that have actually been broken before: balls
// off the placement grid (which made opening a level in the editor and
// saving it back move things), two obstacles claiming the same cell, and
// a level pointing at a ball size or a background that doesn't exist.
//
// Nothing here loads Phaser or a browser -- a level is JSON, and every
// rule below is a statement about that JSON.
import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFiles, elements, exists, readJSON } from './helpers.mjs';
import {
  VIRTUAL_W, GROUND_Y, BORDER_THICKNESS, OBSTACLE_BLOCK_SIZE,
} from '../js/constants.js';
import { WEAPON_TYPES, PLAYER_CONFIG } from '../js/config.js';

const LEVELS = levelFiles();
const EL = elements();
const BALL_KEY = (shape, size) => `${shape}-${size}`;
const BALL_SIZES = new Map(EL.balls.map((el) => [BALL_KEY(el.shape, el.size), el]));
const OBSTACLE_TYPES = new Set(EL.obstacles.map((el) => el.type));
const LADDER_TYPES = new Map(EL.ladders.map((el) => [el.type, el]));
const POWERUP_TYPES = new Set(EL.powerups.map((el) => el.type));

const onGrid = (value) => (value - BORDER_THICKNESS) % OBSTACLE_BLOCK_SIZE === 0;

test('there is at least one level, and the files are numbered without gaps', () => {
  assert.ok(LEVELS.length > 0, 'no levels/level_NN.json files found');
  LEVELS.forEach(({ name, number }, index) => {
    assert.equal(number, index + 1, `${name}: levels must run 1..N with no gaps`);
  });
});

test('every level declares the fields the loader needs', () => {
  for (const { name, number, def } of LEVELS) {
    assert.equal(def.id, number, `${name}: id must match the file number`);
    assert.ok(typeof def.name === 'string' && def.name.length > 0, `${name}: needs a name`);
    assert.ok(Array.isArray(def.obstacles), `${name}: obstacles must be an array`);
    assert.ok(Array.isArray(def.balls), `${name}: balls must be an array`);
    assert.ok(def.balls.length > 0, `${name}: a level with no balls can never be cleared`);
    assert.ok(def.timeLimitSec >= 10 && def.timeLimitSec <= 300,
      `${name}: timeLimitSec ${def.timeLimitSec} is outside the editor's own 10..300`);
  }
});

test('every level points at a background and a weapon that exist', () => {
  for (const { name, def } of LEVELS) {
    assert.ok(exists(`assets/backgrounds/${def.background}.webp`),
      `${name}: background "${def.background}" has no file`);
    assert.ok(WEAPON_TYPES[def.weapon], `${name}: weapon "${def.weapon}" is not a WEAPON_TYPES key`);
  }
});

test('obstacles are on the 16px grid and inside the playfield', () => {
  for (const { name, def } of LEVELS) {
    for (const o of def.obstacles) {
      const where = `${name}: obstacle ${o.type} at (${o.x}, ${o.y})`;
      assert.ok(OBSTACLE_TYPES.has(o.type), `${where}: unknown type`);
      assert.ok(onGrid(o.x) && onGrid(o.y), `${where}: off the placement grid`);
      assert.equal(o.w % OBSTACLE_BLOCK_SIZE, 0, `${where}: width is not whole blocks`);
      assert.equal(o.h % OBSTACLE_BLOCK_SIZE, 0, `${where}: height is not whole blocks`);
      assert.ok(o.x >= BORDER_THICKNESS && o.x + o.w <= VIRTUAL_W - BORDER_THICKNESS,
        `${where}: crosses a side wall`);
      assert.ok(o.y >= BORDER_THICKNESS && o.y + o.h <= GROUND_Y, `${where}: crosses the ceiling or floor`);
      if (o.powerup !== undefined) {
        assert.ok(POWERUP_TYPES.has(o.powerup), `${where}: unknown powerup "${o.powerup}"`);
      }
    }
  }
});

test('no two obstacles claim the same cell', () => {
  for (const { name, def } of LEVELS) {
    const taken = new Map();
    for (const o of def.obstacles) {
      for (let y = o.y; y < o.y + o.h; y += OBSTACLE_BLOCK_SIZE) {
        for (let x = o.x; x < o.x + o.w; x += OBSTACLE_BLOCK_SIZE) {
          const cell = `${x},${y}`;
          assert.ok(!taken.has(cell),
            `${name}: cell (${x}, ${y}) is claimed by both a ${taken.get(cell)} and a ${o.type}`);
          taken.set(cell, o.type);
        }
      }
    }
  }
});

test('balls are a real shape/size, on the grid, and inside the playfield', () => {
  for (const { name, def } of LEVELS) {
    for (const b of def.balls) {
      const where = `${name}: ${b.shape} ${b.size} at (${b.x}, ${b.y})`;
      const el = BALL_SIZES.get(BALL_KEY(b.shape, b.size));
      assert.ok(el, `${where}: no element for this shape/size`);
      // A ball's x/y is its CENTRE; it sits on the grid when its bounding
      // box's top-left corner does (see the README's "Adding levels").
      assert.ok(onGrid(b.x - el.radius) && onGrid(b.y - el.radius), `${where}: off the placement grid`);
      assert.ok(b.x - el.radius >= BORDER_THICKNESS && b.x + el.radius <= VIRTUAL_W - BORDER_THICKNESS,
        `${where}: overlaps a side wall`);
      assert.ok(b.y - el.radius >= BORDER_THICKNESS && b.y + el.radius <= GROUND_Y,
        `${where}: overlaps the ceiling or the floor`);
      if (b.powerup !== undefined) {
        assert.ok(POWERUP_TYPES.has(b.powerup), `${where}: unknown powerup "${b.powerup}"`);
      }
    }
  }
});

test('ladders are a real type, on the grid, and fully inside the playfield', () => {
  for (const { name, def } of LEVELS) {
    for (const l of def.ladders ?? []) {
      const where = `${name}: ladder ${l.type} at (${l.x}, ${l.y})`;
      const el = LADDER_TYPES.get(l.type);
      assert.ok(el, `${where}: unknown ladder type`);
      assert.ok(onGrid(l.x) && onGrid(l.y), `${where}: off the placement grid`);
      assert.ok(l.x >= BORDER_THICKNESS && l.x + el.width <= VIRTUAL_W - BORDER_THICKNESS,
        `${where}: crosses a side wall`);
      assert.ok(l.y >= BORDER_THICKNESS && l.y + el.height <= GROUND_Y,
        `${where}: crosses the ceiling or the floor`);
    }
  }
});

test('a level that names a player start puts it somewhere the player fits', () => {
  for (const { name, def } of LEVELS) {
    if (def.playerStart === undefined) continue;
    const where = `${name}: playerStart (${def.playerStart.x}, ${def.playerStart.y})`;
    const halfWidth = PLAYER_CONFIG.spriteWidth / 2;
    assert.ok(Number.isFinite(def.playerStart.x) && Number.isFinite(def.playerStart.y),
      `${where}: x and y must both be numbers`);
    assert.ok(def.playerStart.x - halfWidth >= BORDER_THICKNESS
      && def.playerStart.x + halfWidth <= VIRTUAL_W - BORDER_THICKNESS, `${where}: outside the side walls`);
    assert.ok(def.playerStart.y >= BORDER_THICKNESS + PLAYER_CONFIG.spriteHeight
      && def.playerStart.y <= GROUND_Y, `${where}: the player would not fit standing there`);
  }
});

test('panic mode has a level of its own, in the same shape', () => {
  const panic = readJSON('levels/panic.json');
  assert.ok(Array.isArray(panic.obstacles) && Array.isArray(panic.balls),
    'panic.json must load like any other level');
  assert.ok(panic.panicSpawn, 'panic.json needs its panicSpawn wave table');
});

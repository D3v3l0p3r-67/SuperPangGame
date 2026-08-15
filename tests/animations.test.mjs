// js/animations.js is read by two very different things -- BootScene
// turns each entry into a Phaser animation, and the admin tool's sprite
// studio plays the same entry back on the file itself -- so a broken
// entry is either an animation the game never plays or a preview that
// lies about it. Both are answerable from the files: the registry names
// texture paths, and the frame counts follow from the sheets on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elements, exists, pngSize } from './helpers.mjs';
import {
  gameAnimations, EFFECT_ANIMATIONS, PLAYER_FRAME_RATE, PLAYER_LOOPING, playerAnimKey,
  hexSpinFrameRate, ballPopFrameSize,
} from '../js/animations.js';
import {
  PLAYER_ANIM_FRAMES, PLAYER_FRAME, PLAYER_TEXTURE_PATH,
  PLAYER_GHOST_FRAMES, PLAYER_GHOST_FRAME, PLAYER_GHOST_TEXTURE_PATH,
  ballPopAnimKey, ballSpinAnimKey, HEX_SPIN_FRAMES, BALL_POP_FRAMES, POP_FRAME_SCALE,
} from '../js/assets.js';

const BALLS = elements().balls;
const ANIMS = gameAnimations(BALLS);

test('every animation is playable: a texture that exists, real frames, a real rate', () => {
  assert.ok(ANIMS.length > 0, 'the registry is empty');
  const seen = new Set();
  for (const anim of ANIMS) {
    assert.ok(!seen.has(anim.key), `two animations share the key "${anim.key}"`);
    seen.add(anim.key);
    assert.ok(exists(anim.texturePath), `${anim.key}: ${anim.texturePath} has no file`);
    assert.ok(anim.frames.length > 0, `${anim.key}: no frames`);
    for (const frame of anim.frames) {
      assert.ok(Number.isInteger(frame) && frame >= 0, `${anim.key}: frame ${frame} is not a frame index`);
    }
    assert.ok(Number.isFinite(anim.frameRate) && anim.frameRate > 0,
      `${anim.key}: ${anim.frameRate} fps -- an animation at zero or NaN never advances`);
    assert.equal(typeof anim.loop, 'boolean', `${anim.key}: loop must be a boolean`);
    assert.ok(anim.frame?.frameWidth > 0 && anim.frame?.frameHeight > 0,
      `${anim.key}: no cell size, so nothing can slice its sheet`);
  }
});

test('the player has exactly the animations its states name, at frames the sheet holds', () => {
  const states = Object.keys(PLAYER_ANIM_FRAMES);
  for (const state of states) {
    const anim = ANIMS.find((a) => a.key === playerAnimKey(state));
    assert.ok(anim, `the player has no animation for "${state}"`);
    assert.deepEqual(anim.frames, PLAYER_ANIM_FRAMES[state], `${state}: frames drifted from assets.js`);
    assert.equal(anim.loop, PLAYER_LOOPING.has(state), `${state}: loops in one place and not the other`);
    assert.ok(PLAYER_FRAME_RATE[state] > 0, `${state}: has no frame rate of its own`);
  }
  // Every frame index has to be a cell the sheet actually has, or Phaser
  // hands out an empty frame and the player vanishes in that state.
  const sheet = pngSize(PLAYER_TEXTURE_PATH);
  const cells = sheet.height / PLAYER_FRAME.frameHeight;
  for (const state of states) {
    for (const frame of PLAYER_ANIM_FRAMES[state]) {
      assert.ok(frame < cells, `${state}: frame ${frame} is past the end of a ${cells}-frame sheet`);
    }
  }
});

test('the effect sheets each play every frame they have', () => {
  for (const effect of EFFECT_ANIMATIONS) {
    const anim = ANIMS.find((a) => a.key === effect.key);
    assert.equal(anim.frames.length, effect.frameCount,
      `${effect.key}: plays ${anim.frames.length} of its ${effect.frameCount} frames`);
  }
  // The ghost is the one effect sheet in a format this suite can measure,
  // and its cell size has to match what the flap is sliced by.
  const ghost = pngSize(PLAYER_GHOST_TEXTURE_PATH);
  assert.equal(ghost.height / PLAYER_GHOST_FRAME.frameHeight, PLAYER_GHOST_FRAMES,
    'the ghost sheet and the ghost animation disagree about how many frames there are');
});

test('every ball has a pop, and only hex balls spin', () => {
  for (const el of BALLS) {
    const pop = ANIMS.find((a) => a.key === ballPopAnimKey(el.shape, el.size));
    assert.ok(pop, `${el.id}: nothing plays when it pops`);
    assert.equal(pop.frames.length, BALL_POP_FRAMES);
    // The burst is drawn bigger than the ball so it can expand past its
    // edge (POP_FRAME_SCALE), and the sheet is sliced by that size.
    assert.equal(pop.frame.frameWidth, ballPopFrameSize(el.radius));
    assert.equal(pop.frame.frameWidth, Math.round(el.radius * 2 * POP_FRAME_SCALE));

    const spin = ANIMS.find((a) => a.key === ballSpinAnimKey(el.shape, el.size));
    if (el.shape !== 'hex') {
      assert.equal(spin, undefined, `${el.id}: a round ball looks the same at every angle -- it should not spin`);
      continue;
    }
    assert.ok(spin, `${el.id}: hex balls spin, and this one has no spin animation`);
    assert.equal(spin.frames.length, HEX_SPIN_FRAMES);
    // Bigger/slower hexagons turn slower -- the rate is derived, not
    // authored, so what this pins down is that it stays a real rate.
    assert.equal(spin.frameRate, hexSpinFrameRate(el.speed, el.radius));
    assert.ok(spin.frameRate > 0 && spin.frameRate < 60, `${el.id}: ${spin.frameRate} fps is not a spin`);
  }
});

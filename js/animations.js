// Every animation the game plays, as data: which texture it runs on,
// which of that texture's frames in which order, how fast, and whether it
// loops. BootScene turns each entry into a Phaser animation (it is the
// only thing here that needs Phaser at all); the admin tool's sprite
// studio reads the same entries to play a sheet back exactly the way the
// game will (see admin/js/spriteMeta.js).
//
// It lives apart from assets.js on purpose: that file names FILES and
// TEXTURE KEYS, this one names MOTION. Both are read rather than
// duplicated -- an animation whose rate is written down twice is one that
// will eventually be two different rates.
//
// Nothing here imports Phaser, so a test (or the admin, or a tool) can
// read it directly.
import { PLAYER_CONFIG, SHOT_LOCK_SEC } from './config.js';
import {
  PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_PATH, PLAYER_FRAME, PLAYER_ANIM_FRAMES,
  PLAYER_SHIELD_TEXTURE_KEY, PLAYER_SHIELD_TEXTURE_PATH, PLAYER_SHIELD_FRAMES, PLAYER_SHIELD_ANIM_KEY,
  PLAYER_HIT_TEXTURE_KEY, PLAYER_HIT_TEXTURE_PATH, PLAYER_HIT_FRAMES, PLAYER_HIT_SIZE, PLAYER_HIT_ANIM_KEY,
  PLAYER_DUST_TEXTURE_KEY, PLAYER_DUST_TEXTURE_PATH, PLAYER_DUST_FRAMES,
  PLAYER_DUST_SIZE, PLAYER_DUST_HEIGHT, PLAYER_DUST_ANIM_KEY,
  PLAYER_GHOST_TEXTURE_KEY, PLAYER_GHOST_TEXTURE_PATH, PLAYER_GHOST_FRAMES,
  PLAYER_GHOST_FRAME, PLAYER_GHOST_ANIM_KEY,
  BULLET_HIT_TEXTURE_KEY, BULLET_HIT_TEXTURE_PATH, BULLET_HIT_FRAMES, BULLET_HIT_SIZE, BULLET_HIT_ANIM_KEY,
  BEAM_HIT_TEXTURE_KEY, BEAM_HIT_TEXTURE_PATH, BEAM_HIT_FRAMES, BEAM_HIT_FRAME, BEAM_HIT_ANIM_KEY,
  HEX_SPIN_FRAMES, ballSpinAnimKey, ballTextureKey, ballTexturePath,
  BALL_POP_FRAMES, POP_FRAME_SCALE, ballPopAnimKey, ballPopTextureKey, ballPopTexturePath,
} from './assets.js';

// -- The player's own sheet ------------------------------------------------

// Which states loop rather than playing once and stopping. Player.js
// switches out of a one-shot state itself when it ends (see its
// 'animationcomplete' handling).
export const PLAYER_LOOPING = new Set(['idle', 'move', 'climb']);

// state -> frames per second. levelclear's rate is what makes its 6
// frames (three idle/victory alternations, see assets.js) last exactly
// the LEVEL_CLEAR_MIN_SEC that GameScene holds the celebration for --
// change one and change both. The step and ladder-exit states are brief
// on purpose: they cover a single 16px move, and anything slower reads as
// the player pausing to think about it rather than taking the step.
//
// shot's rate is the one that has to agree with something outside this
// file: its single frame has to be on screen for exactly as long as the
// player is held still by having fired (config.js's SHOT_LOCK_SEC), so
// the pose and the pause end together.
export const PLAYER_FRAME_RATE = {
  idle: 1, move: 8, shot: 1 / SHOT_LOCK_SEC, victory: 1, dead: 1, levelclear: 3,
  climb: 6, ladderoff: 8, stepup: 12, stepdown: 12,
};

export const PLAYER_ANIM_LABELS = {
  idle: 'Idle', move: 'Walk', shot: 'Firing', victory: 'Victory pose', dead: 'Dead',
  levelclear: 'Level clear hop', climb: 'Climbing a ladder', ladderoff: 'Stepping off a ladder',
  stepup: 'Stepping up a block', stepdown: 'Stepping down a block',
};

export function playerAnimKey(state) {
  return `player-${state}`;
}

// -- Effects ---------------------------------------------------------------

// The one-file effect sheets: frames stacked vertically, frame 0 on top.
// Their rates read as a set rather than one at a time -- the two impact
// bursts share a rate so a hit on the player and a hit on a ball are the
// same kind of event, dust is slower because dust settles rather than
// snapping, and the ghost is the only looping one because the tween that
// carries it up is what ends it (see GameScene.spawnDeathGhost).
export const EFFECT_ANIMATIONS = [
  {
    key: PLAYER_SHIELD_ANIM_KEY,
    label: 'Shield effect',
    textureKey: PLAYER_SHIELD_TEXTURE_KEY,
    texturePath: PLAYER_SHIELD_TEXTURE_PATH,
    frame: { frameWidth: PLAYER_CONFIG.shieldSize, frameHeight: PLAYER_CONFIG.shieldSize },
    frameCount: PLAYER_SHIELD_FRAMES,
    frameRate: 8,
    loop: true,
  },
  {
    key: PLAYER_HIT_ANIM_KEY,
    label: 'Player hit burst',
    textureKey: PLAYER_HIT_TEXTURE_KEY,
    texturePath: PLAYER_HIT_TEXTURE_PATH,
    frame: { frameWidth: PLAYER_HIT_SIZE, frameHeight: PLAYER_HIT_SIZE },
    frameCount: PLAYER_HIT_FRAMES,
    frameRate: 12,
    loop: false,
  },
  {
    key: BULLET_HIT_ANIM_KEY,
    label: 'Bullet splash',
    textureKey: BULLET_HIT_TEXTURE_KEY,
    texturePath: BULLET_HIT_TEXTURE_PATH,
    frame: { frameWidth: BULLET_HIT_SIZE, frameHeight: BULLET_HIT_SIZE },
    frameCount: BULLET_HIT_FRAMES,
    frameRate: 14,
    loop: false,
  },
  {
    key: BEAM_HIT_ANIM_KEY,
    label: 'Beam impact puff',
    textureKey: BEAM_HIT_TEXTURE_KEY,
    texturePath: BEAM_HIT_TEXTURE_PATH,
    frame: BEAM_HIT_FRAME,
    frameCount: BEAM_HIT_FRAMES,
    // Slower than the bullet's spark: it is a cloud coming apart rather
    // than a chip flying off, and a bigger picture wants the extra
    // fortieth of a second to be seen at all.
    frameRate: 11,
    loop: false,
  },
  {
    key: PLAYER_DUST_ANIM_KEY,
    label: 'Landing dust',
    textureKey: PLAYER_DUST_TEXTURE_KEY,
    texturePath: PLAYER_DUST_TEXTURE_PATH,
    frame: { frameWidth: PLAYER_DUST_SIZE, frameHeight: PLAYER_DUST_HEIGHT },
    frameCount: PLAYER_DUST_FRAMES,
    frameRate: 9,
    loop: false,
  },
  {
    key: PLAYER_GHOST_ANIM_KEY,
    label: 'Ghost wingbeat',
    textureKey: PLAYER_GHOST_TEXTURE_KEY,
    texturePath: PLAYER_GHOST_TEXTURE_PATH,
    frame: PLAYER_GHOST_FRAME,
    frameCount: PLAYER_GHOST_FRAMES,
    frameRate: 7,
    loop: true,
  },
];

// -- Balls -----------------------------------------------------------------

export const BALL_POP_FRAME_RATE = 12;

// Angular speed a hex ball's fixed diagonal speed/radius implies (this is
// the same relationship Ball.js used to apply as a smooth per-frame
// rotation transform -- bigger/slower balls turn slower -- before that
// became visibly blurry/aliased on this game's tiny pixel-art hexagons at
// arbitrary rotation angles), converted from radians/sec to frames/sec
// for a HEX_SPIN_FRAMES-frame-per-rotation cycle, then sped up on top of
// that physically-derived rate (SPIN_SPEED_MULTIPLIER: 1.5x, then a
// further 30% on top of that -- 1.5 * 1.3 = 1.95).
const SPIN_SPEED_MULTIPLIER = 1.95;

export function hexSpinFrameRate(speed, radius) {
  const hSpeed = speed * Math.SQRT1_2;
  const angularSpeed = hSpeed / radius; // radians/sec
  return (angularSpeed / (Math.PI * 2)) * HEX_SPIN_FRAMES * SPIN_SPEED_MULTIPLIER;
}

export function ballPopFrameSize(radius) {
  return Math.round(radius * 2 * POP_FRAME_SCALE);
}

// -- The whole list --------------------------------------------------------

// Every animation in the game, in one array, given the ball elements the
// game booted with (they decide how many pop/spin animations there are --
// one per shape/size pair, see elements/*.json). Both consumers iterate
// this generically: BootScene creates a Phaser animation per entry, the
// admin offers one playable animation per entry.
export function gameAnimations(ballElements = []) {
  const list = [];

  for (const [state, frames] of Object.entries(PLAYER_ANIM_FRAMES)) {
    list.push({
      key: playerAnimKey(state),
      label: PLAYER_ANIM_LABELS[state] ?? state,
      textureKey: PLAYER_TEXTURE_KEY,
      texturePath: PLAYER_TEXTURE_PATH,
      frame: PLAYER_FRAME,
      frames: [...frames],
      frameRate: PLAYER_FRAME_RATE[state] ?? 8,
      loop: PLAYER_LOOPING.has(state),
    });
  }

  for (const effect of EFFECT_ANIMATIONS) {
    list.push({
      key: effect.key,
      label: effect.label,
      textureKey: effect.textureKey,
      texturePath: effect.texturePath,
      frame: effect.frame,
      frames: frameRange(effect.frameCount),
      frameRate: effect.frameRate,
      loop: effect.loop,
    });
  }

  for (const el of ballElements) {
    const popSize = ballPopFrameSize(el.radius);
    list.push({
      key: ballPopAnimKey(el.shape, el.size),
      label: `Pop -- ${el.shape} size ${el.size}`,
      textureKey: ballPopTextureKey(el.shape, el.size),
      texturePath: ballPopTexturePath(el.shape, el.size),
      frame: { frameWidth: popSize, frameHeight: popSize },
      frames: frameRange(BALL_POP_FRAMES),
      frameRate: BALL_POP_FRAME_RATE,
      loop: false,
    });

    // Only hex balls spin: a round one looks the same at every angle, so
    // its texture is a single image rather than a sheet.
    if (el.shape !== 'hex') continue;
    list.push({
      key: ballSpinAnimKey(el.shape, el.size),
      label: `Spin -- ${el.shape} size ${el.size}`,
      textureKey: ballTextureKey(el.shape, el.size),
      texturePath: ballTexturePath(el.shape, el.size),
      frame: { frameWidth: el.radius * 2, frameHeight: el.radius * 2 },
      frames: frameRange(HEX_SPIN_FRAMES),
      frameRate: hexSpinFrameRate(el.speed, el.radius),
      loop: true,
    });
  }

  return list;
}

function frameRange(count) {
  return Array.from({ length: count }, (_, i) => i);
}

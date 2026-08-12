import { WEAPON_SHOTS_KEY, WEAPON_SHOTS_FRAME, SHOT_BEAM_WIDTH, weaponShotFrame } from './assets.js';
import { BORDER_THICKNESS, GROUND_Y } from './constants.js';

// The shot is a BEAM, not a travelling bullet: its foot stays planted on
// the ground the player fired from and its head climbs upward (at the
// weapon's shotSpeed, see config.js) until something stops it -- a ball or
// obstacle it overlaps (GameScene's onProjectileHit* handlers destroy it,
// or decrement its pierce count first), or the ceiling, which caps
// its length and either ends the shot or anchors it there (see the phases
// below). So it starts already spanning feet-to-muzzle and, at full
// extension, runs the whole way from the ground to the ceiling.
//
// PHASES. A shot is 'flying' while its head climbs. On reaching the
// ceiling a weapon with no ceilingStickSec is done; one with it instead
// goes 'stuck' -- held at full length for that many seconds, still lethal
// along its entire length, so it works as a standing barrier balls can't
// cross rather than a one-shot. Its last ceilingReleaseWarnSec seconds are
// spent 'releasing', which exists purely to telegraph the end: the shot is
// still solid, but drawn in its letting-go frame so a player can see the
// barrier is about to disappear instead of being surprised by it.
// Each phase has its own cell in the shot spritesheet (see assets.js's
// WEAPON_SHOT_FRAMES).
//
// Growing the body rather than moving it is what makes the WHOLE beam
// lethal along its length instead of only a leading edge -- a ball
// drifting into the middle of an already-extended beam still gets popped.
//
// Rendering is by CROP, never by scaling: the artwork is authored at the
// exact height a full-extension shot reaches (see assets.js's
// WEAPON_SHOTS_FRAME) with its head at the top of the cell, so showing the
// top `length` pixels of that cell puts the head at the climbing edge with
// the shaft trailing below it, at 1:1 pixel scale the whole way up. Left
// unscaled, an Arcade body sized in world pixels also stays exactly the
// size it was set to (a scaled sprite would multiply it again).
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, headY, width, speed, pierce, weaponType, stickSec = 0, releaseWarnSec = 0) {
    super(scene, x, GROUND_Y, WEAPON_SHOTS_KEY, weaponShotFrame(weaponType, 'flying'));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Top-centre: the sprite is positioned by its head, which is the end
    // that actually moves, so growth is a position + crop update with no
    // origin maths per frame.
    this.setOrigin(0.5, 0);

    this.body.setAllowGravity(false);
    // The beam is driven entirely by updateBeam(), so Arcade shouldn't be
    // integrating a velocity for it.
    this.body.moves = false;

    this.beamX = x;
    this.beamWidth = Math.max(SHOT_BEAM_WIDTH, Math.round(width));
    this.growSpeed = speed;
    this.hitsLeft = pierce;
    this.weaponType = weaponType;
    this.stickSec = stickSec;
    this.releaseWarnSec = releaseWarnSec;
    this.phase = 'flying';
    this.stickLeft = 0;
    // Behind the player (depth 4), so the shot reads as coming from
    // behind the character rather than being painted across it -- but
    // still above the balls (3) and obstacles (1-2) it travels past.
    this.setDepth(3.5);

    // Already spanning from the ground up to the muzzle at the instant it
    // is fired, rather than starting as a stub at the muzzle.
    this.setLength(Math.min(GROUND_Y - headY, this.maxLength));
  }

  get maxLength() {
    return GROUND_Y - BORDER_THICKNESS;
  }

  setLength(length) {
    this.length = length;
    const headY = GROUND_Y - length;

    this.setPosition(this.beamX, headY);
    // Show the top `length` px of the cell: head at the top, shaft below.
    this.setCrop(0, 0, WEAPON_SHOTS_FRAME.frameWidth, length);

    // Hitbox tracks the drawn beam, not the cell's empty side margins.
    this.body.setSize(this.beamWidth, length, false);
    this.body.setOffset((WEAPON_SHOTS_FRAME.frameWidth - this.beamWidth) / 2, 0);
  }

  // Swaps in the artwork for a phase. setFrame keeps the crop rect but
  // re-derives the body from the new frame, so the length has to be
  // re-applied afterwards to put the crop and hitbox back where they were.
  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.setFrame(weaponShotFrame(this.weaponType, phase));
    this.setLength(this.length);
  }

  // Called once per frame from GameScene.updatePlaying. Returns false once
  // the beam is spent and should be destroyed -- on reaching the ceiling
  // for a weapon that doesn't stick, or at the end of the stick for one
  // that does.
  updateBeam(dt) {
    if (this.phase !== 'flying') {
      this.stickLeft -= dt;
      if (this.stickLeft <= this.releaseWarnSec) this.setPhase('releasing');
      return this.stickLeft > 0;
    }

    const next = this.length + this.growSpeed * dt;
    if (next < this.maxLength) {
      this.setLength(next);
      return true;
    }

    this.setLength(this.maxLength);
    if (this.stickSec <= 0) return false;
    this.stickLeft = this.stickSec;
    this.setPhase(this.stickSec <= this.releaseWarnSec ? 'releasing' : 'stuck');
    return true;
  }

  registerHit() {
    this.hitsLeft -= 1;
    return this.hitsLeft <= 0;
  }
}

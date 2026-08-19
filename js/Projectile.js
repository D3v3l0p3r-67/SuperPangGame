import {
  WEAPON_SHOTS_KEY, WEAPON_SHOTS_FRAME, SHOT_BEAM_WIDTH, weaponShotFrame,
  BEAM_HIT_TEXTURE_KEY, BEAM_HIT_ANIM_KEY,
} from './assets.js';
import { BORDER_THICKNESS } from './constants.js';
import { SHOT_SHAKE_MAX_SEC } from './config.js';

// The shot is a BEAM, not a travelling bullet: its foot stays planted at
// the height the player fired from and its head climbs upward (at the
// weapon's shotSpeed, see config.js) until something stops it -- a ball or
// obstacle it overlaps (GameScene's onProjectileHit* handlers destroy it,
// or decrement its pierce count first), or the ceiling, which caps
// its length and either ends the shot or anchors it there (see the phases
// below). So it starts already spanning feet-to-muzzle and, at full
// extension, runs the whole way from there to the ceiling.
//
// That foot is `footY`, the firing player's FEET -- not the ground line.
// On the floor the two are the same thing, which is why this was written
// as the ground to begin with; standing on a platform or holding a ladder
// they are not, and a beam anchored to the ground would sprout from the
// floor far below the player and sweep everything in between.
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
// How far into the surface it was fired from a beam's foot is allowed to
// sit before anything there counts as being in the beam's way. The player's
// feet settle within a fraction of a pixel of whatever they are standing on
// rather than exactly on it (Player.followGround leaves anything under half
// a pixel alone), and when that fraction lands INSIDE the surface, so does
// the foot of a beam fired from there -- see blockedBy.
const FOOT_CLEARANCE = 1;

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, headY, footY, width, speed, pierce, weaponType, stickSec = 0, releaseWarnSec = 0) {
    super(scene, x, footY, WEAPON_SHOTS_KEY, weaponShotFrame(weaponType, 'flying'));

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
    this.footY = footY;
    this.beamWidth = Math.max(SHOT_BEAM_WIDTH, Math.round(width));
    this.growSpeed = speed;
    this.hitsLeft = pierce;
    this.weaponType = weaponType;
    this.stickSec = stickSec;
    this.releaseWarnSec = releaseWarnSec;
    this.phase = 'flying';
    this.stickLeft = 0;
    // How much of its hang this beam can still be shaken out of (see
    // shakeLoose). Spent, not renewed: it is a budget for the ONE beam,
    // so holding the trigger down does not simply cancel the weapon.
    this.shakeLeft = SHOT_SHAKE_MAX_SEC;
    // Behind the player (depth 4), so the shot reads as coming from
    // behind the character rather than being painted across it -- but
    // still above the balls (3) and obstacles (1-2) it travels past.
    this.setDepth(3.5);

    // Already spanning from the ground up to the muzzle at the instant it
    // is fired, rather than starting as a stub at the muzzle.
    this.setLength(Math.min(footY - headY, this.maxLength));
  }

  get maxLength() {
    return this.footY - BORDER_THICKNESS;
  }

  setLength(length) {
    this.length = length;
    const headY = this.footY - length;

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

  // Where the climbing end of the beam is right now: what reaches the
  // ceiling, and so where an impact belongs (see GameScene's
  // playShotImpact). The sprite is positioned by its head, but only after
  // setLength has run -- this works it out from the foot instead, which
  // is fixed for the beam's whole life.
  get head() {
    return { x: this.beamX, y: this.footY - this.length };
  }

  // What it leaves where it stops -- the beams' own, bigger and grey (see
  // Bullet.js's for the other half of the pair).
  get impact() {
    // originY 0: the puff hangs from the surface it came off rather than
    // straddling it, so no part of the cloud is drawn inside the block.
    return { textureKey: BEAM_HIT_TEXTURE_KEY, animKey: BEAM_HIT_ANIM_KEY, originY: 0 };
  }

  // True once the beam has caught hold of something and stopped climbing.
  get isAnchored() {
    return this.phase !== 'flying';
  }

  // True when `obstacleBody` is actually in this beam's way. A beam
  // climbs, so only something ABOVE its foot can be -- and the surface the
  // player fired from standing on is not, even though Arcade reports an
  // overlap with it whenever their feet (and so the beam's foot) have
  // settled a fraction of a pixel inside it.
  //
  // Without this, standing on a platform spent the shot on the platform
  // underfoot the instant it was fired. For a grapple that meant anchoring
  // at ZERO length: nothing drawn, and the weapon's only slot held for its
  // full four seconds -- a grapple that simply did not work up there, and
  // only sometimes, since which way that fraction falls depends on how the
  // player arrived.
  blockedBy(obstacleBody) {
    return obstacleBody.y < this.footY - FOOT_CLEARANCE;
  }

  // Catches the beam with its head at `headY` -- the underside of whatever
  // stopped it, the ceiling or an indestructible obstacle alike -- and
  // starts the stick timer. Returns false for a weapon that can't stick
  // (or a beam already hanging), leaving the caller to spend the shot as
  // it normally would.
  anchorAt(headY) {
    if (this.stickSec <= 0 || this.isAnchored) return false;
    this.setLength(Math.max(0, Math.min(this.footY - headY, this.maxLength)));
    this.stickLeft = this.stickSec;
    this.setPhase(this.stickSec <= this.releaseWarnSec ? 'releasing' : 'stuck');
    return true;
  }

  // Rattling the trigger while this beam is hanging brings it down
  // sooner: `seconds` off what is left of its stick, out of a budget that
  // does not refill. Nothing happens to a beam that is still climbing --
  // that press was refused because the slot is full, and a shot in
  // flight is about to free the slot on its own anyway.
  //
  // Returns whether it actually took anything off, so the caller can say
  // so (a press that changes nothing should not sound like one that did).
  shakeLoose(seconds) {
    if (!this.isAnchored || this.shakeLeft <= 0) return false;
    const cut = Math.min(seconds, this.shakeLeft, this.stickLeft);
    if (cut <= 0) return false;
    this.shakeLeft -= cut;
    this.stickLeft -= cut;
    // The "letting go" frame is the warning, and it has to appear as soon
    // as the shortened clock is inside it rather than at the next tick.
    if (this.stickLeft <= this.releaseWarnSec) this.setPhase('releasing');
    return true;
  }

  // Called once per frame from GameScene.updatePlaying. Returns false once
  // the beam is spent and should be destroyed -- on reaching the ceiling
  // for a weapon that doesn't stick, or at the end of the stick for one
  // that does.
  updateBeam(dt) {
    if (this.isAnchored) {
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
    // Reaching the ceiling is a shot stopping on something it cannot
    // break, which is exactly the event the machine gun's bullets have
    // always marked with a puff. A beam gets the same one now, whether it
    // then dies there (the harpoon) or catches hold (the grapple) -- it
    // only ever fires once per shot, because the next frame either finds
    // the beam gone or finds it anchored and returns above.
    this.scene.playShotImpact(this.beamX, this.footY - this.maxLength, this.impact);
    return this.anchorAt(this.footY - this.maxLength);
  }

  registerHit() {
    this.hitsLeft -= 1;
    return this.hitsLeft <= 0;
  }
}

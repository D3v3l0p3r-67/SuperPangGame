import { PROJECTILE_TEXTURE_KEY } from './assets.js';
import { BORDER_THICKNESS } from './constants.js';

// The shot is a laser BEAM, not a travelling bullet: it stays anchored at
// the muzzle it was fired from and grows upward from there (at the weapon's
// shotSpeed, see config.js) until something stops it -- a ball or an
// obstacle it overlaps (GameScene's onProjectileHit* handlers destroy it,
// or decrement pierce first for wide_harpoon), or the ceiling, which caps
// its length and ends it in updateBeam below.
//
// Growing the body instead of moving it is what makes the WHOLE beam
// lethal along its length rather than only its leading edge -- a ball
// drifting into the middle of an already-extended beam still gets popped.
//
// Geometry note: the sprite's origin is its bottom-centre, pinned at the
// muzzle, so with a zero body offset Arcade derives the body rect as
// exactly (x - width/2, muzzleY - length) to (x + width/2, muzzleY) --
// i.e. body and sprite stay aligned for free at every length, no
// per-frame offset correction needed.
const INITIAL_LENGTH = 8;

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, width, speed, pierce) {
    super(scene, x, y, PROJECTILE_TEXTURE_KEY);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1); // bottom-centre: pinned at the muzzle, grows up

    this.body.setAllowGravity(false);
    // The beam never moves -- its length is driven by updateBeam(), so
    // Arcade shouldn't be integrating a velocity for it at all.
    this.body.moves = false;

    this.beamWidth = width;
    this.growSpeed = speed;
    this.muzzleY = y;
    this.hitsLeft = pierce;
    this.setDepth(6);

    this.setLength(INITIAL_LENGTH);
  }

  // Only the DISPLAY size is set here, never body.setSize(): an Arcade body
  // is stored at its unscaled source size and re-derived as source * the
  // sprite's scale every step, so a body explicitly sized in world pixels
  // gets multiplied by that scale a second time (the beam's body ran to
  // thousands of pixels tall while the visible beam was ~300). Left as the
  // default full-frame body with a zero offset, Arcade scales it to exactly
  // the display rect on its own, and the bottom-centre origin puts that
  // rect at (x - width/2, muzzleY - length) -- which is the beam.
  setLength(length) {
    this.length = length;
    this.setDisplaySize(this.beamWidth, length);
  }

  // Called once per frame from GameScene.updatePlaying. Returns false once
  // the beam has reached the ceiling and should be destroyed -- the same
  // moment the old travelling projectile died on the world bounds.
  updateBeam(dt) {
    const maxLength = this.muzzleY - BORDER_THICKNESS;
    const next = this.length + this.growSpeed * dt;
    if (next >= maxLength) {
      this.setLength(maxLength);
      return false;
    }
    this.setLength(next);
    return true;
  }

  registerHit() {
    this.hitsLeft -= 1;
    return this.hitsLeft <= 0;
  }
}

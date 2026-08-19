import { BULLET_TEXTURE_KEY, BULLET_SIZE } from './assets.js';
import { VIRTUAL_W, BORDER_THICKNESS } from './constants.js';

// The machine gun's shot: a short dart that actually travels, unlike the
// harpoon's and grapple's ground-anchored beam (see Projectile.js). Fired
// four at a time in a fanned volley, so the group covers more ground the
// higher it gets.
//
// It deliberately presents the SAME interface GameScene already drives its
// projectiles through -- updateBeam(dt) per frame, registerHit() on a ball,
// isAnchored/anchorAt() for obstacles -- so both weapon kinds live in the
// one this.projectiles group and every collider set up for beams works for
// bullets untouched. Only tryFire() has to know the difference.
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, angleRad, speed, pierce, volleyId) {
    super(scene, x, y, BULLET_TEXTURE_KEY);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setSize(BULLET_SIZE.width, BULLET_SIZE.height);
    // Angles are measured from straight up, so a positive angle leans
    // right. The artwork is drawn nose-up, which makes the sprite's
    // rotation exactly the fired angle with no offset to remember.
    this.body.setVelocity(Math.sin(angleRad) * speed, -Math.cos(angleRad) * speed);
    this.setRotation(angleRad);

    this.hitsLeft = pierce;
    // Which volley this belongs to. GameScene limits how many VOLLEYS may
    // be in the air, not how many bullets, so the bullets have to carry
    // their group with them.
    this.volleyId = volleyId;
    this.setDepth(3.5); // behind the player, above balls -- same as the beam
  }

  // A bullet never catches hold of anything; it just stops. Answering the
  // beam's questions keeps GameScene's obstacle handler weapon-agnostic.
  get isAnchored() {
    return false;
  }

  anchorAt() {
    return false;
  }

  registerHit() {
    this.hitsLeft -= 1;
    return this.hitsLeft <= 0;
  }

  // A bullet travels rather than climbing from a planted foot, so anything
  // it reaches is in its way by definition. Answering the beam's question
  // keeps GameScene's obstacle handler weapon-agnostic.
  blockedBy() {
    return true;
  }

  // Where the dart's tip is -- the point an impact splash belongs at,
  // rather than the middle of the sprite.
  get tip() {
    const half = BULLET_SIZE.height / 2;
    return { x: this.x + Math.sin(this.rotation) * half, y: this.y - Math.cos(this.rotation) * half };
  }

  // Called once per frame from GameScene.updatePlaying, same as the beam's.
  // Returns false once the bullet is spent. Arcade moves it, so all this
  // has to catch is the walls -- which are drawn, not physics bodies (see
  // GameScene.drawBorder), so they need testing by hand.
  updateBeam() {
    const tip = this.tip;
    if (tip.y <= BORDER_THICKNESS || tip.x <= BORDER_THICKNESS || tip.x >= VIRTUAL_W - BORDER_THICKNESS) {
      this.scene.playShotImpact(
        Math.max(BORDER_THICKNESS, Math.min(VIRTUAL_W - BORDER_THICKNESS, tip.x)),
        Math.max(BORDER_THICKNESS, tip.y),
      );
      return false;
    }
    return true;
  }
}

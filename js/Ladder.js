import { LADDER_TYPES } from './elements.js';
import { ladderTextureKey } from './assets.js';

// A climbable ladder. Deliberately NOT a physics object: nothing in the
// game collides with one -- balls, shots and power-ups pass straight
// through, and so does the player, which is exactly what lets a ladder
// carry the player up through a platform it ends against. All it has to
// offer is a rectangle, which Player.js reads to decide when the player
// can get on and where the two ends are.
//
// Drawn above obstacles (depth 2) and behind the balls (3) and the player
// (4), so it reads as fixed to the wall with everything else moving in
// front of it.
export class Ladder extends Phaser.GameObjects.Image {
  constructor(scene, type, x, y) {
    const el = LADDER_TYPES[type];
    super(scene, x, y, ladderTextureKey(el.texture));

    scene.add.existing(this);

    this.type = type;
    // Positioned by its top-left corner, the same reference point every
    // obstacle block and every editor grid cell uses.
    this.setOrigin(0, 0);
    this.setDisplaySize(el.width, el.height);
    this.setDepth(2.5);
  }

  get left() {
    return this.x;
  }

  get right() {
    return this.x + this.displayWidth;
  }

  // The two ends the climb runs between: `top` is where a climber's feet
  // end up at the top of it, `bottom` where they step off at the foot.
  get top() {
    return this.y;
  }

  get bottom() {
    return this.y + this.displayHeight;
  }

  get centerX() {
    return this.x + this.displayWidth / 2;
  }
}

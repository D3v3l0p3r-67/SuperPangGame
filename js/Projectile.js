export class Projectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, width, speed, pierce) {
    super(scene, x, y, 'projectile');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setSize(width, 7);
    this.setDisplaySize(width, 7);
    this.body.setVelocityY(-speed);
    // Both are required: onWorldBounds only controls whether the event
    // fires, setCollideWorldBounds is what actually makes the body stop
    // at (and report reaching) the boundary in the first place.
    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;

    this.hitsLeft = pierce;
    this.setDepth(6);
  }

  registerHit() {
    this.hitsLeft -= 1;
    return this.hitsLeft <= 0;
  }
}

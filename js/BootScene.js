import { PLAYER_PALETTE, PLAYER_IDLE, PLAYER_WALK, buildPixelCanvas, buildPowerupCanvas } from './sprites.js';
import { BALL_SHAPES, POWERUP_TYPES } from './config.js';
import { BALL_TEXTURE_REF_RADIUS } from './Ball.js';
import { OBSTACLE_BLOCK_SIZE, COLORS } from './constants.js';

function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

// Generates every texture the game needs procedurally (pixel-grid canvases
// for the player, Graphics-drawn shapes for balls/projectiles/particles,
// glyph-on-a-disc canvases for power-up icons) and registers them with
// Phaser's texture manager -- no image files anywhere, nothing to preload
// over the network, so this finishes synchronously and starts GameScene
// immediately.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.textures.addCanvas('player-idle', buildPixelCanvas(PLAYER_IDLE, PLAYER_PALETTE));
    this.textures.addCanvas('player-walk', buildPixelCanvas(PLAYER_WALK, PLAYER_PALETTE));

    this.buildBallTexture('ball-round', BALL_SHAPES.round, false);
    this.buildBallTexture('ball-hex', BALL_SHAPES.hex, true);

    this.buildProjectileTexture();
    this.buildParticleTexture();
    this.buildBorderTileTexture();

    for (const [type, def] of Object.entries(POWERUP_TYPES)) {
      this.textures.addCanvas(`powerup-${type}`, buildPowerupCanvas(def.icon, def.color));
    }

    this.scene.start('Game');
  }

  buildBallTexture(key, shapeDef, isHex) {
    const r = BALL_TEXTURE_REF_RADIUS;
    const size = r * 2;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(hexColor(shapeDef.color), 1);
    g.lineStyle(1, 0x0b0e2a, 1);
    if (isHex) {
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        points.push(new Phaser.Geom.Point(r + r * Math.cos(angle), r + r * Math.sin(angle)));
      }
      g.fillPoints(points, true);
      g.strokePoints(points, true);
    } else {
      g.fillCircle(r, r, r);
      g.strokeCircle(r, r, r - 0.5);
    }

    g.fillStyle(hexColor(shapeDef.highlight), 0.85);
    g.fillCircle(r - r * 0.35, r - r * 0.35, Math.max(1, r * 0.3));

    g.generateTexture(key, size, size);
    g.destroy();
  }

  buildProjectileTexture() {
    const w = 4;
    const h = 7;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffd23f, 1);
    g.fillRect(0, 3, w, h - 3);
    g.fillTriangle(0, 3, w / 2, 0, w, 3);
    g.generateTexture('projectile', w, h);
    g.destroy();
  }

  buildParticleTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture('particle', 2, 2);
    g.destroy();
  }

  // Repeating tiles for obstacle walls -- a beveled block with a small
  // rivet, tiled via Phaser TileSprites so each wall is drawn once and
  // reused unchanged everywhere. 'border-tile' (blue) is the playfield
  // frame (see GameScene.drawBorder) and indestructible obstacles;
  // 'border-tile-crate' (brown) is the same shape/texture for destructible
  // crates (see Obstacle.js) -- only the palette differs.
  buildBorderTileTexture() {
    this.buildWallTexture('border-tile', COLORS.frameBase, COLORS.frameHighlight, COLORS.frameShadow, COLORS.frameRivet);
    this.buildWallTexture('border-tile-crate', COLORS.crateBase, COLORS.crateHighlight, COLORS.crateShadow, COLORS.frameRivet);
  }

  buildWallTexture(key, base, highlight, shadow, rivet) {
    const size = OBSTACLE_BLOCK_SIZE;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(hexColor(base), 1);
    g.fillRect(0, 0, size, size);

    g.fillStyle(hexColor(highlight), 1);
    g.fillRect(0, 0, size, 1);
    g.fillRect(0, 0, 1, size);

    g.fillStyle(hexColor(shadow), 1);
    g.fillRect(0, size - 1, size, 1);
    g.fillRect(size - 1, 0, 1, size);

    g.fillStyle(hexColor(rivet), 1);
    g.fillRect(size / 2 - 1, size / 2 - 1, 2, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }
}

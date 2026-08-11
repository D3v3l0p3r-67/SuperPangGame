import { VIRTUAL_W, PLAYFIELD_H, GAME_STATES, COLORS } from './constants.js';
import { WEAPON_TYPES } from './config.js';
import * as assets from './assets.js';
import * as storage from './storage.js';
import { hexColor } from './colors.js';

const ACCENT = hexColor(COLORS.accent);
const DANGER = hexColor(COLORS.danger);

const VISIBLE_STATES = new Set([
  GAME_STATES.PLAYING,
  GAME_STATES.PAUSED,
  GAME_STATES.LEVEL_INTRO,
  GAME_STATES.LEVEL_CLEAR,
  GAME_STATES.HIT_FREEZE,
]);

const MAX_LIVES_ICONS = 5;

// The HUD's own pixel-art layout below is authored at a fixed design
// width (all the individual x offsets -- 4, 74, 166, 196, ... -- assume
// it), independent of VIRTUAL_W. Centering the whole container in
// whatever the actual (possibly wider) HUD_H bar is keeps that hand-laid
// design intact instead of stretching or re-anchoring every element.
const HUD_CONTENT_W = 384;

// A left-anchored row of pooled digit Images, one call to setValue() per
// frame -- unused slots (beyond however many digits the current value
// needs) are just hidden, never destroyed/recreated.
class DigitRow {
  constructor(container, textureKey, frameWidth, maxDigits, x, y) {
    this.frameWidth = frameWidth;
    this.images = [];
    for (let i = 0; i < maxDigits; i++) {
      const img = container.scene.add.image(x + i * frameWidth, y, textureKey, 0).setOrigin(0, 0);
      container.add(img);
      this.images.push(img);
    }
  }

  setValue(n) {
    const str = String(Math.max(0, Math.floor(n)));
    for (let i = 0; i < this.images.length; i++) {
      const has = i < str.length;
      this.images[i].setVisible(has);
      if (has) this.images[i].setFrame(Number(str[i]));
    }
  }

  setTint(color) {
    for (const img of this.images) img.setTint(color);
  }
}

// The graphic status bar living in the dedicated HUD_H strip below the
// playfield (see constants.js) -- every label/digit/icon here is a real
// loaded image (see assets.js's HUD_* constants / BootScene's preload),
// never drawn text, so the whole thing is reskinned by swapping files.
// Layout (all coordinates local to this.container, which sits at
// (0, PLAYFIELD_H)):
//   "1-P" label, then a row of life icons, top-left.
//   Score: large digits, no label (matches the reference HUD).
//   Weapon frame + the current weapon's icon centered inside it.
//   Three label+value rows on the right: TIME, WORLD (level), HI (top
//   score) -- all using the smaller digit strip so label and value line
//   up at the same height.
export class Hud {
  constructor(scene) {
    this.scene = scene;
    const contentX = Math.max(0, (VIRTUAL_W - HUD_CONTENT_W) / 2);
    this.container = scene.add.container(contentX, PLAYFIELD_H).setDepth(20);

    this.container.add(scene.add.image(4, 3, assets.HUD_1P_KEY).setOrigin(0, 0).setTint(ACCENT));

    this.lifeIcons = [];
    for (let i = 0; i < MAX_LIVES_ICONS; i++) {
      const icon = scene.add.image(4 + i * 12, 18, assets.HUD_LIFE_KEY).setOrigin(0, 0);
      this.container.add(icon);
      this.lifeIcons.push(icon);
    }

    this.scoreRow = new DigitRow(this.container, assets.HUD_DIGITS_LARGE_KEY, assets.HUD_DIGITS_LARGE_FRAME.frameWidth, 6, 74, 11);
    this.scoreRow.setTint(ACCENT);

    this.weaponFrame = scene.add.image(166, 9, assets.HUD_WEAPON_FRAME_KEY).setOrigin(0, 0);
    this.container.add(this.weaponFrame);
    this.weaponIcon = scene.add.image(177, 20, assets.hudWeaponIconKey(Object.keys(WEAPON_TYPES)[0]));
    this.container.add(this.weaponIcon);
    this.lastWeaponType = null;

    const ROW1_Y = 1;
    const ROW2_Y = 14;
    const ROW3_Y = 27;
    const RIGHT_X = 196;

    this.container.add(scene.add.image(RIGHT_X, ROW1_Y, assets.HUD_TIME_LABEL_KEY).setOrigin(0, 0).setTint(ACCENT));
    this.timeRow = new DigitRow(this.container, assets.HUD_DIGITS_SMALL_KEY, assets.HUD_DIGITS_SMALL_FRAME.frameWidth, 3, RIGHT_X + 44, ROW1_Y);
    this.timeRow.setTint(ACCENT);

    this.container.add(scene.add.image(RIGHT_X, ROW2_Y, assets.HUD_WORLD_LABEL_KEY).setOrigin(0, 0).setTint(ACCENT));
    this.worldRow = new DigitRow(this.container, assets.HUD_DIGITS_SMALL_KEY, assets.HUD_DIGITS_SMALL_FRAME.frameWidth, 2, RIGHT_X + 54, ROW2_Y);
    this.worldRow.setTint(ACCENT);

    this.container.add(scene.add.image(RIGHT_X, ROW3_Y, assets.HUD_HI_LABEL_KEY).setOrigin(0, 0).setTint(ACCENT));
    this.hiRow = new DigitRow(this.container, assets.HUD_DIGITS_SMALL_KEY, assets.HUD_DIGITS_SMALL_FRAME.frameWidth, 6, RIGHT_X + 20, ROW3_Y);
    this.hiRow.setTint(ACCENT);

    this.lastState = null;
    this.topHighScore = storage.loadHighScores()[0]?.score ?? 0;
  }

  render() {
    const g = this.scene;
    if (g.state !== this.lastState) {
      this.lastState = g.state;
      // Cheap re-read on state changes only -- covers a high score just
      // submitted on the previous run showing up here on the next one.
      this.topHighScore = storage.loadHighScores()[0]?.score ?? 0;
    }

    const visible = VISIBLE_STATES.has(g.state);
    this.container.setVisible(visible);
    if (!visible) return;

    if (g.weaponType !== this.lastWeaponType) {
      this.lastWeaponType = g.weaponType;
      this.weaponIcon.setTexture(assets.hudWeaponIconKey(g.weaponType));
    }

    this.scoreRow.setValue(g.score);
    this.timeRow.setValue(g.remainingLevelTime);
    this.timeRow.setTint(g.remainingLevelTime <= 10 ? DANGER : ACCENT);
    this.worldRow.setValue(g.levelIndex + 1);
    this.hiRow.setValue(Math.max(this.topHighScore, g.score));

    for (let i = 0; i < this.lifeIcons.length; i++) this.lifeIcons[i].setVisible(i < g.lives);
  }
}

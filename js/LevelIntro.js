import { VIRTUAL_W, GAME_STATES, COLORS, LEVEL_INTRO_GO_SEC } from './constants.js';
import * as assets from './assets.js';

function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

const ACCENT = hexColor(COLORS.accent);
const CHAR_ADVANCE = assets.INTRO_FONT_FRAME.frameWidth + 1; // 1px gap between glyphs, pre-scale
const READY_BLINK_MS = 250;

// Composes `text` into a row of Images from the intro font spritesheet
// (monospaced, unknown characters fall back to a blank space frame),
// starting at local (x, y) scaled up by `scale` -- returns the images and
// the row's total pixel width so the caller can center it afterwards.
function buildTextRow(scene, container, text, x, y, scale) {
  const advance = CHAR_ADVANCE * scale;
  const images = [];
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const idx = assets.INTRO_FONT_CHARS.indexOf(ch);
    const img = scene.add.image(cx, y, assets.INTRO_FONT_KEY, idx === -1 ? 0 : idx)
      .setOrigin(0, 0).setScale(scale).setTint(ACCENT);
    container.add(img);
    images.push(img);
    cx += advance;
  }
  const width = text.length === 0 ? 0 : (text.length - 1) * advance + assets.INTRO_FONT_FRAME.frameWidth * scale;
  return { images, width };
}

// Composes `value` as a row of the HUD's large digit strip (native size,
// no scaling -- its 18px frame height already matches the "LEVEL" text
// row at font scale 3, see ensureBuilt), same left-to-right + width
// pattern as buildTextRow above.
function buildDigitsRow(scene, container, value, x, y) {
  const str = String(value);
  const fw = assets.HUD_DIGITS_LARGE_FRAME.frameWidth;
  const images = [];
  for (let i = 0; i < str.length; i++) {
    const img = scene.add.image(x + i * fw, y, assets.HUD_DIGITS_LARGE_KEY, Number(str[i])).setOrigin(0, 0).setTint(ACCENT);
    container.add(img);
    images.push(img);
  }
  return { images, width: str.length * fw };
}

// The graphic level-intro overlay: "LEVEL <n>", the level's name, then a
// blinking "READY" for LEVEL_INTRO_READY_SEC followed by a solid "GO!"
// for LEVEL_INTRO_GO_SEC (see constants.js/GameScene.startLevelIntro) --
// entirely composed from loaded images (assets/intro/font_alpha.webp +
// the HUD's digit strip), same "no drawn text" rule as Hud.js. Drawn with
// no dimming behind it, over the frozen (see GameScene.startLevelIntro)
// gameplay, matching the old DOM screen's transparent background.
export class LevelIntro {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(25).setVisible(false);
    this.rowImages = [];
    this.readyImages = [];
    this.goImages = [];
    this.builtFor = null; // "<levelNumber>:<name>" cache key
  }

  // Rebuilds the level-specific rows (LEVEL number + name) only when they
  // actually changed -- cheap to call every frame while LEVEL_INTRO is
  // active, since it's normally a no-op after the first call.
  ensureBuilt() {
    const g = this.scene;
    const levelNum = g.levelIndex + 1;
    const name = g.currentLevelDef?.name ?? '';
    const key = `${levelNum}:${name}`;
    if (this.builtFor === key) return;
    this.builtFor = key;

    for (const img of [...this.rowImages, ...this.readyImages, ...this.goImages]) img.destroy();
    this.rowImages = [];
    this.readyImages = [];
    this.goImages = [];

    const centerX = VIRTUAL_W / 2;
    const GAP = 8;

    const levelText = buildTextRow(g, this.container, 'LEVEL', 0, 70, 3);
    const digits = buildDigitsRow(g, this.container, levelNum, 0, 70);
    let rowX = centerX - (levelText.width + GAP + digits.width) / 2;
    for (const img of levelText.images) img.x += rowX;
    rowX += levelText.width + GAP;
    for (const img of digits.images) img.x += rowX;
    this.rowImages = [...levelText.images, ...digits.images];

    const nameRow = buildTextRow(g, this.container, name, 0, 102, 2);
    const nameX = centerX - nameRow.width / 2;
    for (const img of nameRow.images) img.x += nameX;
    this.rowImages.push(...nameRow.images);

    const readyRow = buildTextRow(g, this.container, 'READY', 0, 132, 3);
    for (const img of readyRow.images) img.x += centerX - readyRow.width / 2;
    this.readyImages = readyRow.images;

    const goRow = buildTextRow(g, this.container, 'GO!', 0, 132, 3);
    for (const img of goRow.images) img.x += centerX - goRow.width / 2;
    this.goImages = goRow.images;
  }

  render() {
    const g = this.scene;
    if (g.state !== GAME_STATES.LEVEL_INTRO) {
      this.container.setVisible(false);
      this.builtFor = null; // next intro may be a different level -- force a rebuild
      return;
    }

    this.ensureBuilt();
    this.container.setVisible(true);

    const isGoPhase = g.stateTimer <= LEVEL_INTRO_GO_SEC;
    for (const img of this.goImages) img.setVisible(isGoPhase);

    const readyVisible = !isGoPhase && Math.floor((g.stateTimer * 1000) / READY_BLINK_MS) % 2 === 0;
    for (const img of this.readyImages) img.setVisible(readyVisible);
  }
}

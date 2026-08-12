import { VIRTUAL_W, GAME_STATES, COLORS, LEVEL_INTRO_SEC, LEVEL_INTRO_GO_SEC, LEVEL_INTRO_SET_SEC } from './constants.js';
import * as assets from './assets.js';
import { hexColor } from './colors.js';

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
// three-beat countdown -- blinking "READY", then blinking "SET", then a
// solid "GO!", one per phase (see constants.js's LEVEL_INTRO_*_SEC;
// GameScene.startLevelIntro sounds a cue on each) --
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
    this.setImages = [];
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

    for (const img of [...this.rowImages, ...this.readyImages, ...this.setImages, ...this.goImages]) img.destroy();
    this.rowImages = [];
    this.readyImages = [];
    this.setImages = [];
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

    // All three countdown words share the same row -- only one is ever
    // visible at a time (see render()), each centred on its own width.
    const readyRow = buildTextRow(g, this.container, 'READY', 0, 132, 3);
    for (const img of readyRow.images) img.x += centerX - readyRow.width / 2;
    this.readyImages = readyRow.images;

    const setRow = buildTextRow(g, this.container, 'SET', 0, 132, 3);
    for (const img of setRow.images) img.x += centerX - setRow.width / 2;
    this.setImages = setRow.images;

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

    // The countdown runs backwards through the phases as stateTimer drains:
    // READY while more than SET+GO is left, SET while more than GO is, then
    // GO for the last stretch.
    const isGoPhase = g.stateTimer <= LEVEL_INTRO_GO_SEC;
    const isSetPhase = !isGoPhase && g.stateTimer <= LEVEL_INTRO_GO_SEC + LEVEL_INTRO_SET_SEC;
    const isReadyPhase = !isGoPhase && !isSetPhase;

    for (const img of this.goImages) img.setVisible(isGoPhase);

    // READY and SET blink (the waiting beats); GO! above stays solid. The
    // blink is timed from the START OF ITS OWN PHASE rather than from the
    // raw countdown, so each word is always visible on the very frame its
    // phase begins -- which is the frame GameScene sounds its cue on. Timed
    // off the shared countdown instead, a word could open on the blink's
    // "off" half and appear a moment after its own sound.
    const phaseElapsed = isReadyPhase
      ? LEVEL_INTRO_SEC - g.stateTimer
      : LEVEL_INTRO_GO_SEC + LEVEL_INTRO_SET_SEC - g.stateTimer;
    const blinkOn = Math.floor((phaseElapsed * 1000) / READY_BLINK_MS) % 2 === 0;
    for (const img of this.readyImages) img.setVisible(isReadyPhase && blinkOn);
    for (const img of this.setImages) img.setVisible(isSetPhase && blinkOn);
  }
}

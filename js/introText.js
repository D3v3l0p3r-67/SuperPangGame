import { COLORS, VIRTUAL_W } from './constants.js';
import * as assets from './assets.js';
import { hexColor } from './colors.js';

// Text drawn ON the playfield -- the level-intro card (LevelIntro.js) and
// the cleared-level card (LevelClearCard.js) -- composed out of the intro
// font spritesheet one Image per character, the same "no drawn text" rule
// the HUD follows. The DOM menus render the same font a different way
// (see PixelText.js, which draws it into a canvas element).
const ACCENT = hexColor(COLORS.accent);
const CHAR_ADVANCE = assets.INTRO_FONT_FRAME.frameWidth + 1; // 1px gap between glyphs, pre-scale

// Composes `text` into a row of Images from the intro font spritesheet
// (monospaced, unknown characters fall back to a blank space frame),
// starting at local (x, y) scaled up by `scale` -- returns the images and
// the row's total pixel width so the caller can center it afterwards.
export function buildTextRow(scene, container, text, x, y, scale, tint = ACCENT) {
  const advance = CHAR_ADVANCE * scale;
  const images = [];
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const idx = assets.INTRO_FONT_CHARS.indexOf(ch);
    const img = scene.add.image(cx, y, assets.INTRO_FONT_KEY, idx === -1 ? 0 : idx)
      .setOrigin(0, 0).setScale(scale).setTint(tint);
    container.add(img);
    images.push(img);
    cx += advance;
  }
  const width = text.length === 0 ? 0 : (text.length - 1) * advance + assets.INTRO_FONT_FRAME.frameWidth * scale;
  return { images, width };
}

// Composes `value` as a row of the HUD's large digit strip (native size,
// no scaling -- its 18px frame height already matches a text row at font
// scale 3, see LevelIntro's ensureBuilt), same left-to-right + width
// pattern as buildTextRow above.
export function buildDigitsRow(scene, container, value, x, y, tint = ACCENT) {
  const str = String(value);
  const fw = assets.HUD_DIGITS_LARGE_FRAME.frameWidth;
  const images = [];
  for (let i = 0; i < str.length; i++) {
    const img = scene.add.image(x + i * fw, y, assets.HUD_DIGITS_LARGE_KEY, Number(str[i])).setOrigin(0, 0).setTint(tint);
    container.add(img);
    images.push(img);
  }
  return { images, width: str.length * fw };
}

// Builds a row already centred across the playfield -- what most callers
// want, since a card's rows are all stacked down the middle.
export function buildCenteredRow(scene, container, text, y, scale, tint = ACCENT) {
  const row = buildTextRow(scene, container, text, 0, y, scale, tint);
  for (const img of row.images) img.x += (VIRTUAL_W - row.width) / 2;
  return row;
}

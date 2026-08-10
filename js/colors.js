// The one place the game's CSS-hex palette (see constants.js's COLORS,
// plus the per-element `color`/`highlight` fields coming from
// elements/*.json) is converted into the packed integer Phaser's tint/
// fill APIs actually take. Kept out of constants.js on purpose: that file
// is pure data with no dependencies, while this needs the Phaser global.
export function hexColor(cssHex) {
  return Phaser.Display.Color.HexStringToColor(cssHex).color;
}

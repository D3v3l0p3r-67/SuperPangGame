// Central place naming every externally-loaded graphic file and the
// Phaser texture key it's registered under, so BootScene (which loads
// them) and the entities that use them (Ball, ...) always agree on both.
// Swapping a graphic is just replacing the file at its path below -- nothing
// in code needs to change as long as the new file keeps the same name and
// pixel dimensions (see each section's own sizing note).

// Balls: one file per (shape, size) pair, sized exactly to that ball's
// diameter (2x its BALL_SIZES radius in config.js -- 8/16/24/32/48px for
// round sizes 1-5, 8/16/24px for hex sizes 1-3) so it's used at native
// resolution with no runtime scaling.
export const BALL_TEXTURE_DIR = 'assets/balls/';

export function ballTextureKey(shape, size) {
  return `ball_${shape}_${size}`;
}

export function ballTexturePath(shape, size) {
  return `${BALL_TEXTURE_DIR}${ballTextureKey(shape, size)}.webp`;
}

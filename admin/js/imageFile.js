// Reading a game graphic into pixels, and writing pixels back out as the
// same kind of file. Used by both halves of the sprite studio: the
// animation player only needs the image, the paint pane needs the pixels
// and the encoder.
//
// Saving re-encodes the whole file, which is the one place an editor can
// quietly cost quality. So nothing is ever written before it has been
// decoded again and compared against what was meant to be written (see
// encodeChecked); a save that would visibly change the art is not made by
// itself, the studio asks first.
//
// What "visibly" means here was measured rather than assumed, on this
// game's own files, in Chromium:
//
//   PNG            every pixel identical, always.
//   WebP, opaque   every pixel identical (backgrounds, tiles, HUD digits:
//                  0 pixels changed).
//   WebP, with a   ALPHA is kept exactly; the colour under a translucent
//   soft edge      pixel moves by up to ~30/255 where that pixel is 3%
//                  opaque. Weighted by the alpha it is drawn at, the
//                  worst error across every sprite in the game is 1.2 of
//                  255 -- one step of what actually reaches the screen --
//                  and re-encoding the result again does not grow it.
//
// So the check is on what is drawn (delta x alpha), not on the raw bytes:
// counting raw byte differences would refuse every soft-edged sprite in
// the game over a difference nothing can display.
import { rootUrl } from './util.js';

// Cache-busted: a replaced file keeps its URL, and the browser would
// otherwise hand back the copy it already has -- which in an editor means
// painting on top of a version that is no longer on disk.
export function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${path}: could not be loaded`));
    img.src = `${rootUrl(path)}?t=${Date.now()}`;
  });
}

export function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// The image's pixels, as one ImageData at its native size. `alpha: false`
// is deliberately NOT used -- every sprite here has transparency, and the
// whole point is to keep it.
export async function readPixels(path) {
  const img = await loadImage(path);
  const canvas = canvasOf(img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

// A file keeps its format: the game's loader and the server's MIME type
// both go by the extension, so a PNG written into a .webp path is a
// broken graphic rather than a converted one.
export function mimeFor(path) {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  throw new Error(`${path}: not an image this tool can write`);
}

function toBlob(canvas, mime) {
  // Quality 1 is what asks Chromium's WebP encoder for its best encode
  // rather than a merely good one. PNG ignores it. Either way the result
  // is checked below rather than trusted.
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the browser could not encode the image'))), mime, 1);
  });
}

async function decode(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = canvasOf(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// How far a DRAWN colour may move before the change counts as visible, in
// 255ths of the final composited pixel. Two steps is the bottom of the
// 8-bit range -- the last bit of quantisation, on a sprite that is itself
// being composited over a background. It is not a threshold picked to let
// this game's files through: measured across every sprite here the worst
// move is 1.2, while a genuinely lossy save moves OPAQUE pixels by tens
// of steps and trips this by thousands of pixels at once.
const VISIBLE_STEP = 2;

// Encodes `imageData` as the file `path` should hold, then decodes what
// came out and measures the difference:
//
//   changed  pixels whose stored bytes are not identical
//   visible  pixels whose DRAWN colour moved further than VISIBLE_STEP
//   worst    the largest of those drawn-colour moves, in 255ths
//
// `visible: 0` means the file on disk will look exactly like the picture
// on screen, whatever the byte count says.
export async function encodeChecked(imageData, path) {
  const canvas = canvasOf(imageData.width, imageData.height);
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  const blob = await toBlob(canvas, mimeFor(path));

  const back = await decode(blob);
  if (back.width !== imageData.width || back.height !== imageData.height) {
    const every = imageData.width * imageData.height;
    return { blob, changed: every, visible: every, worst: 255 };
  }

  let changed = 0;
  let visible = 0;
  let worst = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const alpha = imageData.data[i + 3];
    // Transparency itself must survive exactly -- a sprite's shape is its
    // alpha, and an edge that moved is a different sprite.
    const alphaMoved = alpha !== back.data[i + 3];
    // A fully transparent pixel's colour channels are not a colour:
    // nothing draws them, and an encoder is free to store whatever
    // compresses best there.
    let delta = 0;
    if (alpha !== 0) {
      for (let k = 0; k < 3; k++) delta = Math.max(delta, Math.abs(imageData.data[i + k] - back.data[i + k]));
    }
    if (!alphaMoved && delta === 0) continue;
    changed++;
    const drawn = alphaMoved ? 255 : delta * (alpha / 255);
    worst = Math.max(worst, drawn);
    if (drawn > VISIBLE_STEP) visible++;
  }
  return { blob, changed, visible, worst: Math.round(worst * 10) / 10 };
}

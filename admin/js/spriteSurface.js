// The picture being edited: a pixel buffer, the tools that write into it,
// and the canvas it is drawn on. Knows nothing about animation -- it is
// told which rectangle of the file to show (one cell, or the whole
// sheet), at what zoom, and whether it is currently locked against
// input; the studio above it decides all three.
//
// The buffer is a plain Uint8ClampedArray copied from the file once, and
// every tool writes into that array rather than drawing through the
// canvas -- so a pixel nobody painted still holds exactly the bytes the
// file had, and a save cannot quietly rewrite the parts of a sheet that
// were only ever looked at.
import { el } from './util.js';
import { canvasOf } from './imageFile.js';

const MAX_UNDO = 24;

export function createSurface({ onPick, onReadout, onChange } = {}) {
  const canvas = el('canvas', { className: 'surface-canvas' });
  const ctx = canvas.getContext('2d');
  const work = canvasOf(1, 1);            // the whole picture at native size
  const workCtx = work.getContext('2d');

  const state = {
    pixels: null, width: 0, height: 0,
    rect: null,                            // the part on screen; null = all of it
    guides: null,                          // cell size, for the whole-sheet view
    zoom: 4, grid: true, mirror: false, locked: false,
    tool: 'pencil', brush: 1, color: { r: 255, g: 255, b: 255, a: 255 },
    hover: null,                           // the pixel under the cursor, for the brush outline
    undo: [], redo: [], painting: false, dirty: false,
  };

  // -- the buffer ----------------------------------------------------------

  const index = (x, y) => (y * state.width + x) * 4;

  function pixelAt(x, y) {
    const i = index(x, y);
    return { r: state.pixels[i], g: state.pixels[i + 1], b: state.pixels[i + 2], a: state.pixels[i + 3] };
  }

  function setPixel(x, y, { r, g, b, a }) {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const i = index(x, y);
    state.pixels[i] = r; state.pixels[i + 1] = g; state.pixels[i + 2] = b; state.pixels[i + 3] = a;
  }

  function stamp(x, y, color) {
    // A brush above 1px is a square centred on the cursor, which is what a
    // pixel grid can actually represent -- a round brush would only be a
    // squarer square with its corners guessed for it.
    const half = Math.floor(state.brush / 2);
    for (let dy = 0; dy < state.brush; dy++) {
      for (let dx = 0; dx < state.brush; dx++) setPixel(x - half + dx, y - half + dy, color);
    }
  }

  // Bounded by the visible rectangle: a fill inside one cell of a sheet
  // must not run through a shared edge into the cell beside it, which
  // would repaint a frame that is not even on screen.
  function floodFill(x, y, color) {
    const bounds = state.rect ?? { x: 0, y: 0, w: state.width, h: state.height };
    const target = pixelAt(x, y);
    const same = (p) => p.r === target.r && p.g === target.g && p.b === target.b && p.a === target.a;
    if (same(color)) return; // would run the whole area and change nothing
    const stack = [[x, y]];
    const seen = new Uint8Array(state.width * state.height);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < bounds.x || cy < bounds.y || cx >= bounds.x + bounds.w || cy >= bounds.y + bounds.h) continue;
      const flat = cy * state.width + cx;
      if (seen[flat]) continue;
      seen[flat] = 1;
      if (!same(pixelAt(cx, cy))) continue;
      setPixel(cx, cy, color);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function pushUndo() {
    state.undo.push(state.pixels.slice());
    if (state.undo.length > MAX_UNDO) state.undo.shift();
    state.redo.length = 0;
  }

  function applyAt(x, y) {
    if (state.tool === 'picker') {
      onPick?.(pixelAt(x, y));
      return;
    }
    if (state.tool === 'fill') floodFill(x, y, state.color);
    else stamp(x, y, state.tool === 'eraser' ? { r: 0, g: 0, b: 0, a: 0 } : state.color);
    state.dirty = true;
    syncWork();
    render();
  }

  // -- drawing -------------------------------------------------------------

  function view() {
    return state.rect ?? { x: 0, y: 0, w: state.width, h: state.height };
  }

  // The buffer -> the offscreen copy everything else draws from. Only
  // when the pixels actually change: the view is redrawn on every pointer
  // move (the brush outline follows the cursor), and putting a whole
  // background's worth of ImageData up on each of those would be work
  // nobody asked for.
  function syncWork() {
    if (!state.pixels) return;
    workCtx.putImageData(new ImageData(state.pixels, state.width, state.height), 0, 0);
  }

  function render() {
    if (!state.pixels) return;
    const { x, y, w, h } = view();
    canvas.width = w * state.zoom;
    canvas.height = h * state.zoom;
    ctx.imageSmoothingEnabled = false;
    drawCheckerboard(ctx, canvas.width, canvas.height);
    ctx.save();
    // Mirroring is how half the game shows the walk and the step frames
    // (authored facing left, drawn with setFlipX -- see js/assets.js). It
    // is a way of LOOKING at the art: the studio locks the tools while it
    // is on, so nothing is ever painted through a mirror.
    if (state.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(work, x, y, w, h, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    // The grid is an aid for placing pixels, so it goes when the picture
    // is moving -- a mesh flickering over an animation is just noise.
    if (state.grid && !state.locked && state.zoom >= 4) drawGrid(ctx, w, h, state.zoom);
    // Looking at the whole sheet, the one thing that is not obvious is
    // where one cell ends and the next begins -- which is the only reason
    // to be looking at the whole sheet in the first place.
    if (state.guides && !state.rect) drawFrameGuides(ctx, state.guides, w, h, state.zoom);
    // What the next press would cover, before it covers it. A 6px brush
    // at 8x zoom paints a 48px square, and until this was drawn the only
    // way to know where its edges fell was to paint and undo.
    if (state.hover && !state.locked) drawBrushOutline(ctx, brushArea(state.hover), view(), state.zoom);
  }

  // The pixels a press at (x, y) would touch. Pencil and eraser stamp a
  // square of the brush size centred on the cursor (see stamp); fill and
  // the eyedropper act on the one pixel under it, whatever the brush is
  // set to -- so the outline shows that instead of promising a square.
  function brushArea({ x, y }) {
    if (state.tool === 'fill' || state.tool === 'picker') return { x, y, w: 1, h: 1 };
    const half = Math.floor(state.brush / 2);
    return { x: x - half, y: y - half, w: state.brush, h: state.brush };
  }

  // -- pointer -------------------------------------------------------------

  function pixelFromEvent(event) {
    const box = canvas.getBoundingClientRect();
    const { x, y } = view();
    return {
      x: x + Math.floor((event.clientX - box.left) / state.zoom),
      y: y + Math.floor((event.clientY - box.top) / state.zoom),
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !state.pixels) return;
    // Locked means the picture on screen is not the picture the cursor
    // thinks it is -- it is playing, or mirrored. The studio takes the
    // click as "stop that" and this press paints nothing.
    if (state.locked) { onChange?.('locked-click'); return; }
    canvas.setPointerCapture(event.pointerId);
    state.painting = true;
    if (state.tool !== 'picker') pushUndo();
    const { x, y } = pixelFromEvent(event);
    applyAt(x, y);
    onChange?.('paint');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.pixels) return;
    const { x, y } = pixelFromEvent(event);
    state.hover = { x, y };
    onReadout?.(inside(x, y) ? { x, y, color: pixelAt(x, y) } : null);
    render();
    // Fill and pick are one decision each: dragging them would run a fill
    // per pixel crossed.
    if (state.painting && (state.tool === 'pencil' || state.tool === 'eraser')) applyAt(x, y);
  });

  const stop = () => {
    if (!state.painting) return;
    state.painting = false;
    onChange?.('stroke-end');
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', () => {
    state.hover = null;
    onReadout?.(null);
    render();
  });

  function inside(x, y) {
    return x >= 0 && y >= 0 && x < state.width && y < state.height;
  }

  // -- what the studio drives ----------------------------------------------

  return {
    canvas,
    get width() { return state.width; },
    get height() { return state.height; },
    get dirty() { return state.dirty; },
    get zoom() { return state.zoom; },
    canUndo: () => state.undo.length > 0,
    canRedo: () => state.redo.length > 0,

    // A whole new picture: from disk, or from a file the admin opened.
    // `keepHistory` is what makes opening a file undoable -- it is the one
    // way to lose a drawing to a single click.
    setPixels(data, width, height, { keepHistory = false } = {}) {
      if (keepHistory && state.pixels) pushUndo();
      else { state.undo.length = 0; state.redo.length = 0; }
      state.pixels = new Uint8ClampedArray(data);
      state.width = width;
      state.height = height;
      state.dirty = keepHistory;
      work.width = width;
      work.height = height;
      syncWork();
      render();
    },

    setView({ rect, guides, zoom, grid, mirror, locked }) {
      if (rect !== undefined) state.rect = rect;
      if (guides !== undefined) state.guides = guides;
      if (zoom !== undefined) state.zoom = zoom;
      if (grid !== undefined) state.grid = grid;
      if (mirror !== undefined) state.mirror = mirror;
      if (locked !== undefined) state.locked = locked;
      render();
    },

    setTool(tool) { state.tool = tool; render(); },
    setBrush(brush) { state.brush = brush; render(); },
    setColor(color) { state.color = color; },
    markSaved() { state.dirty = false; },

    undo() {
      const previous = state.undo.pop();
      if (!previous) return;
      state.redo.push(state.pixels.slice());
      state.pixels = previous;
      state.dirty = true;
      syncWork();
      render();
    },
    redo() {
      const next = state.redo.pop();
      if (!next) return;
      state.undo.push(state.pixels.slice());
      state.pixels = next;
      state.dirty = true;
      syncWork();
      render();
    },

    imageData() {
      return new ImageData(state.pixels.slice(), state.width, state.height);
    },

    // The picture as a source other canvases can copy from -- the frame
    // strip draws its thumbnails out of this, so a thumbnail is the art as
    // it is being painted rather than the file as it was loaded.
    source() { return work; },

    // The colours already in the file, commonest first: this art is drawn
    // from a handful of them, so picking one out of the picture beats
    // matching it by eye in a colour dialog.
    filePalette(limit = 20) {
      const counts = new Map();
      for (let i = 0; i < state.pixels.length; i += 4) {
        if (state.pixels[i + 3] === 0) continue;
        const key = `${state.pixels[i]},${state.pixels[i + 1]},${state.pixels[i + 2]},${state.pixels[i + 3]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
        .map(([key]) => {
          const [r, g, b, a] = key.split(',').map(Number);
          return { r, g, b, a };
        });
    },
    render,
  };
}

// -- drawing helpers --------------------------------------------------------

// Transparency has to look like transparency rather than like whatever
// the panel behind it happens to be, or a hole in the sprite and a black
// pixel are the same picture.
function drawCheckerboard(ctx, width, height) {
  const SQUARE = 8;
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#35353f';
  for (let y = 0; y < height; y += SQUARE) {
    for (let x = 0; x < width; x += SQUARE) {
      if (((x / SQUARE) + (y / SQUARE)) % 2 === 0) ctx.fillRect(x, y, SQUARE, SQUARE);
    }
  }
}

// Two lines, light over dark, so the outline is visible on white art and
// on black art alike without tinting either -- the same reason a marquee
// is drawn this way everywhere else.
function drawBrushOutline(ctx, area, view, zoom) {
  const x = (area.x - view.x) * zoom;
  const y = (area.y - view.y) * zoom;
  const w = area.w * zoom;
  const h = area.h * zoom;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawFrameGuides(ctx, frame, width, height, zoom) {
  ctx.strokeStyle = 'rgba(255, 196, 0, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = frame.frameWidth; x < width; x += frame.frameWidth) {
    ctx.moveTo(x * zoom, 0);
    ctx.lineTo(x * zoom, height * zoom);
  }
  for (let y = frame.frameHeight; y < height; y += frame.frameHeight) {
    ctx.moveTo(0, y * zoom);
    ctx.lineTo(width * zoom, y * zoom);
  }
  ctx.stroke();
}

function drawGrid(ctx, width, height, zoom) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x * zoom + 0.5, 0);
    ctx.lineTo(x * zoom + 0.5, height * zoom);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y * zoom + 0.5);
    ctx.lineTo(width * zoom, y * zoom + 0.5);
  }
  ctx.stroke();
}

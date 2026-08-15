// The sprite studio's Paint pane: the file's own pixels, at whatever zoom
// makes them workable, with the few tools pixel art actually needs.
//
// The picture being edited is a plain Uint8ClampedArray copied from the
// file once, and every tool writes into that array rather than drawing
// through the canvas -- so a pixel nobody painted still holds exactly the
// bytes the file had, and Save cannot quietly rewrite the parts of the
// sheet that were only ever looked at.
//
// The frame grid is drawn over the picture but is never part of it: a
// spritesheet is one image, and editing it as one image (rather than as
// N little canvases stitched back together) is what keeps the cells
// aligned with the layout the game slices them by.
import { el, labeled, statusParagraph } from './util.js';
import { canvasOf, encodeChecked, readPixels } from './imageFile.js';

const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24];
const MAX_UNDO = 24;
const TOOLS = [
  ['pencil', 'Pencil', 'Paint with the current colour'],
  ['eraser', 'Eraser', 'Make pixels fully transparent'],
  ['fill', 'Fill', 'Flood-fill the area of one colour under the cursor'],
  ['picker', 'Pick', 'Take the colour under the cursor'],
];

export function createPaintPane(entry, fs) {
  const pane = el('div', { className: 'studio-paint' });
  const state = {
    tool: 'pencil', size: 1, zoom: 4, grid: true, guides: true,
    color: { r: 255, g: 255, b: 255, a: 255 },
    pixels: null, width: 0, height: 0,
    undo: [], redo: [], painting: false, changed: false,
  };

  const work = canvasOf(1, 1);              // the picture at native size
  const workCtx = work.getContext('2d');
  const view = el('canvas', { className: 'paint-canvas' }); // what is on screen
  const viewCtx = view.getContext('2d');
  const stage = el('div', { className: 'paint-stage' }, [view]);
  const status = statusParagraph();

  // -- painting ------------------------------------------------------------

  const index = (x, y) => (y * state.width + x) * 4;

  function setPixel(x, y, { r, g, b, a }) {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    const i = index(x, y);
    state.pixels[i] = r; state.pixels[i + 1] = g; state.pixels[i + 2] = b; state.pixels[i + 3] = a;
  }

  function pixelAt(x, y) {
    const i = index(x, y);
    return { r: state.pixels[i], g: state.pixels[i + 1], b: state.pixels[i + 2], a: state.pixels[i + 3] };
  }

  function stamp(x, y, color) {
    // Brush sizes above 1 are a square centred on the cursor, which is
    // what a pixel grid can actually represent -- a round brush would
    // only be a squarer square with corners guessed for it.
    const half = Math.floor(state.size / 2);
    for (let dy = 0; dy < state.size; dy++) {
      for (let dx = 0; dx < state.size; dx++) setPixel(x - half + dx, y - half + dy, color);
    }
  }

  function floodFill(x, y, color) {
    const target = pixelAt(x, y);
    const same = (p) => p.r === target.r && p.g === target.g && p.b === target.b && p.a === target.a;
    // A fill with the colour already there would run the whole picture and
    // change nothing.
    if (same(color)) return;
    const stack = [[x, y]];
    const seen = new Uint8Array(state.width * state.height);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) continue;
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
    refreshButtons();
  }

  function applyAt(x, y) {
    if (state.tool === 'picker') {
      setColor(pixelAt(x, y));
      return;
    }
    if (state.tool === 'fill') floodFill(x, y, state.color);
    else stamp(x, y, state.tool === 'eraser' ? { r: 0, g: 0, b: 0, a: 0 } : state.color);
    state.changed = true;
    draw();
  }

  // -- drawing the view ----------------------------------------------------

  function draw() {
    workCtx.putImageData(new ImageData(state.pixels, state.width, state.height), 0, 0);
    view.width = state.width * state.zoom;
    view.height = state.height * state.zoom;
    viewCtx.imageSmoothingEnabled = false;
    drawCheckerboard(viewCtx, view.width, view.height);
    viewCtx.drawImage(work, 0, 0, view.width, view.height);
    if (state.grid && state.zoom >= 4) drawGrid(viewCtx, state.width, state.height, state.zoom);
    if (state.guides && entry.frame) drawFrameGuides(viewCtx, entry.frame, state.width, state.height, state.zoom);
  }

  // -- controls ------------------------------------------------------------

  const colorInput = el('input', { type: 'color', value: '#ffffff' });
  const alphaInput = el('input', { type: 'range', min: '0', max: '255', value: '255', className: 'alpha-slider' });
  const swatch = el('span', { className: 'colour-swatch' });
  const palette = el('div', { className: 'palette' });

  function setColor({ r, g, b, a }) {
    state.color = { r, g, b, a };
    colorInput.value = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    alphaInput.value = String(a);
    swatch.style.background = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }

  colorInput.addEventListener('input', () => {
    const hex = colorInput.value;
    setColor({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
      a: Number(alphaInput.value),
    });
  });
  alphaInput.addEventListener('input', () => setColor({ ...state.color, a: Number(alphaInput.value) }));

  const toolButtons = TOOLS.map(([id, label, title]) => {
    const btn = el('button', { textContent: label, title, className: 'tool-btn' });
    btn.addEventListener('click', () => {
      state.tool = id;
      for (const other of toolButtons) other.classList.toggle('active', other === btn);
    });
    return btn;
  });
  toolButtons[0].classList.add('active');

  const sizeSelect = el('select');
  for (const n of [1, 2, 3, 4, 6, 8]) sizeSelect.append(el('option', { value: String(n), textContent: `${n}px` }));
  sizeSelect.addEventListener('change', () => { state.size = Number(sizeSelect.value); });

  const zoomSelect = el('select');
  for (const z of ZOOMS) zoomSelect.append(el('option', { value: String(z), textContent: `${z}x` }));
  zoomSelect.value = '4';
  zoomSelect.addEventListener('change', () => { state.zoom = Number(zoomSelect.value); draw(); });

  const gridToggle = el('input', { type: 'checkbox', checked: true });
  gridToggle.addEventListener('change', () => { state.grid = gridToggle.checked; draw(); });
  const guideToggle = el('input', { type: 'checkbox', checked: true });
  guideToggle.addEventListener('change', () => { state.guides = guideToggle.checked; draw(); });

  const undoBtn = el('button', { textContent: 'Undo', title: 'Ctrl+Z' });
  const redoBtn = el('button', { textContent: 'Redo', title: 'Ctrl+Shift+Z' });
  const revertBtn = el('button', { textContent: 'Reload from disk' });
  const saveBtn = el('button', { textContent: 'Save to project', className: 'primary' });

  undoBtn.addEventListener('click', () => {
    const previous = state.undo.pop();
    if (!previous) return;
    state.redo.push(state.pixels.slice());
    state.pixels = previous;
    state.changed = true;
    draw();
    refreshButtons();
  });
  redoBtn.addEventListener('click', () => {
    const next = state.redo.pop();
    if (!next) return;
    state.undo.push(state.pixels.slice());
    state.pixels = next;
    draw();
    refreshButtons();
  });
  revertBtn.addEventListener('click', () => load());

  function refreshButtons() {
    undoBtn.disabled = state.undo.length === 0;
    redoBtn.disabled = state.redo.length === 0;
  }

  function onKey(event) {
    if (!pane.isConnected || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    (event.shiftKey ? redoBtn : undoBtn).click();
  }
  document.addEventListener('keydown', onKey);

  // -- saving --------------------------------------------------------------

  // A save that would VISIBLY change the art is offered a second time
  // rather than made anyway: knowing the file is about to lose something
  // is the whole reason to check, and "Save anyway" is then a decision
  // rather than an accident. A re-encode nothing can display is not that
  // -- it is reported and written (see imageFile.js for the measurement
  // behind the distinction).
  let forceSave = false;

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    status.textContent = 'Encoding…';
    try {
      const imageData = new ImageData(state.pixels.slice(), state.width, state.height);
      const { blob, changed, visible, worst } = await encodeChecked(imageData, entry.path);
      if (visible > 0 && !forceSave) {
        forceSave = true;
        saveBtn.textContent = 'Save anyway';
        status.textContent = `Re-encoding this file would visibly change ${visible} pixel${visible === 1 ? '' : 's'} `
          + `(by up to ${worst} of 255) -- nothing was written. Save again to accept that, or draw the art elsewhere `
          + 'and bring it in through Replace file.';
        saveBtn.disabled = false;
        return;
      }
      await fs.saveFile(entry.path, blob);
      forceSave = false;
      saveBtn.textContent = 'Save to project';
      state.changed = false;
      status.textContent = changed === 0
        ? 'Saved, pixel for pixel. Hard-refresh the game (Ctrl+Shift+R) to see it.'
        : `Saved. ${changed} pixels were re-encoded, none of them visibly (worst ${worst} of 255). `
          + 'Hard-refresh the game (Ctrl+Shift+R) to see it.';
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  });

  // -- pointer -------------------------------------------------------------

  function pixelFromEvent(event) {
    const rect = view.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) / state.zoom),
      y: Math.floor((event.clientY - rect.top) / state.zoom),
    };
  }

  const readout = el('span', { className: 'paint-readout' });

  view.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !state.pixels) return;
    view.setPointerCapture(event.pointerId);
    state.painting = true;
    if (state.tool !== 'picker') pushUndo();
    const { x, y } = pixelFromEvent(event);
    applyAt(x, y);
  });
  view.addEventListener('pointermove', (event) => {
    if (!state.pixels) return;
    const { x, y } = pixelFromEvent(event);
    readout.textContent = describePixel(x, y);
    // Fill and pick are one decision each: dragging them would run a fill
    // per pixel crossed.
    if (state.painting && (state.tool === 'pencil' || state.tool === 'eraser')) applyAt(x, y);
  });
  const stopPainting = () => { state.painting = false; };
  view.addEventListener('pointerup', stopPainting);
  view.addEventListener('pointercancel', stopPainting);
  view.addEventListener('pointerleave', () => { readout.textContent = ''; });

  function describePixel(x, y) {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return '';
    const frame = entry.frame ? `  frame ${frameIndexAt(entry.frame, state.width, x, y)}` : '';
    const { r, g, b, a } = pixelAt(x, y);
    return `${x}, ${y}${frame}   rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // -- assembly ------------------------------------------------------------

  pane.append(
    el('div', { className: 'paint-tools' }, [
      el('div', { className: 'tool-group' }, toolButtons),
      el('div', { className: 'tool-group' }, [
        swatch, colorInput, labeled('Alpha', alphaInput), labeled('Brush', sizeSelect),
      ]),
      el('div', { className: 'tool-group' }, [
        labeled('Zoom', zoomSelect), labeled('Grid', gridToggle), labeled('Frames', guideToggle),
      ]),
      el('div', { className: 'tool-group' }, [undoBtn, redoBtn, revertBtn, saveBtn]),
    ]),
    palette,
    stage,
    el('div', { className: 'paint-footer' }, [readout, status]),
  );

  async function load() {
    status.textContent = 'Loading…';
    try {
      const { width, height, data } = await readPixels(entry.path);
      state.width = width;
      state.height = height;
      state.pixels = new Uint8ClampedArray(data.data);
      state.undo.length = 0;
      state.redo.length = 0;
      state.changed = false;
      work.width = width;
      work.height = height;
      buildPalette();
      draw();
      refreshButtons();
      status.textContent = '';
    } catch (err) {
      status.textContent = err.message;
    }
  }

  // The colours already in the file, commonest first -- this art is drawn
  // from a handful of them, so picking one out of the picture beats
  // matching it by eye in a colour dialog.
  function buildPalette() {
    const counts = new Map();
    for (let i = 0; i < state.pixels.length; i += 4) {
      if (state.pixels[i + 3] === 0) continue;
      const key = `${state.pixels[i]},${state.pixels[i + 1]},${state.pixels[i + 2]},${state.pixels[i + 3]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    palette.replaceChildren(el('span', { className: 'palette-label', textContent: 'In this file:' }));
    for (const [key] of top) {
      const [r, g, b, a] = key.split(',').map(Number);
      const btn = el('button', { className: 'palette-swatch', title: `rgba(${r}, ${g}, ${b}, ${a})` });
      btn.style.background = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      btn.addEventListener('click', () => setColor({ r, g, b, a }));
      palette.append(btn);
    }
  }

  load();

  return {
    el: pane,
    hasUnsavedChanges: () => state.changed,
    dispose() { document.removeEventListener('keydown', onKey); },
  };
}

// -- shared drawing helpers -------------------------------------------------

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

// Which cell a pixel falls in, counted the way Phaser slices a sheet:
// left to right, then top to bottom.
export function frameIndexAt(frame, imageWidth, x, y) {
  const cols = Math.max(1, Math.floor(imageWidth / frame.frameWidth));
  return Math.floor(y / frame.frameHeight) * cols + Math.floor(x / frame.frameWidth);
}

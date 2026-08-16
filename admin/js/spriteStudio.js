// The sprite studio: one graphic, opened over the Graphics tab, in ONE
// view. There are no tabs inside it -- the picture is drawn in the same
// window it is played in, a frame at a time, and the controls above it
// are grouped into what moves the picture, what paints it, and what
// writes it.
//
// That is not a cosmetic choice. A file is one thing, and a tool that
// showed it in three places (playing it, painting it, and previewing a
// replacement for it) made the reader hold three pictures of one file in
// their head. The cost of the single view is that an animation cannot
// play while it is being painted -- pressing Play takes the canvas over.
// The exchange is deliberate: the whole modal width goes to the drawing,
// one zoom means one zoom, and there is no state to keep in step.
//
// The surface below it (spriteSurface.js) owns the pixels and the tools;
// everything here is about WHICH part of the file is on screen and when.
import { el, labeled, statusParagraph } from './util.js';
import { COLORS } from '../../js/constants.js';
import { encodeChecked, readPixels } from './imageFile.js';
import { createSurface } from './spriteSurface.js';

const TOOLS = [
  ['pencil', 'Pencil', 'Paint with the current colour'],
  ['eraser', 'Eraser', 'Make pixels fully transparent'],
  ['fill', 'Fill', 'Flood-fill one colour, within the frame on screen'],
  ['picker', 'Pick', 'Take the colour under the cursor'],
];
const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16, 24];
const BRUSHES = [1, 2, 3, 4, 6, 8];

// Colours to paint with that are NOT in the file being edited: the
// game's own palette (js/constants.js), so a new mark can be made in a
// colour the rest of the game already uses rather than one matched by
// eye. The colour dialog beside them still reaches everything else.
const GAME_SWATCHES = [...new Set([...Object.values(COLORS), '#ffffff'])];

let open = null; // the studio currently on screen, if any

export function openSpriteStudio(entry, fs, { onClose } = {}) {
  closeSpriteStudio();

  const backdrop = el('div', { className: 'studio-backdrop' });
  const modal = el('div', { className: 'studio' });
  const status = statusParagraph();
  const readout = el('span', { className: 'paint-readout' });
  const sizeNote = el('span', { className: 'size-note' });

  const state = {
    sequence: [],        // frame indices of the chosen animation
    position: 0,         // where in `sequence` the canvas is
    editPosition: 0,     // where it was when Play was pressed
    wholeSheet: false,
    playing: false,
    loop: true,
    rate: 8,
    timer: null,
    lastStep: 0,
    color: { r: 255, g: 255, b: 255, a: 255 },
  };

  const surface = createSurface({
    onPick: (color) => setColor(color),
    onReadout: (at) => {
      readout.textContent = at
        ? `${at.x}, ${at.y}${frameLabelAt(at)}   rgba(${at.color.r}, ${at.color.g}, ${at.color.b}, ${at.color.a})`
        : '';
    },
    onChange: (what) => {
      // A click on a canvas that is playing (or mirrored) is a request to
      // stop, not a stroke -- see the surface's pointerdown. The frame it
      // goes back to is the one that was SELECTED, not whichever the
      // animation happened to be showing when the click landed.
      if (what === 'locked-click') {
        if (state.playing) { pause(); showFrame(state.editPosition); }
        else if (mirrorToggle.checked) { mirrorToggle.checked = false; applyView(); }
        return;
      }
      if (what === 'stroke-end') refreshStrip();
      refreshButtons();
    },
  });

  // -- row 1: motion -------------------------------------------------------

  const animSelect = el('select');
  const prevBtn = el('button', { textContent: '◀', title: 'Previous frame' });
  const playBtn = el('button', { textContent: 'Play' });
  const nextBtn = el('button', { textContent: '▶', title: 'Next frame' });
  const rateInput = el('input', { type: 'number', min: '0.25', max: '60', step: '0.25', className: 'rate-input' });
  const loopToggle = el('input', { type: 'checkbox', checked: true });
  const mirrorToggle = el('input', { type: 'checkbox' });
  const zoomSelect = el('select');
  zoomSelect.append(el('option', { value: 'fit', textContent: 'fit' }));
  for (const z of ZOOMS) zoomSelect.append(el('option', { value: String(z), textContent: `${z}x` }));

  animSelect.addEventListener('change', () => selectChoice(Number(animSelect.value)));
  rateInput.addEventListener('input', () => { state.rate = Math.max(0.25, Number(rateInput.value) || 1); });
  loopToggle.addEventListener('change', () => { state.loop = loopToggle.checked; });
  mirrorToggle.addEventListener('change', applyView);
  zoomSelect.addEventListener('change', applyView);
  playBtn.addEventListener('click', () => (state.playing ? pause() : play()));
  prevBtn.addEventListener('click', () => { pause(); step(-1); });
  nextBtn.addEventListener('click', () => { pause(); step(1); });

  // -- row 2: painting -----------------------------------------------------

  const colorInput = el('input', { type: 'color', value: '#ffffff' });
  const alphaInput = el('input', { type: 'range', min: '0', max: '255', value: '255', className: 'alpha-slider' });
  const swatch = el('span', { className: 'colour-swatch' });
  const brushSelect = el('select');
  for (const n of BRUSHES) brushSelect.append(el('option', { value: String(n), textContent: `${n}px` }));
  const gridToggle = el('input', { type: 'checkbox', checked: true });
  const filePalette = el('span', { className: 'palette-group' });
  const gamePalette = el('span', { className: 'palette-group' });

  const toolButtons = TOOLS.map(([id, label, title]) => {
    const btn = el('button', { textContent: label, title, className: 'tool-btn' });
    btn.addEventListener('click', () => {
      surface.setTool(id);
      for (const other of toolButtons) other.classList.toggle('active', other === btn);
    });
    return btn;
  });
  toolButtons[0].classList.add('active');

  colorInput.addEventListener('input', () => setColor({ ...hexToRgb(colorInput.value), a: Number(alphaInput.value) }));
  alphaInput.addEventListener('input', () => setColor({ ...state.color, a: Number(alphaInput.value) }));
  brushSelect.addEventListener('change', () => surface.setBrush(Number(brushSelect.value)));
  gridToggle.addEventListener('change', applyView);

  function setColor(color) {
    state.color = color;
    surface.setColor(color);
    colorInput.value = rgbToHex(color);
    alphaInput.value = String(color.a);
    swatch.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
  }

  function swatchButton(color) {
    const btn = el('button', { className: 'palette-swatch', title: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` });
    btn.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    btn.addEventListener('click', () => setColor(color));
    return btn;
  }

  // -- row 3: the file -----------------------------------------------------

  const undoBtn = el('button', { textContent: 'Undo', title: 'Ctrl+Z' });
  const redoBtn = el('button', { textContent: 'Redo', title: 'Ctrl+Shift+Z' });
  const openBtn = el('button', { textContent: 'Open file…', title: 'Load an image from disk into this editor' });
  const openInput = el('input', { type: 'file', accept: 'image/*', className: 'hidden' });
  const reloadBtn = el('button', { textContent: 'Reload from disk' });
  const saveBtn = el('button', { textContent: 'Save to project', className: 'primary' });

  undoBtn.addEventListener('click', () => { surface.undo(); refreshStrip(); refreshButtons(); });
  redoBtn.addEventListener('click', () => { surface.redo(); refreshStrip(); refreshButtons(); });
  reloadBtn.addEventListener('click', () => load());
  openBtn.addEventListener('click', () => openInput.click());
  openInput.addEventListener('change', () => openFile(openInput.files[0]));
  saveBtn.addEventListener('click', save);

  function onKey(event) {
    if (!backdrop.isConnected) return;
    if (event.key === 'Escape') { closeSpriteStudio(); return; }
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    (event.shiftKey ? redoBtn : undoBtn).click();
  }
  document.addEventListener('keydown', onKey);

  function refreshButtons() {
    undoBtn.disabled = !surface.canUndo();
    redoBtn.disabled = !surface.canRedo();
  }

  // -- the canvas and the frame strip --------------------------------------

  const stage = el('div', { className: 'studio-stage' }, [surface.canvas]);
  const strip = el('div', { className: 'frame-strip' });

  // Which cell of the sheet a frame index is, counted the way Phaser
  // slices one: left to right, then top to bottom.
  function frameRect(frameIndex) {
    const frame = entry.frame;
    if (!frame) return null;
    const cols = Math.max(1, Math.floor(surface.width / frame.frameWidth));
    return {
      x: (frameIndex % cols) * frame.frameWidth,
      y: Math.floor(frameIndex / cols) * frame.frameHeight,
      w: frame.frameWidth,
      h: frame.frameHeight,
    };
  }

  function frameCount() {
    if (!entry.frame || !surface.width) return 1;
    const cols = Math.max(1, Math.floor(surface.width / entry.frame.frameWidth));
    const rows = Math.max(1, Math.floor(surface.height / entry.frame.frameHeight));
    return cols * rows;
  }

  function currentFrame() {
    return state.sequence[state.position] ?? 0;
  }

  function frameLabelAt({ x, y }) {
    if (!entry.frame) return '';
    const cols = Math.max(1, Math.floor(surface.width / entry.frame.frameWidth));
    const i = Math.floor(y / entry.frame.frameHeight) * cols + Math.floor(x / entry.frame.frameWidth);
    return `  frame ${i}`;
  }

  // The zoom that fits what is on screen into the stage, so a 16px pop
  // and a 154px one are both worth looking at without touching the
  // control. Never below 1: a graphic drawn smaller than its own pixels
  // is not a view of anything.
  function fitZoom() {
    const box = stage.getBoundingClientRect();
    const w = state.wholeSheet || !entry.frame ? surface.width : entry.frame.frameWidth;
    const h = state.wholeSheet || !entry.frame ? surface.height : entry.frame.frameHeight;
    if (!w || !h || !box.width) return 4;
    const room = Math.min((box.width - 24) / w, (box.height - 24) / h);
    return Math.max(1, Math.min(24, Math.floor(room)));
  }

  function applyView() {
    const zoom = zoomSelect.value === 'fit' ? fitZoom() : Number(zoomSelect.value);
    const mirror = mirrorToggle.checked;
    surface.setView({
      rect: state.wholeSheet ? null : frameRect(currentFrame()),
      guides: state.wholeSheet ? entry.frame : null,
      zoom,
      grid: gridToggle.checked,
      mirror,
      // Painting is only allowed when what is on screen is a still,
      // un-mirrored picture of the frame the cursor thinks it is on.
      locked: state.playing || mirror,
    });
    for (const btn of toolButtons) btn.disabled = mirror;
    stage.classList.toggle('locked', state.playing || mirror);
    status.textContent = state.wholeSheet
      ? 'Whole sheet -- every cell at once, for edits that cross frames.'
      : `Frame ${currentFrame()}${state.sequence.length > 1 ? ` -- ${state.position + 1} of ${state.sequence.length}` : ''}`;
    markStrip();
  }

  function showFrame(position) {
    state.position = position;
    state.editPosition = position;
    applyView();
  }

  function step(by) {
    if (!state.sequence.length) return;
    const next = state.position + by;
    if (next >= state.sequence.length && !state.loop) {
      pause();
      state.position = state.sequence.length - 1;
    } else {
      state.position = (next + state.sequence.length) % state.sequence.length;
    }
    if (!state.playing) state.editPosition = state.position;
    applyView();
  }

  function play() {
    if (state.wholeSheet || state.sequence.length < 2) return;
    state.playing = true;
    state.editPosition = state.position;
    playBtn.textContent = 'Pause';
    state.lastStep = performance.now();
    const tick = (now) => {
      if (!state.playing) return;
      if (now - state.lastStep >= 1000 / state.rate) {
        state.lastStep = now;
        step(1);
      }
      state.timer = requestAnimationFrame(tick);
    };
    state.timer = requestAnimationFrame(tick);
    applyView();
  }

  function pause() {
    if (!state.playing) return;
    state.playing = false;
    playBtn.textContent = 'Play';
    if (state.timer) cancelAnimationFrame(state.timer);
    state.timer = null;
    applyView();
  }

  // Every cell in the file, in file order -- the ones outside the chosen
  // animation dimmed rather than hidden, so a sheet still reads as a
  // sheet while a four-frame walk is selected. Drawn from the surface's
  // own buffer, so a thumbnail is the art as it is being painted.
  function refreshStrip() {
    strip.replaceChildren();
    if (!entry.frame || !surface.width) return;
    const total = frameCount();
    for (let i = 0; i < total; i++) {
      const rect = frameRect(i);
      const scale = Math.max(1, Math.min(3, Math.floor(52 / Math.max(rect.w, rect.h))));
      const thumb = el('canvas', { className: 'frame-thumb', title: `Frame ${i}` });
      thumb.width = rect.w * scale;
      thumb.height = rect.h * scale;
      const tctx = thumb.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(surface.source(), rect.x, rect.y, rect.w, rect.h, 0, 0, thumb.width, thumb.height);
      thumb.dataset.frame = String(i);
      thumb.addEventListener('click', () => {
        pause();
        const at = state.sequence.indexOf(i);
        // A cell the chosen animation does not use is still editable --
        // picking it switches to the view of every frame in the file,
        // which is the sequence it does belong to.
        if (at >= 0) showFrame(at);
        else selectChoice(allFramesIndex(), { keepFrame: i });
      });
      strip.append(thumb);
    }
    markStrip();
  }

  function markStrip() {
    for (const thumb of strip.children) {
      const i = Number(thumb.dataset.frame);
      thumb.classList.toggle('current', !state.wholeSheet && i === currentFrame());
      thumb.classList.toggle('dimmed', !state.sequence.includes(i));
    }
  }

  // -- what can be shown ---------------------------------------------------

  function choices() {
    const list = entry.animations.map((anim) => ({
      label: `${anim.label} (${anim.frames.length} frames, ${round(anim.frameRate)} fps${anim.loop ? ', loops' : ''})`,
      frames: anim.frames,
      frameRate: anim.frameRate,
      loop: anim.loop,
    }));
    if (entry.frame) {
      const count = frameCount();
      list.push({ label: `All ${count} frames in the file`, frames: range(count), frameRate: 8, loop: true });
      list.push({ label: 'Whole sheet (edit across frames)', wholeSheet: true, frames: range(count) });
    } else {
      list.push({ label: 'The whole image', wholeSheet: true, frames: [0] });
    }
    return list;
  }

  const allFramesIndex = () => entry.animations.length;

  function selectChoice(i, { keepFrame } = {}) {
    pause();
    const list = choices();
    const at = Math.min(i, list.length - 1);
    const choice = list[at];
    animSelect.value = String(at);
    state.sequence = choice.frames;
    state.wholeSheet = Boolean(choice.wholeSheet);
    state.rate = choice.frameRate ?? 8;
    state.loop = choice.loop ?? true;
    rateInput.value = String(round(state.rate));
    loopToggle.checked = state.loop;
    const position = keepFrame === undefined ? 0 : Math.max(0, state.sequence.indexOf(keepFrame));
    state.position = position;
    state.editPosition = position;
    // Nothing to play through in a single-frame view, and nothing to
    // mirror in one that is not a sprite facing anywhere.
    const still = state.wholeSheet || state.sequence.length < 2;
    for (const control of [playBtn, prevBtn, nextBtn, rateInput, loopToggle, mirrorToggle]) control.disabled = still;
    if (still) mirrorToggle.checked = false;
    applyView();
  }

  // -- loading and saving --------------------------------------------------

  async function load() {
    status.textContent = 'Loading…';
    try {
      const { width, height, data } = await readPixels(entry.path);
      surface.setPixels(data.data, width, height);
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    describeFile();
    animSelect.replaceChildren();
    choices().forEach((choice, i) => animSelect.append(el('option', { value: String(i), textContent: choice.label })));
    selectChoice(0);
    refreshStrip();
    refreshButtons();
    setColor(surface.filePalette(1)[0] ?? { r: 255, g: 255, b: 255, a: 255 });
    buildPalettes();
  }

  // A file opened from disk is NOT written -- it is loaded into the
  // editor, and the same Save that writes a drawing writes it. That keeps
  // one path to disk, makes an accidental pick undoable, and gives the
  // one thing an upload never had: a look at the picture, in frames,
  // before it lands in the project.
  async function openFile(file) {
    if (!file) return;
    status.textContent = 'Opening…';
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const was = { width: surface.width, height: surface.height };
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      surface.setPixels(data.data, canvas.width, canvas.height, { keepHistory: true });
      describeFile();
      selectChoice(Number(animSelect.value) || 0);
      refreshStrip();
      refreshButtons();
      buildPalettes();
      const sameSize = canvas.width === was.width && canvas.height === was.height;
      status.textContent = sameSize
        ? `${file.name} loaded -- nothing is written until Save.`
        : `${file.name} is ${canvas.width}x${canvas.height}, the file it would replace is ${was.width}x${was.height}.`
          + (entry.frame
            ? ` This sheet is sliced into ${entry.frame.frameWidth}x${entry.frame.frameHeight} cells, so its frames will not line up.`
            : '')
          + ' Nothing is written until Save.';
    } catch (err) {
      status.textContent = `Could not open that file: ${err.message}`;
    }
    openInput.value = '';
  }

  // A save that would VISIBLY change the art is offered a second time
  // rather than made anyway (see imageFile.js for what "visibly" means
  // and the measurement behind it). A re-encode nothing can display is
  // reported and written.
  let forceSave = false;

  async function save() {
    saveBtn.disabled = true;
    status.textContent = 'Encoding…';
    try {
      const { blob, changed, visible, worst } = await encodeChecked(surface.imageData(), entry.path);
      if (visible > 0 && !forceSave) {
        forceSave = true;
        saveBtn.textContent = 'Save anyway';
        status.textContent = `Re-encoding this file would visibly change ${visible} pixel${visible === 1 ? '' : 's'} `
          + `(by up to ${worst} of 255) -- nothing was written. Save again to accept that.`;
        saveBtn.disabled = false;
        return;
      }
      await fs.saveFile(entry.path, blob);
      forceSave = false;
      saveBtn.textContent = 'Save to project';
      surface.markSaved();
      status.textContent = changed === 0
        ? 'Saved, pixel for pixel. Hard-refresh the game (Ctrl+Shift+R) to see it.'
        : `Saved. ${changed} pixels were re-encoded, none of them visibly (worst ${worst} of 255). `
          + 'Hard-refresh the game (Ctrl+Shift+R) to see it.';
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  }

  function describeFile() {
    const size = `${surface.width}x${surface.height}px`;
    sizeNote.textContent = entry.frame
      ? `${size}, sliced into ${entry.frame.frameWidth}x${entry.frame.frameHeight} cells`
      : `${size}, a single image`;
  }

  function buildPalettes() {
    filePalette.replaceChildren(el('span', { className: 'palette-label', textContent: 'in this file:' }));
    for (const color of surface.filePalette()) filePalette.append(swatchButton(color));
    gamePalette.replaceChildren(el('span', { className: 'palette-label', textContent: 'game palette:' }));
    for (const hex of GAME_SWATCHES) gamePalette.append(swatchButton({ ...hexToRgb(hex), a: 255 }));
  }

  // -- assembly ------------------------------------------------------------

  const closeBtn = el('button', { className: 'studio-close', textContent: '×', title: 'Close (Esc)' });
  closeBtn.addEventListener('click', () => closeSpriteStudio());

  modal.append(
    el('header', { className: 'studio-header' }, [
      el('div', {}, [
        el('h2', { textContent: entry.label }),
        el('code', { className: 'path', textContent: entry.path }),
      ]),
      closeBtn,
    ]),
    generatorWarning(entry),
    el('div', { className: 'studio-body' }, [
      controlRow('motion', [
        labeled('Animation', animSelect),
        el('span', { className: 'tool-group' }, [prevBtn, playBtn, nextBtn]),
        labeled('FPS', rateInput),
        labeled('Loop', loopToggle),
        labeled('Mirror', mirrorToggle),
        labeled('Zoom', zoomSelect),
      ]),
      controlRow('paint', [
        el('span', { className: 'tool-group' }, toolButtons),
        el('span', { className: 'tool-group' }, [swatch, colorInput, labeled('Alpha', alphaInput)]),
        labeled('Brush', brushSelect),
        labeled('Grid', gridToggle),
      ]),
      controlRow('colours', [filePalette, gamePalette]),
      controlRow('file', [
        el('span', { className: 'tool-group' }, [undoBtn, redoBtn]),
        el('span', { className: 'tool-group' }, [openBtn, reloadBtn]),
        saveBtn,
        openInput,
      ]),
      stage,
      strip,
      el('div', { className: 'paint-footer' }, [readout, sizeNote, status]),
    ]),
  );

  backdrop.append(modal);
  document.body.append(backdrop);

  // Clicking the dimmed page outside the modal closes it, but only when
  // the press STARTED there: dragging a stroke off the canvas and
  // releasing over the backdrop must not close the editor mid-stroke.
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) closeSpriteStudio();
  });

  load();

  open = {
    close() {
      pause();
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      open = null;
      // The list behind the studio is showing thumbnails of files that
      // may have just been painted over.
      onClose?.();
    },
  };
}

export function closeSpriteStudio() {
  open?.close();
}

function controlRow(tag, children) {
  return el('div', { className: 'studio-row' }, [
    el('span', { className: 'row-tag', textContent: tag }),
    ...children,
  ]);
}

function generatorWarning(entry) {
  if (!entry.generator) return el('span', { className: 'hidden' });
  const from = entry.generator.from ? ` from ${entry.generator.from}` : '';
  return el('p', { className: 'studio-warning', textContent:
    `Drawn by ${entry.generator.tool}${from}. Painting here works, but running that tool again overwrites it -- `
    + 'for a change that lasts, change the tool and rerun it.' });
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

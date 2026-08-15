// The sprite studio: one graphic, opened over the Graphics tab, with the
// three things there are to do to it -- watch it move, paint it, or
// replace the whole file.
//
// It is a popup rather than a fifth tab because it is about ONE file: the
// tab is the list, this is the thing you picked out of it, and closing it
// puts you back where you were with the list still scrolled where it was.
// Only one is ever open.
import { el, labeled, rootUrl, statusParagraph, SAVED_ASSET_MSG } from './util.js';
import { loadImage } from './imageFile.js';
import { createPaintPane } from './spriteEditor.js';

const PANES = [
  ['animate', 'Animate'],
  ['paint', 'Paint'],
  ['replace', 'Replace file'],
];

let open = null; // the studio currently on screen, if any

export function openSpriteStudio(entry, fs, { onClose } = {}) {
  closeSpriteStudio();

  const backdrop = el('div', { className: 'studio-backdrop' });
  const modal = el('div', { className: 'studio' });
  const body = el('div', { className: 'studio-body' });
  const panes = {};

  const closeBtn = el('button', { className: 'studio-close', textContent: '×', title: 'Close (Esc)' });
  closeBtn.addEventListener('click', () => closeSpriteStudio());

  const tabs = el('nav', { className: 'studio-tabs' });
  const tabButtons = PANES.map(([id, label]) => {
    const btn = el('button', { textContent: label, className: 'tab-btn' });
    btn.addEventListener('click', () => showPane(id));
    tabs.append(btn);
    return [id, btn];
  });

  function showPane(id) {
    for (const [paneId, btn] of tabButtons) btn.classList.toggle('active', paneId === id);
    for (const [paneId, pane] of Object.entries(panes)) pane.classList.toggle('hidden', paneId !== id);
    // The animation keeps running while another pane is open otherwise --
    // an off-screen rAF loop repainting a canvas nobody is looking at.
    if (id !== 'animate') animate.pause();
  }

  const animate = createAnimatePane(entry);
  panes.animate = animate.el;
  const paint = createPaintPane(entry, fs);
  panes.paint = paint.el;
  // A replaced file is a different picture: the animation pane is showing
  // the old one until it re-reads it.
  panes.replace = createReplacePane(entry, fs, () => animate.reload());

  modal.append(
    el('header', { className: 'studio-header' }, [
      el('div', {}, [
        el('h2', { textContent: entry.label }),
        el('code', { className: 'path', textContent: entry.path }),
      ]),
      closeBtn,
    ]),
    generatorWarning(entry),
    tabs,
    body,
  );
  for (const pane of Object.values(panes)) {
    pane.classList.add('hidden');
    body.append(pane);
  }
  backdrop.append(modal);
  document.body.append(backdrop);
  showPane('animate');

  // Clicking the dimmed page outside the modal closes it, but only when
  // the press STARTED there: dragging a paint stroke off the canvas and
  // releasing over the backdrop must not close the editor mid-stroke.
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) closeSpriteStudio();
  });
  const onKey = (event) => {
    if (event.key === 'Escape') closeSpriteStudio();
  };
  document.addEventListener('keydown', onKey);

  open = {
    close() {
      animate.dispose();
      paint.dispose();
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

function generatorWarning(entry) {
  if (!entry.generator) return el('span', { className: 'hidden' });
  const from = entry.generator.from ? ` from ${entry.generator.from}` : '';
  return el('p', { className: 'studio-warning', textContent:
    `Drawn by ${entry.generator.tool}${from}. Painting here works, but running that tool again overwrites it -- `
    + 'for a change that lasts, change the tool and rerun it.' });
}

// -- Animate ---------------------------------------------------------------

// Plays the sheet exactly the way the game will: the animations offered
// are the game's own (js/animations.js, the same registry BootScene
// builds Phaser's animations from), at their own frame rates, looping if
// they loop. The rate is editable for looking at something closely, and
// says so -- it changes the preview, not the game.
function createAnimatePane(entry) {
  const pane = el('div', { className: 'studio-animate' });
  const canvas = el('canvas', { className: 'animate-canvas' });
  const ctx = canvas.getContext('2d');
  const strip = el('div', { className: 'frame-strip' });
  const status = statusParagraph();
  const sizeNote = el('span', { className: 'size-note' });

  const frame = entry.frame;
  let image = null;
  let sequence = [];      // frame indices being played
  let position = 0;       // where in `sequence`
  let playing = false;
  let loop = true;
  let rate = 8;
  let timer = null;
  let lastStep = 0;

  const animSelect = el('select');
  const playBtn = el('button', { textContent: 'Play' });
  const prevBtn = el('button', { textContent: '◀', title: 'Previous frame' });
  const nextBtn = el('button', { textContent: '▶', title: 'Next frame' });
  const rateInput = el('input', { type: 'number', min: '0.25', max: '60', step: '0.25', className: 'rate-input' });
  const loopToggle = el('input', { type: 'checkbox', checked: true });
  const flipToggle = el('input', { type: 'checkbox' });
  const zoomSelect = el('select');
  for (const z of [1, 2, 3, 4, 6, 8]) zoomSelect.append(el('option', { value: String(z), textContent: `${z}x` }));
  zoomSelect.value = '4';

  const choices = () => {
    const list = entry.animations.map((anim) => ({
      label: `${anim.label} (${anim.frames.length} frames, ${round(anim.frameRate)} fps${anim.loop ? ', loops' : ''})`,
      frames: anim.frames,
      frameRate: anim.frameRate,
      loop: anim.loop,
    }));
    if (frame && image) {
      const count = frameCount(frame, image);
      // Every cell in file order, including any the game never plays --
      // the digits, the font, a sheet with a frame left over.
      list.push({ label: `All ${count} frames in the file`, frames: range(count), frameRate: 8, loop: true });
    }
    if (!list.length) list.push({ label: 'The whole image', frames: [0], frameRate: 1, loop: false });
    return list;
  };

  function selectChoice(i) {
    const list = choices();
    const choice = list[Math.min(i, list.length - 1)];
    sequence = choice.frames;
    rate = choice.frameRate;
    loop = choice.loop;
    rateInput.value = String(round(rate));
    loopToggle.checked = loop;
    position = 0;
    buildStrip();
    render();
  }

  animSelect.addEventListener('change', () => selectChoice(Number(animSelect.value)));
  rateInput.addEventListener('input', () => { rate = Math.max(0.25, Number(rateInput.value) || 1); });
  loopToggle.addEventListener('change', () => { loop = loopToggle.checked; });
  flipToggle.addEventListener('change', render);
  zoomSelect.addEventListener('change', () => { buildStrip(); render(); });

  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  prevBtn.addEventListener('click', () => { pause(); step(-1); });
  nextBtn.addEventListener('click', () => { pause(); step(1); });

  function step(by) {
    if (!sequence.length) return;
    const next = position + by;
    if (next >= sequence.length && !loop) { pause(); position = sequence.length - 1; }
    else position = (next + sequence.length) % sequence.length;
    render();
  }

  function play() {
    if (!image || sequence.length < 2) return;
    playing = true;
    playBtn.textContent = 'Pause';
    lastStep = performance.now();
    const tick = (now) => {
      if (!playing) return;
      if (now - lastStep >= 1000 / rate) {
        lastStep = now;
        step(1);
      }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    playBtn.textContent = 'Play';
    if (timer) cancelAnimationFrame(timer);
    timer = null;
  }

  function render() {
    if (!image) return;
    const zoom = Number(zoomSelect.value);
    const w = frame ? frame.frameWidth : image.naturalWidth;
    const h = frame ? frame.frameHeight : image.naturalHeight;
    canvas.width = w * zoom;
    canvas.height = h * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // The walk cycle and the step frames are authored facing LEFT and
    // mirrored by the game (see assets.js) -- so mirroring here is how
    // you see the frame the way half the game shows it.
    if (flipToggle.checked) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    const { sx, sy } = sourceRect(frame, image, sequence[position] ?? 0);
    ctx.drawImage(image, sx, sy, w, h, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    markStrip();
    status.textContent = sequence.length
      ? `Frame ${sequence[position]} -- ${position + 1} of ${sequence.length}`
      : '';
  }

  function buildStrip() {
    strip.replaceChildren();
    if (!image) return;
    sequence.forEach((frameIndex, i) => {
      const thumb = el('canvas', { className: 'frame-thumb', title: `Frame ${frameIndex}` });
      const w = frame ? frame.frameWidth : image.naturalWidth;
      const h = frame ? frame.frameHeight : image.naturalHeight;
      const scale = Math.max(1, Math.min(4, Math.floor(64 / Math.max(w, h))));
      thumb.width = w * scale;
      thumb.height = h * scale;
      const tctx = thumb.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      const { sx, sy } = sourceRect(frame, image, frameIndex);
      tctx.drawImage(image, sx, sy, w, h, 0, 0, thumb.width, thumb.height);
      thumb.addEventListener('click', () => { pause(); position = i; render(); });
      strip.append(thumb);
    });
  }

  function markStrip() {
    [...strip.children].forEach((thumb, i) => thumb.classList.toggle('current', i === position));
  }

  async function reload() {
    pause();
    status.textContent = 'Loading…';
    try {
      image = await loadImage(entry.path);
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    animSelect.replaceChildren();
    choices().forEach((choice, i) => animSelect.append(el('option', { value: String(i), textContent: choice.label })));
    selectChoice(0);
    const size = `${image.naturalWidth}x${image.naturalHeight}px`;
    sizeNote.textContent = frame
      ? `${size}, sliced into ${frame.frameWidth}x${frame.frameHeight} cells`
      : `${size}, a single image`;
    // A one-frame graphic has nothing to play, and the controls saying so
    // is better than them doing nothing when pressed.
    const still = !frame || frameCount(frame, image) < 2;
    for (const control of [playBtn, prevBtn, nextBtn, rateInput, loopToggle]) control.disabled = still;
  }

  pane.append(
    el('div', { className: 'animate-controls' }, [
      labeled('Animation', animSelect),
      el('div', { className: 'tool-group' }, [prevBtn, playBtn, nextBtn]),
      labeled('FPS', rateInput),
      labeled('Loop', loopToggle),
      labeled('Mirror', flipToggle),
      labeled('Zoom', zoomSelect),
    ]),
    el('div', { className: 'animate-stage' }, [canvas]),
    strip,
    el('div', { className: 'paint-footer' }, [sizeNote, status]),
  );

  reload();

  return { el: pane, pause, reload, dispose: pause };
}

// -- Replace ---------------------------------------------------------------

// The old Graphics tab in one pane: hand the file over as a file. Still
// the only way in for art drawn somewhere else, and the only way to
// change a graphic's SIZE -- the paint pane edits the pixels a file
// already has.
function createReplacePane(entry, fs, onSaved) {
  const pane = el('div', { className: 'studio-replace' });
  const preview = el('img', { className: 'preview', alt: entry.label, src: `${rootUrl(entry.path)}?t=${Date.now()}` });
  const fileInput = el('input', { type: 'file', accept: 'image/*' });
  const saveBtn = el('button', { textContent: 'Save to project', className: 'primary' });
  const status = statusParagraph();
  let pending = null;

  fileInput.addEventListener('change', () => {
    pending = fileInput.files[0] || null;
    status.textContent = '';
    if (!pending) return;
    preview.src = URL.createObjectURL(pending);
    if (!pending.name.endsWith(entry.path.slice(entry.path.lastIndexOf('.')))) {
      status.textContent = `Note: the file on disk stays ${entry.path.split('.').pop()} -- `
        + 'a different format under the same name is a graphic the game cannot read.';
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!pending) {
      status.textContent = 'Choose a replacement file first.';
      return;
    }
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      await fs.saveFile(entry.path, pending);
      preview.src = `${rootUrl(entry.path)}?t=${Date.now()}`;
      status.textContent = SAVED_ASSET_MSG;
      onSaved();
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  });

  pane.append(
    el('p', { className: 'tab-intro', textContent:
      'Upload a replacement. Keep the same pixel dimensions unless you also mean to change how the game slices it '
      + '(a spritesheet is cells of a fixed size -- see the size below the preview on the Animate pane).' }),
    preview,
    fileInput,
    saveBtn,
    status,
  );
  return pane;
}

// -- shared ----------------------------------------------------------------

// Where a frame sits in the sheet, counted the way Phaser slices one:
// left to right, then top to bottom.
function sourceRect(frame, image, frameIndex) {
  if (!frame) return { sx: 0, sy: 0 };
  const cols = Math.max(1, Math.floor(image.naturalWidth / frame.frameWidth));
  return {
    sx: (frameIndex % cols) * frame.frameWidth,
    sy: Math.floor(frameIndex / cols) * frame.frameHeight,
  };
}

function frameCount(frame, image) {
  const cols = Math.max(1, Math.floor(image.naturalWidth / frame.frameWidth));
  const rows = Math.max(1, Math.floor(image.naturalHeight / frame.frameHeight));
  return cols * rows;
}

function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

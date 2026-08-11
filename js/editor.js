import { VIRTUAL_W, GROUND_Y, OBSTACLE_BLOCK_SIZE, BORDER_THICKNESS, GAME_STATES } from './constants.js';
import { OBSTACLE_TYPE_KEYS, POWERUP_TYPE_KEYS, POWERUP_TYPES, BALL_ELEMENTS, getBallElement, maxBallSize } from './elements.js';
import { WEAPON_TYPES } from './config.js';
import { backgroundTextureKey, DEFAULT_BACKGROUND } from './assets.js';
import { LEVELS } from './LevelManager.js';
import { Obstacle, refreshObstacleSeams } from './Obstacle.js';
import { Ball } from './Ball.js';
import * as storage from './storage.js';

const BRUSHES = [
  { id: 'platform', label: 'Wall' },
  { id: 'crate', label: 'Crate' },
  { id: 'erase', label: 'Erase' },
];

// The editor panel is plain DOM (same markup/CSS as the debug panel, see
// style.css's .debug-btn-row) built entirely in buildPanel() below -- these
// two cover every button and dropdown it needs.
function makeButton(label, onClick, title) {
  const btn = document.createElement('button');
  btn.textContent = label;
  if (title) btn.title = title;
  btn.onclick = onClick;
  return btn;
}

// `entries` is a list of [value, label] pairs, in the order they should
// appear -- the caller builds that list, including any leading "none"
// entry (see the powerup dropdown, whose empty value means "no drop").
function makeSelect(entries, onChange) {
  const select = document.createElement('select');
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.onchange = onChange;
  return select;
}

// A <label> with its text and the control it labels, matching the
// "Text: <control>" shape every labelled row in the panel uses.
function labelled(text, control) {
  const label = document.createElement('label');
  label.textContent = text;
  label.appendChild(control);
  return label;
}

// Builds the brush list for balls straight from BALL_ELEMENTS, so a new
// elements/<shape>-ball-<size>.json shows up as a brush automatically --
// same registry the debug spawn panel uses.
function ballBrushes() {
  return BALL_ELEMENTS.map((el) => ({ id: `ball-${el.shape}-${el.size}`, label: `${el.shape[0].toUpperCase()}${el.size}` }));
}

// Every background name any loaded level actually uses, plus
// DEFAULT_BACKGROUND itself (BootScene.js preloads exactly this same set --
// see its own backgroundNames construction) -- there's no separate
// registry file for backgrounds the way elements/obstacles/powerups have
// one, since a background is just an image name a level points at.
function backgroundNames() {
  return [...new Set([DEFAULT_BACKGROUND, ...LEVELS.map((lvl) => lvl.background).filter(Boolean)])];
}

// Snap a raw pointer coordinate to the OBSTACLE_BLOCK_SIZE grid cell that
// actually CONTAINS it (floor, not round-to-nearest -- rounding to the
// nearest grid line could snap up to half a cell away from the pointer,
// so the highlighted cell wouldn't be the one the pointer is inside of),
// clamped so a placed obstacle/ball always stays fully inside the
// playfield (never overlapping the border) -- same rule every
// hand-authored level in levels.js already follows. Every editor object
// (walls, crates, balls) is placed on this exact grid, no free placement.
// Grid step (OBSTACLE_BLOCK_SIZE) and border clearance (BORDER_THICKNESS)
// are independent constants -- see constants.js.
//
// The clamp itself has to land ON a grid line, not just inside bounds:
// GROUND_Y - BORDER_THICKNESS isn't necessarily a whole number of grid
// cells below the top border (e.g. 800x420 with a 16px border/grid: the
// inner playfield is 388px tall, and 388 isn't a multiple of 16), so a
// naive `Math.min(gy, rawMax)` clamp could snap the bottom row to a
// pixel offset the rest of the grid never uses -- visibly misaligned/
// overlapping with the row above it. gridSnap() rounds each raw bound
// down to the nearest cell that's actually still fully inside the
// playfield, same as the floor() above does for an ordinary coordinate.
function gridSnap(bt, grid, rawMax) {
  return bt + Math.floor((rawMax - bt) / grid) * grid;
}

function snapObstacleOrigin(x, y) {
  const grid = OBSTACLE_BLOCK_SIZE;
  const bt = BORDER_THICKNESS;
  const gx = Math.floor((x - bt) / grid) * grid + bt;
  const gy = Math.floor((y - bt) / grid) * grid + bt;
  const maxX = gridSnap(bt, grid, VIRTUAL_W - bt - grid);
  const maxY = gridSnap(bt, grid, GROUND_Y - bt - grid);
  return { x: Math.min(Math.max(gx, bt), maxX), y: Math.min(Math.max(gy, bt), maxY) };
}

function ballRadius(shape, size) {
  return getBallElement(shape, Math.min(size, maxBallSize(shape))).radius;
}

// Initial velocity for a ball placed with a given (dirX, dirY) direction
// toggle -- mirrors the default-direction logic in Ball.js's constructor,
// just deterministic instead of random. Round (gravity) balls only move
// horizontally at first (dirY is meaningless for them); hex balls split
// their speed diagonally across both axes.
function computeBallVelocity(shape, size, dirX, dirY) {
  const el = getBallElement(shape, Math.min(size, maxBallSize(shape)));
  if (el.hasGravity) return { vx: el.speed * dirX, vy: 0 };
  const component = el.speed * Math.SQRT1_2;
  return { vx: component * dirX, vy: component * dirY };
}

// In-scene level editor: paint obstacle blocks and ball spawn points onto
// a live GameScene (reusing its real Obstacle/Ball classes and groups, so
// what you see while editing is exactly what plays), then save and/or
// play the result. Entirely a GameScene.EDITOR-state add-on -- doesn't
// touch PLAYING logic, and every handler here no-ops outside that state.
export class Editor {
  constructor(scene) {
    this.scene = scene;
    this.brush = 'platform';
    this.blocks = new Map(); // "gx,gy" -> Obstacle instance
    this.balls = new Map(); // "gx,gy" -> { shape, size, x, y, vx, vy, powerup, sprite }
    this.dirX = 1; // next-placed ball's horizontal direction: 1 = right, -1 = left
    this.dirY = -1; // next-placed ball's vertical direction (hex only): -1 = up, 1 = down
    this.selectedPowerup = null; // next-placed crate/ball's guaranteed powerup drop, if any
    this.background = DEFAULT_BACKGROUND;
    this.weapon = 'harpoon';
    this.panelBuilt = false;
    this.cursorGraphics = scene.add.graphics();
    this.cursorGraphics.setDepth(50);

    scene.input.on('pointerdown', (p) => this.onPointer(p, true));
    scene.input.on('pointermove', (p) => this.onPointer(p, false));
    // Right-click is always erase, regardless of the selected brush --
    // without this the browser's own context menu would pop up over the
    // canvas on every right-click instead.
    scene.input.mouse?.disableContextMenu();
  }

  buildPanel() {
    this.panelBuilt = true;
    this.panelEl = document.getElementById('editor-panel');
    this.panelEl.innerHTML = '';

    const brushRow = document.createElement('div');
    brushRow.className = 'debug-btn-row';
    this.brushButtons = {};
    for (const brush of [...BRUSHES.slice(0, 2), ...ballBrushes(), BRUSHES[2]]) {
      const btn = makeButton(brush.label, () => this.setBrush(brush.id), brush.id);
      brushRow.appendChild(btn);
      this.brushButtons[brush.id] = btn;
    }
    this.panelEl.appendChild(brushRow);

    // Options that apply to the NEXT placed ball/crate: initial direction
    // (round balls only use the X one; hex balls use both) and a
    // guaranteed powerup drop on pop/destroy. Chosen before placing, then
    // baked into that specific instance -- see placeBall/placeBlock.
    const optionsRow = document.createElement('div');
    optionsRow.className = 'debug-btn-row';

    // Both direction buttons get their label from updateOptionLabels()
    // below (it renders the current arrow), not here.
    this.dirXBtn = makeButton('', () => {
      this.dirX *= -1;
      this.updateOptionLabels();
    }, 'Ball direction (horizontal)');
    optionsRow.appendChild(this.dirXBtn);

    this.dirYBtn = makeButton('', () => {
      this.dirY *= -1;
      this.updateOptionLabels();
    }, 'Ball direction (vertical) -- hex balls only, round balls always start falling');
    optionsRow.appendChild(this.dirYBtn);

    this.powerupSelect = makeSelect(
      [['', 'No powerup'], ...POWERUP_TYPE_KEYS.map((key) => [key, POWERUP_TYPES[key].label])],
      () => { this.selectedPowerup = this.powerupSelect.value || null; },
    );
    optionsRow.appendChild(labelled('On break/pop: ', this.powerupSelect));

    this.panelEl.appendChild(optionsRow);
    this.updateOptionLabels();

    // Whole-level settings: background image and starting weapon. Unlike
    // the per-placement options above, these apply to the level as a
    // whole, so changing either takes effect immediately (background
    // swaps the live preview via setLevelBackground; weapon just updates
    // what buildDef() will save -- there's only one weapon type today, so
    // nothing visibly changes yet, but a level editor authors this field
    // exactly like background for whenever a second one exists).
    const levelRow = document.createElement('div');
    levelRow.className = 'debug-btn-row';

    this.backgroundSelect = makeSelect(
      backgroundNames().map((name) => [name, name]),
      () => this.setBackground(this.backgroundSelect.value),
    );
    levelRow.appendChild(labelled('Background: ', this.backgroundSelect));

    this.weaponSelect = makeSelect(
      Object.entries(WEAPON_TYPES).map(([key, w]) => [key, w.label]),
      () => { this.weapon = this.weaponSelect.value; },
    );
    levelRow.appendChild(labelled('Weapon: ', this.weaponSelect));

    this.panelEl.appendChild(levelRow);

    const actionRow = document.createElement('div');
    actionRow.className = 'debug-btn-row';

    this.timeInput = document.createElement('input');
    this.timeInput.type = 'number';
    this.timeInput.min = '10';
    this.timeInput.max = '300';
    this.timeInput.value = '60';
    this.timeInput.style.width = '48px';
    actionRow.appendChild(labelled('Time ', this.timeInput));

    actionRow.append(
      makeButton('Clear all', () => this.clearAll()),
      makeButton('Save', () => this.save()),
      makeButton('Export', () => this.exportJSON()),
      makeButton('Import', () => this.importFileInput.click()),
    );

    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.json,application/json';
    this.importFileInput.style.display = 'none';
    this.importFileInput.onchange = (e) => this.importJSON(e);
    actionRow.appendChild(this.importFileInput);

    actionRow.append(
      makeButton('Play', () => this.play()),
      makeButton('Menu', () => this.scene.exitEditor()),
    );

    this.panelEl.appendChild(actionRow);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'debug-text';
    this.panelEl.appendChild(this.statusEl);

    this.setBrush(this.brush);
  }

  updateOptionLabels() {
    if (this.dirXBtn) this.dirXBtn.textContent = `Dir X: ${this.dirX > 0 ? '→' : '←'}`;
    if (this.dirYBtn) this.dirYBtn.textContent = `Dir Y: ${this.dirY < 0 ? '↑' : '↓'}`;
  }

  // Updates both the editor's own saved field and the live GameScene
  // preview (the same Image loadLevel() points at during real gameplay --
  // see GameScene.drawBackground/loadLevel), so picking a different
  // background in the dropdown shows it immediately while editing.
  setBackground(name) {
    this.background = name;
    if (this.backgroundSelect) this.backgroundSelect.value = name;
    this.scene.backgroundImage.setTexture(backgroundTextureKey(name));
  }

  setBrush(id) {
    this.brush = id;
    if (!this.brushButtons) return;
    for (const [brushId, btn] of Object.entries(this.brushButtons)) {
      btn.style.outline = brushId === id ? '2px solid #ffd23f' : 'none';
    }
  }

  enable() {
    if (!this.panelBuilt) this.buildPanel();
    this.panelEl.classList.remove('hidden');
    const existing = storage.loadCustomLevel();
    this.clearAll();
    if (existing) {
      this.loadDef(existing);
    } else {
      // Resync the live preview with this.background/weapon (retained from
      // the last editor session) -- whatever level was last played may
      // have pointed scene.backgroundImage at a different texture since.
      this.setBackground(this.background);
      if (this.weaponSelect) this.weaponSelect.value = this.weapon;
    }
  }

  disable() {
    if (this.panelEl) this.panelEl.classList.add('hidden');
    this.cursorGraphics.clear();
  }

  // Re-shows the editor's panel after the pause menu hid it with disable()
  // (see GameScene.pauseFromEditor/returnToEditor). Deliberately NOT
  // enable(): that reloads the last SAVED level from storage, which would
  // throw away every edit made since -- whereas disable() only ever hides
  // UI, so the scene still holds the exact in-progress layout and simply
  // showing the panel again resumes editing it untouched.
  reshowPanel() {
    if (this.panelEl) this.panelEl.classList.remove('hidden');
  }

  // Also the entry point for imported JSON files (see importJSON), which
  // may be hand-edited or from an older/foreign export -- so every field
  // is validated rather than trusted, and invalid entries are skipped
  // individually instead of aborting or crashing the whole import.
  loadDef(def) {
    this.timeInput.value = String(def.timeLimitSec || 60);
    this.setBackground(backgroundNames().includes(def.background) ? def.background : DEFAULT_BACKGROUND);
    this.weapon = WEAPON_TYPES[def.weapon] ? def.weapon : 'harpoon';
    if (this.weaponSelect) this.weaponSelect.value = this.weapon;
    for (const o of def.obstacles || []) {
      if (!OBSTACLE_TYPE_KEYS.includes(o.type)) continue;
      if (![o.x, o.y, o.w, o.h].every(Number.isFinite)) continue;
      const powerup = POWERUP_TYPE_KEYS.includes(o.powerup) ? o.powerup : null;
      for (let dy = 0; dy < o.h; dy += OBSTACLE_BLOCK_SIZE) {
        for (let dx = 0; dx < o.w; dx += OBSTACLE_BLOCK_SIZE) {
          this.setBlock(o.x + dx, o.y + dy, o.type, powerup);
        }
      }
    }
    for (const b of def.balls || []) {
      if (!BALL_ELEMENTS.some((el) => el.shape === b.shape) || !Number.isFinite(b.size) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      // b.x/b.y are the ball's CENTER (the coordinate real gameplay spawns
      // it at); the editor's grid cell is anchored to its top-left corner
      // (center - radius), so recover that corner before snapping rather
      // than snapping the center itself -- otherwise a ball's radius would
      // shift which cell it's considered to belong to on reload.
      const radius = ballRadius(b.shape, b.size);
      const snapped = snapObstacleOrigin(b.x - radius, b.y - radius);
      const hasVelocity = Number.isFinite(b.vx) && Number.isFinite(b.vy);
      const { vx, vy } = hasVelocity ? { vx: b.vx, vy: b.vy } : computeBallVelocity(b.shape, b.size, 1, -1);
      const powerup = POWERUP_TYPE_KEYS.includes(b.powerup) ? b.powerup : null;
      this.setBall(snapped, b.shape, b.size, vx, vy, powerup);
    }
  }

  clearAll() {
    for (const block of this.blocks.values()) block.destroy();
    this.blocks.clear();
    for (const ball of this.balls.values()) ball.sprite.destroy();
    this.balls.clear();
  }

  keyFor(x, y) {
    return `${x},${y}`;
  }

  // Low-level placement (grid cell already known) shared by the live
  // pointer brush and loadDef() -- a wall/crate block always fully
  // occupies its cell, so placing one evicts any ball sitting there.
  setBlock(x, y, type, powerup) {
    const key = this.keyFor(x, y);
    const existingBlock = this.blocks.get(key);
    if (existingBlock) existingBlock.destroy();
    const existingBall = this.balls.get(key);
    if (existingBall) {
      existingBall.sprite.destroy();
      this.balls.delete(key);
    }
    const block = new Obstacle(this.scene, type, x, y, OBSTACLE_BLOCK_SIZE, OBSTACLE_BLOCK_SIZE, powerup);
    this.scene.obstacles.add(block);
    this.blocks.set(key, block);
    refreshObstacleSeams(this.scene.obstacles);
  }

  placeBlock(x, y, type) {
    this.setBlock(x, y, type, this.selectedPowerup);
  }

  eraseAt(x, y) {
    const key = this.keyFor(x, y);
    const block = this.blocks.get(key);
    if (block) {
      block.destroy();
      this.blocks.delete(key);
      refreshObstacleSeams(this.scene.obstacles);
    }
    const ball = this.balls.get(key);
    if (ball) {
      ball.sprite.destroy();
      this.balls.delete(key);
    }
  }

  // Low-level placement (grid cell + exact velocity/powerup already
  // known) shared by the live pointer brush and loadDef() -- loadDef
  // passes each ball's own saved vx/vy/powerup directly so restoring a
  // level reproduces it exactly, rather than reapplying whatever the
  // editor's CURRENT direction/powerup toggles happen to be set to.
  // The grid cell marks the ball's top-left bounding-box corner (not its
  // center) -- the same reference point a wall/crate block uses -- so the
  // cursor square consistently means "this corner is on the grid" for
  // every brush, ball included, even though a ball's own texture origin
  // is its center.
  setBall(snapped, shape, size, vx, vy, powerup) {
    const key = this.keyFor(snapped.x, snapped.y);
    if (this.blocks.has(key)) return; // don't stack a ball on a wall block
    const existing = this.balls.get(key);
    if (existing) existing.sprite.destroy();
    const radius = ballRadius(shape, size);
    const cx = snapped.x + radius;
    const cy = snapped.y + radius;
    const sprite = new Ball(this.scene, shape, size, cx, cy, 0, 0);
    sprite.body.setAllowGravity(false);
    sprite.body.setVelocity(0, 0);
    this.scene.balls.add(sprite);
    this.balls.set(key, { shape, size, x: cx, y: cy, vx, vy, powerup, sprite });
  }

  placeBall(x, y, shape, size) {
    const snapped = snapObstacleOrigin(x, y);
    const { vx, vy } = computeBallVelocity(shape, size, this.dirX, this.dirY);
    this.setBall(snapped, shape, size, vx, vy, this.selectedPowerup);
  }

  // isDown is true only for the initial 'pointerdown' call, false for
  // 'pointermove' -- walls/crates/erase paint continuously while dragging,
  // but a ball brush only places one ball per discrete click (a drag would
  // otherwise spam dozens of balls along the drag path).
  onPointer(pointer, isDown) {
    if (this.scene.state !== GAME_STATES.EDITOR) return;
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (x < BORDER_THICKNESS || x > VIRTUAL_W - BORDER_THICKNESS || y < BORDER_THICKNESS || y > GROUND_Y - BORDER_THICKNESS) return;

    const snapped = snapObstacleOrigin(x, y);
    this.hoverCell = snapped;

    // pointer.isDown only reflects the LEFT button -- the right button
    // needs its own check, since right-click-to-erase (below) has to work
    // even though it isn't "the" primary button press.
    if (!pointer.isDown && !pointer.rightButtonDown()) return;

    // Right-click always erases whatever's under the cursor, regardless of
    // the selected brush -- a quick-access shortcut alongside the
    // dedicated Erase brush, which still works the same as before via the
    // left button.
    if (pointer.rightButtonDown()) {
      this.eraseAt(snapped.x, snapped.y);
      return;
    }

    const isBallBrush = this.brush.startsWith('ball-');
    if (isBallBrush && !isDown) return;

    if (this.brush === 'erase') {
      this.eraseAt(snapped.x, snapped.y);
    } else if (isBallBrush) {
      const [, shape, sizeStr] = this.brush.split('-');
      this.placeBall(x, y, shape, parseInt(sizeStr, 10));
    } else {
      this.placeBlock(snapped.x, snapped.y, this.brush);
    }
  }

  render() {
    this.cursorGraphics.clear();
    if (this.scene.state !== GAME_STATES.EDITOR || !this.hoverCell) return;
    this.cursorGraphics.lineStyle(1, 0xffd23f, 0.9);
    // Every brush -- ball included -- snaps to the same grid cell, and that
    // cell is always the object's top-left bounding-box corner (the square
    // below marks exactly that corner). A ball's actual footprint is
    // usually much bigger than one 8x8 cell though (up to 48px across) --
    // draw its true radius, extending down-right from that same corner, so
    // the cursor shows the whole element about to be placed rather than
    // just the small grid square at its corner.
    this.cursorGraphics.strokeRect(this.hoverCell.x, this.hoverCell.y, OBSTACLE_BLOCK_SIZE, OBSTACLE_BLOCK_SIZE);
    if (this.brush.startsWith('ball-')) {
      const [, shape, sizeStr] = this.brush.split('-');
      const size = parseInt(sizeStr, 10);
      const radius = ballRadius(shape, size);
      const cx = this.hoverCell.x + radius;
      const cy = this.hoverCell.y + radius;
      this.cursorGraphics.strokeCircle(cx, cy, radius);
    }
    if (this.statusEl) {
      // A transient message (e.g. an import error) takes over the status
      // line for a few seconds instead of being overwritten on the very
      // next frame by the brush/count line below.
      if (this.statusMessage && performance.now() < this.statusMessageUntil) {
        this.statusEl.textContent = this.statusMessage;
      } else {
        this.statusMessage = null;
        this.statusEl.textContent = `BRUSH ${this.brush}\nBLOCKS ${this.blocks.size}  BALLS ${this.balls.size}`;
      }
    }
  }

  showStatusMessage(text, durationMs = 3000) {
    this.statusMessage = text;
    this.statusMessageUntil = performance.now() + durationMs;
  }

  buildDef() {
    const obstacles = [...this.blocks.entries()].map(([key, block]) => {
      const [x, y] = key.split(',').map(Number);
      const entry = { type: block.type, x, y, w: OBSTACLE_BLOCK_SIZE, h: OBSTACLE_BLOCK_SIZE };
      if (block.forcedPowerup) entry.powerup = block.forcedPowerup;
      return entry;
    });
    const balls = [...this.balls.values()].map((b) => {
      const entry = { shape: b.shape, size: b.size, x: b.x, y: b.y, vx: b.vx, vy: b.vy };
      if (b.powerup) entry.powerup = b.powerup;
      return entry;
    });
    const timeLimitSec = Math.max(10, Math.min(300, parseInt(this.timeInput.value, 10) || 60));
    return { id: 'custom', name: 'Custom Level', timeLimitSec, background: this.background, weapon: this.weapon, obstacles, balls };
  }

  save() {
    storage.saveCustomLevel(this.buildDef());
  }

  // Download the current level as a standalone .json file -- a second way
  // to keep/share a level besides the single localStorage save slot.
  exportJSON() {
    const blob = new Blob([JSON.stringify(this.buildDef(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'balloon-buster-level.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Loads a previously exported (or hand-written) level file, replacing
  // whatever's currently being edited. Bad JSON or a malformed level just
  // reports a status message rather than throwing -- see loadDef for the
  // per-entry validation that protects against a partially-bad file.
  importJSON(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let def;
      try {
        def = JSON.parse(reader.result);
      } catch {
        this.showStatusMessage('IMPORT FAILED: invalid JSON');
        return;
      }
      if (!def || typeof def !== 'object' || !Array.isArray(def.obstacles) || !Array.isArray(def.balls)) {
        this.showStatusMessage('IMPORT FAILED: not a level file');
        return;
      }
      this.clearAll();
      this.loadDef(def);
      this.showStatusMessage('IMPORT OK');
    };
    reader.readAsText(file);
  }

  play() {
    if (this.balls.size === 0) return; // nothing to pop, refuse to start
    this.save();
    const def = this.buildDef();
    this.disable();
    this.scene.startCustomLevel(def);
  }
}

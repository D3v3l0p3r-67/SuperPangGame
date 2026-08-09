import { VIRTUAL_W, GROUND_Y, OBSTACLE_BLOCK_SIZE, GAME_STATES } from './constants.js';
import { BALL_SHAPES, BALL_SIZES, OBSTACLE_TYPE_KEYS } from './config.js';
import { Obstacle } from './Obstacle.js';
import { Ball } from './Ball.js';
import * as storage from './storage.js';

const BRUSHES = [
  { id: 'platform', label: 'Wall' },
  { id: 'crate', label: 'Crate' },
  { id: 'erase', label: 'Erase' },
];

// Builds the brush list for balls from the same registries the debug
// spawn panel uses, so adding a new ball size/shape shows up here too.
function ballBrushes() {
  const brushes = [];
  for (const shape of Object.keys(BALL_SHAPES)) {
    const maxSize = BALL_SHAPES[shape].maxSize;
    for (const { size } of BALL_SIZES) {
      if (size > maxSize) continue;
      brushes.push({ id: `ball-${shape}-${size}`, label: `${shape[0].toUpperCase()}${size}` });
    }
  }
  return brushes;
}

// Snap a raw pointer coordinate to the OBSTACLE_BLOCK_SIZE grid cell that
// actually CONTAINS it (floor, not round-to-nearest -- rounding to the
// nearest grid line could snap up to half a cell away from the pointer,
// so the highlighted cell wouldn't be the one the pointer is inside of),
// clamped so a placed obstacle block always stays fully inside the
// playfield (never overlapping the border) -- same rule every
// hand-authored level in levels.js already follows.
function snapObstacleOrigin(x, y) {
  const bt = OBSTACLE_BLOCK_SIZE;
  const gx = Math.floor((x - bt) / bt) * bt + bt;
  const gy = Math.floor((y - bt) / bt) * bt + bt;
  const maxX = VIRTUAL_W - bt * 2;
  const maxY = GROUND_Y - bt * 2;
  return { x: Math.min(Math.max(gx, bt), maxX), y: Math.min(Math.max(gy, bt), maxY) };
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
    this.balls = []; // { shape, size, x, y, sprite }
    this.panelBuilt = false;
    this.cursorGraphics = scene.add.graphics();
    this.cursorGraphics.setDepth(50);

    scene.input.on('pointerdown', (p) => this.onPointer(p, true));
    scene.input.on('pointermove', (p) => this.onPointer(p, false));
  }

  buildPanel() {
    this.panelBuilt = true;
    this.panelEl = document.getElementById('editor-panel');
    this.panelEl.innerHTML = '';

    const brushRow = document.createElement('div');
    brushRow.className = 'debug-btn-row';
    this.brushButtons = {};
    for (const brush of [...BRUSHES.slice(0, 2), ...ballBrushes(), BRUSHES[2]]) {
      const btn = document.createElement('button');
      btn.textContent = brush.label;
      btn.title = brush.id;
      btn.onclick = () => this.setBrush(brush.id);
      brushRow.appendChild(btn);
      this.brushButtons[brush.id] = btn;
    }
    this.panelEl.appendChild(brushRow);

    const actionRow = document.createElement('div');
    actionRow.className = 'debug-btn-row';

    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time ';
    this.timeInput = document.createElement('input');
    this.timeInput.type = 'number';
    this.timeInput.min = '10';
    this.timeInput.max = '300';
    this.timeInput.value = '60';
    this.timeInput.style.width = '48px';
    timeLabel.appendChild(this.timeInput);
    actionRow.appendChild(timeLabel);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear all';
    clearBtn.onclick = () => this.clearAll();
    actionRow.appendChild(clearBtn);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => this.save();
    actionRow.appendChild(saveBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.onclick = () => this.exportJSON();
    actionRow.appendChild(exportBtn);

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.onclick = () => this.importFileInput.click();
    actionRow.appendChild(importBtn);

    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.json,application/json';
    this.importFileInput.style.display = 'none';
    this.importFileInput.onchange = (e) => this.importJSON(e);
    actionRow.appendChild(this.importFileInput);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.onclick = () => this.play();
    actionRow.appendChild(playBtn);

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Menu';
    backBtn.onclick = () => this.scene.exitEditor();
    actionRow.appendChild(backBtn);

    this.panelEl.appendChild(actionRow);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'debug-text';
    this.panelEl.appendChild(this.statusEl);

    this.setBrush(this.brush);
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
    if (existing) this.loadDef(existing);
  }

  disable() {
    if (this.panelEl) this.panelEl.classList.add('hidden');
    this.cursorGraphics.clear();
  }

  // Also the entry point for imported JSON files (see importJSON), which
  // may be hand-edited or from an older/foreign export -- so every field
  // is validated rather than trusted, and invalid entries are skipped
  // individually instead of aborting or crashing the whole import.
  loadDef(def) {
    this.timeInput.value = String(def.timeLimitSec || 60);
    for (const o of def.obstacles || []) {
      if (!OBSTACLE_TYPE_KEYS.includes(o.type)) continue;
      if (![o.x, o.y, o.w, o.h].every(Number.isFinite)) continue;
      for (let dy = 0; dy < o.h; dy += OBSTACLE_BLOCK_SIZE) {
        for (let dx = 0; dx < o.w; dx += OBSTACLE_BLOCK_SIZE) {
          this.placeBlock(o.x + dx, o.y + dy, o.type);
        }
      }
    }
    for (const b of def.balls || []) {
      if (!BALL_SHAPES[b.shape] || !Number.isFinite(b.size) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      this.placeBall(b.x, b.y, b.shape, b.size);
    }
  }

  clearAll() {
    for (const block of this.blocks.values()) block.destroy();
    this.blocks.clear();
    for (const b of this.balls) b.sprite.destroy();
    this.balls = [];
  }

  keyFor(x, y) {
    return `${x},${y}`;
  }

  placeBlock(x, y, type) {
    const key = this.keyFor(x, y);
    const existing = this.blocks.get(key);
    if (existing) existing.destroy();
    this.removeBallNear(x + OBSTACLE_BLOCK_SIZE / 2, y + OBSTACLE_BLOCK_SIZE / 2, OBSTACLE_BLOCK_SIZE / 2);
    const block = new Obstacle(this.scene, type, x, y, OBSTACLE_BLOCK_SIZE, OBSTACLE_BLOCK_SIZE);
    this.scene.obstacles.add(block);
    this.blocks.set(key, block);
  }

  eraseAt(x, y) {
    const key = this.keyFor(x, y);
    const existing = this.blocks.get(key);
    if (existing) {
      existing.destroy();
      this.blocks.delete(key);
    }
    this.removeBallNear(x + OBSTACLE_BLOCK_SIZE / 2, y + OBSTACLE_BLOCK_SIZE / 2, OBSTACLE_BLOCK_SIZE);
  }

  removeBallNear(x, y, radius) {
    const keep = [];
    for (const b of this.balls) {
      if (Math.hypot(b.x - x, b.y - y) <= radius) b.sprite.destroy();
      else keep.push(b);
    }
    this.balls = keep;
  }

  placeBall(x, y, shape, size) {
    this.removeBallNear(x, y, OBSTACLE_BLOCK_SIZE);
    const snapped = snapObstacleOrigin(x, y);
    if (this.blocks.has(this.keyFor(snapped.x, snapped.y))) return; // don't stack a ball on a wall block
    const sprite = new Ball(this.scene, shape, size, x, y, 0, 0);
    sprite.body.setAllowGravity(false);
    sprite.body.setVelocity(0, 0);
    this.scene.balls.add(sprite);
    this.balls.push({ shape, size, x, y, sprite });
  }

  // isDown is true only for the initial 'pointerdown' call, false for
  // 'pointermove' -- walls/crates/erase paint continuously while dragging,
  // but a ball brush only places one ball per discrete click (a drag would
  // otherwise spam dozens of balls along the drag path).
  onPointer(pointer, isDown) {
    if (this.scene.state !== GAME_STATES.EDITOR) return;
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (x < OBSTACLE_BLOCK_SIZE || x > VIRTUAL_W - OBSTACLE_BLOCK_SIZE || y < OBSTACLE_BLOCK_SIZE || y > GROUND_Y - OBSTACLE_BLOCK_SIZE) return;

    const snapped = snapObstacleOrigin(x, y);
    this.hoverCell = snapped;
    this.hoverPointer = { x, y };

    if (!pointer.isDown) return;
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
    if (this.brush.startsWith('ball-')) {
      // A ball doesn't snap to the grid -- it spawns at the exact pointer
      // position (see placeBall) -- so the cursor must track the raw
      // pointer, not the block-grid cell, or it would visibly disagree
      // with where the ball actually lands.
      const [, , sizeStr] = this.brush.split('-');
      const size = Math.min(parseInt(sizeStr, 10), BALL_SIZES.length);
      const radius = BALL_SIZES[size - 1].radius;
      this.cursorGraphics.strokeCircle(this.hoverPointer.x, this.hoverPointer.y, radius);
    } else {
      this.cursorGraphics.strokeRect(this.hoverCell.x, this.hoverCell.y, OBSTACLE_BLOCK_SIZE, OBSTACLE_BLOCK_SIZE);
    }
    if (this.statusEl) {
      // A transient message (e.g. an import error) takes over the status
      // line for a few seconds instead of being overwritten on the very
      // next frame by the brush/count line below.
      if (this.statusMessage && performance.now() < this.statusMessageUntil) {
        this.statusEl.textContent = this.statusMessage;
      } else {
        this.statusMessage = null;
        this.statusEl.textContent = `BRUSH ${this.brush}\nBLOCKS ${this.blocks.size}  BALLS ${this.balls.length}`;
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
      return { type: block.type, x, y, w: OBSTACLE_BLOCK_SIZE, h: OBSTACLE_BLOCK_SIZE };
    });
    const balls = this.balls.map((b) => ({ shape: b.shape, size: b.size, x: b.x, y: b.y, vx: undefined }));
    const timeLimitSec = Math.max(10, Math.min(300, parseInt(this.timeInput.value, 10) || 60));
    return { id: 'custom', name: 'Custom Level', timeLimitSec, obstacles, balls };
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
    if (this.balls.length === 0) return; // nothing to pop, refuse to start
    this.save();
    const def = this.buildDef();
    this.disable();
    this.scene.startCustomLevel(def);
  }
}

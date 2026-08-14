import { VIRTUAL_W, VIRTUAL_H, HUD_H, GROUND_Y, OBSTACLE_BLOCK_SIZE, BORDER_THICKNESS, GAME_STATES } from './constants.js';
import { OBSTACLE_TYPE_KEYS, LADDER_TYPES, LADDER_TYPE_KEYS, POWERUP_TYPE_KEYS, POWERUP_TYPES, BALL_ELEMENTS, getBallElement, maxBallSize } from './elements.js';
import { WEAPON_TYPES, PLAYER_CONFIG } from './config.js';
import { backgroundTextureKey, DEFAULT_BACKGROUND, levelFileKey } from './assets.js';
import {
  LEVELS, SHIPPED_LEVELS, setLevel, isLevelDef,
  DEFAULT_PLAYER_SPAWN, clampPlayerSpawn, playerSpawn,
} from './LevelManager.js';
import { daylightBackgroundNames } from './regions.js';
import { Obstacle, refreshObstacleSeams } from './Obstacle.js';
import { Ball } from './Ball.js';
import { Ladder } from './Ladder.js';
import { makeButton, makeSelect, labelled, row, group, setGroupTitle } from './panelUi.js';
import * as storage from './storage.js';

// Split into the two brushes that TILE (painted cell by cell while the
// pointer is dragged) and the two that don't, because the panel row below
// puts the whole-element brushes -- ladders, the player's start -- between
// them.
const TILE_BRUSHES = [
  { id: 'platform', label: 'Wall' },
  { id: 'crate', label: 'Crate' },
];
const START_BRUSH = { id: 'start', label: 'Start' };
const ERASE_BRUSH = { id: 'erase', label: 'Erase' };

// Builds the brush list for balls straight from BALL_ELEMENTS, so a new
// elements/<shape>-ball-<size>.json shows up as a brush automatically --
// same registry the debug spawn panel uses.
function ballBrushes() {
  return BALL_ELEMENTS.map((el) => ({ id: `ball-${el.shape}-${el.size}`, label: `${el.shape[0].toUpperCase()}${el.size}` }));
}

// Same idea for ladders: a new elements/<ladder>.json is a new brush, no
// change here. Unlike every other brush a ladder is placed whole rather
// than cell by cell -- it is a fixed-size element, not a tiling block.
function ladderBrushes() {
  return LADDER_TYPE_KEYS.map((type) => ({ id: `ladder-${type}`, label: LADDER_TYPES[type].label }));
}

// Every background name any loaded level actually uses, plus
// DEFAULT_BACKGROUND itself, plus every region's frame at each of its
// times of day (BootScene.js preloads exactly this same set -- see its own
// backgroundNames construction) -- there's no separate registry file for
// backgrounds the way elements/obstacles/powerups have one, since a
// background is just an image name a level points at.
function backgroundNames() {
  return [...new Set([
    DEFAULT_BACKGROUND,
    ...LEVELS.map((lvl) => lvl.background).filter(Boolean),
    ...daylightBackgroundNames(),
  ])];
}

// A level with nothing in it, in the shape loadDef/buildDef expect (see
// the README's "Adding levels" for the full field list). Every field the
// editor has a control for gets that control's own default, so New leaves
// no trace of whatever was open before -- which is the whole difference
// between it and Clear all. The name is the placeholder buildDef would
// have used anyway for a level that never had one; there is no control
// for it here, so a level authored this way is renamed by editing the
// exported file.
function blankLevelDef(levelNumber) {
  return {
    id: levelNumber,
    name: `Level ${levelNumber}`,
    timeLimitSec: 60,
    background: DEFAULT_BACKGROUND,
    weapon: 'harpoon',
    obstacles: [],
    balls: [],
  };
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
// Rows are counted UP FROM THE GROUND rather than down from the ceiling,
// so the bottom row always rests exactly on the ground and a wall can be
// built standing ON it. GROUND_Y is snapped to the grid (see constants.js),
// which makes the interior a whole number of cells tall, so counting up
// from the ground reaches the ceiling flush as well -- both ends line up
// with the drawn border and every row is exactly one step above the row
// below it, which is what the player's step-up needs to read a stack of
// blocks as a staircase (see Player.js).
function gridSnap(bt, grid, rawMax) {
  return bt + Math.floor((rawMax - bt) / grid) * grid;
}

function snapObstacleOrigin(x, y) {
  const grid = OBSTACLE_BLOCK_SIZE;
  const bt = BORDER_THICKNESS;
  const gx = Math.floor((x - bt) / grid) * grid + bt;
  const maxX = gridSnap(bt, grid, VIRTUAL_W - bt - grid);

  // Which row up from the ground the pointer is in: 1 is the row resting
  // on the ground, counting upward. ceil, so a pointer anywhere inside a
  // row picks that row rather than the one below it.
  const maxRows = Math.floor((GROUND_Y - bt) / grid);
  const rows = Math.min(Math.max(Math.ceil((GROUND_Y - y) / grid), 1), maxRows);

  return { x: Math.min(Math.max(gx, bt), maxX), y: GROUND_Y - rows * grid };
}

// The start point a grid cell stands for: the player centred across the
// cell with their feet on its bottom edge -- the edge a block placed in
// that same cell would rest on, so clicking the floor row starts them on
// the floor and clicking a cell over a platform starts them on it.
function startFor(cell) {
  return { x: cell.x + OBSTACLE_BLOCK_SIZE / 2, y: cell.y + OBSTACLE_BLOCK_SIZE };
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
    this.ladders = new Map(); // "gx,gy" (top-left cell) -> { type, x, y, sprite }
    // Where the level puts the player, or null for "wherever the default
    // puts them" (see LevelManager's playerSpawn). Only ever one, so it is
    // a single value rather than another Map -- and it needs no sprite of
    // its own: the scene's real player stands on it while editing (see
    // applyPlayerStart).
    this.playerStart = null;
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
    // The panel fills the HUD strip (see style.css) -- its height taken
    // from the layout constants rather than written into the stylesheet a
    // second time, so it stays right through any change to either.
    this.panelEl.style.height = `${(HUD_H / VIRTUAL_H) * 100}%`;

    this.brushButtons = {};
    const brushButton = (brush) => {
      const btn = makeButton(brush.label, () => this.setBrush(brush.id), brush.id);
      this.brushButtons[brush.id] = btn;
      return btn;
    };

    // What the pointer paints. Split by what the brushes actually put
    // down -- the structure of the level on one row, the balls that have
    // to be popped in it on the next -- rather than one long run of them.
    this.panelEl.appendChild(group(
      'BRUSH',
      row(...[...TILE_BRUSHES, ...ladderBrushes(), START_BRUSH, ERASE_BRUSH].map(brushButton)),
      row(...ballBrushes().map(brushButton)),
    ));

    // Options that apply to the NEXT placed ball/crate: initial direction
    // (round balls only use the X one; hex balls use both) and a
    // guaranteed powerup drop on pop/destroy. Chosen before placing, then
    // baked into that specific instance -- see placeBall/placeBlock.
    //
    // Both direction buttons get their label from updateOptionLabels()
    // below (it renders the current arrow), not here.
    this.dirXBtn = makeButton('', () => {
      this.dirX *= -1;
      this.updateOptionLabels();
    }, 'Ball direction (horizontal)');
    this.dirYBtn = makeButton('', () => {
      this.dirY *= -1;
      this.updateOptionLabels();
    }, 'Ball direction (vertical) -- hex balls only, round balls always start falling');
    this.powerupSelect = makeSelect(
      [['', 'No powerup'], ...POWERUP_TYPE_KEYS.map((key) => [key, POWERUP_TYPES[key].label])],
      () => { this.selectedPowerup = this.powerupSelect.value || null; },
    );
    this.panelEl.appendChild(group(
      'NEXT PLACED',
      row(this.dirXBtn, this.dirYBtn),
      row(labelled('Drops ', this.powerupSelect)),
    ));
    this.updateOptionLabels();

    // Whole-level settings: background image, starting weapon and clock.
    // Unlike the per-placement options above, these apply to the level as
    // a whole, so changing either dropdown takes effect immediately
    // (background swaps the live preview via setBackground; weapon just
    // updates what buildDef() will save).
    this.backgroundSelect = makeSelect(
      backgroundNames().map((name) => [name, name]),
      () => this.setBackground(this.backgroundSelect.value),
    );
    this.weaponSelect = makeSelect(
      Object.entries(WEAPON_TYPES).map(([key, w]) => [key, w.label]),
      () => { this.weapon = this.weaponSelect.value; },
    );
    this.timeInput = document.createElement('input');
    this.timeInput.type = 'number';
    this.timeInput.min = '10';
    this.timeInput.max = '300';
    this.timeInput.value = '60';
    this.timeInput.style.width = '9cqh';
    // One control per row here, unlike the two-row groups either side:
    // these three are the widest controls in the panel, and side by side
    // they made this group wide enough to push the ones after it off the
    // end of the strip.
    // The title is not fixed: it names the campaign level this session has
    // open (see enable/setTargetTitle), which is the one thing about the
    // editor's state that has to be visible at all times.
    this.levelGroup = group(
      'LEVEL',
      row(labelled('Bg ', this.backgroundSelect)),
      row(labelled('Weapon ', this.weaponSelect)),
      row(labelled('Time ', this.timeInput)),
    );
    this.panelEl.appendChild(this.levelGroup);

    // Everything that touches the level as a whole rather than one thing
    // in it. Clear all sits with them because it is the same kind of
    // action -- one click, the whole level -- not a brush. Revert is the
    // way back out of an edit: it drops this browser's saved version of
    // the level and restores the file the game shipped with.
    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.json,application/json';
    this.importFileInput.style.display = 'none';
    this.importFileInput.onchange = (e) => this.importJSON(e);
    // Starting from nothing throws away more than any other button here --
    // not just what is placed, but the level's name, time, background and
    // weapon -- so it is the one that asks first. The question lives in a
    // row of its own that is hidden until it is asked, so it costs no
    // panel height the rest of the time.
    // The question TAKES THE PLACE of the row it is asked from, rather
    // than appearing under it. This panel is a fixed band across the
    // bottom of the HUD strip and is already wider than the canvas: a
    // group that grew a row while asking would push its own buttons out
    // of the band, which is a poor place to put the answer to a question.
    // Same reason the labels are short and New shares Revert's row rather
    // than sitting beside Save -- as laid out, it costs no width at all.
    this.newRow = row(
      makeButton('Revert', () => this.revert(), 'Drop this browser\'s saved version and restore the shipped level'),
      makeButton('New', () => this.askNewLevel(true), 'Start a blank level in this slot'),
    );
    this.newConfirmRow = row(
      makeButton('Blank it', () => this.newLevel()),
      makeButton('Cancel', () => this.askNewLevel(false)),
    );
    this.newConfirmRow.classList.add('hidden');
    this.panelEl.appendChild(group(
      'FILE',
      row(makeButton('Save', () => this.save()), makeButton('Export', () => this.exportJSON())),
      row(makeButton('Import', () => this.importFileInput.click()),
        makeButton('Clear all', () => this.clearAll()), this.importFileInput),
      this.newRow,
      this.newConfirmRow,
    ));

    // The two ways out of the editor, kept apart from everything that
    // edits so neither is a mis-click away from the brushes.
    this.panelEl.appendChild(group(
      'GO',
      row(makeButton('Play', () => this.play())),
      row(makeButton('Menu', () => this.scene.exitEditor())),
    ));

    // What is actually in the level, and the place a transient message
    // (an import failure, say) is reported. Deliberately no "current
    // brush" readout: the selected brush button is already the one
    // highlighted in the BRUSH group.
    this.statusEl = document.createElement('div');
    this.panelEl.appendChild(group('COUNT', this.statusEl));
    this.panelEl.lastChild.classList.add('panel-status');

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
      btn.classList.toggle('panel-btn-on', brushId === id);
    }
  }

  // Opens the editor on one campaign level, picked from the level list
  // (see GameScene.editLevel). `levelIndex` indexes LEVELS, so what loads
  // is the level as it currently stands -- this browser's saved version of
  // it if there is one, the shipped file otherwise, exactly what playing
  // it would give you.
  //
  // `draft` is the unsaved buffer a playtest left behind (see play), used
  // instead of re-reading the level so that coming back from one continues
  // where it left off. Nothing else may pass it: opening the editor fresh
  // must show the level, not whatever was in it last time.
  enable(levelIndex, draft = null) {
    if (!this.panelBuilt) this.buildPanel();
    this.panelEl.classList.remove('hidden');
    this.levelIndex = levelIndex;
    this.clearAll();
    this.loadDef(draft || LEVELS[levelIndex] || {});
    this.setTargetTitle();
  }

  // The level number as levels/ names it -- 1-based, unlike the index.
  get levelNumber() {
    return this.levelIndex + 1;
  }

  setTargetTitle() {
    if (this.levelGroup) setGroupTitle(this.levelGroup, `LEVEL ${this.levelNumber}`);
  }

  disable() {
    if (this.panelEl) this.panelEl.classList.add('hidden');
    this.cursorGraphics.clear();
  }

  // Re-shows the editor's panel after the pause menu hid it with disable()
  // (see GameScene.pauseFromEditor/returnToEditor). Deliberately NOT
  // enable(): that reloads the level, which would throw away every edit
  // made since -- whereas disable() only ever hides UI, so the scene still
  // holds the exact in-progress layout and simply showing the panel again
  // resumes editing it untouched.
  reshowPanel() {
    if (this.panelEl) this.panelEl.classList.remove('hidden');
  }

  // Also the entry point for imported JSON files (see importJSON), which
  // may be hand-edited or from an older/foreign export -- so every field
  // is validated rather than trusted, and invalid entries are skipped
  // individually instead of aborting or crashing the whole import.
  loadDef(def) {
    // Kept so buildDef() can write its edits back ON TOP of it -- a level
    // carries fields this editor has no controls for (its id and name, and
    // whatever a hand-edited file adds), and editing one must not silently
    // drop them.
    this.sourceDef = def;
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
    // Read through the same reader gameplay uses, so what the editor shows
    // is what the level will spawn -- a missing or malformed start reads
    // as null in both places and falls back to the default.
    this.setPlayerStart(playerSpawn(def));
    for (const l of def.ladders || []) {
      if (!LADDER_TYPE_KEYS.includes(l.type)) continue;
      if (![l.x, l.y].every(Number.isFinite)) continue;
      const snapped = snapObstacleOrigin(l.x, l.y);
      this.setLadder(snapped.x, snapped.y, l.type);
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

  // Swaps the Revert/New row for the "are you sure" and back (see the
  // FILE group). One row is always showing, so the panel never changes
  // height over it.
  askNewLevel(asking) {
    this.newRow?.classList.toggle('hidden', asking);
    this.newConfirmRow?.classList.toggle('hidden', !asking);
  }

  // A level from NOTHING, in the slot this session has open.
  //
  // Not the same thing as Clear all, which empties the field but leaves
  // everything the level IS -- its name, its time limit, its background
  // and its weapon all still come from whatever was opened, so what you
  // are left with is that level with its contents removed. This is a
  // blank level instead, which is what the editor needs to AUTHOR one
  // rather than only edit one.
  //
  // Nothing is written by it. Save puts it in this slot and the game
  // plays it from then on; Export downloads it as the level file for
  // putting into the project; and Revert -- which reads the shipped file,
  // not this -- is still the way back to what shipped.
  newLevel() {
    this.askNewLevel(false);
    this.clearAll();
    this.loadDef(blankLevelDef(this.levelNumber));
    this.showStatusMessage(`NEW LEVEL ${this.levelNumber} - EMPTY`);
  }

  clearAll() {
    for (const block of this.blocks.values()) block.destroy();
    this.blocks.clear();
    for (const ball of this.balls.values()) ball.sprite.destroy();
    this.balls.clear();
    for (const ladder of this.ladders.values()) ladder.sprite.destroy();
    this.ladders.clear();
    this.setPlayerStart(null);
  }

  // The start point is shown with the scene's REAL player rather than a
  // marker of the editor's own: what stands there while editing is exactly
  // what the level will spawn, down to the sprite. Passing null clears the
  // level's own start, and the player then stands where the default puts
  // them -- so the fallback is on screen too, not just implied.
  setPlayerStart(spawn) {
    this.playerStart = spawn ? clampPlayerSpawn(spawn.x, spawn.y) : null;
    this.applyPlayerStart();
  }

  applyPlayerStart() {
    this.scene.player.reset(this.playerStart || DEFAULT_PLAYER_SPAWN);
  }

  // Whether a grid cell is the one the start point stands in -- the cell
  // holding the point just above the feet line, on the player's centre.
  // That single cell is what erasing the start reacts to: the sprite is
  // four cells tall, and erasing a block up by its head should not take
  // the spawn point with it.
  startCellAt(x, y) {
    if (!this.playerStart) return false;
    const { x: px, y: py } = this.playerStart;
    return px >= x && px < x + OBSTACLE_BLOCK_SIZE && py > y && py <= y + OBSTACLE_BLOCK_SIZE;
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

  // A ladder is placed whole, keyed by its top-left cell, and clamped so
  // the WHOLE element stays inside the playfield -- the grid snap only
  // guarantees that for the one cell under the cursor, and a ladder is six
  // of them tall. It is deliberately allowed to overlap obstacles: a
  // ladder running past (and through) a platform is the point of it.
  setLadder(x, y, type) {
    const { width, height } = LADDER_TYPES[type];
    const lx = Math.min(x, VIRTUAL_W - BORDER_THICKNESS - width);
    const ly = Math.min(Math.max(y, BORDER_THICKNESS), GROUND_Y - height);
    const key = this.keyFor(lx, ly);
    const existing = this.ladders.get(key);
    if (existing) existing.sprite.destroy();
    const sprite = new Ladder(this.scene, type, lx, ly);
    this.scene.ladders.add(sprite);
    this.ladders.set(key, { type, x: lx, y: ly, sprite });
  }

  // Which ladder covers a grid cell, if any -- a ladder is 3x6 cells, so
  // erasing has to find it from any cell it spans, not just its corner.
  ladderKeyAt(x, y) {
    for (const [key, l] of this.ladders) {
      const { width, height } = LADDER_TYPES[l.type];
      if (x >= l.x && x < l.x + width && y >= l.y && y < l.y + height) return key;
    }
    return null;
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
    const ladderKey = this.ladderKeyAt(x, y);
    if (ladderKey) {
      this.ladders.get(ladderKey).sprite.destroy();
      this.ladders.delete(ladderKey);
    }
    if (this.startCellAt(x, y)) this.setPlayerStart(null);
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
    // Down to GROUND_Y, not GROUND_Y - BORDER_THICKNESS: the bottom border
    // is drawn just PAST the ground line (see GameScene.drawBorder), so
    // the ground itself is the inner face there and the whole bottom row
    // is inside the playfield. Subtracting the border thickness here as
    // well was the other half of why nothing could be placed on the floor.
    if (x < BORDER_THICKNESS || x > VIRTUAL_W - BORDER_THICKNESS || y < BORDER_THICKNESS || y > GROUND_Y) return;

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
    const isLadderBrush = this.brush.startsWith('ladder-');
    const isStartBrush = this.brush === START_BRUSH.id;
    // Whole-element brushes place one per discrete click; only the tiling
    // block brushes paint continuously while the pointer is dragged.
    if ((isBallBrush || isLadderBrush || isStartBrush) && !isDown) return;

    if (this.brush === 'erase') {
      this.eraseAt(snapped.x, snapped.y);
    } else if (isStartBrush) {
      this.setPlayerStart(startFor(snapped));
    } else if (isBallBrush) {
      const [, shape, sizeStr] = this.brush.split('-');
      this.placeBall(x, y, shape, parseInt(sizeStr, 10));
    } else if (isLadderBrush) {
      this.setLadder(snapped.x, snapped.y, this.brush.slice('ladder-'.length));
    } else {
      this.placeBlock(snapped.x, snapped.y, this.brush);
    }
  }

  render() {
    this.cursorGraphics.clear();
    if (this.scene.state !== GAME_STATES.EDITOR) return;
    // Before the cursor check: the counts belong on screen from the
    // moment the editor opens, not only once the pointer has been over
    // the canvas at least once.
    this.updateStatus();
    if (!this.hoverCell) return;
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
    } else if (this.brush.startsWith('ladder-')) {
      const { width, height } = LADDER_TYPES[this.brush.slice('ladder-'.length)];
      this.cursorGraphics.strokeRect(
        Math.min(this.hoverCell.x, VIRTUAL_W - BORDER_THICKNESS - width),
        Math.min(Math.max(this.hoverCell.y, BORDER_THICKNESS), GROUND_Y - height),
        width, height,
      );
    } else if (this.brush === START_BRUSH.id) {
      // The player standing where this click would put them: the same
      // clamp the placement itself applies, so the outline never promises
      // a position the level cannot actually hold.
      const start = startFor(this.hoverCell);
      const { x, y } = clampPlayerSpawn(start.x, start.y);
      this.cursorGraphics.strokeRect(
        x - PLAYER_CONFIG.spriteWidth / 2, y - PLAYER_CONFIG.spriteHeight,
        PLAYER_CONFIG.spriteWidth, PLAYER_CONFIG.spriteHeight,
      );
    }
  }

  updateStatus() {
    if (!this.statusEl) return;
    // A transient message (e.g. an import error) takes over the status
    // line for a few seconds instead of being overwritten on the very
    // next frame by the brush/count line below.
    if (this.statusMessage && performance.now() < this.statusMessageUntil) {
      this.statusEl.textContent = this.statusMessage;
      return;
    }
    this.statusMessage = null;
    // The start counts like everything else here: 1 when this level places
    // one, 0 when it has none and the player starts where the default puts
    // them (see LevelManager's playerSpawn).
    this.statusEl.textContent = `Blocks ${this.blocks.size}  Balls ${this.balls.size}\n`
      + `Ladders ${this.ladders.size}  Start ${this.playerStart ? 1 : 0}`;
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
    // Written over the definition this session opened, so a level's id and
    // name -- and any field a hand-edited file carries that this editor has
    // no control over -- survive being edited and saved. Only what the
    // editor actually owns is replaced.
    const def = {
      id: this.levelNumber,
      name: `Level ${this.levelNumber}`,
      ...this.sourceDef,
      timeLimitSec,
      background: this.background,
      weapon: this.weapon,
      obstacles,
      balls,
    };
    // Both optional keys, and both rewritten from scratch every time: a
    // level that has none keeps the key out of its file entirely (see
    // LevelManager's playerSpawn / loadLevel), and a start or a ladder just
    // erased has to actually leave the file rather than linger from
    // whatever was loaded.
    delete def.playerStart;
    if (this.playerStart) def.playerStart = { ...this.playerStart };
    delete def.ladders;
    const ladders = [...this.ladders.values()].map((l) => ({ type: l.type, x: l.x, y: l.y }));
    if (ladders.length) def.ladders = ladders;
    return def;
  }

  // Saves back to the level this session opened -- the whole point of
  // picking one first. Nothing can write levels/level_NN.json from a
  // browser, so the save is stored under that level's number (see
  // storage's levelEdits) and laid over the shipped file on every boot;
  // Export writes the same definition out as the file itself, for putting
  // the change into the project.
  save() {
    const def = this.buildDef();
    if (!storage.saveLevelEdit(this.levelNumber, def)) {
      this.showStatusMessage('SAVE FAILED - STORAGE FULL?');
      return;
    }
    // Live as well as stored, so playing the level right now -- from here,
    // from Start Level or in the campaign -- uses what was just saved
    // rather than what happened to boot.
    setLevel(this.levelIndex, def);
    this.showStatusMessage(`SAVED ${levelFileKey(this.levelNumber)}`);
  }

  // The way back out of an edit: drop this browser's saved version of the
  // level and put the file the game shipped with back, in storage, in
  // LEVELS and on screen.
  revert() {
    storage.clearLevelEdit(this.levelNumber);
    const shipped = SHIPPED_LEVELS[this.levelIndex];
    if (!shipped) return;
    setLevel(this.levelIndex, shipped);
    this.clearAll();
    this.loadDef(shipped);
    this.showStatusMessage(`REVERTED ${levelFileKey(this.levelNumber)}`);
  }

  // Downloads the level as the file it belongs in: named for the level
  // being edited, so putting an edit into the project is dropping it into
  // levels/ over the old one (or handing it to the admin tool's Levels
  // tab), with nothing to rename or renumber first.
  exportJSON() {
    const blob = new Blob([JSON.stringify(this.buildDef(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${levelFileKey(this.levelNumber)}.json`;
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
      if (!isLevelDef(def)) {
        this.showStatusMessage('IMPORT FAILED: not a level file');
        return;
      }
      this.clearAll();
      this.loadDef(def);
      this.showStatusMessage('IMPORT OK');
    };
    reader.readAsText(file);
  }

  // Playtests what is on screen. Deliberately does NOT save first: the
  // editor is pointed at a real campaign level now, and trying a change
  // out is not the same as committing it -- Save is the only thing that
  // writes. The definition goes to the scene as the editor's draft, so
  // coming back from the playtest resumes these exact edits (see
  // GameScene.returnToEditor/editorDraft).
  play() {
    if (this.balls.size === 0) return; // nothing to pop, refuse to start
    const def = this.buildDef();
    this.scene.editorDraft = def;
    this.disable();
    this.scene.startCustomLevel(def);
  }
}

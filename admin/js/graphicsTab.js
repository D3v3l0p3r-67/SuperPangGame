// Lists every graphic the game loads (see ../js/assets.js) and lets the
// admin replace each one by uploading a new file at the exact same path.
// Which balls/obstacle tiles/power-ups exist is read straight from
// elements/*.json (via elements/index.json) -- same source of truth the
// game itself boots from (see ElementsScene.js) -- so this list can never
// drift out of sync with what the game actually loads.
import * as assets from '../../js/assets.js';
import { WEAPON_TYPES } from '../../js/config.js';
import { el, fetchJSON, rootUrl, statusParagraph } from './util.js';

async function fetchElements() {
  const ids = await fetchJSON(assets.ELEMENTS_INDEX_PATH);
  const results = await Promise.all(ids.map(async (id) => {
    try {
      return await fetchJSON(assets.elementFilePath(id));
    } catch (err) {
      console.error(`Skipping ${id}:`, err);
      return null;
    }
  }));
  return results.filter(Boolean);
}

// Every distinct `background` a levels/level_NN.json actually uses, same
// probing convention levelsTab.js uses (no manifest, just try each slot up
// to MAX_LEVEL_FILES and keep whichever load) -- plus DEFAULT_BACKGROUND
// itself, since the level editor always starts pointed at it even before
// any level names it.
async function fetchBackgroundNames() {
  const names = new Set([assets.DEFAULT_BACKGROUND]);
  for (let n = 1; n <= assets.MAX_LEVEL_FILES; n++) {
    try {
      const level = await fetchJSON(assets.levelFilePath(n));
      if (level.background) names.add(level.background);
    } catch {
      // No file at this slot -- expected past the last level.
    }
  }
  return names;
}

async function buildGraphicList() {
  const elements = await fetchElements();
  const list = [];

  for (const item of elements) {
    if (item.category === 'ball') {
      const spinNote = item.shape === 'hex' ? ` -- ${assets.HEX_SPIN_FRAMES}-frame spin spritesheet` : '';
      list.push({ label: `Ball -- ${item.shape} size ${item.size} (${item.label ?? item.id})${spinNote}`, path: assets.ballTexturePath(item.shape, item.size) });
      list.push({ label: `Ball pop effect -- ${item.shape} size ${item.size} (${assets.BALL_POP_FRAMES}-frame)`, path: assets.ballPopTexturePath(item.shape, item.size) });
    }
  }

  list.push({ label: 'Player spritesheet (idle, shot, 4 walk, victory, dead -- see README)', path: assets.PLAYER_TEXTURE_PATH });
  list.push({ label: `Shield effect (${assets.PLAYER_SHIELD_FRAMES}-frame loop, while the shield power-up is active)`, path: assets.PLAYER_SHIELD_TEXTURE_PATH });

  const tileNames = new Set(elements.filter((item) => item.category === 'obstacle').map((item) => item.tileTexture));
  for (const name of tileNames) {
    list.push({ label: `Obstacle tile -- ${name}`, path: assets.obstacleTexturePath(name) });
  }

  for (const item of elements) {
    if (item.category === 'powerup') {
      list.push({ label: `Power-up icon -- ${item.label} (${item.type})`, path: assets.powerupTexturePath(item.type) });
    }
  }

  list.push({ label: 'Harpoon projectile', path: assets.PROJECTILE_TEXTURE_PATH });
  list.push({ label: 'Burst particle (tinted at runtime -- keep plain white)', path: assets.PARTICLE_TEXTURE_PATH });

  list.push({ label: 'HUD -- score digits (large, 10 frames)', path: assets.HUD_DIGITS_LARGE_PATH });
  list.push({ label: 'HUD -- time/world/hi digits (small, 10 frames)', path: assets.HUD_DIGITS_SMALL_PATH });
  list.push({ label: 'HUD -- "1-P" label', path: assets.HUD_1P_PATH });
  list.push({ label: 'HUD -- "TIME" label', path: assets.HUD_TIME_LABEL_PATH });
  list.push({ label: 'HUD -- "WORLD" label', path: assets.HUD_WORLD_LABEL_PATH });
  list.push({ label: 'HUD -- "HI" label', path: assets.HUD_HI_LABEL_PATH });
  list.push({ label: 'HUD -- life icon', path: assets.HUD_LIFE_PATH });
  list.push({ label: 'HUD -- weapon socket frame', path: assets.HUD_WEAPON_FRAME_PATH });
  for (const type of Object.keys(WEAPON_TYPES)) {
    list.push({ label: `HUD -- weapon icon (${type})`, path: assets.hudWeaponIconPath(type) });
  }

  list.push({ label: 'Menu/level-intro pixel font (A-Z, 0-9, !, :, .)', path: assets.INTRO_FONT_PATH });

  const backgroundNames = await fetchBackgroundNames();
  for (const name of backgroundNames) {
    list.push({ label: `Level background -- ${name}`, path: assets.backgroundTexturePath(name) });
  }

  return list;
}

export async function initGraphicsTab(panel, fs) {
  panel.innerHTML = '<p>Loading graphics list…</p>';
  let list;
  try {
    list = await buildGraphicList();
  } catch (err) {
    panel.innerHTML = `<p class="error">Failed to load elements: ${err.message}</p>`;
    return;
  }

  panel.innerHTML = '';
  panel.append(el('p', { className: 'tab-intro', textContent:
    'Every image file the game loads, straight from elements/*.json + js/assets.js -- upload a replacement (same pixel dimensions as the current file) and Save.' }));

  const grid = document.createElement('div');
  grid.className = 'graphics-grid';
  panel.appendChild(grid);
  for (const item of list) grid.appendChild(buildGraphicCard(item, fs));
}

function buildGraphicCard({ label, path }, fs) {
  const card = document.createElement('div');
  card.className = 'card';

  card.append(el('h3', { textContent: label }));
  card.append(el('code', { textContent: path, className: 'path' }));

  const preview = el('img', { className: 'preview', alt: label, src: `${rootUrl(path)}?t=${Date.now()}` });
  card.append(preview);

  const fileInput = el('input', { type: 'file', accept: 'image/*' });
  card.append(fileInput);

  const status = statusParagraph();

  let pendingFile = null;
  fileInput.addEventListener('change', () => {
    pendingFile = fileInput.files[0] || null;
    if (pendingFile) preview.src = URL.createObjectURL(pendingFile);
    status.textContent = '';
  });

  const saveBtn = el('button', { textContent: 'Save' });
  saveBtn.addEventListener('click', async () => {
    if (!pendingFile) {
      status.textContent = 'Choose a replacement file first.';
      return;
    }
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      const result = await fs.saveFile(path, pendingFile);
      status.textContent = result.savedTo !== 'download' ? 'Saved.' : `Downloaded -- copy it into ${path}.`;
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  });
  card.append(saveBtn, status);

  return card;
}

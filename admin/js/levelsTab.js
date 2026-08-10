// Raw-JSON editor for levels/*.json, in exactly the shape the in-game
// Level Editor's own Export button produces (see ../js/editor.js's
// buildDef() and the root README's "Adding levels"). Levels follow a
// fixed level_NN naming the game itself probes (see ../js/assets.js's
// MAX_LEVEL_FILES) rather than an index file, so this tab probes the
// same way instead of reading a manifest.
import * as assets from '../../js/assets.js';
import { fetchJSON, statusParagraph, labeled } from './util.js';

function el(tag, props) {
  return Object.assign(document.createElement(tag), props);
}

export async function initLevelsTab(panel, fs) {
  panel.innerHTML = '<p>Loading levels…</p>';

  const found = [];
  for (let n = 1; n <= assets.MAX_LEVEL_FILES; n++) {
    try {
      found.push({ n, data: await fetchJSON(assets.levelFilePath(n)) });
    } catch {
      // No file at this slot -- expected once past the last level, same
      // as ElementsScene.js's own probing.
    }
  }

  panel.innerHTML = '';
  panel.append(el('p', { className: 'tab-intro', textContent:
    `One JSON file per level, level_01.json.. -- ${found.length} found. For visual level design, use the game's own in-canvas Level Editor (link below), then import its Export output here.` }));

  const list = document.createElement('div');
  list.className = 'levels-list';
  panel.appendChild(list);
  for (const { n, data } of found) list.appendChild(buildLevelCard(n, data, fs));

  const nextN = found.length > 0 ? Math.max(...found.map((f) => f.n)) + 1 : 1;
  panel.append(buildAddForm(list, fs, nextN), buildImportForm(list, fs));

  const editorLink = el('a', {
    href: '../index.html', target: '_blank',
    textContent: 'Open the in-game Level Editor (design visually, then Export + import the file above) →',
    className: 'editor-link',
  });
  panel.append(editorLink);
}

function buildLevelCard(n, data, fs) {
  const key = assets.levelFileKey(n);
  const card = document.createElement('div');
  card.className = 'card level-card';
  const title = el('h3', { textContent: `${key} -- ${data.name ?? ''}` });
  card.append(title);

  const textarea = el('textarea', { className: 'json-editor', value: JSON.stringify(data, null, 2), spellcheck: false });
  card.append(textarea);

  const status = statusParagraph();
  const saveBtn = el('button', { textContent: 'Save' });
  saveBtn.addEventListener('click', async () => {
    let parsed;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (err) {
      status.textContent = `Invalid JSON: ${err.message}`;
      return;
    }
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      const result = await fs.saveFile(assets.levelFilePath(n), `${JSON.stringify(parsed, null, 2)}\n`);
      status.textContent = result.savedTo === 'disk' ? 'Saved.' : `Downloaded -- copy it into levels/${key}.json.`;
      title.textContent = `${key} -- ${parsed.name ?? ''}`;
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  });
  card.append(saveBtn, status);

  return card;
}

function buildAddForm(list, fs, nextN) {
  const wrap = document.createElement('div');
  wrap.className = 'add-form';
  const key = assets.levelFileKey(nextN);
  wrap.append(el('p', { textContent: `Next free slot: ${key}.json` }));
  const addBtn = el('button', { textContent: 'Add blank level' });
  addBtn.addEventListener('click', () => {
    const template = { id: nextN, name: 'New Level', timeLimitSec: 90, obstacles: [], balls: [] };
    list.appendChild(buildLevelCard(nextN, template, fs));
    wrap.remove();
  });
  wrap.append(addBtn);
  return wrap;
}

function buildImportForm(list, fs) {
  const wrap = document.createElement('div');
  wrap.className = 'add-form';
  wrap.append(el('p', { textContent: 'Import a level JSON exported from the in-game Level Editor:' }));

  const fileInput = el('input', { type: 'file', accept: 'application/json' });
  const status = statusParagraph();
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      status.textContent = `Invalid JSON: ${err.message}`;
      return;
    }
    const n = Number.isInteger(parsed.id) && parsed.id > 0 ? parsed.id : 1;
    list.appendChild(buildLevelCard(n, parsed, fs));
    status.textContent = `Imported as ${assets.levelFileKey(n)} below -- check the slot number, then Save.`;
    fileInput.value = '';
  });
  wrap.append(fileInput, status);
  return wrap;
}

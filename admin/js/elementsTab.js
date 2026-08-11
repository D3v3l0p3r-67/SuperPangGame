// Raw-JSON editor for elements/*.json (see ../js/elements.js's
// registerElement() for the fields each category actually reads).
// Deliberately a plain <textarea> per element rather than bespoke forms
// per category -- levels use the same "edit the JSON directly" approach
// (see levelsTab.js) since both are already meant to be hand-editable
// files (see the root README's "Adding elements"/"Adding levels").
import * as assets from '../../js/assets.js';
import { el, fetchJSON, labeled, statusParagraph } from './util.js';

// One starting point per category, matching registerElement()'s expected
// fields (see ../js/elements.js) -- filled in with the new id and left
// for the admin to actually tune before saving.
const TEMPLATES = {
  ball: {
    id: '', category: 'ball', shape: 'round', size: 1, label: 'New Ball',
    hasGravity: true, gravityAccel: 260, radius: 4, speed: 40,
    bounceVelocity: 221, points: 800, color: '#ff6b6b', highlight: '#ffb3b3',
  },
  obstacle: {
    id: '', category: 'obstacle', type: '', label: 'New Obstacle',
    destructible: true, hitPoints: 1, color: '#8b5a2b', tileTexture: '',
  },
  powerup: {
    id: '', category: 'powerup', type: '', label: 'New Power-up', color: '#ffd23f',
    durationMs: 8000, instant: false, kind: 'freeze_balls', params: {},
    pickupSound: 'itempick',
  },
};

export async function initElementsTab(panel, fs) {
  panel.innerHTML = '<p>Loading elements/index.json…</p>';
  let ids;
  try {
    ids = await fetchJSON(assets.ELEMENTS_INDEX_PATH);
  } catch (err) {
    panel.innerHTML = `<p class="error">Failed to load index: ${err.message}</p>`;
    return;
  }

  panel.innerHTML = '';
  panel.append(el('p', { className: 'tab-intro', textContent:
    'One JSON file per ball size/shape, obstacle type, or power-up -- see the root README\'s "Adding elements" for what each category\'s fields mean. Saving a new id also updates elements/index.json.' }));

  const list = document.createElement('div');
  list.className = 'elements-list';
  panel.appendChild(list);

  const currentIds = [...ids]; // mutated as new elements get their first successful save
  const pageIds = new Set(ids); // every id with a card on the page, saved or not -- guards against adding the same new id twice before saving

  for (const id of ids) {
    let data;
    try {
      data = await fetchJSON(assets.elementFilePath(id));
    } catch (err) {
      list.appendChild(el('div', { className: 'card error', textContent: `${id}: failed to load (${err.message})` }));
      continue;
    }
    list.appendChild(buildElementCard(id, data, fs, currentIds));
  }

  panel.appendChild(buildAddForm(list, fs, currentIds, pageIds));
}

function buildElementCard(id, data, fs, currentIds, { isNew = false } = {}) {
  const card = document.createElement('div');
  card.className = 'card element-card';
  const title = el('h3', { textContent: id + (isNew ? ' (not yet saved)' : '') });
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
    if (parsed.id !== id) {
      status.textContent = `"id" must stay "${id}" -- add a new element instead of renaming one in place.`;
      return;
    }
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      await fs.saveFile(assets.elementFilePath(id), `${JSON.stringify(parsed, null, 2)}\n`);
      let msg = 'Saved.';
      if (!currentIds.includes(id)) {
        currentIds.push(id);
        await fs.saveFile(assets.ELEMENTS_INDEX_PATH, `${JSON.stringify(currentIds, null, 2)}\n`);
        msg += ' index.json updated too.';
        title.textContent = id;
      }
      status.textContent = msg;
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveBtn.disabled = false;
  });
  card.append(saveBtn, status);

  return card;
}

function buildAddForm(list, fs, currentIds, pageIds) {
  const wrap = document.createElement('div');
  wrap.className = 'add-form';

  const idInput = el('input', { placeholder: 'new-element-id' });
  const categorySelect = document.createElement('select');
  for (const c of Object.keys(TEMPLATES)) categorySelect.append(el('option', { value: c, textContent: c }));

  const addBtn = el('button', { textContent: 'Add new element' });
  const status = statusParagraph();

  addBtn.addEventListener('click', () => {
    const id = idInput.value.trim();
    if (!id) {
      status.textContent = 'Enter an id first.';
      return;
    }
    if (pageIds.has(id)) {
      status.textContent = 'An element with that id already exists.';
      return;
    }
    pageIds.add(id);
    const template = { ...TEMPLATES[categorySelect.value], id };
    list.appendChild(buildElementCard(id, template, fs, currentIds, { isNew: true }));
    status.textContent = 'Added below -- edit its fields, then click that card\'s Save.';
    idInput.value = '';
  });

  wrap.append(labeled('New element id', idInput), labeled('Category', categorySelect), addBtn, status);
  return wrap;
}

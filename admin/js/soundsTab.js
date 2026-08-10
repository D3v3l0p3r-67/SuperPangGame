// Edits assets/audio/audio.json (see ../js/audio.js's AudioManager) and
// lets the admin replace each sound's .ogg file. All 17+ sounds share one
// config file, so field edits accumulate in memory and are written back
// as a single audio.json via "Save audio.json" -- swapping a sound's
// actual file is a separate per-card action, matching how the two are
// already independent in AUDIO_CONFIG (a file path vs its playback
// settings).
import * as assets from '../../js/assets.js';
import { el, fetchJSON, labeled, rootUrl, statusParagraph } from './util.js';

export async function initSoundsTab(panel, fs) {
  panel.innerHTML = '<p>Loading audio.json…</p>';
  let config;
  try {
    config = await fetchJSON(assets.AUDIO_CONFIG_PATH);
  } catch (err) {
    panel.innerHTML = `<p class="error">Failed to load: ${err.message}</p>`;
    return;
  }

  panel.innerHTML = '';
  panel.append(el('p', { className: 'tab-intro', textContent:
    'Every sound the game can play, from assets/audio/audio.json. Edit a sound\'s settings here (kept in memory until you click "Save audio.json" below), or replace its .ogg file directly.' }));

  const list = document.createElement('div');
  list.className = 'sounds-list';
  panel.appendChild(list);
  for (const [name, cfg] of Object.entries(config)) {
    list.appendChild(buildSoundCard(name, cfg, fs));
  }

  const saveConfigBtn = el('button', { textContent: 'Save audio.json (all sound settings)', className: 'save-all' });
  const configStatus = statusParagraph();
  saveConfigBtn.addEventListener('click', async () => {
    saveConfigBtn.disabled = true;
    configStatus.textContent = 'Saving…';
    try {
      const result = await fs.saveFile(assets.AUDIO_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
      configStatus.textContent = result.savedTo !== 'download' ? 'Saved.' : 'Downloaded audio.json -- copy it into assets/audio/.';
    } catch (err) {
      configStatus.textContent = `Save failed: ${err.message}`;
    }
    saveConfigBtn.disabled = false;
  });
  panel.append(saveConfigBtn, configStatus);
}

function buildSoundCard(name, cfg, fs) {
  const card = document.createElement('div');
  card.className = 'card';
  card.append(el('h3', { textContent: name }));

  const audioEl = el('audio', { controls: true, src: `${rootUrl(assets.audioPath(cfg.file))}?t=${Date.now()}` });
  card.append(audioEl);

  const form = document.createElement('div');
  form.className = 'sound-form';

  const categorySelect = document.createElement('select');
  for (const c of ['music', 'sfx', 'ui']) {
    categorySelect.append(el('option', { value: c, textContent: c, selected: c === cfg.category }));
  }
  categorySelect.addEventListener('change', () => { cfg.category = categorySelect.value; });
  form.append(labeled('Category', categorySelect));

  const modeSelect = document.createElement('select');
  for (const m of ['once', 'loop']) {
    modeSelect.append(el('option', { value: m, textContent: m, selected: m === cfg.mode }));
  }
  modeSelect.addEventListener('change', () => { cfg.mode = modeSelect.value; });
  form.append(labeled('Mode', modeSelect));

  const volumeInput = el('input', { type: 'number', min: '0', max: '1', step: '0.05', value: cfg.volume });
  volumeInput.addEventListener('input', () => { cfg.volume = parseFloat(volumeInput.value) || 0; });
  form.append(labeled('Volume', volumeInput));

  const overlapInput = el('input', { type: 'checkbox', checked: !!cfg.overlap });
  overlapInput.addEventListener('change', () => { cfg.overlap = overlapInput.checked; });
  form.append(labeled('Can overlap itself', overlapInput));

  const maxDurInput = el('input', { type: 'number', min: '0', step: '50', placeholder: 'none', value: cfg.maxDurationMs ?? '' });
  maxDurInput.addEventListener('input', () => {
    const v = parseInt(maxDurInput.value, 10);
    if (Number.isFinite(v) && v > 0) cfg.maxDurationMs = v;
    else delete cfg.maxDurationMs;
  });
  form.append(labeled('Max duration (ms)', maxDurInput));

  card.append(form);

  const fileRow = document.createElement('div');
  const fileInput = el('input', { type: 'file', accept: 'audio/*' });
  const status = statusParagraph();

  let pendingFile = null;
  fileInput.addEventListener('change', () => {
    pendingFile = fileInput.files[0] || null;
    if (pendingFile) audioEl.src = URL.createObjectURL(pendingFile);
    status.textContent = '';
  });

  const saveFileBtn = el('button', { textContent: 'Save audio file' });
  saveFileBtn.addEventListener('click', async () => {
    if (!pendingFile) {
      status.textContent = 'Choose a replacement file first.';
      return;
    }
    saveFileBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      const path = assets.audioPath(cfg.file);
      const result = await fs.saveFile(path, pendingFile);
      status.textContent = result.savedTo !== 'download' ? 'Saved.' : `Downloaded -- copy it into ${path}.`;
    } catch (err) {
      status.textContent = `Save failed: ${err.message}`;
    }
    saveFileBtn.disabled = false;
  });

  fileRow.append(fileInput, saveFileBtn);
  card.append(fileRow, status);

  return card;
}

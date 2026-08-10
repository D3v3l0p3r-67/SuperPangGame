import * as fs from './fsSave.js';
import { initGraphicsTab } from './graphicsTab.js';
import { initSoundsTab } from './soundsTab.js';
import { initElementsTab } from './elementsTab.js';
import { initLevelsTab } from './levelsTab.js';

// Login is a real server-side gate now (see includes/auth.php) -- this
// page only ever renders once index.php has already confirmed a valid
// session, so there's no client-side login screen to wire up here
// anymore. "Log out" is a plain link to logout.php.

// -- Project folder connection (see fsSave.js) --------------------------
//
// Saves go straight to the server via save.php now (see fsSave.js) --
// picking a local project folder here is only a fallback, for whenever
// the server save fails (e.g. the web server user can't write to the
// project folder) or the admin would rather save to a local checkout
// instead.

const fsStatusText = document.getElementById('fs-status-text');
const pickFolderBtn = document.getElementById('btn-pick-folder');

function refreshFsStatus() {
  if (!fs.hasFsAccess()) {
    fsStatusText.textContent = 'Saves go to the server. (This browser also can\'t use a local folder as a fallback -- needs Chrome/Edge for that.)';
    pickFolderBtn.classList.add('hidden');
  } else if (fs.isConnected()) {
    fsStatusText.textContent = `Saves go to the server, falling back to "${fs.connectedName()}" if that fails.`;
  } else {
    fsStatusText.textContent = 'Saves go to the server.';
  }
}
refreshFsStatus();

pickFolderBtn.addEventListener('click', async () => {
  try {
    await fs.pickProjectRoot();
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  }
  refreshFsStatus();
});

// -- Tabs -----------------------------------------------------------------

const tabButtons = [...document.querySelectorAll('.tab-btn')];
const tabPanels = {
  graphics: document.getElementById('tab-graphics'),
  sounds: document.getElementById('tab-sounds'),
  elements: document.getElementById('tab-elements'),
  levels: document.getElementById('tab-levels'),
};
const tabInitializers = {
  graphics: initGraphicsTab,
  sounds: initSoundsTab,
  elements: initElementsTab,
  levels: initLevelsTab,
};
const loadedTabs = new Set();

function openTab(name) {
  for (const btn of tabButtons) btn.classList.toggle('active', btn.dataset.tab === name);
  for (const [tabName, panel] of Object.entries(tabPanels)) panel.classList.toggle('hidden', tabName !== name);
  // Each tab loads its data lazily, the first time it's opened, rather
  // than all four firing a burst of fetches before the admin has even
  // logged in / picked a screen to look at.
  if (!loadedTabs.has(name)) {
    loadedTabs.add(name);
    tabInitializers[name](tabPanels[name], fs);
  }
}

for (const btn of tabButtons) {
  btn.addEventListener('click', () => openTab(btn.dataset.tab));
}

openTab('graphics');

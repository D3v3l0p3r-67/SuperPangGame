import { checkLogin, isLoggedIn, setLoggedIn } from './auth.js';
import * as fs from './fsSave.js';
import { initGraphicsTab } from './graphicsTab.js';
import { initSoundsTab } from './soundsTab.js';
import { initElementsTab } from './elementsTab.js';
import { initLevelsTab } from './levelsTab.js';

const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

function showApp() {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
}

function showLogin() {
  app.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  document.getElementById('login-pass').value = '';
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (checkLogin(user, pass)) {
    setLoggedIn(true);
    loginError.classList.add('hidden');
    showApp();
    openTab('graphics');
  } else {
    loginError.textContent = 'Invalid username or password.';
    loginError.classList.remove('hidden');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  setLoggedIn(false);
  showLogin();
});

// -- Project folder connection (see fsSave.js) --------------------------

const fsStatusText = document.getElementById('fs-status-text');
const pickFolderBtn = document.getElementById('btn-pick-folder');

function refreshFsStatus() {
  if (!fs.hasFsAccess()) {
    fsStatusText.textContent = "This browser can't save files directly (needs Chrome/Edge) -- every Save will download instead.";
    pickFolderBtn.classList.add('hidden');
  } else if (fs.isConnected()) {
    fsStatusText.textContent = `Connected to "${fs.connectedName()}" -- saves write straight to disk.`;
  } else {
    fsStatusText.textContent = 'No project folder selected -- saves will download instead.';
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

if (isLoggedIn()) {
  showApp();
  openTab('graphics');
}

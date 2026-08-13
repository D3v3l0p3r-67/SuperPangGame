import { GAME_STATES, COLORS, ZOOM_FIT } from './constants.js';
import { LEVELS } from './LevelManager.js';
import { setPixelText } from './PixelText.js';
import { getZoom, setZoom, watchViewport } from './DisplayZoom.js';
import { isMobileDevice } from './input.js';
import { ACTIONS, SLOTS, getBindings, setBinding, resetBindings, keyLabel, captureNextKey } from './keys.js';

// zoom value -> the settings-row button that selects it (see ELEMENT_IDS/
// bindEvents/updateZoomButtons below).
// zoom value -> the settings-row button that selects it. Keyed by the
// value as a STRING, because one of them is not a number (see
// constants.js's ZOOM_FIT) and object keys are strings regardless.
const ZOOM_BUTTON_IDS = { 0.5: 'btn-zoom-half', 1: 'btn-zoom-1x', 2: 'btn-zoom-2x', [ZOOM_FIT]: 'btn-zoom-fit' };

const SCREEN_IDS = {
  [GAME_STATES.MENU]: 'screen-menu',
  [GAME_STATES.OPTIONS]: 'screen-options',
  [GAME_STATES.KEY_CONFIG]: 'screen-keys',
  [GAME_STATES.LEVEL_SELECT]: 'screen-level-select',
  [GAME_STATES.PAUSED]: 'screen-pause',
  [GAME_STATES.GAME_OVER]: 'screen-game-over',
  [GAME_STATES.HIGH_SCORE_ENTRY]: 'screen-high-score-entry',
  [GAME_STATES.HIGH_SCORE_TABLE]: 'screen-high-scores',
  [GAME_STATES.VICTORY]: 'screen-victory',
};

const ELEMENT_IDS = [
  'screen-menu', 'game-title-line1', 'game-title-line2',
  'screen-options', 'options-title', 'chk-mute-label', 'rng-sfx-label', 'rng-music-label',
  'zoom-label', 'btn-zoom-half', 'btn-zoom-1x', 'btn-zoom-2x', 'btn-zoom-fit',
  'screen-keys', 'keys-title', 'keys-list', 'keys-hint', 'btn-keys-reset', 'btn-close-keys',
  'screen-level-select', 'level-select-title', 'level-select-list',
  'screen-pause', 'pause-title',
  'screen-game-over', 'gameover-title', 'final-score',
  'screen-victory', 'victory-title', 'victory-score',
  'screen-high-score-entry', 'entry-title', 'entry-score', 'entry-name',
  'screen-high-scores', 'highscores-title', 'high-score-list',
  'touch-controls',
  'btn-start', 'btn-start-panic', 'btn-start-level', 'btn-editor', 'btn-highscores', 'btn-options',
  'btn-controls', 'btn-options-fullscreen', 'btn-close-options', 'btn-close-level-select', 'btn-fullscreen-pause',
  'btn-resume', 'btn-pause-restart', 'btn-pause-editor', 'btn-quit', 'btn-restart', 'btn-menu', 'btn-victory-restart', 'btn-victory-menu',
  'btn-submit-score', 'btn-close-highscores', 'chk-mute', 'rng-sfx', 'rng-music',
];

// Every static label in the UI, rendered once at startup (see setupPixelLabels())
// through the same bitmap font the HUD/level-intro screen use (see
// PixelText.js) -- kept as one table instead of scattered setPixelText()
// calls so every screen's wording lives in one place, same spirit as
// SCREEN_IDS above.
const STATIC_LABELS = [
  ['game-title-line1', 'BALLOON', 'h1', COLORS.accent],
  ['game-title-line2', 'BUSTER', 'h1', COLORS.accent],
  ['options-title', 'OPTIONS', 'h2', COLORS.accent],
  ['chk-mute-label', 'MUTE', 'body', COLORS.text],
  ['rng-sfx-label', 'SFX', 'body', COLORS.text],
  ['rng-music-label', 'MUSIC', 'body', COLORS.text],
  ['zoom-label', 'SIZE', 'body', COLORS.text],
  ['btn-zoom-half', '0.5X', 'button', COLORS.text],
  ['btn-zoom-1x', '1X', 'button', COLORS.text],
  ['btn-zoom-2x', '2X', 'button', COLORS.text],
  ['btn-zoom-fit', 'FIT', 'button', COLORS.text],
  ['keys-title', 'CONTROLS', 'h2', COLORS.accent],
  ['btn-controls', 'CONTROLS', 'button', COLORS.text],
  ['btn-keys-reset', 'RESET TO DEFAULTS', 'button', COLORS.text],
  ['btn-close-keys', 'BACK', 'button', COLORS.text],
  ['level-select-title', 'START LEVEL', 'h2', COLORS.accent],
  ['pause-title', 'PAUSED', 'h2', COLORS.accent],
  ['gameover-title', 'GAME OVER', 'h2', COLORS.accent],
  ['victory-title', 'YOU WIN!', 'h2', COLORS.accent],
  ['entry-title', 'NEW HIGH SCORE!', 'h2', COLORS.accent],
  ['highscores-title', 'HIGH SCORES', 'h2', COLORS.accent],
  ['btn-start', 'START CAMPAIGN', 'button', COLORS.text],
  ['btn-start-panic', 'START PANIC MODE', 'button', COLORS.text],
  ['btn-start-level', 'START LEVEL', 'button', COLORS.text],
  ['btn-editor', 'LEVEL EDITOR', 'button', COLORS.text],
  ['btn-highscores', 'HIGH SCORES', 'button', COLORS.text],
  ['btn-options', 'OPTIONS', 'button', COLORS.text],
  ['btn-options-fullscreen', 'FULLSCREEN', 'button', COLORS.text],
  ['btn-close-options', 'BACK', 'button', COLORS.text],
  ['btn-close-level-select', 'BACK', 'button', COLORS.text],
  ['btn-fullscreen-pause', 'FULLSCREEN', 'button', COLORS.text],
  ['btn-resume', 'RESUME', 'button', COLORS.text],
  ['btn-pause-restart', 'RESTART LEVEL', 'button', COLORS.text],
  ['btn-pause-editor', 'LEVEL EDITOR', 'button', COLORS.text],
  ['btn-quit', 'QUIT TO MENU', 'button', COLORS.text],
  ['btn-restart', 'PLAY AGAIN', 'button', COLORS.text],
  ['btn-menu', 'MAIN MENU', 'button', COLORS.text],
  ['btn-victory-restart', 'PLAY AGAIN', 'button', COLORS.text],
  ['btn-victory-menu', 'MAIN MENU', 'button', COLORS.text],
  ['btn-submit-score', 'SUBMIT', 'button', COLORS.text],
  ['btn-close-highscores', 'BACK', 'button', COLORS.text],
];

export function toggleFullscreen() {
  const container = document.getElementById('game-container');
  const requestFs = container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen;
  const exitFs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (!document.fullscreenElement) {
    requestFs?.call(container);
  } else {
    exitFs?.call(document);
  }
}

export class UI {
  constructor(game, audio, storageModule) {
    this.game = game;
    this.audio = audio;
    this.storage = storageModule;
    this.lastState = null;
    this.el = {};
    for (const id of ELEMENT_IDS) this.el[id] = document.getElementById(id);

    // Browsers only let a genuine user-activation gesture (click/tap/
    // keydown) unlock WebAudio -- a hover is never sufficient, no matter
    // how bindMenuSfx() below calls resumeContext() on mouseover, so
    // nothing plays on hover until *some* qualifying gesture has happened
    // anywhere on the page, however unrelated to an actual menu button.
    // Listened for once, as early and broadly as possible (document-wide,
    // capture phase -- not scoped to #ui-layer or to buttons at all), so
    // audio unlocks the instant the very first click/tap/key happens
    // rather than only once the user happens to click a specific button.
    document.addEventListener('pointerdown', () => this.audio.resumeContext(), { once: true, capture: true });
    document.addEventListener('keydown', () => this.audio.resumeContext(), { once: true, capture: true });

    this.bindEvents();
    this.bindMenuSfx();
    this.applySettingsToControls();
    this.setupPixelLabels();
  }

  // Every static heading/button/settings-row label goes through the same
  // bitmap font the HUD/level-intro screen use (see PixelText.js), so
  // this menu chrome actually looks like it belongs to the same game --
  // only the live-editable initials input stays plain CSS text.
  setupPixelLabels() {
    for (const [id, text, tier, color] of STATIC_LABELS) {
      setPixelText(this.el[id], text, tier, color);
    }
  }

  bindEvents() {
    const startGame = () => {
      this.audio.resumeContext();
      this.game.startNewGame();
    };
    // "Play Again" after a run ends replays whatever mode just ended --
    // isPanicMode is still whatever that run left it as (only beginRun()
    // ever changes it, see GameScene.js) -- while btn-start itself always
    // means "start the campaign", regardless of what was last played.
    const playAgain = () => {
      this.audio.resumeContext();
      if (this.game.isPanicMode) this.game.startPanicMode();
      else this.game.startNewGame();
    };

    this.el['btn-start'].addEventListener('click', startGame);
    this.el['btn-restart'].addEventListener('click', playAgain);
    this.el['btn-victory-restart'].addEventListener('click', playAgain);

    this.el['btn-start-panic'].addEventListener('click', () => {
      this.audio.resumeContext();
      this.game.startPanicMode();
    });

    // Editing starts by picking WHICH level to edit -- the same list as
    // Start Level, in its 'edit' mode (see renderLevelSelect).
    this.el['btn-editor'].addEventListener('click', () => {
      this.audio.resumeContext();
      this.game.showLevelSelect('edit');
    });

    this.el['btn-highscores'].addEventListener('click', () => this.game.showHighScores());
    this.el['btn-close-highscores'].addEventListener('click', () => this.game.goToMenu());

    this.el['btn-options'].addEventListener('click', () => this.game.showOptions());
    this.el['btn-close-options'].addEventListener('click', () => this.game.goToMenu());
    this.el['btn-options-fullscreen'].addEventListener('click', toggleFullscreen);
    this.el['btn-fullscreen-pause'].addEventListener('click', toggleFullscreen);

    this.el['btn-start-level'].addEventListener('click', () => this.game.showLevelSelect());
    this.el['btn-close-level-select'].addEventListener('click', () => this.game.goToMenu());

    this.el['btn-resume'].addEventListener('click', () => this.game.resume());
    this.el['btn-pause-restart'].addEventListener('click', () => this.game.restartLevel());
    this.el['btn-pause-editor'].addEventListener('click', () => this.game.returnToEditor());
    this.el['btn-quit'].addEventListener('click', () => this.game.goToMenu());
    this.el['btn-menu'].addEventListener('click', () => this.game.goToMenu());
    this.el['btn-victory-menu'].addEventListener('click', () => this.game.goToMenu());

    this.el['btn-submit-score'].addEventListener('click', () => this.submitScore());
    this.el['entry-name'].addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitScore();
    });

    this.el['chk-mute'].addEventListener('change', (e) => {
      this.audio.setMuted(e.target.checked);
      this.storage.saveSettings({ muted: e.target.checked });
    });
    this.el['rng-sfx'].addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.audio.setSfxVolume(v);
      this.storage.saveSettings({ sfxVolume: v });
    });
    this.el['rng-music'].addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.audio.setMusicVolume(v);
      this.storage.saveSettings({ musicVolume: v });
    });

    // One of the values is a word, the rest are numbers (see ZOOM_FIT),
    // so the key is only parsed as a number when it actually is one.
    for (const [zoom, id] of Object.entries(ZOOM_BUTTON_IDS)) {
      this.el[id].addEventListener('click', () => {
        setZoom(zoom === ZOOM_FIT ? ZOOM_FIT : parseFloat(zoom));
        this.updateZoomButtons();
      });
    }
    // A fitted canvas follows the window from here on (a fixed one has
    // nothing to follow) -- see DisplayZoom.watchViewport.
    watchViewport();

    this.el['btn-controls'].addEventListener('click', () => this.game.showKeyConfig());
    this.el['btn-close-keys'].addEventListener('click', () => this.game.showOptions());
    this.el['btn-keys-reset'].addEventListener('click', () => {
      resetBindings();
      this.renderKeyList();
    });
  }

  // One row per action, with a button per slot showing what that slot is
  // bound to. Rebuilt from the bindings themselves every time rather than
  // patched in place, so what is on screen is always what keys.js would
  // actually answer with.
  renderKeyList() {
    const list = this.el['keys-list'];
    list.innerHTML = '';
    this.cancelKeyCapture?.();
    this.cancelKeyCapture = null;
    const bindings = getBindings();
    for (const { id, label } of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'keys-row';
      const name = document.createElement('span');
      setPixelText(name, label, 'body', COLORS.text);
      row.appendChild(name);
      for (let slot = 0; slot < SLOTS; slot++) {
        const btn = document.createElement('button');
        btn.className = 'menu-btn key-btn';
        setPixelText(btn, keyLabel(bindings[id][slot]), 'button', COLORS.text);
        btn.addEventListener('click', () => this.beginKeyCapture(id, slot, btn));
        row.appendChild(btn);
      }
      list.appendChild(row);
    }
    setPixelText(this.el['keys-hint'], 'CLICK A KEY THEN PRESS ONE. ESC CANCELS.', 'body', COLORS.text);
  }

  // Asks keys.js for the next key pressed and gives it to this slot. Only
  // one capture can be open at a time -- starting another cancels the
  // first, so two half-armed buttons can never both be waiting.
  beginKeyCapture(action, slot, btn) {
    this.cancelKeyCapture?.();
    setPixelText(btn, 'PRESS KEY', 'button', COLORS.accent);
    this.cancelKeyCapture = captureNextKey((code) => {
      this.cancelKeyCapture = null;
      // null means the player pressed Escape to cancel; the binding is
      // left exactly as it was.
      if (code) setBinding(action, slot, code);
      this.renderKeyList();
    });
  }

  // A short hover/click blip on every menu button (main menu, pause,
  // level select, ...), including the level-select/high-score rows built
  // dynamically in renderLevelSelect()/renderHighScores() -- delegated
  // from #ui-layer once here instead of wiring each button individually,
  // so a screen that builds new buttons later still gets it for free.
  // Touch controls are deliberately excluded: they're in-game controls,
  // not menu navigation, and don't have a "hover" concept anyway.
  //
  // mouseover (not mouseenter/pointerenter) is used because it bubbles,
  // which is what makes delegation possible at all -- lastHoverBtn tracks
  // the currently-hovered button so moving the pointer around inside the
  // same button (over its inner pixel-text canvas, say) doesn't retrigger
  // the sound on every sub-element crossed.
  bindMenuSfx() {
    const uiLayer = document.getElementById('ui-layer');
    let lastHoverBtn = null;
    uiLayer.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('button:not(.touch-btn)');
      if (!btn || btn.disabled) { lastHoverBtn = null; return; }
      if (btn === lastHoverBtn) return;
      lastHoverBtn = btn;
      this.audio.resumeContext();
      this.audio.play('uihover');
    });
    uiLayer.addEventListener('click', (e) => {
      const btn = e.target.closest('button:not(.touch-btn)');
      if (!btn || btn.disabled) return;
      this.audio.resumeContext();
      this.audio.play('uiclick');
    });
  }

  applySettingsToControls() {
    const s = this.storage.loadSettings();
    this.el['chk-mute'].checked = s.muted;
    this.el['rng-sfx'].value = s.sfxVolume;
    this.el['rng-music'].value = s.musicVolume;
    this.updateZoomButtons();
  }

  // Highlights whichever of the three zoom buttons matches the currently
  // applied display size (see DisplayZoom.js) -- re-run on every options
  // load and every click, same pattern as the mute checkbox/volume
  // sliders above just without a native control of its own to reflect
  // state through.
  updateZoomButtons() {
    const zoom = getZoom();
    for (const [z, id] of Object.entries(ZOOM_BUTTON_IDS)) {
      this.el[id].classList.toggle('active', z === String(zoom));
    }
  }

  submitScore() {
    const raw = (this.el['entry-name'].value || 'AAA').toUpperCase().slice(0, 3);
    this.game.submitHighScore(raw || 'AAA');
  }

  // Phones only (see input.js's isMobileDevice) -- this used to key off
  // `(pointer: coarse)`, which also matches touchscreen laptops and
  // desktops with a touch monitor, where a keyboard is right there and
  // the overlay is just clutter sitting on top of the playfield.
  showTouchControlsIfNeeded() {
    if (isMobileDevice()) this.el['touch-controls'].classList.remove('hidden');
  }

  // On a phone the browser's own chrome eats a lot of an already small
  // screen, so landscape (the orientation this game is actually shaped
  // for -- the playfield is 800x500) goes fullscreen by default.
  //
  // It can't simply be requested on load: the Fullscreen API only honours
  // a request made during a user gesture, so this arms one-shot gesture
  // listeners instead and fires on whatever the player touches first. The
  // same arming re-runs on every rotation into landscape, so turning the
  // phone sideways mid-session still gets there on the next touch, and
  // any rejected request is swallowed rather than surfacing as an
  // unhandled promise (a request can still be refused, e.g. if the
  // gesture doesn't qualify).
  setupMobileFullscreen() {
    if (!isMobileDevice()) return;

    const isLandscape = () => (window.matchMedia
      ? window.matchMedia('(orientation: landscape)').matches
      : window.innerWidth > window.innerHeight);

    const request = () => {
      if (!isLandscape() || document.fullscreenElement) return;
      const container = document.getElementById('game-container');
      const requestFs = container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen;
      try {
        Promise.resolve(requestFs?.call(container)).catch(() => {});
      } catch {
        /* refused -- the manual Fullscreen button in Options/pause still works */
      }
    };

    const armOnce = () => {
      document.addEventListener('pointerdown', request, { once: true, capture: true });
      document.addEventListener('keydown', request, { once: true, capture: true });
    };

    armOnce();
    window.addEventListener('orientationchange', armOnce);
    window.matchMedia?.('(orientation: landscape)').addEventListener?.('change', armOnce);
  }

  render() {
    const g = this.game;
    if (g.state !== this.lastState) {
      this.setScreen(g.state);
      this.lastState = g.state;
    }
  }

  setScreen(state) {
    for (const id of Object.values(SCREEN_IDS)) this.el[id].classList.add('hidden');
    const id = SCREEN_IDS[state];
    if (!id) return;
    this.el[id].classList.remove('hidden');

    if (state === GAME_STATES.PAUSED) {
      // The extra Restart button only shows for a level opened via the
      // editor's Play button (jump straight back into testing the level
      // you're actively building -- see GameScene.advanceLevel/hitPlayer
      // for the matching playtest-only behavior) or for Panic Mode (start
      // the difficulty ramp over without spending a life) -- not a general
      // "restart" offered mid-campaign.
      this.el['btn-pause-restart'].classList.toggle('hidden', !this.game.isCustomLevel && !this.game.isPanicMode);
      // Back to editing -- offered whenever this pause came from the
      // editor at all: either Escape pressed while actually editing (
      // pausedFromEditor) or Escape during a playtest of an editor level
      // (isCustomLevel), which is exactly when "return to the editor" is
      // a place you can meaningfully go back to.
      this.el['btn-pause-editor'].classList.toggle('hidden', !this.game.isCustomLevel && !this.game.pausedFromEditor);
    } else if (state === GAME_STATES.GAME_OVER) {
      setPixelText(this.el['final-score'], `FINAL SCORE: ${this.game.score}`, 'body', COLORS.text);
    } else if (state === GAME_STATES.VICTORY) {
      setPixelText(this.el['victory-score'], `SCORE: ${this.game.score}`, 'body', COLORS.text);
    } else if (state === GAME_STATES.HIGH_SCORE_ENTRY) {
      setPixelText(this.el['entry-score'], `SCORE: ${this.game.score}`, 'body', COLORS.text);
      this.el['entry-name'].value = '';
      setTimeout(() => this.el['entry-name'].focus(), 50);
    } else if (state === GAME_STATES.HIGH_SCORE_TABLE) {
      this.renderHighScores();
    } else if (state === GAME_STATES.LEVEL_SELECT) {
      this.renderLevelSelect();
    } else if (state === GAME_STATES.KEY_CONFIG) {
      this.renderKeyList();
    }
  }

  // Rebuilt every time the screen opens (not cached) -- cheap, and picks
  // up a level just unlocked by clearing the one before it, or one just
  // saved in the editor.
  //
  // One screen, two jobs (see GameScene.showLevelSelect): picking a level
  // to PLAY, where progress applies and an unreached level is hidden
  // behind "???", and picking one to EDIT, where it does not -- authoring
  // level 40 shouldn't require playing to it first, and its name is
  // exactly what you need to see to find it.
  renderLevelSelect() {
    const list = this.el['level-select-list'];
    list.innerHTML = '';
    const editing = this.game.levelSelectMode === 'edit';
    const edits = this.storage.loadLevelEdits();
    setPixelText(this.el['level-select-title'], editing ? 'EDIT LEVEL' : 'START LEVEL', 'h2', COLORS.accent);
    const progress = this.storage.loadProgress();
    LEVELS.forEach((def, i) => {
      const unlocked = editing || i < progress.unlockedLevels;
      const btn = document.createElement('button');
      btn.className = 'level-select-btn' + (unlocked ? '' : ' locked');
      const label = unlocked ? `${i + 1}. ${def.name}` : `${i + 1}. ???`;
      // A level this browser has its own saved version of (see storage's
      // levelEdits) is named in the accent color -- the one thing about a
      // level worth knowing before opening it. Marked by color rather than
      // by a symbol next to the name because the pixel font is letters,
      // digits and three punctuation marks (see INTRO_FONT_CHARS): there
      // is no star to put there.
      const color = edits[i + 1] ? COLORS.accent : COLORS.text;
      // Dimming for a locked level comes from the .locked CSS class on
      // the button itself (opacity), not a different fill color here.
      setPixelText(btn, label, 'body', color);
      btn.disabled = !unlocked;
      if (unlocked) {
        btn.addEventListener('click', () => {
          this.audio.resumeContext();
          if (editing) this.game.editLevel(i);
          else this.game.startAtLevel(i);
        });
      }
      list.appendChild(btn);
    });
  }

  renderHighScores() {
    const scores = this.storage.loadHighScores();
    const list = this.el['high-score-list'];
    list.innerHTML = '';
    if (scores.length === 0) {
      const li = document.createElement('li');
      setPixelText(li, 'NO SCORES YET', 'body', COLORS.text);
      list.appendChild(li);
      return;
    }
    scores.forEach((entry, i) => {
      const li = document.createElement('li');
      const isNew = this.game.justSubmittedEntry && entry.id === this.game.justSubmittedEntry.id;
      const color = isNew ? COLORS.accent : COLORS.text;
      // Two separate canvases (rank+name, score) rather than one string,
      // so the li's flex justify-content:space-between still pushes the
      // score to the right edge like the old single-line text did. Rank
      // is padded to a fixed 2-digit width (a leading space for 1-9) so
      // every row's rank+name canvas is exactly as wide as "10. XXX" --
      // without this, rows 1-9 render narrower than row 10 and end up
      // with a visibly bigger gap before the score than row 10 gets
      // (which can shrink to nothing at small canvas scales).
      const rankName = document.createElement('span');
      setPixelText(rankName, `${String(i + 1).padStart(2, ' ')}. ${entry.name}`, 'body', color);
      const score = document.createElement('span');
      setPixelText(score, String(entry.score), 'body', color);
      li.append(rankName, score);
      list.appendChild(li);
    });
  }
}

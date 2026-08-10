import { GAME_STATES, COLORS } from './constants.js';
import { POWERUP_TYPES } from './elements.js';
import { LEVELS } from './LevelManager.js';
import { setPixelText } from './PixelText.js';

const SCREEN_IDS = {
  [GAME_STATES.MENU]: 'screen-menu',
  [GAME_STATES.OPTIONS]: 'screen-options',
  [GAME_STATES.LEVEL_SELECT]: 'screen-level-select',
  [GAME_STATES.PAUSED]: 'screen-pause',
  [GAME_STATES.GAME_OVER]: 'screen-game-over',
  [GAME_STATES.HIGH_SCORE_ENTRY]: 'screen-high-score-entry',
  [GAME_STATES.HIGH_SCORE_TABLE]: 'screen-high-scores',
  [GAME_STATES.VICTORY]: 'screen-victory',
};

// The always-visible stat bar and the level-intro screen are graphic now
// (see Hud.js / LevelIntro.js, drawn in Phaser) -- this set is only used
// here to show/hide the DOM powerup-timer chips, which stay in-play only.
const HUD_VISIBLE_STATES = new Set([
  GAME_STATES.PLAYING,
  GAME_STATES.PAUSED,
  GAME_STATES.LEVEL_INTRO,
  GAME_STATES.LEVEL_CLEAR,
  GAME_STATES.HIT_FREEZE,
]);

const ELEMENT_IDS = [
  'powerup-indicators',
  'screen-menu', 'game-title-line1', 'game-title-line2',
  'screen-options', 'options-title', 'chk-mute-label', 'rng-sfx-label', 'rng-music-label',
  'screen-level-select', 'level-select-title', 'level-select-list',
  'screen-pause', 'pause-title',
  'screen-game-over', 'gameover-title', 'final-score',
  'screen-victory', 'victory-title', 'victory-score',
  'screen-high-score-entry', 'entry-title', 'entry-score', 'entry-name',
  'screen-high-scores', 'highscores-title', 'high-score-list',
  'touch-controls',
  'btn-start', 'btn-start-level', 'btn-editor', 'btn-highscores', 'btn-options',
  'btn-options-fullscreen', 'btn-close-options', 'btn-close-level-select', 'btn-fullscreen-pause',
  'btn-resume', 'btn-quit', 'btn-restart', 'btn-menu', 'btn-victory-restart', 'btn-victory-menu',
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
  ['level-select-title', 'START LEVEL', 'h2', COLORS.accent],
  ['pause-title', 'PAUSED', 'h2', COLORS.accent],
  ['gameover-title', 'GAME OVER', 'h2', COLORS.accent],
  ['victory-title', 'YOU WIN!', 'h2', COLORS.accent],
  ['entry-title', 'NEW HIGH SCORE!', 'h2', COLORS.accent],
  ['highscores-title', 'HIGH SCORES', 'h2', COLORS.accent],
  ['btn-start', 'START CAMPAIGN', 'button', COLORS.text],
  ['btn-start-level', 'START LEVEL', 'button', COLORS.text],
  ['btn-editor', 'LEVEL EDITOR', 'button', COLORS.text],
  ['btn-highscores', 'HIGH SCORES', 'button', COLORS.text],
  ['btn-options', 'OPTIONS', 'button', COLORS.text],
  ['btn-options-fullscreen', 'FULLSCREEN', 'button', COLORS.text],
  ['btn-close-options', 'BACK', 'button', COLORS.text],
  ['btn-close-level-select', 'BACK', 'button', COLORS.text],
  ['btn-fullscreen-pause', 'FULLSCREEN', 'button', COLORS.text],
  ['btn-resume', 'RESUME', 'button', COLORS.text],
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

    this.bindEvents();
    this.applySettingsToControls();
    this.setupPixelLabels();
  }

  // Every static heading/button/settings-row label goes through the same
  // bitmap font the HUD/level-intro screen use (see PixelText.js), so
  // this menu chrome actually looks like it belongs to the same game --
  // only genuinely dynamic per-frame text (the powerup-timer chips) and
  // the live-editable initials input stay plain CSS text.
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

    this.el['btn-start'].addEventListener('click', startGame);
    this.el['btn-restart'].addEventListener('click', startGame);
    this.el['btn-victory-restart'].addEventListener('click', startGame);

    this.el['btn-editor'].addEventListener('click', () => {
      this.audio.resumeContext();
      this.game.enterEditor();
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
  }

  applySettingsToControls() {
    const s = this.storage.loadSettings();
    this.el['chk-mute'].checked = s.muted;
    this.el['rng-sfx'].value = s.sfxVolume;
    this.el['rng-music'].value = s.musicVolume;
  }

  submitScore() {
    const raw = (this.el['entry-name'].value || 'AAA').toUpperCase().slice(0, 3);
    this.game.submitHighScore(raw || 'AAA');
  }

  showTouchControlsIfNeeded() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      this.el['touch-controls'].classList.remove('hidden');
    }
  }

  render() {
    const g = this.game;
    if (g.state !== this.lastState) {
      this.setScreen(g.state);
      this.lastState = g.state;
    }

    if (HUD_VISIBLE_STATES.has(g.state)) {
      this.renderPowerupIndicators();
    } else {
      this.el['powerup-indicators'].innerHTML = '';
    }
  }

  renderPowerupIndicators() {
    const container = this.el['powerup-indicators'];
    container.innerHTML = '';
    for (const [type, expiresAt] of this.game.effects.active) {
      const def = POWERUP_TYPES[type];
      const remaining = Math.max(0, (expiresAt - this.game.elapsedMs) / 1000);
      const chip = document.createElement('div');
      chip.className = 'powerup-chip';
      chip.style.borderColor = def.color;
      chip.textContent = `${def.label} ${remaining.toFixed(1)}s`;
      container.appendChild(chip);
    }
  }

  setScreen(state) {
    for (const id of Object.values(SCREEN_IDS)) this.el[id].classList.add('hidden');
    const id = SCREEN_IDS[state];
    if (!id) return;
    this.el[id].classList.remove('hidden');

    if (state === GAME_STATES.GAME_OVER) {
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
    }
  }

  // Rebuilt every time the screen opens (not cached) -- cheap, and picks
  // up a level just unlocked by clearing the one before it.
  renderLevelSelect() {
    const list = this.el['level-select-list'];
    list.innerHTML = '';
    const progress = this.storage.loadProgress();
    LEVELS.forEach((def, i) => {
      const unlocked = i < progress.unlockedLevels;
      const btn = document.createElement('button');
      btn.className = 'level-select-btn' + (unlocked ? '' : ' locked');
      const label = unlocked ? `${i + 1}. ${def.name}` : `${i + 1}. ???`;
      // Dimming for a locked level comes from the .locked CSS class on
      // the button itself (opacity), not a different fill color here.
      setPixelText(btn, label, 'body', COLORS.text);
      btn.disabled = !unlocked;
      if (unlocked) {
        btn.addEventListener('click', () => {
          this.audio.resumeContext();
          this.game.startAtLevel(i);
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
      // score to the right edge like the old single-line text did.
      const rankName = document.createElement('span');
      setPixelText(rankName, `${i + 1}. ${entry.name}`, 'body', color);
      const score = document.createElement('span');
      setPixelText(score, String(entry.score), 'body', color);
      li.append(rankName, score);
      list.appendChild(li);
    });
  }
}

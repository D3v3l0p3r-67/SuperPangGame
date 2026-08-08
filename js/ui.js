import { GAME_STATES } from './constants.js';
import { POWERUP_TYPES } from './config.js';

const SCREEN_IDS = {
  [GAME_STATES.MENU]: 'screen-menu',
  [GAME_STATES.LEVEL_INTRO]: 'screen-level-intro',
  [GAME_STATES.PAUSED]: 'screen-pause',
  [GAME_STATES.GAME_OVER]: 'screen-game-over',
  [GAME_STATES.HIGH_SCORE_ENTRY]: 'screen-high-score-entry',
  [GAME_STATES.HIGH_SCORE_TABLE]: 'screen-high-scores',
  [GAME_STATES.VICTORY]: 'screen-victory',
};

const HUD_VISIBLE_STATES = new Set([
  GAME_STATES.PLAYING,
  GAME_STATES.PAUSED,
  GAME_STATES.LEVEL_INTRO,
  GAME_STATES.LEVEL_CLEAR,
]);

const ELEMENT_IDS = [
  'hud', 'hud-score', 'hud-level', 'hud-lives', 'hud-time', 'hud-weapon', 'powerup-indicators',
  'screen-menu', 'screen-level-intro', 'level-intro-title', 'level-intro-name',
  'screen-pause', 'screen-game-over', 'final-score', 'screen-victory', 'victory-score',
  'screen-high-score-entry', 'entry-score', 'entry-name', 'screen-high-scores', 'high-score-list',
  'touch-controls',
  'btn-start', 'btn-highscores', 'btn-fullscreen', 'btn-fullscreen-pause',
  'btn-resume', 'btn-quit', 'btn-restart', 'btn-menu', 'btn-victory-restart', 'btn-victory-menu',
  'btn-submit-score', 'btn-close-highscores', 'chk-mute', 'rng-sfx', 'rng-music',
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
  }

  bindEvents() {
    const startGame = () => {
      this.audio.resumeContext();
      this.game.startNewGame();
    };

    this.el['btn-start'].addEventListener('click', startGame);
    this.el['btn-restart'].addEventListener('click', startGame);
    this.el['btn-victory-restart'].addEventListener('click', startGame);

    this.el['btn-highscores'].addEventListener('click', () => this.game.showHighScores());
    this.el['btn-close-highscores'].addEventListener('click', () => this.game.goToMenu());
    this.el['btn-fullscreen'].addEventListener('click', toggleFullscreen);
    this.el['btn-fullscreen-pause'].addEventListener('click', toggleFullscreen);
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
      this.el.hud.classList.remove('hidden');
      this.el['hud-score'].textContent = `SCORE ${g.score}`;
      this.el['hud-level'].textContent = `LEVEL ${g.levelIndex + 1}`;
      this.el['hud-lives'].textContent = `LIVES ${g.lives}`;
      this.el['hud-time'].textContent = `TIME ${g.remainingLevelTime}`;
      this.el['hud-time'].classList.toggle('hud-time-low', g.remainingLevelTime <= 10);
      this.el['hud-weapon'].textContent = g.weaponLabel;
      this.renderPowerupIndicators();
    } else {
      this.el.hud.classList.add('hidden');
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

    if (state === GAME_STATES.LEVEL_INTRO) {
      this.el['level-intro-title'].textContent = `LEVEL ${this.game.levelIndex + 1}`;
      this.el['level-intro-name'].textContent = this.game.currentLevelDef?.name ?? '';
    } else if (state === GAME_STATES.GAME_OVER) {
      this.el['final-score'].textContent = `FINAL SCORE: ${this.game.score}`;
    } else if (state === GAME_STATES.VICTORY) {
      this.el['victory-score'].textContent = `SCORE: ${this.game.score}`;
    } else if (state === GAME_STATES.HIGH_SCORE_ENTRY) {
      this.el['entry-score'].textContent = `SCORE: ${this.game.score}`;
      this.el['entry-name'].value = '';
      setTimeout(() => this.el['entry-name'].focus(), 50);
    } else if (state === GAME_STATES.HIGH_SCORE_TABLE) {
      this.renderHighScores();
    }
  }

  renderHighScores() {
    const scores = this.storage.loadHighScores();
    const list = this.el['high-score-list'];
    list.innerHTML = '';
    if (scores.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'NO SCORES YET';
      list.appendChild(li);
      return;
    }
    scores.forEach((entry, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${entry.name}  ${entry.score}`;
      if (this.game.justSubmittedEntry && entry.id === this.game.justSubmittedEntry.id) {
        li.classList.add('new-entry');
      }
      list.appendChild(li);
    });
  }
}

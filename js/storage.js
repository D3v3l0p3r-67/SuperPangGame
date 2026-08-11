import { STORAGE_PREFIX, SCHEMA_VERSION, DEFAULT_ZOOM } from './constants.js';

const KEYS = {
  highscores: STORAGE_PREFIX + 'highscores',
  settings: STORAGE_PREFIX + 'settings',
  customLevel: STORAGE_PREFIX + 'customLevel',
  progress: STORAGE_PREFIX + 'progress',
};

const MAX_HIGH_SCORES = 10;

const DEFAULT_SETTINGS = { schemaVersion: SCHEMA_VERSION, muted: false, sfxVolume: 0.8, musicVolume: 0.6, zoom: DEFAULT_ZOOM };
const DEFAULT_HIGH_SCORES = { schemaVersion: SCHEMA_VERSION, entries: [] };
// unlockedLevels is a count, not an index: 1 means only LEVELS[0] is
// playable from Start Level, 2 means LEVELS[0..1], etc. -- level 1 is
// always unlocked, everything else opens up as the level before it is
// cleared (see GameScene.levelClear's markLevelCleared call).
const DEFAULT_PROGRESS = { schemaVersion: SCHEMA_VERSION, unlockedLevels: 1 };

// Add an entry here (keyed by the version a payload is migrating FROM) when
// the schema changes in the future, e.g. migrations[1] = (data) => ({...}).
const migrations = {};

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function migrate(data, defaultShape) {
  if (!data || typeof data !== 'object') return structuredCloneJSON(defaultShape);
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  let result = data;
  while (version < SCHEMA_VERSION && typeof migrations[version] === 'function') {
    result = migrations[version](result);
    version += 1;
  }
  return { ...result, schemaVersion: SCHEMA_VERSION };
}

function structuredCloneJSON(v) {
  return JSON.parse(JSON.stringify(v));
}

export function loadSettings() {
  const parsed = safeParse(readRaw(KEYS.settings));
  const migrated = migrate(parsed, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...migrated };
}

export function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial, schemaVersion: SCHEMA_VERSION };
  writeRaw(KEYS.settings, JSON.stringify(next));
  return next;
}

// The level editor's single custom-level slot. Stored as the raw level
// definition (same shape as an entry in LEVELS) wrapped with a schema
// version, same pattern as every other stored payload here.
export function saveCustomLevel(def) {
  writeRaw(KEYS.customLevel, JSON.stringify({ schemaVersion: SCHEMA_VERSION, def }));
}

export function loadCustomLevel() {
  const parsed = safeParse(readRaw(KEYS.customLevel));
  return parsed && parsed.def ? parsed.def : null;
}

export function loadProgress() {
  const parsed = safeParse(readRaw(KEYS.progress));
  const migrated = migrate(parsed, DEFAULT_PROGRESS);
  return { ...DEFAULT_PROGRESS, ...migrated };
}

// Called once a (non-custom) level is actually cleared -- unlocks the
// next one, if it isn't already. Safe to call repeatedly / out of order
// (e.g. replaying an already-cleared level from Start Level): it only
// ever raises unlockedLevels, never lowers it.
export function markLevelCleared(levelIndex) {
  const progress = loadProgress();
  const unlockedLevels = Math.max(progress.unlockedLevels, levelIndex + 2);
  writeRaw(KEYS.progress, JSON.stringify({ schemaVersion: SCHEMA_VERSION, unlockedLevels }));
  return unlockedLevels;
}

export function isLevelUnlocked(levelIndex) {
  return levelIndex < loadProgress().unlockedLevels;
}

export function loadHighScores() {
  const parsed = safeParse(readRaw(KEYS.highscores));
  const migrated = migrate(parsed, DEFAULT_HIGH_SCORES);
  const entries = Array.isArray(migrated.entries) ? migrated.entries : [];
  return entries.slice(0, MAX_HIGH_SCORES);
}

export function qualifiesForHighScore(score) {
  const scores = loadHighScores();
  if (scores.length < MAX_HIGH_SCORES) return true;
  return score > scores[scores.length - 1].score;
}

export function saveHighScore({ name, score, level }) {
  const scores = loadHighScores();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || 'AAA').toUpperCase().slice(0, 3) || 'AAA',
    score,
    level,
    date: new Date().toISOString(),
  };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const truncated = scores.slice(0, MAX_HIGH_SCORES);
  writeRaw(KEYS.highscores, JSON.stringify({ schemaVersion: SCHEMA_VERSION, entries: truncated }));
  return { entries: truncated, entry };
}

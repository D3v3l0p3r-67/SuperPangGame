import { STORAGE_PREFIX, SCHEMA_VERSION } from './constants.js';

const KEYS = {
  highscores: STORAGE_PREFIX + 'highscores',
  settings: STORAGE_PREFIX + 'settings',
};

const MAX_HIGH_SCORES = 10;

const DEFAULT_SETTINGS = { schemaVersion: SCHEMA_VERSION, muted: false, sfxVolume: 0.8, musicVolume: 0.6 };
const DEFAULT_HIGH_SCORES = { schemaVersion: SCHEMA_VERSION, entries: [] };

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

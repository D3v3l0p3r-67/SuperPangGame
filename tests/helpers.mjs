// Shared helpers: where the project's files are, and how to read them.
// Deliberately plain Node -- no test framework, no build step, no
// node_modules. The game itself has no dependencies and neither does its
// test suite (see tests/README.md).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readJSON(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'));
}

export function exists(relativePath) {
  return existsSync(join(ROOT, relativePath));
}

export function readText(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

export function listFiles(relativeDir) {
  return readdirSync(join(ROOT, relativeDir));
}

// Every levels/level_NN.json, in order, with the number the filename
// claims -- which several rules below check the contents against.
export function levelFiles() {
  return listFiles('levels')
    .filter((name) => /^level_\d{2}\.json$/.test(name))
    .sort()
    .map((name) => ({
      name,
      number: Number(name.slice('level_'.length, -'.json'.length)),
      def: readJSON(`levels/${name}`),
    }));
}

// The element registry as the game builds it at boot (see js/elements.js),
// flattened by category so the level rules can ask "is this a real ball
// shape/size?" the same way the game would.
export function elements() {
  const all = readJSON('elements/index.json').map((id) => readJSON(`elements/${id}.json`));
  return {
    all,
    balls: all.filter((el) => el.category === 'ball'),
    obstacles: all.filter((el) => el.category === 'obstacle'),
    ladders: all.filter((el) => el.category === 'ladder'),
    powerups: all.filter((el) => el.category === 'powerup'),
  };
}

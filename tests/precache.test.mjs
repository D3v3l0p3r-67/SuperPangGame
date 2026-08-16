// The offline manifest has two authors: tools/build_precache.mjs at
// release time, and admin/includes/precache.php every time the admin tool
// writes a file. They have to produce the same thing -- same hashes, same
// version string, same bytes on disk -- or a save and a release would
// each look to the other like a change that never happened, and the
// service worker would reinstall the whole game for nothing.
//
// PHP is the one thing this suite cannot assume is installed, so this
// skips itself where there is none rather than failing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const hasPhp = spawnSync('php', ['-v'], { encoding: 'utf8' }).status === 0;

// The rules, exactly as tools/build_precache.mjs applies them.
const fileHash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

function versionOf(files) {
  const hash = createHash('sha256');
  for (const [path, digest] of Object.entries(files)) hash.update(path).update(digest);
  return `super-pang-${hash.digest('hex').slice(0, 12)}`;
}

test('a save writes the same manifest a release would', { skip: hasPhp ? false : 'no php on this machine' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'precache-'));
  try {
    // A project of two files, one of which is about to be "saved".
    writeFileSync(join(dir, 'a.txt'), 'the file the admin just wrote');
    writeFileSync(join(dir, 'b.txt'), 'a file nobody touched');
    const before = {
      version: 'super-pang-stale0000',
      files: { 'a.txt': 'aaaaaaaaaaaaaaaa', 'b.txt': fileHash(readFileSync(join(dir, 'b.txt'))) },
    };
    writeFileSync(join(dir, 'sw-precache.json'), `${JSON.stringify(before, null, 2)}\n`);
    writeFileSync(join(dir, 'service-worker.js'), "const CACHE_VERSION = 'super-pang-stale0000';\n");

    const php = spawnSync('php', ['-r', `
      define('PROJECT_ROOT', '${dir}');
      require '${join(ROOT, 'admin/includes/precache.php')}';
      [$ok, $note] = refreshPrecache('a.txt');
      echo $ok ? $note : "FAILED: $note";
    `], { encoding: 'utf8' });
    assert.equal(php.status, 0, `php refused to run it: ${php.stderr}`);
    assert.ok(!php.stdout.startsWith('FAILED'), php.stdout);

    const expectedFiles = {
      'a.txt': fileHash(readFileSync(join(dir, 'a.txt'))),
      'b.txt': before.files['b.txt'],
    };
    const expectedVersion = versionOf(expectedFiles);
    assert.equal(php.stdout, expectedVersion, 'the version PHP reported is not the one the tool computes');

    // Byte for byte, not merely equivalent: the two writers take turns on
    // the same file in git, and a manifest that differs only in its
    // whitespace is a diff on every release.
    assert.equal(
      readFileSync(join(dir, 'sw-precache.json'), 'utf8'),
      `${JSON.stringify({ version: expectedVersion, files: expectedFiles }, null, 2)}\n`,
      'PHP and the tool disagree about how the manifest is written',
    );
    assert.equal(
      readFileSync(join(dir, 'service-worker.js'), 'utf8'),
      `const CACHE_VERSION = '${expectedVersion}';\n`,
      "the worker's CACHE_VERSION line was not rewritten the way the tool rewrites it",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a save leaves the project alone when there is no worker to tell', { skip: hasPhp ? false : 'no php on this machine' }, () => {
  // A host serving the game without the PWA files (or with them read-only)
  // must still take saves: the file the admin asked for is on disk either
  // way, and reporting a failed save after a successful write is worse
  // than an offline copy that lags.
  const dir = mkdtempSync(join(tmpdir(), 'precache-'));
  try {
    writeFileSync(join(dir, 'a.txt'), 'written, with nothing to notify');
    const php = spawnSync('php', ['-r', `
      define('PROJECT_ROOT', '${dir}');
      require '${join(ROOT, 'admin/includes/precache.php')}';
      [$ok, $note] = refreshPrecache('a.txt');
      echo $ok ? 'UPDATED' : $note;
    `], { encoding: 'utf8' });
    assert.equal(php.status, 0, php.stderr);
    assert.equal(php.stdout, 'no service worker on this host');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

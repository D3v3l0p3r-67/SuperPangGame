// Writes sw-precache.json: the list of files the service worker takes
// into its cache so the game can be started and played with no network
// (see service-worker.js, which fetches this list on install).
//
//     node tools/build_precache.mjs
//
// Run it whenever a file is added, renamed or removed from the game --
// the same moment you would bump the cache version in service-worker.js.
// tests/pwa.test.mjs fails if the list and the folder have drifted apart,
// so a forgotten run is caught before it becomes a game that only half
// works offline.
//
// Everything the browser fetches at runtime is included and nothing else:
// the admin site is PHP (it cannot work offline and does not belong to
// the game), and the tests, the tools and the docs are never fetched by
// anything. Music is in the list like every other sound -- it is the bulk
// of the download, but a game that goes quiet when the network does is
// not really working offline.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'sw-precache.json');

// Files at the root of the game, and the folders it loads everything else
// from. Order matters only in that the shell comes first -- the service
// worker treats the first entries as the ones that MUST cache.
const ROOT_FILES = ['index.html', 'style.css', 'manifest.webmanifest', 'favicon.ico'];
const DIRS = ['js', 'assets', 'levels', 'elements'];

// Never cached, wherever they turn up: editor/OS leftovers and source
// maps, none of which the game asks for.
const SKIP = /(^\.|\.map$|~$|\.DS_Store$)/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(join(ROOT, dir)).sort()) {
    if (SKIP.test(entry)) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const files = [...ROOT_FILES, ...DIRS.flatMap((dir) => walk(dir))]
  // Relative, with no leading slash: the game has to work from a
  // subdirectory (GitHub Pages project sites serve it from /<repo>/), so
  // every path here is resolved against the service worker's own scope.
  .map((path) => path.split(sep).join('/'));

writeFileSync(OUT, `${JSON.stringify(files, null, 2)}\n`);
console.log(`${relative(ROOT, OUT)}: ${files.length} files`);

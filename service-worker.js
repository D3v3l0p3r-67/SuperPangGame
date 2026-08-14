// Makes the game playable with no network at all: everything it loads is
// taken into one cache the first time it is visited, and served from
// there afterwards.
//
// Registered by js/pwa.js with a RELATIVE url, so its scope is whatever
// folder the game is served from -- a GitHub Pages project site puts it
// under /<repo>/, and nothing here may assume the site root. Every path
// below is resolved against `self.registration.scope` for that reason.
//
// Bump CACHE_VERSION on a new release. The old cache is deleted the
// moment the new worker activates (see activate), so a release can never
// be served half from the previous one -- and rerun
// `node tools/build_precache.mjs` in the same breath if any file was
// added, renamed or removed.
const CACHE_VERSION = 'super-pang-v1';
const PRECACHE_LIST = 'sw-precache.json';

// The files the game cannot start without. These have to cache for the
// install to count as done; everything else in the list is fetched
// best-effort, so one missing sound can't cost the whole offline copy.
const SHELL = ['./', 'index.html', 'style.css', 'js/main.js', 'js/vendor/phaser.min.js', 'manifest.webmanifest'];

// How many requests are in flight at once while filling the cache. The
// list is ~270 files: all at once is a burst most servers throttle
// anyway, and a phone on a slow connection times some of them out.
const BATCH = 12;

const url = (path) => new URL(path, self.registration.scope).toString();

async function precache() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(SHELL.map(url));

  const response = await fetch(url(PRECACHE_LIST), { cache: 'no-cache' });
  if (!response.ok) return;
  const files = (await response.json()).filter((path) => !SHELL.includes(path));
  for (let i = 0; i < files.length; i += BATCH) {
    // allSettled, not all: a file that 404s (or a phone that drops the
    // connection halfway through) leaves the rest of the cache intact
    // rather than throwing the whole install away.
    await Promise.allSettled(files.slice(i, i + BATCH).map((path) => cache.add(url(path))));
  }
}

self.addEventListener('install', (event) => {
  // Take over as soon as the new copy is ready rather than waiting for
  // every tab to close: the game is a single page, and a version that
  // only arrives on the third visit is a confusing thing to debug.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE_VERSION) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// A page load with no network: the game is one page, so any navigation
// inside the scope is answered with index.html and the game routes itself
// from there.
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    return (await cache.match(url('index.html'))) || (await cache.match(url('./')))
      || Response.error();
  }
}

// Everything else: from the cache if it is there (these files never
// change without a new CACHE_VERSION), otherwise from the network, and
// what comes back is kept for next time.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Only a real, complete, same-origin answer is worth keeping: an error
  // page or a partial (206) response cached here would be served as the
  // game itself for as long as this version lives.
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // GET only, and only what belongs to the game. A score posted to an
  // API, or anything on another origin, goes straight to the network and
  // is never cached -- offline it simply fails, which the game already
  // copes with by keeping scores locally (see js/storage.js).
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.registration.scope)) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});

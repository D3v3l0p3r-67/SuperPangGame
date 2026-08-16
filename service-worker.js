// Makes the game playable with no network at all: everything it loads is
// taken into one cache the first time it is visited, and served from
// there afterwards.
//
// Registered by js/pwa.js with a RELATIVE url, so its scope is whatever
// folder the game is served from -- a GitHub Pages project site puts it
// under /<repo>/, and nothing here may assume the site root. Every path
// below is resolved against `self.registration.scope` for that reason.
//
// CACHE_VERSION is GENERATED: `node tools/build_precache.mjs` writes a
// hash of every precached file's contents into the line below, so it
// moves whenever any file in the game does. Do not edit it by hand, and
// do not rely on remembering to bump it -- this worker answers from its
// cache first, so a version that lags behind the files means players go
// on playing whatever they downloaded first (which is exactly what
// happened to a redrawn player sprite: three redraws, none of them
// reaching anyone who had already opened the game). The old cache is
// deleted the moment the new worker activates (see activate), so a
// release is never served half from the previous one.
const CACHE_VERSION = 'super-pang-f8ec7a6258d3';
const PRECACHE_LIST = 'sw-precache.json';

// The files the game cannot start without. These have to cache for the
// install to count as done; everything else in the list is fetched
// best-effort, so one missing sound can't cost the whole offline copy.
const SHELL = ['./', 'index.html', 'style.css', 'js/main.js', 'js/vendor/phaser.min.js', 'manifest.webmanifest'];

// How many requests are in flight at once while filling the cache, for
// the files that do have to be fetched. The list is ~270: all at once is
// a burst most servers throttle anyway, and a phone on a slow connection
// times some of them out.
const BATCH = 12;

const url = (path) => new URL(path, self.registration.scope).toString();

// The manifest of the cache being replaced, so an install can tell which
// files actually changed. It is kept IN that cache (see precache below)
// rather than worked out from the files themselves, because a cached
// response says nothing about which version of a file it holds.
async function previousManifest() {
  for (const name of await caches.keys()) {
    if (name === CACHE_VERSION || !name.startsWith('super-pang-')) continue;
    const cache = await caches.open(name);
    const hit = await cache.match(url(PRECACHE_LIST));
    if (hit) return { cache, files: (await hit.json()).files || {} };
  }
  return null;
}

async function precache() {
  const cache = await caches.open(CACHE_VERSION);
  const response = await fetch(url(PRECACHE_LIST), { cache: 'no-cache' });
  if (!response.ok) throw new Error('no precache manifest');
  const manifest = await response.json();
  const files = manifest.files || {};
  const previous = await previousManifest();

  // The shell first and on its own: these are what a blank screen offline
  // is made of, so the install only counts as done if they cached.
  await cache.addAll(SHELL.map(url));

  const outstanding = Object.keys(files).filter((path) => !SHELL.includes(path));
  const fetchAll = [];
  for (const path of outstanding) {
    // Unchanged since the release being replaced: take the copy that is
    // already on the device. A new sprite then costs a sprite to install
    // rather than the whole game, which is the difference between an
    // update the player never notices and one that re-downloads 7MB over
    // whatever connection they happen to be on.
    if (previous && previous.files[path] === files[path]) {
      const hit = await previous.cache.match(url(path));
      if (hit) {
        await cache.put(url(path), hit.clone());
        continue;
      }
    }
    fetchAll.push(path);
  }

  for (let i = 0; i < fetchAll.length; i += BATCH) {
    // allSettled, not all: a file that 404s (or a phone that drops the
    // connection halfway through) leaves the rest of the cache intact
    // rather than throwing the whole install away.
    await Promise.allSettled(fetchAll.slice(i, i + BATCH).map((path) => cache.add(url(path))));
  }

  // Kept so the NEXT install can diff against this release.
  await cache.put(url(PRECACHE_LIST), new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' },
  }));
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

// The admin tool is not the game. It is PHP, it is behind a login, and
// its answers are per-session -- exactly the things that must never come
// out of a cache built to outlive the page. Everything under admin/ goes
// straight to the network, unhandled, so a stale session probe or a
// cached login page can never be served as the live one (see
// js/levelFile.js, which the editor's Save asks through).
const isAdmin = (request) => request.url.startsWith(url('admin/'));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // GET only, and only what belongs to the game. A score posted to an
  // API, or anything on another origin, goes straight to the network and
  // is never cached -- offline it simply fails, which the game already
  // copes with by keeping scores locally (see js/storage.js).
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.registration.scope)) return;
  if (isAdmin(request)) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});

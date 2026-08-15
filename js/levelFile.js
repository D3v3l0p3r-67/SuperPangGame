// Writing a level back to the project as a real file, when the game is
// being served by something that can do that.
//
// The in-game editor is the visual one -- it paints on the live scene
// with the real entities and Play tests it instantly -- but it could not
// save anywhere except this browser. Save went to localStorage, which
// only that browser sees and which silently overlays the shipped level,
// and getting the work into the project meant Export, find the download,
// move the file. Meanwhile admin/save.php has been able to write
// levels/*.json all along.
//
// So this joins the two. It is the only thing in the game that knows the
// admin tool exists, and it is written so the game does not depend on it
// in any way: on GitHub Pages, where there is no PHP at all, `available()`
// answers false once and the editor carries on exactly as it did.
import { levelFilePath } from './assets.js';

const SESSION_URL = 'admin/session.php';
const SAVE_URL = 'admin/save.php';

// Asked at most once per page load, and only when a save is actually
// attempted -- a probe on boot would cost every player a request (and a
// 404 in the console) for a tool almost none of them have.
let session = null;

async function probe() {
  try {
    const response = await fetch(SESSION_URL, { credentials: 'same-origin', cache: 'no-store' });
    // Not JSON means PHP is not running it: on a static host this is the
    // 404 page, which is a perfectly good answer of "no".
    if (!response.ok) return { loggedIn: false, reason: `no admin tool here (HTTP ${response.status})` };
    const data = await response.json();
    return data.loggedIn
      ? { loggedIn: true, csrf: data.csrf }
      : { loggedIn: false, reason: 'not logged into the admin tool' };
  } catch {
    return { loggedIn: false, reason: 'no admin tool here' };
  }
}

// Whether a file save can be attempted at all, with the reason when not.
// Cached: a login that happens in another tab after this answered is
// picked up on the next page load, which is the same as every other
// thing the admin session governs.
export async function fileSaving() {
  if (!session) session = await probe();
  return session;
}

// Writes levels/level_NN.json for real. Resolves with the path written;
// throws with the server's own reason otherwise -- there is deliberately
// no silent fallback here, because a save that did not go where it said
// it went is worse than one that failed loudly (the same lesson
// admin/js/fsSave.js records). Choosing what to do about a failure is
// the caller's business (see editor.js's save).
export async function saveLevelFile(levelNumber, def) {
  const state = await fileSaving();
  if (!state.loggedIn) throw new Error(state.reason);

  const path = levelFilePath(levelNumber);
  const body = new FormData();
  body.append('path', path);
  body.append('csrf', state.csrf);
  body.append('file', new Blob([`${JSON.stringify(def, null, 2)}\n`], { type: 'application/json' }), path.split('/').pop());

  const response = await fetch(SAVE_URL, { method: 'POST', body, credentials: 'same-origin' });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`server returned HTTP ${response.status} (not JSON -- is PHP running?)`);
  }
  if (!response.ok || !data.ok) {
    // A session that expired between the probe and the save: forget what
    // was cached so the next attempt asks again rather than repeating a
    // request that cannot succeed.
    if (response.status === 401 || response.status === 403) session = null;
    throw new Error(data.error || `server returned HTTP ${response.status}`);
  }
  return path;
}

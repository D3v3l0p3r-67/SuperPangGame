// Every "Save" action in this admin tool goes through here. The primary
// path now is the PHP backend (save.php): a real authenticated, CSRF-
// checked server endpoint that writes straight into the project's own
// files (see save.php's path/extension whitelist for what it'll accept
// and admin/includes/auth.php for the login it requires). If that fails
// for any reason (server save.php unreachable, web server user lacking
// write permission, ...), this falls back to the File System Access API
// (Chromium browsers, if the admin has picked a local project folder via
// main.js's "Choose project folder" button) and finally to a plain
// download, same pattern the game's own level editor uses for its Export
// button (js/editor.js) -- the admin then drops it into place by hand.

const CSRF_TOKEN = document.querySelector('meta[name="admin-csrf"]')?.content ?? '';

let rootHandle = null;

export function hasFsAccess() {
  return typeof window.showDirectoryPicker === 'function';
}

export function isConnected() {
  return rootHandle !== null;
}

export function connectedName() {
  return rootHandle ? rootHandle.name : null;
}

export async function pickProjectRoot() {
  if (!hasFsAccess()) throw new Error('File System Access API not supported in this browser.');
  rootHandle = await window.showDirectoryPicker();
  return rootHandle.name;
}

// `rootRelativePath` is slash-separated, relative to the project root
// (e.g. "elements/round-ball-1.json", "assets/balls/ball_round_1.webp").
// Creates any missing intermediate folders, same as `mkdir -p`.
async function getFileHandle(rootRelativePath) {
  const parts = rootRelativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  let dir = rootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir.getFileHandle(fileName, { create: true });
}

async function saveToServer(rootRelativePath, content) {
  const formData = new FormData();
  formData.append('path', rootRelativePath);
  formData.append('csrf', CSRF_TOKEN);
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/octet-stream' });
  formData.append('file', blob, rootRelativePath.split('/').pop());

  const res = await fetch('save.php', { method: 'POST', body: formData, credentials: 'same-origin' });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server save failed: HTTP ${res.status}`);
  }
  if (!res.ok || !data.ok) throw new Error(data.error || `Server save failed: HTTP ${res.status}`);
}

function downloadFallback(rootRelativePath, content) {
  const fileName = rootRelativePath.split('/').pop();
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// `content` is either a string (JSON/text files) or a Blob/File (images,
// audio). Returns { savedTo: 'server' | 'disk' | 'download' } so callers
// can show the right follow-up message -- only 'download' needs the
// admin to manually move the file into place.
export async function saveFile(rootRelativePath, content) {
  try {
    await saveToServer(rootRelativePath, content);
    return { savedTo: 'server' };
  } catch (err) {
    console.error(`Server save of ${rootRelativePath} failed, trying next option:`, err);
  }

  if (isConnected()) {
    try {
      const handle = await getFileHandle(rootRelativePath);
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { savedTo: 'disk' };
    } catch (err) {
      console.error(`Direct save of ${rootRelativePath} failed, falling back to download:`, err);
    }
  }

  downloadFallback(rootRelativePath, content);
  return { savedTo: 'download' };
}

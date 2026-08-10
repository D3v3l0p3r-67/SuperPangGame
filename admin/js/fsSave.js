// Every "Save" action in this admin tool goes through here. There is no
// backend or database (this whole game is a static site, see the root
// README.md) -- the project's own files ARE the storage. If the browser
// supports the File System Access API (Chromium-based browsers) and the
// admin has picked the project's root folder (see main.js's "Choose
// project folder" button), saves write straight to disk. Otherwise every
// save downloads the file instead, same pattern the game's own level
// editor already uses for its Export button (js/editor.js) -- the admin
// then drops it into place by hand.

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

// `content` is either a string (JSON/text files) or a Blob/File (images,
// audio). Returns { savedTo: 'disk' | 'download' } so callers can show
// the right follow-up message.
export async function saveFile(rootRelativePath, content) {
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

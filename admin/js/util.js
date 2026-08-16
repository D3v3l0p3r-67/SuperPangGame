// Small shared helpers every admin tab module uses. All paths here are
// PROJECT-ROOT-relative (e.g. "elements/round-ball-1.json"), matching the
// same convention js/assets.js already uses -- rootUrl() is the one place
// that turns one into a fetchable URL from inside admin/ (one directory
// below the project root).

export function rootUrl(rootRelativePath) {
  return `../${rootRelativePath}`;
}

export async function fetchJSON(rootRelativePath) {
  const res = await fetch(rootUrl(rootRelativePath));
  if (!res.ok) throw new Error(`${rootRelativePath}: HTTP ${res.status}`);
  return res.json();
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
}

export function labeled(text, input) {
  const label = document.createElement('label');
  label.append(`${text} `, input);
  return label;
}

// Replacing an asset FILE (an image or a sound) leaves its URL unchanged,
// and the game is served by a service worker that answers from its own
// cache first -- so what a player keeps getting is the copy on their
// device, and a hard reload does not change that (it empties the
// browser's cache, not the worker's). What does is the worker seeing a
// new version, which the save arranges for itself (see
// admin/includes/precache.php) and which arrives on the game's next load.
export const SAVED_ASSET_MSG = 'Saved. The game picks it up on its next load.';

export function statusParagraph() {
  const p = document.createElement('p');
  p.className = 'status';
  return p;
}

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

export function statusParagraph() {
  const p = document.createElement('p');
  p.className = 'status';
  return p;
}

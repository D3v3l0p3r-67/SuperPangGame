// The two developer toolbars -- the level editor's (js/editor.js) and the
// debug one (js/debug.js) -- are plain DOM rather than anything drawn into
// the canvas, and they are built from exactly these five pieces. Sharing
// them is what keeps the two panels reading as one tool: same controls,
// same grouping, same size (see style.css's .panel-* rules, which both
// panels use).

export function makeButton(label, onClick, title) {
  const btn = document.createElement('button');
  btn.textContent = label;
  if (title) btn.title = title;
  btn.onclick = onClick;
  return btn;
}

// `entries` is a list of [value, label] pairs, in the order they should
// appear -- the caller builds that list, including any leading "none"
// entry (see the editor's powerup dropdown, whose empty value means "no
// drop").
export function makeSelect(entries, onChange) {
  const select = document.createElement('select');
  for (const [value, label] of entries) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  select.onchange = onChange;
  return select;
}

// A <label> with its text and the control it labels, matching the
// "Text: <control>" shape every labelled row in either panel uses.
export function labelled(text, control) {
  const label = document.createElement('label');
  label.textContent = text;
  label.appendChild(control);
  return label;
}

// One row of controls inside a group.
export function row(...controls) {
  const el = document.createElement('div');
  el.className = 'panel-row';
  el.append(...controls);
  return el;
}

// One labelled unit of related controls -- a column of rows. A panel is a
// line of these, so what each control belongs to is readable at a glance
// instead of every button sitting in one undifferentiated strip.
export function group(title, ...rows) {
  const el = document.createElement('div');
  el.className = 'panel-group';
  const heading = document.createElement('span');
  heading.className = 'panel-group-title';
  heading.textContent = title;
  el.append(heading, ...rows);
  return el;
}

// Relabels a group built above, for a title that isn't fixed: the
// editor's LEVEL group names the level it currently has open.
export function setGroupTitle(groupEl, title) {
  groupEl.firstChild.textContent = title;
}

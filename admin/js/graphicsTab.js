// Every image the game loads, grouped by what it is, with a filter for
// finding one among the two hundred of them -- and a card that opens the
// sprite studio (see spriteStudio.js), which is where anything is
// actually done to a graphic: watched, painted, or replaced.
//
// The list itself is derived, never written down: spriteMeta.js builds it
// from elements/*.json + js/assets.js + js/animations.js, the same three
// places the game reads. A new element or a new animation appears here on
// its own.
import { el, rootUrl } from './util.js';
import { buildCatalogue } from './spriteMeta.js';
import { openSpriteStudio } from './spriteStudio.js';

export async function initGraphicsTab(panel, fs) {
  panel.replaceChildren(el('p', { textContent: 'Loading graphics…' }));
  let groups;
  try {
    groups = await buildCatalogue();
  } catch (err) {
    panel.replaceChildren(el('p', { className: 'error', textContent: `Failed to load the graphics list: ${err.message}` }));
    return;
  }

  const filter = el('input', { type: 'search', placeholder: 'Filter by name or path…', className: 'graphics-filter' });
  const listEl = el('div', {});

  panel.replaceChildren(
    el('p', { className: 'tab-intro', textContent:
      'Every image file the game loads. Open one to play its animations, paint its pixels, or replace the whole file.' }),
    filter,
    listEl,
  );

  const cards = [];
  for (const group of groups) {
    if (!group.items.length) continue;
    const grid = el('div', { className: 'graphics-grid' });
    const section = el('section', { className: 'graphics-group' }, [
      el('h2', { textContent: `${group.title} (${group.items.length})` }),
      grid,
    ]);
    for (const entry of group.items) {
      const card = buildCard(entry, fs);
      cards.push({ entry, card, section });
      grid.append(card);
    }
    listEl.append(section);
  }

  filter.addEventListener('input', () => {
    const needle = filter.value.trim().toLowerCase();
    const shown = new Set();
    for (const { entry, card, section } of cards) {
      const hit = !needle || entry.label.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle);
      card.classList.toggle('hidden', !hit);
      if (hit) shown.add(section);
    }
    // A heading with nothing under it reads as an empty category rather
    // than as one the filter simply did not match.
    for (const section of new Set(cards.map((c) => c.section))) {
      section.classList.toggle('hidden', !shown.has(section));
    }
  });
}

function buildCard(entry, fs) {
  const card = el('div', { className: 'card graphic-card' });
  const preview = el('img', { className: 'preview', alt: entry.label, src: `${rootUrl(entry.path)}?t=${Date.now()}` });

  const badges = el('div', { className: 'badges' });
  if (entry.animations.length) {
    badges.append(el('span', {
      className: 'badge badge-anim',
      textContent: `▶ ${entry.animations.length} animation${entry.animations.length === 1 ? '' : 's'}`,
    }));
  }
  if (entry.frame) {
    badges.append(el('span', {
      className: 'badge',
      textContent: `${entry.frame.frameWidth}x${entry.frame.frameHeight} cells`,
    }));
  }
  if (entry.generator) {
    badges.append(el('span', { className: 'badge badge-generated', textContent: 'generated', title: `Drawn by ${entry.generator.tool}` }));
  }

  const openBtn = el('button', { textContent: 'Open', className: 'primary' });
  const open = () => openSpriteStudio(entry, fs, {
    // Whatever was saved in there, this card is still showing the file as
    // it was when the list was built.
    onClose: () => { preview.src = `${rootUrl(entry.path)}?t=${Date.now()}`; },
  });
  openBtn.addEventListener('click', open);
  preview.addEventListener('click', open);

  card.append(
    el('h3', { textContent: entry.label }),
    el('code', { textContent: entry.path, className: 'path' }),
    preview,
    badges,
    openBtn,
  );
  return card;
}

// Hand-authored pixel-grid sprites, defined as plain JS string arrays (no
// binary image assets at all). BootScene bakes these onto small offscreen
// canvases and registers them with Phaser's texture manager once at boot.

export const PLAYER_PALETTE = {
  '.': null,
  O: '#12102a',
  H: '#5b3a29',
  S: '#f4c39a',
  E: '#12102a',
  B: '#3457d5',
  L: '#233a7a',
  W: '#12102a',
};

export const PLAYER_IDLE = [
  '..OOOOOO....',
  '..OHHHHO....',
  '.OHHHHHHO...',
  '.OSSSSSSO...',
  '.OSSESESO...',
  '.OSSSSSSO...',
  '..OSSSSO....',
  '..OBBBBO....',
  '.OBBBBBBO...',
  '.OBBBBBBO...',
  '.OBBBBBBO...',
  '..OBBBBO....',
  '..OLLLLO....',
  '.OLL..LLO...',
  '.OLL..LLO...',
  '.OLL..LLO...',
  '.OWW..WWO...',
  '..OO..OO....',
];

export const PLAYER_WALK = [
  '..OOOOOO....',
  '..OHHHHO....',
  '.OHHHHHHO...',
  '.OSSSSSSO...',
  '.OSSESESO...',
  '.OSSSSSSO...',
  '..OSSSSO....',
  '..OBBBBO....',
  '.OBBBBBBO...',
  '.OBBBBBBO...',
  '.OBBBBBBO...',
  '..OBBBBO....',
  '..OLLLLO....',
  '.OL....LLO..',
  '.OL....LLO..',
  '.OL....LLO..',
  '.OW....WWO..',
  '..O....OO...',
];

export const GLYPHS = {
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  2: ['01110', '10001', '00010', '00100', '01000', '10000', '11111'],
};

export function buildPixelCanvas(rows, palette) {
  const width = rows[0].length;
  const height = rows.length;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = palette[rows[y][x]];
      if (color) {
        c.fillStyle = color;
        c.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

export function buildPowerupCanvas(glyphChar, color) {
  const size = 9;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');

  c.fillStyle = '#12102a';
  c.beginPath();
  c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = color;
  c.beginPath();
  c.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  c.fill();

  const rows = GLYPHS[glyphChar] || GLYPHS['+'];
  c.fillStyle = '#12102a';
  const offsetX = Math.round((size - rows[0].length) / 2);
  const offsetY = Math.round((size - rows.length) / 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '1') c.fillRect(offsetX + x, offsetY + y, 1, 1);
    }
  });

  return canvas;
}

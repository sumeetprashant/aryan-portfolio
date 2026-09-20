// Runtime glyph atlases for the ASCII pipeline.
// Acerola's shader ships fillASCII.png (10 glyphs) and edgesASCII.png (4 directions).
// We generate both at runtime instead, sized to the live cell size, so the ramp is
// tunable and glyphs stay crisp at any cell size (1 atlas texel = 1 screen pixel).

export const DEFAULT_RAMP = ' .:coPO?#@';

// Luminance-ramp glyphs, drawn left to right, white on black.
// The shader reads only the red channel.
export function buildFillAtlas(cell, ramp = DEFAULT_RAMP, font = '"JetBrains Mono", monospace') {
  const n = ramp.length;
  const cv = document.createElement('canvas');
  cv.width = cell * n;
  cv.height = cell;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(4, Math.round(cell * 0.98))}px ${font}`;
  for (let i = 0; i < n; i++) {
    ctx.fillText(ramp[i], i * cell + cell / 2, cell * 0.56);
  }
  return cv;
}

// Edge glyphs are strokes, not font characters: drawn edge-to-edge so contour
// lines connect across neighbouring tiles (a font's "/" floats inside its em box
// and would leave gaps). Slots: 0 = vertical |, 1 = horizontal _, 2 = /, 3 = \.
export function buildEdgeAtlas(cell) {
  const cv = document.createElement('canvas');
  cv.width = cell * 4;
  cv.height = cell;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, cell / 8);
  ctx.lineCap = 'butt';

  const c = cell / 2;
  // slot 0: vertical
  ctx.beginPath();
  ctx.moveTo(0 * cell + c, 0);
  ctx.lineTo(0 * cell + c, cell);
  ctx.stroke();
  // slot 1: horizontal
  ctx.beginPath();
  ctx.moveTo(1 * cell, c);
  ctx.lineTo(2 * cell, c);
  ctx.stroke();
  // slot 2: "/"
  ctx.beginPath();
  ctx.moveTo(2 * cell, cell);
  ctx.lineTo(3 * cell, 0);
  ctx.stroke();
  // slot 3: "\"
  ctx.beginPath();
  ctx.moveTo(3 * cell, 0);
  ctx.lineTo(4 * cell, cell);
  ctx.stroke();

  return cv;
}

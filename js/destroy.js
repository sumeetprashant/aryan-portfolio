// A pixel Aryan sits on the footer button; press it and he jumps down and takes the page apart:
// run, jump (hold to fly), machine gun, flamethrower, rockets, grenades. Esc puts every piece back.
// Our own take on the destroy-any-website toy, played on the real page instead of sending the visitor away.

const CELL = 4;                       // the grain the page breaks at, CSS px
const PX = 4;                         // one pixel of him while he plays, CSS px
const PERCH_PX = 3;                   // and while he sits on the button
const GRAV = 2200, RUN = 340, JUMP = 740, FLY = 2800, FUEL = 1.6;
const HW = 15;                        // half his footing, CSS px (where he can stand)
const WALL = 8 * PX;                  // half his drawn width: he stops at the edge, never half off it

// him, facing right, 16 x 24: curly hair, beard, the blue suit, white shirt, navy tie, black shoes
const PAL = { H: '#2b1b14', h: '#523727', S: '#c98b5f', s: '#9a6240', B: '#3a2419', E: '#120c0a', W: '#eeeae2', T: '#1b2766', t: '#3d50a8', U: '#3049c4', u: '#1f318c', K: '#16161b', k: '#4a4a56' };
const HEAD = [
  '.....HHhHH......',
  '...HHHHHHhHH....',
  '..HHhHHHHHHHH...',
  '..HHHHHHHHHHHH..',
  '..HHHHSSSSSHH...',
  '..HHsSSSSSESS...',
  '...HsSSSSSSSSS..',
  '...HsSSSSSSSS...',
  '....BBBBBBBBB...',
  '.....BBBBBBB....',
  '......sSSSS.....',
  '....uUUWWTWUU...',
  '...uUUUUWTWUUU..',
  '...uUUUUUTtUUU..',
  '...uUUUUUTtUUU..',
  '...uUUUUUUTUUU..',
  '...uuUUUUUUUUu..',
];
const LEGS = {
  stand: ['...SuUUUUUUUu...', '....uUUU.UUUu...', '....uUUU.UUUu...', '....uUUU.UUUu...', '....uUUU.UUUu...', '....uUUU.UUUu...', '....KKKK.KKKKk..'],
  a: ['....uUUUUUUUu...', '....uUUU.UUUU...', '...uUUU...UUUU..', '..uUUU.....UUU..', '.uUUU......uUUu.', 'kKKU........UUu.', 'KK..........KKKk'],
  b: ['....uUUUUUUUu...', '.....uUUUUUUu...', '.....uUUUUUU....', '......uUUUU.....', '......uUUuUU....', '.....kKKu.UU....', '.........KKKKk..'],
  c: ['....uUUUUUUUu...', '....uUUU.UUUu...', '...uUUU..uUUU...', '...uUU....uUUU..', '..uUU......UUU..', '.kKKK......uUU..', '...........KKKk.'],
  jump: ['....uUUUUUUUu...', '....uUUUUUUUUU..', '....uUUU..uUUUU.', '....uUUU....kKKk', '....uUU.........', '....uUU.........', '....KKKK........'],
  sitA: ['...SuUUUUUUUUUu.', '....uUUUUUUUUUUu', '...........uUUu.', '...........uUUu.', '...........uUUu.', '...........uUUu.', '...........KKKKk'],
  sitB: ['...SuUUUUUUUUUu.', '....uUUUUUUUUUUu', '...........uUUu.', '...........uUUu.', '............uUUu', '............uUUu', '............KKKK'],
};
const RUN_CYCLE = ['a', 'b', 'c', 'b'];
const SEAT_ROW = 18;                  // the row he sits on, in the sitting frames

// drawn on an 18 x 26 grid: one pixel of dark outline all round, so he reads on the blue portrait and on the light page
const LINE = '#07080c';
function sprite(rows, flip, size = PX) {
  const c = document.createElement('canvas'); c.width = 18 * size; c.height = 26 * size;
  const x = c.getContext('2d');
  const on = (col, r) => r >= 0 && r < rows.length && col >= 0 && col < 16 && rows[r][col] !== '.';
  for (let r = -1; r <= 24; r++) for (let col = -1; col <= 16; col++) {
    const ch = on(col, r) ? rows[r][col] : null;
    if (!ch && !(on(col - 1, r) || on(col + 1, r) || on(col, r - 1) || on(col, r + 1))) continue;
    x.fillStyle = ch ? PAL[ch] : LINE;
    x.fillRect(((flip ? 15 - col : col) + 1) * size, (r + 1) * size, size, size);
  }
  return c;
}
const blinking = (rows) => rows.map((r) => r.replace('E', 'S'));

// ---- the perch: he sits on the button, swings his legs, blinks ----
let perched = null;
export function perch(button) {
  if (perched) return perched;
  const wrap = button.parentElement;
  const cv = document.createElement('canvas');
  cv.className = 'destroy-perch'; cv.setAttribute('aria-hidden', 'true');
  wrap.prepend(cv);
  const S = PERCH_PX, look = {};
  for (const legs of ['sitA', 'sitB']) for (const blink of [0, 1]) {
    const rows = [...HEAD, ...LEGS[legs]];
    look[legs + blink] = sprite(blink ? blinking(rows) : rows, false, S);
  }
  cv.width = 18 * S; cv.height = 26 * S;
  const x = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let shown = '';
  const paint = (key) => { if (key === shown) return; shown = key; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(look[key], 0, 0); };
  // his seat sits on the top of the label, his shins hang past its end
  const place = () => {
    const pad = parseFloat(getComputedStyle(button).paddingTop) || 0;
    cv.style.left = `${button.offsetLeft + button.offsetWidth - 10 * S}px`;
    cv.style.top = `${button.offsetTop + pad - 1 - (SEAT_ROW + 2) * S}px`;
  };
  place(); addEventListener('resize', place);
  document.fonts?.ready.then(place);
  paint('sitA0');
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1000;
    const swing = !still.matches && t % 5 < 2.2 ? ((t * 2.6) | 0) % 2 : 0;
    const blink = t % 4.3 > 4.15 ? 1 : 0;
    paint((swing ? 'sitB' : 'sitA') + blink);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  perched = {
    seat() { const r = cv.getBoundingClientRect(); return { x: r.left + 9 * S, y: r.top + (SEAT_ROW + 2) * S }; },
    hide() { cv.style.visibility = 'hidden'; },
    show() { cv.style.visibility = ''; place(); },
  };
  return perched;
}

// ---- the weapons: 1 machine gun, 2 flamethrower, 3 rockets; right click is always a grenade ----
const WEAPONS = [
  { name: 'gun', every: 40 },
  { name: 'flame', every: 16 },
  { name: 'rocket', every: 280 },
];

let game = null;
export function start(button) {
  if (game) return;
  game = createGame(button);
}

function createGame(button) {
  const root = document.documentElement, css = getComputedStyle(root);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const ink = v('--ink', '#ece9e2'), muted = v('--muted', '#94949b'), bgRGB = v('--bg-rgb', '10, 11, 14');
  const butter = v('--butter', '#f0d264'), rose = v('--rose', '#f08aa6');
  const bg = bgRGB.split(',').map(Number);
  // fire keeps its own colours: the page's light-mode tones are darkened for text and would burn brown
  const FW = '#fff4d6', FY = '#f6d35a', FO = '#f0883e', FR = '#d2402a';
  // real-looking fire and smoke: soft round glows, white-hot to yellow to orange to deep red, blended additively on the dark
  // page (it lights up what is behind it) and laid over normally on the light one
  const lightPage = root.dataset.theme === 'light';
  const glow = (r, g, b, a = 1) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.55})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  };
  const RAMP = [[255, 250, 225], [255, 226, 130], [255, 190, 70], [255, 140, 40], [240, 95, 25], [200, 55, 15], [130, 30, 10], [60, 20, 12]];
  const HEAT = Array.from({ length: 24 }, (_, i) => {
    const f = i / 23 * (RAMP.length - 1), a = RAMP[Math.floor(f)], b = RAMP[Math.min(RAMP.length - 1, Math.floor(f) + 1)], k = f % 1;
    return glow(...a.map((v, j) => Math.round(v + (b[j] - v) * k)));
  });
  const SMOKE = lightPage ? glow(95, 95, 102) : glow(120, 118, 122);
  const PLUME = lightPage ? glow(40, 38, 38) : glow(74, 70, 70);   // a blast's smoke is thick and dark
  const heat = (q) => HEAT[Math.min(23, Math.max(0, Math.round(q * 23)))];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seat = button ? perch(button) : null;

  const frames = {};
  for (const k of ['stand', 'a', 'b', 'c', 'jump']) frames[k] = [sprite([...HEAD, ...LEGS[k]], false), sprite([...HEAD, ...LEGS[k]], true)];

  // the layer he plays on
  const canvas = document.createElement('canvas');
  canvas.className = 'dx-layer'; canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const rubble = document.createElement('canvas'), rctx = rubble.getContext('2d');
  const hud = document.createElement('div');
  hud.className = 'dx-hud';
  // one quiet row: the three weapons, how much is gone, and the way out
  hud.innerHTML = `${WEAPONS.map((w, i) => `<button type="button" data-w="${i}"><i>${i + 1}</i> ${w.name}</button>`).join('')}<b role="status"></b><button type="button" class="dx-mute"><i>m</i> sound</button><button type="button" class="dx-esc">esc</button>`;
  const hudScore = hud.querySelector('b'), chips = [...hud.querySelectorAll('[data-w]')], muteChip = hud.querySelector('.dx-mute');
  document.body.append(canvas, hud);

  let W = 0, H = 0, dpr = 1, heap = new Float32Array(1);
  const COL = 3;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    for (const c of [canvas, rubble]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.imageSmoothingEnabled = false;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    heap = new Float32Array(Math.ceil(W / COL) + 2);
  }
  resize();

  // ---- the page, as things that can break ----
  const targets = [];
  const sampler = document.createElement('canvas'); sampler.width = sampler.height = 1;
  const sx = sampler.getContext('2d', { willReadFrequently: true });

  const seen = new Set();
  // what is on screen now; called again as the visitor scrolls, so every section can be taken apart
  function collect() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      if (el === canvas || el.closest('script, style, template, noscript, dialog:not([open]), .dx-layer, .dx-hud, .destroy-perch')) continue;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'svg' && el.closest('svg')) continue;
      const media = ['img', 'canvas', 'video', 'svg', 'button', 'input'].includes(tag);
      const text = !media && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!media && !text) continue;
      if (seen.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
      if (el.checkVisibility ? !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : getComputedStyle(el).visibility !== 'visible') continue;
      const t = target(el, r, tag, text);
      seen.add(el); targets.push(t);
      if (t.gl) { t.snap = document.createElement('canvas'); t.sctx = t.snap.getContext('2d', { willReadFrequently: true }); t.snapAt = 0; snaps.set(el, t); }
    }
    targets.sort((a, b) => a.area - b.area);   // the smallest thing under a shot takes it
  }

  function target(el, r, tag, text) {
    const w0 = Math.ceil(r.width), h0 = Math.ceil(r.height), cols = Math.ceil(w0 / CELL), rows = Math.ceil(h0 / CELL);
    const big = r.width * r.height > W * H * 0.35;
    const t = { el, r, tag, w0, h0, cols, rows, big, grid: new Uint8Array(cols * rows), cut: null, total: 0, alive: 0, dead: false, area: r.width * r.height,
      color: getComputedStyle(el).color || ink, lines: [], dirty: false,
      gl: tag === 'canvas' && big,   // the full-screen WebGL canvases: the portrait, his clips
      prev: { clip: el.style.clipPath, wclip: el.style.webkitClipPath, vis: el.style.visibility } };
    if (text) {
      const range = document.createRange(); range.selectNodeContents(el);
      for (const q of range.getClientRects()) if (q.width > 2 && q.height > 4) t.lines.push({ x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height });
      for (const l of t.lines) fill(t, l.x, l.y, l.w, l.h);
    } else {
      fill(t, 0, 0, w0, h0);
      if (!big) t.lines.push({ x: 0, y: 0, w: w0, h: Math.min(h0, 24) });
    }
    t.alive = t.total;
    if (t.gl) t.total = t.alive = 0;   // counted from its frames
    return t;
  }
  function fill(t, x, y, w, h) {
    const c0 = Math.max(0, Math.floor(x / CELL)), c1 = Math.min(t.cols - 1, Math.floor((x + w - 1) / CELL));
    const r0 = Math.max(0, Math.floor(y / CELL)), r1 = Math.min(t.rows - 1, Math.floor((y + h - 1) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = r * t.cols + c; if (!t.grid[i]) { t.grid[i] = 1; t.total++; } }
  }
  const cellOf = (t, x, y) => {
    const c = Math.floor((x - t.r.left) * (t.w0 / t.r.width) / CELL), r = Math.floor((y - t.r.top) * (t.h0 / t.r.height) / CELL);
    return c < 0 || r < 0 || c >= t.cols || r >= t.rows ? -1 : r * t.cols + c;
  };

  // the big WebGL canvases (the pixel portrait, his clips) only count where something is drawn: the site hands us each frame
  const snaps = new Map();
  window.__destroyPaint = (c, glowInfo) => {
    const t = snaps.get(c); if (!t) return;
    if (glowInfo) backdrop(t, glowInfo);
    const now = performance.now(); if (now - t.snapAt < 200) return; t.snapAt = now;
    // one snapshot pixel per grid cell, so a cell's index reads its pixel straight off
    const w = t.cols, h = t.rows;
    if (t.snap.width !== w || t.snap.height !== h) { t.snap.width = w; t.snap.height = h; }
    t.sctx.clearRect(0, 0, w, h);
    try { t.sctx.drawImage(c, 0, 0, w, h); t.sdata = t.sctx.getImageData(0, 0, w, h).data; } catch { t.sdata = null; }
    // its share of the score follows what it shows now (his portrait changes as the page scrolls): drawn cells, and how many of them are cut
    if (t.sdata) {
      const d = t.sdata, cut = t.cut, b0 = bg[0], b1 = bg[1], b2 = bg[2];
      let drawnCells = 0, cutDrawn = 0;
      for (let i = 0, j = 0; i < t.grid.length; i++, j += 4) {
        const a = d[j + 3]; if (a < 90) continue;
        const k = 255 / a;
        if (Math.abs(d[j] * k - b0) + Math.abs(d[j + 1] * k - b1) + Math.abs(d[j + 2] * k - b2) <= 70) continue;
        drawnCells++; if (cut && cut[i]) cutDrawn++;
      }
      t.total = drawnCells; t.alive = drawnCells - cutDrawn;
    }
  };
  function backdrop(t, g) {
    const el = t.el;
    if (!t.back) {
      t.back = document.createElement('canvas'); t.back.className = 'dx-back'; t.back.setAttribute('aria-hidden', 'true');
      el.parentElement.insertBefore(t.back, el);
    }
    const b = t.back, key = [g.cx, g.cy, g.scale, g.glow, g.light, el.width, el.height].map((n) => Math.round(n * 100)).join();
    if (key === t.backKey) return;
    t.backKey = key;
    Object.assign(b.style, { left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` });
    if (b.width !== el.width || b.height !== el.height) { b.width = el.width; b.height = el.height; }
    const x = b.getContext('2d'); x.clearRect(0, 0, b.width, b.height);
    const k = (g.light ? 0.05 : 0.1) * g.glow;   // stage.js BACK_FS: mix(DEEP, BLUE, .35) * k * exp(-6.5 r^2)
    if (k < 0.002) return;
    x.save(); x.translate(g.cx, g.cy - 0.14 * g.scale); x.scale(g.scale / 1.45, g.scale);
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1.3);
    for (let i = 0; i <= 16; i++) { const r = i / 16 * 1.3; gr.addColorStop(i / 16, `rgba(70,91,205,${k * Math.exp(-6.5 * r * r)})`); }
    x.fillStyle = gr; x.fillRect(-4, -4, 8, 8);
    x.restore();
  }
  function snapPixel(t, x, y) {
    if (!t.sdata) return null;
    const cell = cellOf(t, x, y);
    if (cell < 0) return null;
    const i = cell * 4, d = t.sdata;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }
  function drawn(t, x, y) {
    if (!t.gl) return true;
    const p = snapPixel(t, x, y);
    if (!p || p[3] < 90) return false;
    const a = p[3] / 255, diff = Math.abs(p[0] / a - bg[0]) + Math.abs(p[1] / a - bg[1]) + Math.abs(p[2] / a - bg[2]);
    return diff > 70;
  }

  function colorAt(t, x, y) {
    try {
      if (t.gl) { const p = snapPixel(t, x, y); if (p && p[3] > 40) return `rgb(${p[0] * 255 / p[3] | 0},${p[1] * 255 / p[3] | 0},${p[2] * 255 / p[3] | 0})`; return t.color; }
      if (t.tag === 'img' || t.tag === 'video' || t.tag === 'canvas') {
        const el = t.el, nw = el.naturalWidth || el.videoWidth || el.width, nh = el.naturalHeight || el.videoHeight || el.height;
        if (!nw || !nh) return t.color;
        sx.clearRect(0, 0, 1, 1);
        sx.drawImage(el, Math.floor((x - t.r.left) / t.r.width * nw), Math.floor((y - t.r.top) / t.r.height * nh), 1, 1, 0, 0, 1, 1);
        const d = sx.getImageData(0, 0, 1, 1).data;
        if (d[3] > 40) return `rgb(${d[0]},${d[1]},${d[2]})`;
      }
    } catch { /* a cross-origin or unready picture: fall back to its ink */ }
    return t.color;
  }

  // holes are cut with an even-odd clip path on the real element (live text, his clips, the portrait). A path changes
  // in place on the next paint, with nothing to load, so nothing blinks
  function pushClip(t, now) {
    if (!t.dirty || t.dead) return;
    if (t.gl && now - (t.clipAt || 0) < 70) return;
    t.dirty = false; t.clipAt = now;
    const kx = t.r.width / t.w0, ky = t.r.height / t.h0, f = (n) => Math.round(n * 10) / 10;
    let d = `M0 0H${f(t.r.width)}V${f(t.r.height)}H0Z`;
    for (let r = 0; r < t.rows; r++) {
      let c = 0;
      while (c < t.cols) {
        if (!t.cut[r * t.cols + c]) { c++; continue; }
        const c0 = c; while (c < t.cols && t.cut[r * t.cols + c]) c++;
        d += `M${f(c0 * CELL * kx)} ${f(r * CELL * ky)}h${f((c - c0) * CELL * kx)}v${f(CELL * ky)}h${f(-(c - c0) * CELL * kx)}Z`;
      }
    }
    t.el.style.clipPath = t.el.style.webkitClipPath = `path(evenodd, "${d}")`;
  }

  function punch(t, x, y, R, debris) {
    if (t.dead) return 0;
    if (!t.cut) t.cut = new Uint8Array(t.grid.length);
    const kx = t.w0 / t.r.width, ky = t.h0 / t.r.height;
    const lx = (x - t.r.left) * kx, ly = (y - t.r.top) * ky;
    const c0 = Math.max(0, Math.floor((lx - R) / CELL)), c1 = Math.min(t.cols - 1, Math.floor((lx + R) / CELL));
    const r0 = Math.max(0, Math.floor((ly - R) / CELL)), r1 = Math.min(t.rows - 1, Math.floor((ly + R) / CELL));
    let n = 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const dx = c * CELL + CELL / 2 - lx, dy = r * CELL + CELL / 2 - ly;
      if (dx * dx + dy * dy > (R * (0.7 + Math.random() * 0.45)) ** 2) continue;
      const i = r * t.cols + c, wx = t.r.left + (c * CELL + CELL / 2) / kx, wy = t.r.top + (r * CELL + CELL / 2) / ky;
      // on the big canvases only what is drawn breaks (his picture, a star); the page's own backdrop around it stays
      if (t.gl && !drawn(t, wx, wy)) continue;
      if (!t.cut[i]) { t.cut[i] = 1; t.dirty = true; }
      if (!t.grid[i]) continue;
      t.grid[i] = 0; n++;
      if (!t.gl) t.alive--;
      if (Math.random() < debris) {
        const a = Math.atan2(wy - y, wx - x), s = 120 + Math.random() * 380;
        bit(wx, wy, Math.cos(a) * s, Math.sin(a) * s - 260, colorAt(t, wx, wy));
      }
    }
    if (!t.big && t.alive < t.total * 0.15) collapse(t);   // holes first; a block only lets go of its last pieces
    return n;
  }

  // a thing that is nearly gone lets its last pieces fall as points, like everything else on this page
  function collapse(t) {
    t.dead = true;
    const solid = [];
    for (let i = 0; i < t.grid.length; i++) if (t.grid[i]) solid.push(i);
    const take = Math.min(solid.length, 160), kx = t.w0 / t.r.width, ky = t.h0 / t.r.height;
    for (let k = 0; k < take; k++) {
      const i = solid[(Math.random() * solid.length) | 0], c = i % t.cols, r = (i / t.cols) | 0;
      const wx = t.r.left + (c * CELL + CELL / 2) / kx, wy = t.r.top + (r * CELL + CELL / 2) / ky;
      bit(wx, wy, (Math.random() - 0.5) * 160, -Math.random() * 180, colorAt(t, wx, wy));
    }
    t.alive = 0;
    t.el.style.visibility = 'hidden';
    sfx.crumble();
  }

  // ---- bits, rubble, sparks, flames ----
  const bits = [], sparks = [], flames = [], fires = [], smoke = [], licks = [];
  // a lick: one soft tongue of flame rising off a fire or out of a blast
  function lick(x, y, vx, vy, size, life) { if (licks.length < 1400) licks.push({ x, y, vx, vy, s: size, life, t: 0, seed: Math.random() * 10 }); }
  // a fire is pinned to the thing it is burning (so it scrolls with it), eats a little of it now and then, may creep to a
  // neighbouring spot, and gives off smoke. It dies when it runs out of time or of page to burn
  function ignite(t, x, y, life = 2 + Math.random() * 2.5) {
    if (!t || t.dead || fires.length >= 60 || !drawn(t, x, y)) return;
    for (const f of fires) if (f.t === t && Math.abs(f.x - x) < 10 && Math.abs(f.y - y) < 10) { f.life = Math.max(f.life, f.age + life * 0.6); return; }
    fires.push({ t, lx: (x - t.r.left) * t.w0 / t.r.width, ly: (y - t.r.top) * t.h0 / t.r.height, x, y, age: 0, life, eat: 0.2 + Math.random() * 0.3, seed: Math.random() * 100, size: 0.75 + Math.random() * 0.35 });
  }
  // set fire to the edge of a fresh hole: the first bit of page still standing, looking outward from it
  function rim(x, y, r, life) {
    const a0 = Math.random() * 6.283;
    for (let k = 0; k < 8; k++) {
      const a = a0 + k * 0.785, fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r, t = hitAt(fx, fy);
      if (t) { ignite(t, fx, fy, life); return; }
    }
  }
  function puff(x, y, big = 1, dark = false) {
    if (smoke.length > 320) smoke.shift();
    smoke.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 20 + 8, vy: (dark ? -70 - Math.random() * 70 : -30 - Math.random() * 40), t: 0, life: (dark ? 2.6 : 1.8) + Math.random() * 1.6, s0: (8 + Math.random() * 6) * big, s1: (34 + Math.random() * 26) * big, dark });
  }
  function bit(x, y, vx, vy, c, burn = 0) {
    if (bits.length > 1800) bits.shift();
    bits.push({ x, y, vx, vy, c, s: burn ? 5 : Math.random() < 0.5 ? 3 : 4, burn });
  }
  function spark(x, y, vx, vy, c, life) { if (sparks.length < 700) sparks.push({ x, y, vx, vy, c, life, t: life }); }
  const heapAt = (x) => heap[Math.max(0, Math.min(heap.length - 1, Math.floor(x / COL)))];
  function heapUnder(x0, x1) { let m = 0; for (let i = Math.max(0, Math.floor(x0 / COL)); i <= Math.min(heap.length - 1, Math.floor(x1 / COL)); i++) m = Math.max(m, heap[i]); return m; }
  function settle(b) {
    let i = Math.max(0, Math.min(heap.length - 1, Math.floor(b.x / COL)));
    for (let k = 0; k < 6; k++) {            // sand: roll to a lower neighbour
      const l = i > 0 ? heap[i - 1] : Infinity, r = i < heap.length - 1 ? heap[i + 1] : Infinity;
      if (l + b.s < heap[i] && l <= r) i--; else if (r + b.s < heap[i]) i++; else break;
    }
    const top = Math.min(heap[i] + b.s * 0.7, H * 0.34);
    rctx.fillStyle = b.c; rctx.fillRect(i * COL, H - heap[i] - b.s, b.s, b.s);
    for (let j = i; j < Math.min(heap.length, i + Math.ceil(b.s / COL)); j++) heap[j] = Math.max(heap[j], top);
  }

  // ---- sound: a few square-wave blips, made here, nothing fetched ----
  let ac = null, master = null, meter = null, mute = false;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 1; const squash = ac.createDynamicsCompressor(); squash.threshold.value = -12; squash.ratio.value = 6; master.connect(squash).connect(ac.destination); meter = ac.createAnalyser(); meter.fftSize = 1024; master.connect(meter); } catch { ac = null; }
  const wake = () => { if (ac?.state === 'suspended') ac.resume(); };
  const setMute = (on) => { mute = on; if (master) master.gain.value = on ? 0 : 1; muteChip.classList.toggle('on', on); muteChip.lastChild.textContent = on ? ' muted' : ' sound'; };
  const sfx = {
    tone(f0, f1, dur, vol = 0.12, type = 'square') {
      if (!ac || mute) return;
      const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, freq, type = 'lowpass') {
      if (!ac || mute) return;
      const t0 = ac.currentTime, len = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f).connect(g).connect(master); s.start(t0);
    },
    // two seconds of white noise, looped by everything that hisses, roars or whooshes
    hiss() {
      if (!this.buf) { const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.buf = buf; }
      const s = ac.createBufferSource(); s.buffer = this.buf; s.loop = true; return s;
    },
    // the fire bed: a low roar and a high hiss that swell with how much is burning, flickering a little
    burn(level) {
      if (!ac) return;
      if (!this.bed) {
        const roar = this.hiss(), rf = ac.createBiquadFilter(), rg = ac.createGain(); rf.type = 'lowpass'; rf.frequency.value = 420; rf.Q.value = 0.7; rg.gain.value = 0;
        const air = this.hiss(), af = ac.createBiquadFilter(), ag = ac.createGain(); af.type = 'bandpass'; af.frequency.value = 2600; af.Q.value = 0.6; ag.gain.value = 0;
        roar.connect(rf).connect(rg).connect(master); air.connect(af).connect(ag).connect(master); roar.start(); air.start();
        this.bed = { rg, ag, rf, at: 0 };
      }
      const b = this.bed, t = ac.currentTime, now = performance.now();
      if (now - b.at < 50) return; b.at = now;
      const flick = 0.75 + Math.random() * 0.25;
      b.rg.gain.setTargetAtTime((mute ? 0 : level * 0.55) * flick, t, 0.08);
      b.ag.gain.setTargetAtTime((mute ? 0 : level * 0.12) * flick, t, 0.05);
      b.rf.frequency.setTargetAtTime(380 + level * 260 + Math.random() * 120, t, 0.1);
    },
    crackle() { if (!ac || mute) return; this.noise(0.012 + Math.random() * 0.02, 0.35 + Math.random() * 0.3, 1800 + Math.random() * 3000, 'highpass'); },
    // a rocket: a whoosh as it leaves, then a whine that follows it until it hits
    rocket() {
      if (!ac || mute) return null;
      const t0 = ac.currentTime;
      this.noise(0.35, 0.5, 2200, 'bandpass');
      const w = this.hiss(), wf = ac.createBiquadFilter(), wg = ac.createGain(); wf.type = 'bandpass'; wf.Q.value = 1.2;
      wf.frequency.setValueAtTime(900, t0); wf.frequency.exponentialRampToValueAtTime(2400, t0 + 0.4);
      wg.gain.setValueAtTime(0.0001, t0); wg.gain.exponentialRampToValueAtTime(0.22, t0 + 0.06); wg.gain.exponentialRampToValueAtTime(0.1, t0 + 1.5);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(260, t0 + 1.2);
      og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.06, t0 + 0.05);
      w.connect(wf).connect(wg).connect(master); o.connect(og).connect(master); w.start(t0); o.start(t0);
      return { stop() { const t = ac.currentTime; wg.gain.cancelScheduledValues(t); wg.gain.setTargetAtTime(0, t, 0.03); og.gain.setTargetAtTime(0, t, 0.02); w.stop(t + 0.3); o.stop(t + 0.3); } };
    },
    gun() { this.tone(700, 160, 0.05, 0.16); this.noise(0.04, 0.4, 3000); },

    hit() { if (performance.now() - (this.lh || 0) > 45) { this.lh = performance.now(); this.noise(0.05, 0.3, 2400); } },
    // a blast: a sub-bass thump that falls away, a crack, and a long rolling tail
    boom() {
      if (!ac || mute) return;
      this.noise(0.08, 0.9, 4000, 'highpass');
      this.noise(1.4, 1, 520);
      this.tone(90, 24, 0.9, 0.5, 'sine');
      this.tone(60, 20, 0.6, 0.35, 'triangle');
    },
    crumble() { this.noise(0.25, 0.45, 1200); },
    jump() { this.tone(300, 620, 0.09, 0.08); },
    land() { this.noise(0.06, 0.25, 500); },
    pick() { this.tone(520, 780, 0.06, 0.08); },
  };

  // ---- him: he hops down off the button he was sitting on ----
  const from = seat?.seat() ?? { x: innerWidth / 2, y: -40 };
  seat?.hide(); wake();
  const p = { x: from.x, y: from.y, vx: 0, vy: -520, ground: false, plat: null, face: 1, fuel: FUEL, drop: 0, run: 0, flash: 0 };
  const keys = new Set(); let jumpEdge = false, dropEdge = false, firing = false, mx = W / 2, my = H / 2, lastShot = 0, weapon = 0;
  const bullets = [], rockets = [], nades = [], booms = [];
  let plats = [], rescan = false, scanAt = 0, shake = 0, last = performance.now(), refreshAt = 0, raf = 0, startedAt = last, wrecked = false;

  // the portrait and his clips change as the page scrolls, so their holes are tied to the picture of the moment: scrolling on
  // brings the next picture whole (text and links keep every hole they took)
  let healY = scrollY;
  function heal() {
    healY = scrollY;
    for (const t of targets) {
      if (!t.gl || !t.cut) continue;
      t.cut.fill(0); t.grid.fill(1); t.dirty = false;
      t.el.style.clipPath = t.prev.clip; t.el.style.webkitClipPath = t.prev.wclip;
    }
    for (let i = fires.length - 1; i >= 0; i--) if (fires[i].t.gl) fires.splice(i, 1);
  }
  function refresh() {
    plats = [];
    for (const t of targets) {
      if (t.dead) continue;
      t.r = t.el.getBoundingClientRect();
      // scrolled away or faded out by the page: not there to hit or stand on, but its holes stay for when it comes back
      t.off = t.r.width < 1 || t.r.height < 1 || t.r.bottom < 0 || t.r.top > H || (t.el.checkVisibility ? !t.el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : false);
      if (t.off) continue;
      const kx = t.r.width / t.w0, ky = t.r.height / t.h0;
      for (const l of t.lines) plats.push({ t, l, x0: t.r.left + l.x * kx, x1: t.r.left + (l.x + l.w) * kx, y: t.r.top + (l.y + l.h * 0.16) * ky, mid: t.r.top + (l.y + l.h * 0.5) * ky });
    }
  }
  function standable(q, x) {
    if (q.t.dead || q.t.off) return false;
    for (const dx of [-HW * 0.6, 0, HW * 0.6]) for (const dy of [-CELL, 0, CELL]) {
      const i = cellOf(q.t, Math.max(q.x0, Math.min(q.x1 - 1, x + dx)), q.mid + dy);
      if (i >= 0 && q.t.grid[i]) return true;
    }
    return false;
  }

  const shoulder = () => ({ x: p.x + p.face * 1.5 * PX, y: p.y - 24 * PX + 12.5 * PX });
  const muzzle = (a, s = shoulder()) => ({ x: s.x + Math.cos(a) * 10 * PX, y: s.y + Math.sin(a) * 10 * PX });

  function pick(i) {
    if (i === weapon || i < 0 || i >= WEAPONS.length) return;
    weapon = i; lastShot = 0; sfx.pick();   // a new weapon fires on the very next click
    chips.forEach((c, k) => c.classList.toggle('on', k === weapon));
  }
  chips.forEach((c) => c.addEventListener('click', () => pick(+c.dataset.w)));
  chips[0].classList.add('on');
  hud.querySelector('.dx-esc').addEventListener('click', () => stop());
  muteChip.addEventListener('click', () => { wake(); setMute(!mute); });

  function fire(now) {
    lastShot = now;
    const s = shoulder(), aim = Math.atan2(my - s.y, mx - s.x);
    if (weapon === 0) {
      const a = aim + (Math.random() - 0.5) * 0.12, m = muzzle(a, s);
      bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * 2000, vy: Math.sin(a) * 2000, life: 1 });
      p.flash = 0.04; p.vx -= Math.cos(a) * 10;
      sfx.gun();
    } else if (weapon === 1) {
      // a dense cone that reaches about 350px and burns its way in: each lick can bite four times before it dies
      const m = muzzle(aim, s);
      for (let k = 0; k < 5; k++) {
        const a = aim + (Math.random() - 0.5) * 0.3, sp = 820 + Math.random() * 280;
        flames.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp + p.vx * 0.5, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.25, t: 0, burn: 4 });
      }
    } else {
      const m = muzzle(aim, s);
      rockets.push({ x: m.x, y: m.y, vx: Math.cos(aim) * 1250, vy: Math.sin(aim) * 1250, life: 2, snd: sfx.rocket() });
      p.flash = 0.08; p.vx -= Math.cos(aim) * 90;
    }
  }
  function throwNade() {
    if (nades.length >= 4) return;
    const s = shoulder(), a = Math.atan2(my - s.y, mx - s.x), sp = Math.min(860, 320 + Math.hypot(mx - s.x, my - s.y) * 1.4);
    nades.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp + p.vx * 0.4, vy: Math.sin(a) * sp, fuse: 0.8 });
    sfx.tone(500, 260, 0.08, 0.02);
  }
  function hitAt(x, y) {
    for (const t of targets) {
      if (t.dead || t.off || x < t.r.left || x >= t.r.right || y < t.r.top || y >= t.r.bottom) continue;
      const i = cellOf(t, x, y);
      if (i < 0 || !t.grid[i] || !drawn(t, x, y)) continue;
      return t;
    }
    return null;
  }
  // a small hit: the thing hit, and anything small stacked with it under that point
  function strike(t, x, y, R, debris) {
    punch(t, x, y, R, debris);
    for (const o of targets) if (o !== t && !o.big && !o.dead && !o.off && x > o.r.left && x < o.r.right && y > o.r.top && y < o.r.bottom) punch(o, x, y, R, debris * 0.4);
  }
  function explode(x, y, R) {
    for (const t of targets) {
      if (t.dead || t.off || x + R < t.r.left || x - R > t.r.right || y + R < t.r.top || y - R > t.r.bottom) continue;
      punch(t, x, y, R, t.big ? 0.1 : 0.3);
    }
    // the rubble pile takes a bite too
    for (let i = Math.max(0, Math.floor((x - R) / COL)); i <= Math.min(heap.length - 1, Math.floor((x + R) / COL)); i++) {
      const d = Math.abs(i * COL - x) / R; if (y > H - heap[i] - R) heap[i] = Math.max(0, heap[i] - (1 - d) * R * 0.5);
    }
    rctx.save(); rctx.globalCompositeOperation = 'destination-out'; rctx.fillStyle = '#000';
    for (let k = 0; k < 90; k++) { const a = Math.random() * 6.283, d = Math.random() * R * 0.9; rctx.fillRect(Math.round((x + Math.cos(a) * d) / 4) * 4, Math.round((y + Math.sin(a) * d) / 4) * 4, 8, 8); }
    rctx.restore();
    booms.push({ x, y, R, t: 0 });
    for (let k = 0; k < 70; k++) { const a = Math.random() * 6.283, sp = 60 + Math.random() * R * 3.2; lick(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 18 + Math.random() * 26, 0.35 + Math.random() * 0.45); }
    // a blast is not a fire: a flash, a shock ring, a column of dark smoke, burning chunks, a rim that glows and cools
    for (let k = 0; k < 2; k++) rim(x, y, R * (0.85 + Math.random() * 0.3), 0.8 + Math.random() * 0.8);
    for (let k = 0; k < 10; k++) puff(x + (Math.random() - 0.5) * R * 0.8, y + (Math.random() - 0.5) * R * 0.5, 1.8, true);
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 380 + Math.random() * 420; bit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, '#2b2220', 0.9 + Math.random() * 0.8); }
    for (let k = 0; k < 44; k++) { const a = Math.random() * 6.283, s = 150 + Math.random() * 520; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, [FY, FO, FW, FR][k % 4], 0.3 + Math.random() * 0.4); }
    const dx = p.x - x, dy = p.y - 30 - y, d = Math.hypot(dx, dy);
    if (d < R * 1.4) { p.vx += dx / (d + 1) * 420; p.vy += dy / (d + 1) * 420 - 180; p.ground = false; }
    if (!calm) shake = 9;
    sfx.boom();
  }

  function step(dt, now) {
    if (rescan && now > scanAt) { rescan = false; scanAt = now + 200; collect(); refreshAt = 0; if (Math.abs(scrollY - healY) > 24) heal(); }
    if (now > refreshAt) { refreshAt = now + 250; refresh(); }
    for (const t of targets) pushClip(t, now);

    const left = keys.has('a') || keys.has('arrowleft'), right = keys.has('d') || keys.has('arrowright');
    const jumpHeld = keys.has(' ') || keys.has('w') || keys.has('arrowup');
    const want = (right ? 1 : 0) - (left ? 1 : 0);
    p.vx += (want * RUN - p.vx) * Math.min(1, dt * (p.ground ? 22 : 6));
    if (jumpEdge && p.ground) { p.vy = -JUMP; p.ground = false; p.plat = null; sfx.jump(); }
    jumpEdge = false;
    if (jumpHeld && !p.ground && p.vy > -240 && p.fuel > 0) {
      p.vy = Math.max(-430, p.vy - FLY * dt); p.fuel -= dt;
      if (Math.random() < 0.8) spark(p.x - p.face * 4, p.y - 2, (Math.random() - 0.5) * 60, 220 + Math.random() * 160, Math.random() < 0.5 ? FY : FO, 0.22);
    }
    if (p.ground) p.fuel = Math.min(FUEL, p.fuel + dt * 2.5);
    if ((dropEdge || keys.has('s') || keys.has('arrowdown')) && p.plat) { p.drop = now + 260; p.ground = false; p.plat = null; }
    dropEdge = false;

    p.vy = Math.min(p.vy + GRAV * dt, 1400);
    const py = p.y;
    p.x = Math.max(WALL, Math.min(W - WALL, p.x + p.vx * dt)); p.y += p.vy * dt;
    const wasGround = p.ground; p.ground = false; p.plat = null;
    if (p.vy >= 0) {
      let best = null;
      const floor = H - heapUnder(p.x - HW * 0.5, p.x + HW * 0.5);
      if (p.y >= floor) best = { y: floor, q: null };
      if (now > p.drop) for (const q of plats) {
        if (p.x + HW * 0.6 < q.x0 || p.x - HW * 0.6 > q.x1) continue;
        if (py <= q.y + (wasGround ? 6 : 1) && p.y >= q.y && (!best || q.y < best.y) && standable(q, p.x)) best = { y: q.y, q };
      }
      if (best) { if (!wasGround && p.vy > 500) sfx.land(); p.y = best.y; p.vy = 0; p.ground = true; p.plat = best.q; }
    }
    if (p.y > H + 200) { p.y = -40; p.vy = 0; }
    p.face = mx >= p.x ? 1 : -1;
    p.run = p.ground && Math.abs(p.vx) > 40 ? p.run + dt * Math.abs(p.vx) / 26 : 0;
    p.flash = Math.max(0, p.flash - dt);

    if (firing && now - lastShot > WEAPONS[weapon].every) fire(now);

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.life -= dt;
      const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
      let gone = b.life <= 0;
      for (let k = 0; k < n && !gone; k++) {
        b.x += b.vx * dt / n; b.y += b.vy * dt / n;
        if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { gone = true; break; }
        if (b.y >= H - heapAt(b.x)) { gone = true; for (let j = 0; j < 4; j++) spark(b.x, b.y, (Math.random() - 0.5) * 200, -Math.random() * 200, muted, 0.25); break; }
        const t = hitAt(b.x, b.y);
        if (t) {
          strike(t, b.x, b.y, 15, 0.55);
          for (let j = 0; j < 3; j++) spark(b.x, b.y, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, butter, 0.12);
          sfx.hit(); gone = true;
        }
      }
      if (gone) bullets.splice(i, 1);
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const b = rockets[i]; b.life -= dt;
      const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4);
      let at = null;
      for (let k = 0; k < n && !at; k++) {
        b.x += b.vx * dt / n; b.y += b.vy * dt / n;
        if (b.y >= H - heapAt(b.x) || hitAt(b.x, b.y)) at = b;
      }
      if (Math.random() < 0.9) spark(b.x - b.vx * 0.012, b.y - b.vy * 0.012, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, FY, 0.2);
      if (Math.random() < 0.6) puff(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 0.6);
      if (at) { rockets.splice(i, 1); b.snd?.stop(); explode(b.x, b.y, 96); }
      else if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) { rockets.splice(i, 1); b.snd?.stop(); }
    }

    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]; f.t += dt;
      if (f.t >= f.life) { flames.splice(i, 1); continue; }
      f.vx *= 1 - dt * 1.6; f.vy = f.vy * (1 - dt * 1.6) - 320 * dt;
      for (let k = 0; k < 2 && f.burn > 0; k++) {
        f.x += f.vx * dt / 2; f.y += f.vy * dt / 2;
        const t = hitAt(f.x, f.y);
        if (!t) continue;
        strike(t, f.x, f.y, 13, 0.25);
        if (Math.random() < 0.35) rim(f.x, f.y, 16);
        if (Math.random() < 0.5) spark(f.x, f.y, (Math.random() - 0.5) * 160, -60 - Math.random() * 160, Math.random() < 0.5 ? FY : FO, 0.4);
        f.vx *= 0.55; f.vy *= 0.55;
        if (--f.burn <= 0) f.life = Math.min(f.life, f.t + 0.1);
      }
      if (f.burn <= 0) { f.x += f.vx * dt; f.y += f.vy * dt; }
    }

    for (let i = nades.length - 1; i >= 0; i--) {
      const g = nades[i]; g.fuse -= dt;
      g.vy += GRAV * 0.8 * dt;
      const gy = g.y; g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.x < 4 || g.x > W - 4) { g.vx *= -0.6; g.x = Math.max(4, Math.min(W - 4, g.x)); }
      const floor = H - heapAt(g.x);
      if (g.y >= floor) { g.y = floor; g.vy *= -0.45; g.vx *= 0.7; }
      else if (g.vy > 0) for (const q of plats) if (g.x > q.x0 && g.x < q.x1 && gy <= q.y && g.y >= q.y && standable(q, g.x)) { g.y = q.y; g.vy *= -0.45; g.vx *= 0.75; break; }
      if (g.fuse <= 0) { nades.splice(i, 1); explode(g.x, g.y, 120); }
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      if (b.burn > 0) { b.burn -= dt; lick(b.x + 2, b.y + 2, 0, -20, 9, 0.22); if (Math.random() < dt * 14) puff(b.x, b.y, 0.4, true); }
      b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - dt * 0.8;
      if (b.x < 0 || b.x > W - b.s) { b.vx *= -0.5; b.x = Math.max(0, Math.min(W - b.s, b.x)); }
      const floor = H - heapAt(b.x + b.s / 2) - b.s;
      if (b.y >= floor && b.vy > 0) {
        if (b.vy > 220) { b.y = floor; b.vy *= -0.3; b.vx *= 0.5; }
        else { settle(b); bits.splice(i, 1); }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t -= dt;
      if (s.t <= 0) { sparks.splice(i, 1); continue; }
      s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    }
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i]; f.age += dt;
      const t = f.t;
      if (f.age >= f.life || t.off) { fires.splice(i, 1); continue; }
      f.x = t.r.left + f.lx * t.r.width / t.w0; f.y = t.r.top + f.ly * t.r.height / t.h0;
      const strength = Math.min(1, f.age / 0.3) * Math.min(1, (f.life - f.age) / 0.8);
      for (let k = 0, n = dt * 32 * strength; k < n || Math.random() < n - k; k++) lick(f.x + (Math.random() - 0.5) * 9 * f.size, f.y + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 14, -38 - Math.random() * 46, (7 + Math.random() * 7) * f.size, 0.35 + Math.random() * 0.35);
      if (Math.random() < dt * 4 * strength) puff(f.x, f.y - 14 * f.size, 0.7);
      if (Math.random() < dt * 2.5 * strength) spark(f.x + (Math.random() - 0.5) * 8, f.y - 6, (Math.random() - 0.5) * 30, -60 - Math.random() * 80, Math.random() < 0.5 ? FY : FO, 0.6);
      if ((f.eat -= dt) <= 0 && !t.dead) {
        f.eat = 0.35 + Math.random() * 0.35;
        punch(t, f.x, f.y, 6 + Math.random() * 3, 0.15);
        if (Math.random() < 0.22) { const a = Math.random() * 6.283, nx = f.x + Math.cos(a) * 12, ny = f.y + Math.sin(a) * 9; if (hitAt(nx, ny) === t) ignite(t, nx, ny, 1.5 + Math.random() * 2); }
        // nothing left under it: it starves
        if (f.age > 0.8 && ![[0, 0], [-12, 0], [12, 0], [0, 10], [0, -10], [-9, 8], [9, 8]].some(([dx, dy]) => hitAt(f.x + dx, f.y + dy))) f.life = Math.min(f.life, f.age + 0.5);
      }
    }
    for (let i = licks.length - 1; i >= 0; i--) {
      const l = licks[i]; l.t += dt;
      if (l.t >= l.life) { licks.splice(i, 1); continue; }
      l.vy -= 60 * dt; l.vx += Math.sin(l.t * 14 + l.seed) * 40 * dt; l.vx *= 1 - dt * 2; l.vy *= 1 - dt * 1.2;
      l.x += l.vx * dt; l.y += l.vy * dt;
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const m = smoke[i]; m.t += dt;
      if (m.t >= m.life) { smoke.splice(i, 1); continue; }
      m.vy *= 1 - dt * 0.4; m.vx += 6 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
    }
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]; b.t += dt;
      if (b.t < 1.3 && Math.random() < dt * 16) puff(b.x + (Math.random() - 0.5) * b.R * 0.4, b.y - Math.random() * 20, 1.5 + Math.random(), true);   // the plume keeps rising a while
      if (b.t > 1.8) booms.splice(i, 1);
    }

    shake = Math.max(0, shake - dt * 40);

    const torch = firing && weapon === 1, blaze = Math.min(1, fires.length / 10) * 0.7 + (torch ? 0.6 : 0) + Math.min(0.3, licks.length / 1500);
    sfx.burn(Math.min(1, blaze));
    if (Math.random() < dt * (fires.length * 1.4 + (torch ? 14 : 0))) sfx.crackle();
  }

  // ---- drawing ----
  function px(x, y, s, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), s, s); }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = shake > 0 ? shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, (Math.random() - 0.5) * k * dpr, (Math.random() - 0.5) * k * dpr);
    ctx.drawImage(rubble, 0, 0, W, H);
    for (const b of bits) px(b.x, b.y, b.s, b.c);
    for (const s of sparks) { ctx.globalAlpha = Math.min(1, s.t / s.life * 1.6); px(s.x - 1.5, s.y - 1.5, 3, s.c); }
    // smoke first, so the fire glows through it
    for (const m of smoke) {
      const q = m.t / m.life, sz = m.s0 + (m.s1 - m.s0) * Math.sqrt(q);
      ctx.globalAlpha = (m.dark ? (lightPage ? 0.3 : 0.38) : (lightPage ? 0.2 : 0.16)) * (1 - q) * Math.min(1, m.t * 4);
      ctx.drawImage(m.dark ? PLUME : SMOKE, m.x - sz / 2, m.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = lightPage ? 'source-over' : 'lighter';
    // the warm light a fire throws on what is around it
    if (!lightPage) for (const f of fires) { const g = 56 * f.size; ctx.globalAlpha = 0.1 * Math.min(1, f.age / 0.3) * Math.min(1, (f.life - f.age) / 0.8); ctx.drawImage(HEAT[12], f.x - g / 2, f.y - g * 0.6, g, g); }
    // the stream from the flamethrower: hot and tight at the nozzle, opening into orange and red
    for (const f of flames) {
      const q = f.t / f.life, sz = 8 + q * 30;
      ctx.globalAlpha = (lightPage ? 0.75 : 0.55) * (1 - q) ** 0.8;
      ctx.drawImage(heat(q * 0.95), f.x - sz / 2, f.y - sz / 2, sz, sz);
    }
    // fire on the page and fireballs: soft tongues that rise, cool and shrink
    for (const l of licks) {
      const q = l.t / l.life, sz = l.s * (1 - q * 0.65);
      ctx.globalAlpha = (lightPage ? 0.7 : 0.5) * (1 - q) ** 1.3;
      ctx.drawImage(heat(0.1 + q * 0.85), l.x - sz / 2, l.y - sz / 2, sz, sz);
    }
    // the flash of a blast
    for (const b of booms) {
      if (b.t < 0.4) { const f = b.t / 0.4, sz = b.R * 2.6 * (0.4 + 0.6 * Math.sqrt(f)); ctx.globalAlpha = (1 - f) ** 2 * 0.9; ctx.drawImage(heat(f * 0.5), b.x - sz / 2, b.y - sz / 2, sz, sz); }
      if (b.t < 0.28) { const f = b.t / 0.28; ctx.globalAlpha = (1 - f) * 0.8; ctx.strokeStyle = lightPage ? '#fff' : '#fff1dc'; ctx.lineWidth = 1 + 4 * (1 - f); ctx.beginPath(); ctx.arc(b.x, b.y, b.R * (0.4 + 2.1 * f), 0, 6.283); ctx.stroke(); }
      // the crater's edge glows, then cools from orange to dull red to nothing
      const c = b.t / 1.8, n = 40;
      for (let k = 0; k < n; k++) {
        const j = Math.sin(k * 12.9898 + b.R) * 0.5 + 0.5, a = k / n * 6.283 + j * 0.2, rr = b.R * (0.82 + j * 0.25), sz = b.R * (0.18 + j * 0.16);
        ctx.globalAlpha = 0.3 * (1 - c) ** 1.5 * (0.5 + j * 0.5);
        ctx.drawImage(heat(0.35 + c * 0.6), b.x + Math.cos(a) * rr - sz / 2, b.y + Math.sin(a) * rr - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const g of nades) { px(g.x - 4, g.y - 8, 8, '#2a3a24'); px(g.x - 2, g.y - 10, 4, '#555'); if ((g.fuse * 8 | 0) % 2) px(g.x - 1, g.y - 11, 3, rose); }
    for (const b of bullets) { const a = Math.atan2(b.vy, b.vx); for (let j = 0; j < 3; j++) px(b.x - Math.cos(a) * j * 3 - 1.5, b.y - Math.sin(a) * j * 3 - 1.5, 3, j ? butter : ink); }
    for (const b of rockets) { const a = Math.atan2(b.vy, b.vx); for (let j = 0; j < 4; j++) px(b.x - Math.cos(a) * j * 3 - 2.5, b.y - Math.sin(a) * j * 3 - 2.5, 5, j ? '#596070' : rose); }

    // him
    const pose = !p.ground ? 'jump' : p.run > 0 ? RUN_CYCLE[(p.run | 0) % 4] : 'stand';
    const bob = pose === 'b' ? -PX : 0;
    const ox = Math.round(p.x - 8 * PX), oy = Math.round(p.y - 24 * PX + bob);
    ctx.drawImage(frames[pose][p.face > 0 ? 0 : 1], ox - PX, oy - PX);
    // the arm and the weapon, turned toward the pointer, drawn pixel by pixel so they stay on his grid
    const s = shoulder(), aim = Math.atan2(my - s.y, mx - s.x);
    let la = p.face > 0 ? aim : Math.PI - aim; la = Math.atan2(Math.sin(la), Math.cos(la)); la = Math.max(-0.95, Math.min(1.2, la));   // never across his own face
    const ca = Math.cos(la), sa = Math.sin(la);
    const dot = (i, off, c) => { const col = Math.round(9 + ca * i - sa * off), row = Math.round(12 + sa * i + ca * off); px(ox + (p.face > 0 ? col : 15 - col) * PX, oy + row * PX, PX, c); };
    const len = weapon === 1 ? 11 : 10;
    for (let i = 1; i <= len; i++) { dot(i, -1 - (i > 5 ? 1 : 0) - (weapon === 2 && i > 5 ? 1 : 0), LINE); dot(i, 2, LINE); }
    dot(len, -1, LINE); dot(len, 0, LINE); dot(len, 1, LINE);
    for (let i = 0; i <= 4; i++) { dot(i, 0, PAL.U); dot(i, 1, PAL.u); }
    dot(5, 0, PAL.S); dot(5, 1, PAL.S);
    for (let i = 6; i < len; i++) {
      if (weapon === 0) { dot(i, 0, PAL.K); dot(i, -1, i > 7 ? PAL.K : PAL.k); dot(i, 1, i === 7 ? PAL.K : LINE); }
      else if (weapon === 1) { dot(i, 0, i > 8 ? '#8a8f9c' : '#c0392b'); dot(i, -1, i > 8 ? '#5a5f6b' : '#e05a48'); dot(i, 1, i === 7 ? PAL.K : LINE); }
      else { dot(i, 0, '#3d4a3a'); dot(i, -1, '#56664f'); dot(i, -2, '#3d4a3a'); dot(i, 1, i === 7 ? PAL.K : LINE); }
    }
    if (weapon === 1 && firing) { dot(len, 0, FY); dot(len, -1, FO); }
    if (p.flash > 0) { dot(len + 1, 0, butter); dot(len + 2, 0, ink); dot(len + 1, -1, rose); dot(len + 1, 1, rose); }
    // fuel, under him, only while it is being used
    if (p.fuel < FUEL - 0.02) { ctx.fillStyle = muted; ctx.fillRect(Math.round(p.x - 12), Math.round(p.y + 6), 24, 2); ctx.fillStyle = butter; ctx.fillRect(Math.round(p.x - 12), Math.round(p.y + 6), Math.round(24 * p.fuel / FUEL), 2); }

    // crosshair
    ctx.fillStyle = ink;
    for (const [dx, dy] of [[-9, 0], [-6, 0], [6, 0], [9, 0], [0, -9], [0, -6], [0, 6], [0, 9]]) ctx.fillRect(Math.round(mx + dx - 1.5), Math.round(my + dy - 1.5), 3, 3);
    ctx.fillStyle = rose; ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
  }

  function score() {
    let all = 0, left = 0;
    for (const t of targets) if (!t.big || t.gl) { all += t.total; left += t.alive; }
    return all ? 1 - left / all : 0;
  }
  let lastScore = '';
  function drawHud() {
    const pct = Math.round(score() * 100);
    if (pct >= 80 && !wrecked) { wrecked = true; sfx.tone(440, 880, 0.3, 0.04); }
    const sc = `${pct}%`;
    if (sc !== lastScore) { lastScore = sc; hudScore.textContent = sc; }
  }

  function loop(now) {
    const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
    step(dt, now); draw(); drawHud();
    raf = requestAnimationFrame(loop);
  }

  // ---- input; the wheel still scrolls the page, so he can take every section apart ----
  const GAME_KEYS = new Set(['a', 'd', 'w', 's', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', '1', '2', '3']);
  const on = [];
  const listen = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); on.push([el, type, fn, opt]); };
  listen(window, 'keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); stop(); return; }
    if (k === 'm' && !e.repeat) setMute(!mute);
    wake();
    if (GAME_KEYS.has(k)) e.preventDefault();
    if (k === '1' || k === '2' || k === '3') pick(+k - 1);
    if ((k === ' ' || k === 'w' || k === 'arrowup') && !keys.has(k)) jumpEdge = true;
    if (k === 's' || k === 'arrowdown') dropEdge = true;
    keys.add(k);
  }, { capture: true });
  listen(window, 'keyup', (e) => keys.delete(e.key.toLowerCase()), { capture: true });
  listen(window, 'blur', () => { keys.clear(); firing = false; });
  listen(window, 'pointermove', (e) => { mx = e.clientX; my = e.clientY; });
  listen(canvas, 'pointerdown', (e) => {
    mx = e.clientX; my = e.clientY;
    wake();
    if (e.button === 2) throwNade();
    else if (e.button === 0) { firing = true; if (performance.now() - lastShot > WEAPONS[weapon].every) fire(performance.now()); }
  });
  listen(window, 'pointerup', (e) => { if (e.button === 0) firing = false; });
  listen(canvas, 'contextmenu', (e) => e.preventDefault());
  listen(window, 'scroll', () => { rescan = true; refreshAt = 0; }, { passive: true });
  listen(window, 'resize', () => { resize(); refresh(); });

  collect();
  refresh();
  root.classList.add('dx-on');
  window.__destroyState = () => ({ audio: ac ? ac.state : "none", mute, rms: level(), targets: targets.length, big: targets.filter((t) => t.big).map((t) => t.el.id || t.tag), plats: plats.length, him: { x: p.x | 0, y: p.y | 0, ground: p.ground }, weapon: WEAPONS[weapon].name, score: score(), bits: bits.length, heap: Math.max(...heap) | 0 });   // read by shots/
  raf = requestAnimationFrame(loop);

  // how loud the game is right now (read by the tests)
  const level = () => { if (!meter) return 0; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); let q = 0; for (const v of d) q += v * v; return Math.sqrt(q / d.length); };

  function stop() {
    cancelAnimationFrame(raf);
    for (const [el, type, fn, opt] of on) el.removeEventListener(type, fn, opt);
    for (const t of targets) {
      const s = t.el.style;
      s.clipPath = t.prev.clip; s.webkitClipPath = t.prev.wclip; s.visibility = t.prev.vis;
    }
    window.__destroyPaint = null; window.__destroyState = null;
    canvas.remove(); hud.remove();
    for (const t of targets) t.back?.remove();
    root.classList.remove('dx-on');
    ac?.close?.();
    game = null;
    seat?.show();
    button?.focus({ preventScroll: true });
  }
  return { stop };
}

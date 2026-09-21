// The things he made. They live in a box at the side of the page, jump into their own chapter
// as it arrives, and gather around his monitor in the summary, where each one opens its case study.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const BLUE = '#7b93f5', DEEP = '#2c45c9', BONE = '#ece9e2', TAU = Math.PI * 2;
// what the canvases draw with, swapped when the page goes light (see setTheme)
const INK = { rgb: '236,233,226', solid: BONE, page: '#0a0b0e', butter: '#f0d264', sage: '185,210,149', light: false };

const DEFS = [
  // table: where it stands around him on the summary's first screen. dx, dy: from the middle of the room he floats in, in its heights;
  // s: its size there at 1440 by 900 (it grows and shrinks with the window); z: how much it drifts
  // dock: where it stands, in the same measure, once he and the things have drawn up into the top of the window above the copy
  // (the two on the right stand clear of where he gathers on his feet and sets off)
  { key: 'globe', name: 'The forecasts', story: 'forecast', chapter: 'forecast', w: 132, h: 132, table: { dx: -0.98, dy: 0.74, z: 0.45, s: 2 }, dock: { dx: -0.84, dy: 0.2 } },
  { key: 'packets', name: 'The privacy study', story: 'privacy', chapter: 'research', w: 240, h: 96, table: { dx: 1.02, dy: -0.4, z: 0.6, s: 1.4 }, dock: { dx: -1.02, dy: -0.27 } },
  { key: 'drone', name: 'The drone rig', story: 'capstone', chapter: 'engineering', w: 250, h: 250, table: { dx: 1.14, dy: 0.27, z: 0.75, s: 1.2 }, dock: { dx: 1.38, dy: -0.12 } },
  { key: 'watch', name: 'The Kiwi watch', story: 'kiwi', chapter: 'kiwi', w: 128, h: 160, table: { dx: 0.5, dy: 0.96, z: 0.9, s: 1.5 }, dock: { dx: 1.86, dy: 0.22 } },
];
// where each stands in the row beside him (x: from the centre line, in his seated widths) and its turn to come down (n)
const LINE = { globe: { x: -1.5, n: 1 }, packets: { x: -2.75, n: 3 }, watch: { x: 1.4, n: 0 }, drone: { x: 2.55, n: 2 } };
const DOCK_SIZE = 0.5;   // their size above the copy, against their size on the table
const REACH = 130;       // how near the pointer has to come, at 1440 by 900, for him and the thing to notice
const RES = 2;   // the canvases are drawn at twice their box, so they stay sharp at table size

/* ---------------- the drone on its two wires, seen from above, built from voxels ---------------- */
function makeDrone(thing) {
  const M = 68, G = 9.81, L = 2, D = 1;
  let I = 18, th = 0, om = 0, drag = false, grab = 0, lastCross = null, crossings = [], kicked = false, clock = 0;
  const state = document.getElementById('rig-state'), period = document.getElementById('rig-period'), inertia = document.getElementById('rig-inertia');
  const say = (s) => { if (state) state.textContent = s; };
  const resetRead = () => { crossings = []; lastCross = null; period.textContent = '0.00'; inertia.textContent = '0.0'; };
  const cells = [];
  for (let y = -10; y <= 9; y++) for (let x = -17; x <= 17; x++) {
    const ax = Math.abs(x);
    const wing = (ax <= 3 && y >= -2 && y <= 1) || (ax <= 9 && y >= -1 && y <= 1) || (ax <= 14 && y >= -1 && y <= 0) || (ax <= 17 && y === 0);
    const body = (ax <= 1 && y >= -8 && y <= 7) || (x === 0 && y >= -10);
    const tail = y >= 8 && ax <= 4;
    if (!wing && !body && !tail) continue;
    const tip = wing && ax >= 16, canopy = body && ax === 0 && y >= -6 && y <= -4;
    cells.push({ x, y, c: canopy ? '#16225e' : body ? BONE : tip ? BONE : tail ? DEEP : null, k: ax / 17 });
  }
  const mixHex = (k) => { const a = [44, 69, 201], b = [123, 147, 245]; return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`; };

  const el = thing.canvas;
  const ang = (e) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  el.addEventListener('pointerdown', (e) => {
    if (thing.mode !== 'slot') return;
    drag = true; el.setPointerCapture(e.pointerId); grab = ang(e) - th; om = 0; resetRead(); say('Twisting');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    let a = ang(e) - grab; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU;
    th = Math.max(-1.1, Math.min(1.1, a));
  });
  const release = () => { if (drag) { drag = false; say('Swinging, timing'); } };
  el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);
  document.querySelectorAll('[data-inertia]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-inertia]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    I = Number(b.dataset.inertia); resetRead();
    if (!drag && Math.abs(th) < 0.08) { th = 0.7; om = 0; }
    say('Swinging, timing');
  }));

  return {
    draw(x, W, H, now, dt, live) {
      if (thing.mode === 'slot' && !kicked && live) { kicked = true; th = 0.75; om = 0; say('Swinging, timing'); }
      if (!drag && live) {
        const k = M * G * D * D / (4 * L), prev = th;
        om += (-k / I * th - 0.05 * om) * dt; th += om * dt; clock += dt;   // the rig's own clock, so a pause never counts as swing time
        if (prev < 0 && th >= 0 && thing.mode === 'slot') {
          if (lastCross !== null) {
            crossings.push(clock - lastCross); if (crossings.length > 3) crossings.shift();
            const T = crossings.reduce((s, v) => s + v, 0) / crossings.length;
            period.textContent = T.toFixed(2); inertia.textContent = (M * G * D * D * T * T / (16 * Math.PI * Math.PI * L)).toFixed(1); say('Measured');
          }
          lastCross = clock;
        }
        if (thing.mode !== 'slot' && Math.abs(th) < 0.2 && Math.abs(om) < 0.2) { th = 0.55; om = 0; }
      }
      const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.46, v = s * 0.9 / 17.5;
      x.strokeStyle = `rgba(${INK.rgb},${INK.light ? 0.3 : 0.13})`; x.lineWidth = 1;
      x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.stroke();
      x.setLineDash([3, 6]); x.beginPath(); x.moveTo(cx - s, cy); x.lineTo(cx + s, cy); x.stroke(); x.setLineDash([]);
      for (let k = -6; k <= 6; k++) { const a = k * Math.PI / 18; x.beginPath(); x.moveTo(cx + Math.cos(a) * (s - 6), cy + Math.sin(a) * (s - 6)); x.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); x.stroke(); }
      x.strokeStyle = 'rgba(123,147,245,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, s, Math.min(0, th), Math.max(0, th)); x.stroke();
      x.save(); x.translate(cx, cy); x.rotate(th);
      for (const c of cells) {
        const px = c.x * v - v / 2, py = c.y * v - v / 2;
        x.fillStyle = c.c ?? mixHex(c.k); x.fillRect(px, py, v - 0.6, v - 0.6);
        x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(px, py, v - 0.6, 1); x.fillRect(px, py, 1, v - 0.6);
        x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(px, py + v - 1.6, v - 0.6, 1); x.fillRect(px + v - 1.6, py, 1, v - 0.6);
      }
      if (I > 30) for (const sx of [-10, 10]) {
        x.fillStyle = '#0d1230'; x.fillRect(sx * v - v, -2 * v, 2 * v, 4 * v);
        x.strokeStyle = BLUE; x.lineWidth = 1.2; x.strokeRect(sx * v - v, -2 * v, 2 * v, 4 * v);
      }
      for (const sx of [-5, 5]) { x.fillStyle = INK.page; x.strokeStyle = BLUE; x.lineWidth = 1.6; x.beginPath(); x.arc(sx * v, 0, v * 0.7, 0, TAU); x.fill(); x.stroke(); }
      x.restore();
    },
  };
}

/* ---------------- the forecasts: a globe of points, watched from orbit ---------------- */
function makeGlobe() {
  const N = 560, pts = [];
  for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const at = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
  // Prognosis: three Indian states. Harvard: ten regional zones in Colombia. Positions are indicative.
  const regions = {
    prognosis: { lon: 79, spots: [[23, 72], [19, 76], [26, 81]].map(([a, b]) => at(a, b)) },
    harvard: { lon: -73, spots: [[10, -74], [7, -73], [6, -75], [4, -74], [3, -76], [5, -72], [2, -72], [8, -76], [1, -75], [6, -70]].map(([a, b]) => at(a, b)) },
  };
  let kind = 'prognosis', yaw = 0;
  return {
    region(k) { kind = k; },
    draw(x, W, H, now, dt) {
      const t = now / 1000, R = Math.min(W, H) * 0.4, cx = W / 2, cy = H / 2, reg = regions[kind];
      const want = -reg.lon * Math.PI / 180 + Math.sin(t * 0.3) * 0.35;
      yaw += (want - yaw) * Math.min(1, dt * 2.2);
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), ct = Math.cos(0.32), stl = Math.sin(0.32);
      const turn = ([px, py, pz]) => { const X = px * cyw + pz * syw, Z = -px * syw + pz * cyw; return [X, py * ct - Z * stl, py * stl + Z * ct]; };
      const sweep = ((t * 0.22) % 1) * 2.6 - 1.3;
      for (const p of pts) {
        const [X, Y, Z] = turn(p); if (Z < -0.15) continue;
        const lit = Math.exp(-Math.pow((X - sweep) / 0.12, 2)), d = 0.25 + 0.75 * Math.max(0, Z);
        x.fillStyle = INK.light ? `rgba(${Math.round(40 - 20 * lit)},${Math.round(62 - 20 * lit)},${Math.round(170 + 30 * lit)},${(0.3 + 0.6 * d + 0.1 * lit).toFixed(3)})`
          : `rgba(${Math.round(150 + 86 * lit)},${Math.round(165 + 68 * lit)},${Math.round(215 + 30 * lit)},${(0.22 + 0.6 * d + 0.3 * lit).toFixed(3)})`;
        const s = 0.8 + 1.5 * d; x.fillRect(cx + X * R - s / 2, cy - Y * R - s / 2, s, s);
      }
      reg.spots.forEach((p, i) => {
        const [X, Y, Z] = turn(p); if (Z < 0) return;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 - i * 0.9);
        x.fillStyle = `rgba(${INK.sage},${(0.2 + 0.24 * pulse) * Z * (INK.light ? 1.6 : 1)})`; x.beginPath(); x.arc(cx + X * R, cy - Y * R, 5 + 5 * pulse, 0, TAU); x.fill();
        x.fillStyle = INK.light ? '#10131f' : '#fff'; x.fillRect(cx + X * R - 1.5, cy - Y * R - 1.5, 3, 3);
      });
      // the orbit, and the satellite that feeds the model
      x.strokeStyle = `rgba(${INK.rgb},${INK.light ? 0.3 : 0.16})`; x.lineWidth = 1; x.beginPath(); x.ellipse(cx, cy, R * 1.2, R * 0.34, -0.42, 0, TAU); x.stroke();
      const a = t * 0.7, ox = Math.cos(a) * R * 1.2, oy = Math.sin(a) * R * 0.34, c = Math.cos(-0.42), s2 = Math.sin(-0.42);
      if (Math.sin(a) > -0.2 || Math.abs(Math.cos(a)) > 0.8) { x.fillStyle = INK.solid; x.fillRect(cx + ox * c - oy * s2 - 2.5, cy + ox * s2 + oy * c - 2.5, 5, 5); }
    },
  };
}

/* ---------------- the privacy study: where the requests go once they leave the chat ---------------- */
function makePackets() {
  const packets = []; let clock = 0;
  const ys = [15, 48, 81], names = ['analytics', 'tracking', '3rd party'];
  return {
    draw(x, W, H, now, dt, live) {
      const k = W / 240; x.save(); x.scale(k, k);
      x.font = '700 9px "Space Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.lineWidth = 1;
      const box = (bx, by, bw, bh, label, col) => { x.strokeStyle = col; x.strokeRect(bx + 0.5, by + 0.5, bw, bh); x.fillStyle = col; x.fillText(label, bx + bw / 2, by + bh / 2 + 1); };
      box(4, 34, 52, 28, 'chat >_', `rgba(${INK.rgb},.88)`); box(84, 34, 58, 28, 'ai tool', `rgba(${INK.rgb},.88)`);
      ys.forEach((y, i) => box(174, y - 9, 62, 18, names[i], INK.butter));
      x.strokeStyle = `rgba(${INK.rgb},${INK.light ? 0.4 : 0.22})`; x.setLineDash([2, 3]);
      x.beginPath(); x.moveTo(57, 48); x.lineTo(84, 48); x.stroke();
      for (const y of ys) { x.beginPath(); x.moveTo(143, 48); x.lineTo(158, 48); x.lineTo(158, y); x.lineTo(174, y); x.stroke(); }
      x.setLineDash([]);
      // roughly one request in five leaves for a third party, inside the 9 to 36% the study measured
      if (live) { clock += dt; while (clock > 0.22) { clock -= 0.22; packets.push({ t: 0, third: Math.random() < 0.22 ? 1 + (Math.random() * 3 | 0) : 0 }); } }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]; if (live) p.t += dt * 0.55;
        if (p.t > (p.third ? 1.65 : 1)) { packets.splice(i, 1); continue; }
        let px, py = 48;
        if (p.t < 1) px = lerp(57, 84, p.t);
        else { const u = (p.t - 1) / 0.65, y = ys[p.third - 1]; if (u < 0.33) px = lerp(143, 158, u / 0.33); else if (u < 0.66) { px = 158; py = lerp(48, y, (u - 0.33) / 0.33); } else { px = lerp(158, 174, (u - 0.66) / 0.34); py = y; } }
        x.fillStyle = p.t >= 1 ? INK.butter : INK.solid; x.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      x.restore();
    },
  };
}

export async function createThings({ stage, chapters, openStory, reduced }) {
  const shelf = document.getElementById('shelf'), scene = document.getElementById('table-scene');
  try { await document.fonts.load('700 9px "Space Mono"'); } catch { /* falls back to monospace */ }
  const indexOf = (id) => chapters.findIndex((c) => c.id === id), about = indexOf('about');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const hint = document.createElement('p');
  hint.className = 'scene-hint is-seen'; hint.setAttribute('aria-hidden', 'true');
  hint.textContent = matchMedia('(hover: hover)').matches ? 'Everything so far, in one place. Pick one up.' : 'Everything so far. Tap one to open it.';
  document.querySelector('.summary-head').append(hint);

  let live = !reduced, hovered = null, focused = null, attended = null, mx = 0, my = 0, ptr = null, watch = null;
  const canHover = matchMedia('(hover: hover)').matches;
  const things = DEFS.map((def, i) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'thing'; el.dataset.key = def.key; el.style.setProperty('--w', `${def.w}px`); el.style.setProperty('--h', `${def.h}px`);
    const canvas = document.createElement('canvas'); canvas.width = def.w * dpr * RES; canvas.height = def.h * dpr * RES;
    const name = document.createElement('span'); name.className = 'thing-name'; name.textContent = def.name;
    el.append(canvas, name); scene.append(el);
    const home = document.createElement('i'); shelf.append(home);
    const seat = document.createElement('i'); seat.className = 'table-seat'; seat.style.aspectRatio = `${def.w} / ${def.h}`; scene.append(seat);
    const thing = { ...def, i, el, canvas, home, seat, slot: document.querySelector(`[data-slot="${def.key}"]`), ci: def.chapter ? indexOf(def.chapter) : -1, mode: 'shelf', lift: 0, back: 0, seen: -1 };
    thing.ctx = def.key === 'watch' ? null : canvas.getContext('2d');
    thing.painter = def.key === 'drone' ? makeDrone(thing) : def.key === 'globe' ? makeGlobe() : def.key === 'packets' ? makePackets() : null;
    el.addEventListener('pointerenter', () => { hovered = thing; });
    el.addEventListener('pointerleave', () => { if (hovered === thing) hovered = null; });
    el.addEventListener('focus', () => { focused = thing; });
    el.addEventListener('blur', () => { if (focused === thing) focused = null; });
    el.addEventListener('click', () => {
      if (thing.mode === 'table') openStory(def.story);
      else if (thing.mode === 'shelf') document.getElementById(def.chapter ?? 'about').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      else if (def.key === 'watch') watch?.fall();
    });
    return thing;
  });
  const watchThing = things.find((t) => t.key === 'watch');
  setTimeout(() => import('./watch.js').then((m) => { watch = m.createWatch(watchThing.canvas); }).catch((e) => console.error(e)), 900);

  addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2;
    if (e.pointerType !== 'touch') ptr = { x: e.clientX, y: e.clientY };
    if (watch) { const r = watchThing.canvas.getBoundingClientRect(); watch.pointer(Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 260)), Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 260))); }
  }, { passive: true });

  let last = performance.now(), frame = 0;
  const fit = (r, t) => { const s = Math.min(r.width / t.w, r.height / t.h); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s }; };

  // which thing has his attention: the one under the pointer or the keyboard, else the one the pointer has come near;
  // on a phone, the one nearest the middle of the screen
  function attend(k2) {
    const on = (t) => t && t.mode === 'table' && t.at;
    if (on(hovered)) return hovered;
    if (on(focused)) return focused;
    const from = canHover ? ptr : { x: innerWidth / 2, y: innerHeight / 2 };
    if (!from) return null;
    let best = null, bd = canHover ? REACH * k2 : 1e9;
    for (const t of things) {
      if (!on(t)) continue;
      const d = Math.max(0, Math.hypot(t.at.x - from.x, t.at.y - from.y) - Math.min(t.w, t.h) * t.at.s / 2);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function update(p, summary) {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
    const boxed = innerWidth > 1100, roomy = innerWidth > 820;   // the shelf only exists on wide screens (see journey.css)
    // they stand around his monitor on the summary's first screen, draw up with it while the copy is read, and go back to the box as he leaves
    // on a phone they sit in a grid under the copy instead, and arrive as that grid scrolls in
    const grid = roomy ? null : scene.getBoundingClientRect();
    const wTable = roomy ? smooth(about - 0.34, about - 0.12, p) * (1 - summary.leave)
      : smooth(innerHeight, innerHeight * 0.8, grid.top) * smooth(0, innerHeight * 0.15, grid.bottom);
    const k2 = Math.max(0.7, Math.min(2.2, Math.min(innerWidth / 1440, innerHeight / 900))), dock = summary.dock;
    attended = attend(k2);
    for (const t of things) {
      const wSlot = t.ci < 0 ? 0 : 1 - smooth(0.4, 0.6, Math.abs(p - t.ci));
      const k = Math.max(wSlot, wTable), toTable = wTable >= wSlot;
      const a = fit(t.home.getBoundingClientRect(), t);
      let b = a;
      if (k > 0.001) {
        if (!toTable) b = fit(t.slot.getBoundingClientRect(), t);
        else if (roomy) {
          const bob = live ? Math.sin(now / 1000 * 0.8 + t.i * 1.7) * 6 * t.table.z : 0;
          // they are objects on the desk around his monitor: sized with the window, placed from the monitor, never off the edge.
          // While the copy is read they stand with it in the top of the window, smaller and stiller
          const sz = t.table.s * k2 * lerp(1, DOCK_SIZE, dock), drift = 1 - 0.6 * dock, e = dock * dock * (3 - 2 * dock), m = summary.at;
          const half = t.w * sz / 2 + 28, tx = m.x + lerp(t.table.dx, t.dock.dx, e) * m.h;
          b = { x: Math.max(half, Math.min(innerWidth - half, tx)) - mx * 26 * t.table.z * drift, y: m.y + lerp(t.table.dy, t.dock.dy, e) * m.h - my * 16 * t.table.z * drift + bob * drift, s: sz };
          // as he walks down they come down after him, one by one, and line up beside him on the same line of letters he sits on:
          // the things he signed for, in a row with him
          const row = summary.row, f = row ? smooth(LINE[t.key].n * 0.16, LINE[t.key].n * 0.16 + 0.5, row.p) : 0;
          t.lined = f > 0.9;
          if (f > 0) {
            const s2 = sz * 0.78, arc = Math.sin(f * Math.PI) * 40;
            b = { x: lerp(b.x, innerWidth / 2 + LINE[t.key].x * row.u, f), y: lerp(b.y, row.y - t.h * s2 / 2 - 2, f) - arc, s: lerp(sz, s2, f) };
          }
        } else b = fit(t.seat.getBoundingClientRect(), t);
      }
      // as he leaves they fade where they stand and are back in the box afterwards: flying home would take them across the words
      const fading = roomy && toTable && summary.leave > 0 && summary.leave < 1;
      t.mode = k > 0.96 ? (toTable ? 'table' : 'slot') : k < 0.04 && !fading ? 'shelf' : 'flight';
      // the one he is looking at lifts toward the visitor; the others step back a little
      t.lift += ((attended === t && t.mode === 'table' ? 1 : 0) - t.lift) * 0.18;
      t.back += ((attended && attended !== t && t.mode === 'table' && canHover ? 1 : 0) - t.back) * 0.12;
      const e = fading ? 1 : k * k * (3 - 2 * k), hop = Math.sin(e * Math.PI);
      let x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e) - hop * (boxed ? 90 : 0) - t.lift * 10, s = lerp(a.s, b.s, e) * (1 + t.lift * 0.12);
      // as he breaks into points so do they: js/aryan.js draws their points from these canvases, and the things themselves step out
      let opacity = (1 - 0.45 * t.back) * (fading ? (summary.points && t.ctx ? (summary.leave > 0.07 ? 0 : 1) : 1 - summary.leave) : 1);   // the watch is drawn by WebGL and cannot be read back, so it fades
      if (!boxed) { x = b.x; y = b.y - t.lift * 10; s = b.s * (0.72 + 0.28 * e) * (1 + t.lift * 0.12); opacity *= e; }
      const still = 1 - 0.6 * dock;
      const tilt = t.mode === 'table' && roomy ? `perspective(900px) rotateX(${(-my * 9 * t.table.z * still).toFixed(2)}deg) rotateY(${(mx * 13 * t.table.z * still).toFixed(2)}deg) ` : '';
      t.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) ${tilt}rotate(${(hop * (t.i % 2 ? -14 : 14)).toFixed(1)}deg) scale(${s.toFixed(4)}) translate(-50%,-50%)`;
      t.el.style.setProperty('--s', s.toFixed(3));   // the name under it stays one size whatever the thing's scale
      t.at = { x, y, s };
      t.el.style.opacity = opacity.toFixed(3);
      t.el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      t.el.style.pointerEvents = t.mode === 'flight' ? 'none' : 'auto';
      t.el.classList.toggle('is-table', t.mode === 'table');
      t.el.classList.toggle('is-lined', !!t.lined && t.mode === 'table');
      t.el.classList.toggle('is-attended', attended === t && t.mode === 'table');
      t.el.classList.toggle('is-drag', t.mode === 'slot' && t.key === 'drone');
      t.el.tabIndex = t.mode === 'table' || (t.mode === 'slot' && t.key === 'watch') ? 0 : -1;
      t.el.setAttribute('aria-label', t.mode === 'table' ? `${t.name}. Open the case study` : t.mode === 'slot' && t.key === 'watch' ? 'The Kiwi watch. Drop it to see a detected fall' : t.name);
      t.home.classList.toggle('is-out', k > 0.04);

      // paint: every frame while it is out, now and then while it rests in the box
      const active = t.mode !== 'shelf' || frame % 20 === t.i || t.seen < 0;
      if (!active || opacity < 0.01) continue;
      t.seen = frame;
      if (t.key === 'watch') { watch?.render(now); continue; }
      const c = t.ctx; c.setTransform(dpr * RES, 0, 0, dpr * RES, 0, 0); c.clearRect(0, 0, t.w, t.h);
      t.painter.draw(c, t.w, t.h, now, dt, live && t.mode !== 'shelf');
    }
  }

  return {
    update,
    // what he should look at: the thing that has his attention (see attend) and its name for his screen, or null for the pointer
    // where each stands at the table, for the points they break into
    boxes() { return things.filter((t) => t.ctx && (t.mode === 'table' || t.mode === 'flight')).map((t) => ({ canvas: t.canvas, x: t.at.x - t.w * t.at.s / 2, y: t.at.y - t.h * t.at.s / 2, w: t.w * t.at.s, h: t.h * t.at.s })); },
    focus() { return attended ? { x: attended.at.x, y: attended.at.y, name: attended.name } : null; },
    region(kind) { things[0].painter.region(kind); },
    setMotion(on) { live = on && !reduced; },
    setTheme(light) {
      Object.assign(INK, light ? { rgb: '16,19,31', solid: '#10131f', page: '#e6e9f0', butter: '#765a00', sage: '71,102,26', light: true }
        : { rgb: '236,233,226', solid: BONE, page: '#0a0b0e', butter: '#f0d264', sage: '185,210,149', light: false });
      for (const t of things) t.seen = -1;   // repaint the ones resting in the box
    },
  };
}

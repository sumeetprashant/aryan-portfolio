// Scroll drives what Aryan is made of; everything else here is the small per-chapter
// assets, the case-study reader and the motion control.
import { createStage } from './stage.js';
import { SCENE } from './aryan.js';

document.documentElement.classList.add('js');

const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
  el, id: el.id, state: el.dataset.state, side: el.dataset.side, note: el.dataset.note, rail: el.dataset.rail, anchor: el.dataset.anchor,
}));
const note = document.getElementById('stage-note');
// the head line is being tried in two places until Sumeet picks one: above his hair, or (?note=bottom) under his bust, typed out
const noteAt = new URLSearchParams(location.search).get('note') === 'bottom' ? 'bottom' : 'top';
document.documentElement.dataset.note = noteAt;
note.innerHTML = '<span class="typed"></span><span class="untyped"></span>';
const HAIR_TOP = 0.125;   // where his hair starts in the portrait's frame
const rail = document.getElementById('rail');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const isSmall = () => innerWidth <= 820;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const summaryCopy = document.querySelector('.summary-copy'), summaryHead = document.querySelector('.summary-head');
const seatLine = document.querySelector('.seat-line');
const HEADER = 92;   // the room the header takes
const onScreen = (r) => r.bottom > 0 && r.top < innerHeight;
// value at p along a list of [p, value] stops, eased between them
const along = (p, stops) => {
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) return lerp(stops[i - 1][1], stops[i][1], smooth(stops[i - 1][0], stops[i][0], p));
  return stops[stops.length - 1][1];
};

// rail: one entry per chapter, named for the work
for (const c of chapters) {
  const a = document.createElement('a');
  a.href = `#${c.id}`;
  a.dataset.id = c.id;
  a.innerHTML = `<span>${c.rail}</span>`;
  rail.append(a);
}

let marks = [], copyPadEnd = 0, noteH = 0;
// the summary: Aryan at his desk and the things keep the top of the window (down to band) and the copy stops under them.
// dock: 0 on the summary's first screen, 1 once they have drawn up to make room; leave: 0..1 as he melts and goes;
// scene: where his scene (js/aryan.js) stands this frame ({x, y}: its corner, s: CSS px per unit), lerped from first to docked;
// at: where his desk stands, for the things (its middle, and the height they are spaced by); arrived: the copy is held under him
const summary = { dock: 0, leave: 0, pin: false, band: 0, arrived: false, xh: 0,
  scene: { x: 0, y: 0, s: 1 }, first: { x: 0, y: 0, s: 1 }, docked: { x: 0, y: 0, s: 1 }, at: { x: 0, y: 0, s: 1, h: 0 } };
// where the tops of the small letters of the Kiwi heading sit below its top: that is his seat
const ruler = document.createElement('canvas').getContext('2d');
function xHeightTop() {
  const cs = getComputedStyle(seatLine);
  ruler.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = ruler.measureText('x'), line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.15;
  return (line - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
}
let measuring = 0;
function measure() {
  noteH = note.offsetHeight;
  copyPadEnd = parseFloat(getComputedStyle(summaryCopy).paddingBottom) || 0;
  // the band is whatever the copy leaves free, up to a little over half the window; under a third and they cannot share it
  const free = innerHeight - summaryCopy.offsetHeight - 8;
  summary.pin = !isSmall() && free > innerHeight * 0.36;
  summary.band = Math.min(free, innerHeight * 0.53);
  document.documentElement.dataset.summary = summary.pin ? 'pin' : 'flow';
  document.documentElement.style.setProperty('--band', `${summary.band.toFixed(1)}px`);
  // his scene. On the summary's first screen the desk stands large in the upper middle, clear of the heading. Once the copy holds,
  // the line he sits on lands on the tops of the heading's small letters and his centre line on the window's, with his hair
  // clear of the top of the window when he stands up. On a phone he is only ever seated, on the heading as it scrolls
  const head = summaryHead.getBoundingClientRect(), [d0, d1, d2, d3] = SCENE.float;
  const h = Math.min(innerHeight * 0.47, innerWidth * 0.4 / 1.12), sF = 0.8 * h / (d3 - d1);
  const fx = Math.max(innerWidth / 2, head.right + 30 + (d2 - d0) * sF / 2), fy = innerHeight * 0.125 + (d3 - d1) * sF / 2;
  summary.first = { x: fx - (d0 + d2) / 2 * sF, y: fy - (d1 + d3) / 2 * sF, s: sF };
  summary.xh = xHeightTop();
  const seatY = summary.band + seatLine.offsetTop + summary.xh;
  const sD = isSmall() ? Math.min(0.42, innerWidth / 930) : Math.max(0.3, Math.min(sF, (seatY - 24) / (SCENE.seat - SCENE.top)));
  summary.docked = { x: innerWidth / 2 - SCENE.cx * sD, y: seatY - SCENE.seat * sD, s: sD };
  // the heading opens where his legs hang, and the columns under it where his feet swing; the right side of both starts together
  const cs = getComputedStyle(summaryCopy), left = summaryCopy.getBoundingClientRect().left + (parseFloat(cs.paddingLeft) || 0);
  const at = (u) => innerWidth / 2 + (u - SCENE.cx) * sD;
  // the heading only opens (--seat-open, from js/aryan.js) while he sits in it; closed, it is one line with a word space
  const legL = at(SCENE.legs[0]) - 6, legR = at(SCENE.legs[1]) + 6, footL = at(SCENE.swing[0]) - 10, right = at(SCENE.swing[1]) + 10;
  const space = parseFloat(getComputedStyle(seatLine).fontSize) * 0.28;
  const drop = isSmall() ? Math.max(0, summary.xh + (SCENE.seated[3] - SCENE.seat) * sD + 14 - seatLine.offsetHeight) : 3;
  const rise = isSmall() ? (SCENE.seat - SCENE.seated[1]) * sD - summary.xh + 16 : 0;   // on a phone the copy makes room above the heading for him
  const vars = { '--seat-a': Math.max(0, legL - left), '--seat-extra': Math.max(0, legR - legL - space), '--col-a': Math.max(0, footL - left), '--col-gap': right - footL, '--seat-drop': drop, '--seat-rise': rise };
  let changed = false;
  for (const [k, v] of Object.entries(vars)) {
    if (Math.abs((parseFloat(summaryCopy.style.getPropertyValue(k)) || -1) - v) > 0.5) { summaryCopy.style.setProperty(k, `${v.toFixed(1)}px`); changed = true; }
  }
  if (changed && measuring < 2) { measuring++; measure(); measuring--; return; }
  const max = document.documentElement.scrollHeight - innerHeight;
  marks = chapters.map((c, i) => {
    const top = c.el.offsetTop, mid = top + c.el.offsetHeight / 2;
    // the summary is settled once its first screen fills the window, however long the copy under it runs
    const centre = i === 0 ? innerHeight / 2 : i === chapters.length - 1 ? max + innerHeight / 2 : c.anchor === 'top' ? top + innerHeight / 2 : mid;
    return { top, centre };
  });
}

// 0 at the middle of the hero, 1 at the middle of the next chapter, and so on
function position() {
  const y = scrollY + innerHeight / 2;
  let i = 0;
  while (i < chapters.length - 2 && y >= marks[i + 1].centre) i++;
  const a = marks[i], b = marks[i + 1], edge = Math.min(Math.max(b.top, a.centre + 1), b.centre - 1);
  const f = y < edge ? 0.5 * (y - a.centre) / (edge - a.centre) : 0.5 + 0.5 * (y - edge) / (b.centre - edge);
  return i + Math.min(1, Math.max(0, f));
}

let target = 0, eased = 0, activeNote = -1, noteY = -1, typing = 0;
// above his head the line is simply there; under him it is typed, with the rest of it holding the room so it never shifts
function say(text) {
  const [typed, rest] = note.children, id = ++typing;
  if (noteAt === 'top' || reduced.matches) { typed.textContent = text; rest.textContent = ''; noteH = note.offsetHeight; return; }
  let n = 0;
  const step = () => {
    if (id !== typing) return;
    typed.textContent = text.slice(0, n); rest.textContent = text.slice(n);
    if (n++ < text.length) setTimeout(step, 34);
  };
  step(); noteH = note.offsetHeight;
}
// it stands a little above his hair, never under the header; or a little under his bust, never off the window
function placeNote(view) {
  const gap = innerHeight * 0.03, top = stage.place(0.5, HAIR_TOP)[1], bottom = stage.place(0.5, view.bust)[1];
  // on a phone his hair starts under the header and the copy covers his chest, so the line takes the nearest clear place: tight under the header, or on his shoulders
  const y = noteAt === 'top' ? Math.max(isSmall() ? 80 : 92, top - gap - noteH) : isSmall() ? innerHeight * 0.385 : Math.min(innerHeight * 0.95 - noteH, bottom + gap * 0.5);
  if (Math.abs(y - noteY) > 0.5) { noteY = y; note.style.setProperty('--ny', `${y.toFixed(1)}px`); }
}
// the portrait sits in the middle of whatever the copy column leaves free
function anchor(c) {
  if (isSmall() || c.side === 'centre') return 0.5;
  const pad = Math.min(96, Math.max(22, innerWidth * 0.06)), copy = pad + Math.min(540, innerWidth * 0.42);
  const x = (copy + innerWidth) / 2 / innerWidth;
  return c.side === 'left' ? x : 1 - x;
}

// Chapter order is fixed by the page: 0 hero (pixels), 1 context (the wax melt), 2 forecasting and
// 3 MIT (characters: numbers, then symbols), 4 cubes, 5 bricks, 6 the summary (his own clips, js/aryan.js), 7 his face through the pixels.
// Between versions the cells break into points and re-gather. Each change owns a real stretch of scroll.
function apply(view, real) {
  // on a phone the copy slides up over him, so every change has to finish while he is still in the clear
  const whole = Math.min(chapters.length - 2, Math.floor(real));
  const p = isSmall() ? whole + Math.min(1, Math.max(0, (real - whole - 0.04) / 0.6)) : real;
  const s = (a, b) => smooth(a, b, p);
  view.melt = 0.3 + 0.7 * s(0.15, 0.95) + 0.5 * s(1.0, 1.5);
  view.liquid = 1 - s(1.3, 1.72);
  view.free = s(1.12, 1.5);
  view.gather = s(1.3, 1.75);
  view.snap = s(1.55, 1.9);
  view.glyph = s(1.62, 1.97);
  view.ramp = s(2.4, 2.95);
  view.solid = s(3.3, 3.95);
  view.stud = s(4.2, 4.55);
  view.big = s(4.25, 4.6) * (1 - s(5.3, 5.45));
  view.build = s(4.5, 4.97);
  view.fine = s(4.88, 4.995);   // once home, every brick clicks into bricks half the size, so his face has twice the studs across it
  view.scatter = s(5.28, 5.8);
  // he comes back only once the summary's copy has left the window, so nothing ever crosses the words
  const copyBox = summaryCopy.getBoundingClientRect(), headBox = summaryHead.getBoundingClientRect();
  const copyEnd = isSmall() ? 0 : (copyBox.bottom - innerHeight * 0.3) / innerHeight;
  const home = smooth(0.3, 0.06, copyEnd);
  view.regather = s(6.32, 6.92) * home;
  view.end = s(6.72, 6.98) * home;
  view.disperse = Math.max(1 - s(1.1, 1.4), view.end);
  view.photo = p > 6 ? 1 : 0;
  // in the summary he and the things draw up into the top of the window before the first words come up, and stay there while
  // the copy holds under him; he walks down onto its heading and sits. Through the last of that hold he melts and breaks into
  // points; only then does the copy go on up, through the room he has left, and the points gather into the last version of him
  // once the hold is over he does not wait for the copy: it goes on up, he rides up with its heading and breaks into points
  const words = copyBox.top / innerHeight, risen = (summary.band - copyBox.top) / innerHeight;
  summary.dock = summary.pin ? 1 - smooth(0.92, 1.28, words) : 0;
  summary.leave = isSmall() ? s(6.25, 6.5) : summary.pin ? smooth(0.02, 0.42, risen) : 1 - smooth(0.72, 1.02, words);
  view.him = s(5.55, 5.85);
  view.drip = s(5.7, 5.9) * smooth(0.3, 0.85, summary.leave);
  const d = smooth(0, 1, summary.dock), a = summary.first, b = summary.docked, sc = summary.scene;
  if (isSmall()) { sc.s = b.s; sc.x = b.x; sc.y = seatLine.getBoundingClientRect().top + summary.xh - SCENE.seat * b.s; }
  else { sc.s = lerp(a.s, b.s, d); sc.x = lerp(a.x, b.x, d); sc.y = lerp(a.y, b.y, d) + (summary.pin ? Math.min(0, copyBox.top - summary.band) : 0); }
  summary.arrived = summary.pin && copyBox.top <= summary.band + 2;
  const [d0, d1, d2, d3] = SCENE.float;
  summary.at.x = sc.x + (d0 + d2) / 2 * sc.s; summary.at.y = sc.y + (d1 + d3) / 2 * sc.s;
  summary.at.h = (d3 - d1) * sc.s / 0.8; summary.at.s = sc.s / a.s;
  const wordsBox = { left: copyBox.left, right: copyBox.right, top: copyBox.top, bottom: copyBox.bottom - copyPadEnd };
  // in the summary the head line is the screen's own text, and the next one waits until the copy has cleared its place
  const noteBox = note.getBoundingClientRect();
  note.classList.toggle('is-under', chapters[Math.round(real)].state === 'desk' || (!isSmall() && noteBox.bottom > wordsBox.top - 24 && noteBox.top < wordsBox.bottom + 24));
  // the summary's heading scrolls up through the place the things draw up into, so it goes as they come
  summaryHead.style.opacity = (1 - smooth(0.1, 0.55, summary.dock)).toFixed(3);
  stage.keepOut(onScreen(wordsBox) ? wordsBox : null, onScreen(headBox) && summary.dock < 0.55 ? headBox : null, noteBox);
  view.floaters = Math.max(1 - s(1.1, 1.4), s(3.7, 3.95)) * (1 - s(5.25, 5.45)) + view.end;
  view.glow = along(p, [[1.5, 1], [1.95, 2.2], [3.3, 2.2], [3.9, 1], [5.4, 1], [5.8, 0.4], [6.4, 0.4], [6.9, 1]]);
  view.bust = along(p, [[1.3, 0.8], [1.9, 0.68], [4.2, 0.68], [4.7, 0.655], [6.3, 0.655], [6.4, 0.765]]);

  const i = whole, f = real - i;
  view.cx = lerp(anchor(chapters[i]), anchor(chapters[i + 1]), smooth(0.12, 0.88, f));
  view.cy = isSmall() ? 0.43 : along(p, [[1.3, 0.61], [1.9, 0.66], [4.3, 0.66], [4.9, 0.625], [5.3, 0.625], [5.8, 0.68], [6.4, 0.68], [6.9, 0.66]]);
  // he fills the height on a wide screen; on a tall or narrow one he is sized to the room beside the copy
  const room = innerWidth - Math.min(96, Math.max(22, innerWidth * 0.06)) - Math.min(540, innerWidth * 0.42);
  view.scale = isSmall() ? 0.92 : Math.min(1.3, room / (innerHeight * (2 / 3)) * 0.97);
  view.cy += isSmall() ? 0 : (1.3 - view.scale) * -0.18;

  const near = Math.round(real);
  document.documentElement.style.setProperty('--px', `${view.cx * 100}vw`);
  if (near !== activeNote) {
    activeNote = near;
    note.classList.remove('is-in');
    setTimeout(() => { note.dataset.kind = chapters[near].state; say(chapters[near].note); note.classList.add('is-in'); }, 260);
    for (const a of rail.children) a.toggleAttribute('aria-current', a.dataset.id === chapters[near].id);
    document.documentElement.dataset.chapter = chapters[near].id;
    document.documentElement.dataset.copy = chapters[near].side === 'left' ? 'left' : 'right';
  }
}

const stage = await createStage(document.getElementById('stage-canvas')).catch((error) => { console.error(error); return null; });
if (!stage) document.documentElement.classList.add('no-stage');
let things = null, aryan = null, seatOpen = '';
if (stage) {
  measure();
  eased = target = position();
  const tick = () => {
    target = position();
    eased = reduced.matches ? target : eased + (target - eased) * 0.14;
    apply(stage.view, eased);
    window.__journey?.override?.(stage.view);   // lets shots/ hold a state still
    things?.update(eased, summary);
    if (eased > 4.4) aryan?.wake();   // his clips are only fetched once the summary comes near
    const him = aryan?.update({ weight: stage.view.him, scene: summary.scene, arrived: summary.arrived, leave: summary.leave, focus: things?.focus() ?? null, small: isSmall() }) ?? null;
    stage.glass(him, summary.leave);
    const open = (him?.open ?? 0).toFixed(3);
    if (open !== seatOpen) { seatOpen = open; seatLine.style.setProperty('--seat-open', open); }
    placeNote(stage.view);
    requestAnimationFrame(tick);
  };
  tick();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);
  document.fonts?.ready.then(measure);
  if (reduced.matches) stage.setMotion(false);
}
window.__journey = { position: () => eased, target: () => position(), chapters: chapters.map((c) => c.id), aryan: () => aryan?.state(), summary }; // read by shots/

// reveal
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-seen'); e.target.dispatchEvent(new Event('seen')); io.unobserve(e.target); }
}, { threshold: 0.2 });
document.querySelectorAll('.copy > *, .summary-head > *').forEach((el) => io.observe(el));

// ASCII chart, typed out once
const chart = document.getElementById('ascii-chart');
const rows = [['grok', 35.9], ['claude', 14.0], ['chatgpt', 13.7], ['gemini', 9.0]];
const chartText = ['third-party requests / 2025 snapshot', '', ...rows.map(([name, v]) =>
  `${name.padEnd(8)} ${'#'.repeat(Math.round(v / 40 * 26)).padEnd(26, '.')} ${v.toFixed(1).padStart(5)}%`)].join('\n');
chart.textContent = chartText;
chart.closest('figure').addEventListener('seen', () => {
  if (reduced.matches) return;
  let n = 0;
  const step = () => { n += 5; chart.textContent = chartText.slice(0, n) + (n < chartText.length ? '_' : ''); if (n < chartText.length) requestAnimationFrame(step); };
  step();
});

// forecast: weeks of warning as a row of signals
const weeks = document.getElementById('weeks');
for (let i = 0; i < 10; i++) { const dot = document.createElement('i'); dot.style.setProperty('--i', i); weeks.append(dot); }
function setForecast(kind) {
  const prognosis = kind === 'prognosis';
  document.querySelectorAll('[data-forecast]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.forecast === kind)));
  [...weeks.children].forEach((dot, i) => dot.classList.toggle('is-lit', prognosis ? i >= 1 && i <= 5 : true));
  weeks.dataset.kind = kind;
  document.getElementById('forecast-value').textContent = prognosis ? '5 weeks' : '20%';
  document.getElementById('forecast-description').textContent = prognosis ? 'ahead of a potential dengue outbreak' : 'lower prediction error across 10 regional zones';
  document.getElementById('forecast-context').textContent = prognosis
    ? 'I founded Prognosis and led a seven-person team. The platform was adopted by public-health agencies across three Indian states.'
    : 'In a separate Harvard collaboration, I led a ten-person team improving dengue prediction with better satellite data across ten zones in Colombia.';
  things?.region(kind);
}
document.querySelectorAll('[data-forecast]').forEach((b) => b.addEventListener('click', () => setForecast(b.dataset.forecast)));
setForecast('prognosis');

// Kiwi: 368 recorded falls as standing marks, one of them down; they lean away from the pointer
const falls = document.getElementById('falls');
const DOWN = 5 * 46 + 30, stand = [];
for (let n = 0; n < 368; n++) { const m = document.createElement('i'); falls.append(m); stand.push(m); }
const rest = new Float32Array(368);
const settle = () => stand.forEach((m, n) => { m.style.transform = rest[n] ? `rotate(${rest[n]}deg)` : ''; });
falls.closest('figure').addEventListener('seen', () => setTimeout(() => {
  stand[DOWN].classList.add('is-down'); rest[DOWN] = 90; rest[DOWN - 1] = 12; rest[DOWN + 2] = -12;
  settle();
}, reduced.matches ? 0 : 900));
if (!reduced.matches && matchMedia('(pointer: fine)').matches) {
  let boxes = null, raf = 0, px = 0, py = 0;
  addEventListener('resize', () => { boxes = null; });
  falls.addEventListener('pointermove', (e) => { const r = falls.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; if (!raf) raf = requestAnimationFrame(lean); });
  falls.addEventListener('pointerleave', settle);
  function lean() {
    raf = 0;
    if (!boxes) boxes = stand.map((m) => [m.offsetLeft + m.offsetWidth / 2 - falls.offsetLeft, m.offsetTop + m.offsetHeight - falls.offsetTop]);
    stand.forEach((m, n) => {
      if (n === DOWN) { m.style.transform = `rotate(${rest[n]}deg)`; return; }
      const dx = boxes[n][0] - px, d = Math.hypot(dx, boxes[n][1] - 8 - py);
      const push = d < 70 ? (1 - d / 70) * 28 * Math.sign(dx || 1) : 0;
      m.style.transform = `rotate(${(rest[n] + push).toFixed(1)}deg)`;
    });
  }
}

// Kiwi: false alarms as blocks out of a hundred
document.querySelectorAll('.blocks').forEach((grid) => {
  const lit = Number(grid.dataset.lit);
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement('i');
    if (i < Math.floor(lit)) cell.className = 'is-lit';
    else if (i === 0 && lit > 0 && lit < 1) cell.className = 'is-sliver';
    cell.style.setProperty('--d', `${(i % 10 + Math.floor(i / 10)) * 22}ms`);
    grid.append(cell);
  }
});

// the honest org chart: every line is in his verified work history
const signed = document.getElementById('signed');
const SIGNATURE = 'M30 22C24 12 8 16 6 30C5 42 18 42 25 28C27 23 29 18 29 17C27 28 26 40 33 39C39 38 42 27 45 20C46 17 48 17 48 21C48 25 47 30 47 30C49 24 54 17 59 19C62 21 60 25 63 26C67 27 70 22 72 20C71 27 71 37 77 37C83 37 87 27 89 19C88 32 88 47 82 54C78 58 73 55 76 49C80 42 93 38 99 30C103 25 106 20 109 22C103 17 94 22 94 31C94 40 103 38 108 29C110 25 111 21 111 20C110 28 110 38 116 38C121 37 123 29 126 22C126 28 125 34 125 37C127 28 132 19 138 21C143 23 139 33 142 37C144 39 147 37 148 35';
['Roadmap for both devices', 'Hardware check on every watch', 'Every supplier call', 'Every hiring interview', 'Sprint planning',
  'The company’s first cloud setup', 'Leading the investor meetings', 'Writing and sending the emails'].forEach((job, n) => {
  const li = document.createElement('li');
  li.style.setProperty('--n', n);
  // one pen stroke, written as "aryan"; each line gets its own slant and size so no two match
  li.style.setProperty('--tilt', `${-5 + (n * 37 % 7)}deg`);
  li.innerHTML = `<span>${job}</span><b>${n === 7 ? 'also ' : ''}<svg viewBox="0 0 148 60" role="img" aria-label="Aryan" style="width:${70 + (n * 13 % 5) * 3}px"><path pathLength="1" d="${SIGNATURE}"/></svg></b>`;
  signed.append(li);
});

// case-study reader
const dialog = document.getElementById('story-dialog');
const dialogContent = document.getElementById('dialog-content');
function openStory(name) {
  dialogContent.replaceChildren(document.getElementById(`story-${name}`).content.cloneNode(true));
  dialog.showModal();
  dialog.scrollTop = 0;
  stage?.setRunning(false);
}
document.querySelectorAll('[data-story]').forEach((button) => button.addEventListener('click', () => openStory(button.dataset.story)));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => stage?.setRunning(true));

// light or dark. The inline script in the head has already picked one (saved choice, else the system's)
const themeToggle = document.getElementById('theme-toggle');
function setTheme(theme, save) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = light ? 'Dark' : 'Light';
  themeToggle.setAttribute('aria-label', light ? 'Switch to the dark page' : 'Switch to the light page');
  document.querySelector('meta[name="theme-color"]').content = light ? '#e6e9f0' : '#0a0b0e';
  stage?.setLight(light);
  things?.setTheme(light);
  if (save) try { localStorage.setItem('theme', theme); } catch { /* private mode: the choice lasts for this visit */ }
}
themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true));
setTheme(document.documentElement.dataset.theme || 'dark', false);

// motion control
const toggle = document.getElementById('motion-toggle');
toggle.addEventListener('click', () => {
  const paused = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  stage?.setMotion(!paused);
  things?.setMotion(!paused);
  aryan?.setMotion(!paused);
});

// Aryan himself for the summary, and the things he made: shelf at the side, flying into their chapters, gathered around him there
if (stage) {
  import('./aryan.js').then((m) => m.createAryan(document.getElementById('aryan'), reduced.matches))
    .then((c) => { aryan = c; if (toggle.getAttribute('aria-pressed') === 'true') aryan?.setMotion(false); }).catch((error) => console.error(error));
  import('./things.js').then((m) => m.createThings({ stage, chapters, openStory, reduced: reduced.matches }))
    .then((t) => { things = t; things.region(weeks.dataset.kind); things.setTheme(document.documentElement.dataset.theme === 'light'); })
    .catch((error) => console.error(error));
}

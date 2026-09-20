// Scroll drives which version of Aryan is on stage; everything else here is
// the small per-chapter assets, the case-study reader and the motion control.
import { createStage, STATE } from './stage.js';

document.documentElement.classList.add('js');

const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
  el, id: el.id, state: STATE[el.dataset.state], side: el.dataset.side,
  melt: Number(el.dataset.melt ?? 0.3), note: el.dataset.note, form: el.dataset.form,
}));
const indexOf = (state) => chapters.findIndex((c) => c.state === state);
const note = document.getElementById('stage-note');
const rail = document.getElementById('rail');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const isSmall = () => innerWidth <= 820;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// rail: one entry per distinct version
const seen = new Set();
for (const c of chapters) {
  if (seen.has(c.state)) continue;
  seen.add(c.state);
  const a = document.createElement('a');
  a.href = `#${c.id}`;
  a.dataset.state = c.state;
  a.innerHTML = `<span>Aryan, ${c.form.split(',')[0]}</span>`;
  rail.append(a);
}

let marks = [];
function measure() {
  const max = document.documentElement.scrollHeight - innerHeight;
  marks = chapters.map((c, i) => {
    const top = c.el.offsetTop, mid = top + c.el.offsetHeight / 2;
    const centre = i === 0 ? innerHeight / 2 : i === chapters.length - 1 ? max + innerHeight / 2 : mid;
    return { top, centre };
  });
}

function position() {
  const y = scrollY + innerHeight / 2;
  let i = 0;
  while (i < chapters.length - 2 && y >= marks[i + 1].centre) i++;
  const a = marks[i], b = marks[i + 1], edge = Math.min(Math.max(b.top, a.centre + 1), b.centre - 1);
  const f = y < edge ? 0.5 * (y - a.centre) / (edge - a.centre) : 0.5 + 0.5 * (y - edge) / (b.centre - edge);
  return i + Math.min(1, Math.max(0, f));
}

let target = 0, eased = 0, activeNote = -1;
// the portrait sits in the middle of whatever the copy column leaves free
function anchor(c) {
  if (isSmall()) return 0.5;
  const pad = Math.min(96, Math.max(22, innerWidth * 0.06)), copy = pad + Math.min(540, innerWidth * 0.42);
  const x = (copy + innerWidth) / 2 / innerWidth;
  return c.side === 'left' ? x : 1 - x;
}

function apply(view, p) {
  const i = Math.min(chapters.length - 2, Math.floor(p)), f = p - i;
  const A = chapters[i], B = chapters[i + 1];
  view.a = A.state; view.b = B.state;
  view.mix = A.state === B.state ? 0 : smooth(0.3, 0.7, f);
  view.melt = A.state === STATE.melt
    ? (B.state === STATE.melt ? lerp(A.melt, B.melt, smooth(0.05, 0.95, f)) : A.melt + f * 0.5)
    : 0.3;
  const kb = indexOf(STATE.blocks), ka = indexOf(STATE.ascii), ks = indexOf(STATE.signal);
  view.build = smooth(kb - 0.62, kb - 0.04, p);
  view.fine = smooth(ka - 0.6, ka - 0.02, p);
  view.conv = 1 - smooth(0.1, 0.6, Math.abs(p - ks));
  view.cx = lerp(anchor(A), anchor(B), smooth(0.12, 0.88, f));
  view.cy = isSmall() ? 0.4 : 0.66;
  view.scale = isSmall() ? 0.92 : 1.3;

  const near = Math.round(p);
  document.documentElement.style.setProperty('--px', `${view.cx * 100}vw`);
  if (near !== activeNote) {
    activeNote = near;
    note.classList.remove('is-in');
    setTimeout(() => { note.textContent = chapters[near].note; note.classList.add('is-in'); }, 260);
    for (const a of rail.children) a.toggleAttribute('aria-current', Number(a.dataset.state) === chapters[near].state);
  }
}

const stage = await createStage(document.getElementById('stage-canvas')).catch((error) => { console.error(error); return null; });
if (!stage) document.documentElement.classList.add('no-stage');
if (stage) {
  measure();
  eased = target = position();
  const tick = () => {
    target = position();
    eased = reduced.matches ? target : eased + (target - eased) * 0.14;
    apply(stage.view, eased);
    requestAnimationFrame(tick);
  };
  tick();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);
  if (reduced.matches) stage.setMotion(false);
}

// reveal
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-seen'); e.target.dispatchEvent(new Event('seen')); io.unobserve(e.target); }
}, { threshold: 0.25 });
document.querySelectorAll('.copy > *').forEach((el) => io.observe(el));

// ASCII chart, typed out once
const chart = document.getElementById('ascii-chart');
const rows = [['GROK', 35.9], ['CLAUDE', 14.0], ['CHATGPT', 13.7], ['GEMINI', 9.0]];
const chartText = ['THIRD-PARTY REQUESTS / 2025 SNAPSHOT', '', ...rows.map(([name, v]) =>
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
}
document.querySelectorAll('[data-forecast]').forEach((b) => b.addEventListener('click', () => setForecast(b.dataset.forecast)));
setForecast('prognosis');

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

// case-study reader
const dialog = document.getElementById('story-dialog');
const dialogContent = document.getElementById('dialog-content');
document.querySelectorAll('[data-story]').forEach((button) => button.addEventListener('click', () => {
  dialogContent.replaceChildren(document.getElementById(`story-${button.dataset.story}`).content.cloneNode(true));
  dialog.showModal();
  dialog.scrollTop = 0;
  stage?.setRunning(false);
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => stage?.setRunning(true));

// motion control
const toggle = document.getElementById('motion-toggle');
toggle.addEventListener('click', () => {
  const paused = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  stage?.setMotion(!paused);
});

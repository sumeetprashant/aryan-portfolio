import { createScene } from './scene.js';

const q = new URLSearchParams(location.search);
const SHOT = q.has('shot');
if (SHOT) document.body.classList.add('shot');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* ---------------- hero: scene + fall detector ---------------- */
const hero = document.querySelector('.hero'), logEl = $('log'), statusText = $('statusText') || {}, alertMeta = $('alertMeta'), hintText = $('hintText');
const t0 = performance.now(); let falls = 0, lastIgnore = 0;
function stamp() { let s = (performance.now() - t0) / 1000; const m = Math.floor(s / 60); s -= m * 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function log(msg, hit) { const d = document.createElement('div'); d.textContent = stamp() + '  ' + msg; if (hit) d.className = 'hit'; logEl.appendChild(d); while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild); }

let scene = null;
try {
  scene = createScene($('gl'), {
    onFall(g) {
      falls++; document.body.classList.add('is-falling', 'has-fallen');
      alertMeta.textContent = 'Event ' + (falls < 10 ? '0' : '') + falls + ', peak ' + g.toFixed(1) + ' g, wrist impact';
      statusText.textContent = 'Fall detected, alerting caregiver'; $('miniState').textContent = 'fall detected';
      log('fall, peak ' + g.toFixed(1) + ' g, alert raised', true);
    },
    onRecover() {
      document.body.classList.remove('is-falling');
      statusText.textContent = 'Wrist sensor live, 50 Hz'; $('miniState').textContent = 'monitoring';
      hintText.textContent = 'It resets. Flick again any time.'; log('caregiver notified, monitoring');
    },
  });
} catch (err) { document.body.classList.add('no-webgl'); console.warn('3D scene unavailable', err); }

function triggerFall(g) { if (scene && scrollY < innerHeight * 0.5) scene.fall(g); }
function ignore() { const n = performance.now(); if (n - lastIgnore < 2600 || !scene || scene.state !== 'idle') return; lastIgnore = n; log('posture change, ignored'); }
log('sensor online');

let lx = null, ly = null, lt = 0, vS = 0;
addEventListener('pointermove', (e) => {
  if (!scene) return;
  scene.pointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
  const now = performance.now();
  if (lx !== null && e.pointerType !== 'touch') {
    const dt = Math.max(now - lt, 1), vx = (e.clientX - lx) / dt, vy = (e.clientY - ly) / dt, sp = Math.hypot(vx, vy);
    scene.impulse(vx, vy); vS = vS * 0.6 + sp * 0.4;
    if (vS > 3.4) triggerFall(2 + vS * 0.9); else if (vS > 1.2) ignore();
  }
  lx = e.clientX; ly = e.clientY; lt = now;
}, { passive: true });
document.addEventListener('pointerleave', () => { lx = null; vS = 0; });
$('simBtn').addEventListener('click', () => triggerFall(4.8));
addEventListener('keydown', (e) => { if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) triggerFall(4.8); });
$('replay').addEventListener('click', () => setTimeout(() => triggerFall(4.8), 900));

const motionBtn = $('motionBtn');
function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x === null || !scene) return;
  scene.impulse((a.x || 0) * 0.6, (a.y || 0) * 0.6);
  const g = Math.hypot(a.x, a.y, a.z) / 9.81; if (g > 2.6) triggerFall(g); else if (g > 1.7) ignore();
}
if ('DeviceMotionEvent' in window && matchMedia('(pointer: coarse)').matches) {
  hintText.textContent = 'Shake your phone, like a wrist in a fall.'; $('simBtn').textContent = 'or tap here';
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    motionBtn.hidden = false;
    motionBtn.addEventListener('click', () => DeviceMotionEvent.requestPermission().then((r) => { if (r === 'granted') { addEventListener('devicemotion', onMotion); motionBtn.hidden = true; log('phone sensor linked'); } }).catch(() => {}));
  } else addEventListener('devicemotion', onMotion);
}
if (q.has('pose') && scene) { scene.debugPose(q.get('pose')); document.body.classList.add('has-fallen'); if (q.get('pose') === 'down') document.body.classList.add('is-falling'); }
if (q.has('fall')) setTimeout(() => scene && scene.fall(4.8), 700);
if (q.has('y')) addEventListener('load', () => { scrollTo({ top: +q.get('y'), behavior: 'instant' }); });

/* ---------------- scroll: canvas fade, nav, progress, manifesto ---------------- */
const gl = $('gl'), nav = $('nav'), progress = $('progress'), man = $('manifesto');
man.innerHTML = man.textContent.trim().split(/\s+/).map((w) => '<span class="w">' + w + '</span>').join(' ');
const words = [...man.querySelectorAll('.w')];
if (SHOT || reduce) words.forEach((w) => w.classList.add('on'));
function onScroll() {
  const y = scrollY, vh = innerHeight, p = Math.min(1, y / vh);
  if (scene) { scene.scroll(p); scene.setVisible(p < 1); }
  gl.style.opacity = String(1 - Math.max(0, (p - 0.45) / 0.55));
  hero.style.opacity = String(1 - Math.min(1, p * 1.5)); hero.style.transform = 'translateY(' + (-p * 60) + 'px)';
  nav.classList.toggle('solid', y > vh * 0.6);
  progress.style.transform = 'scaleX(' + (y / Math.max(1, document.documentElement.scrollHeight - vh)) + ')';
  if (!SHOT && !reduce) { const r = man.getBoundingClientRect(), k = (vh * 0.82 - r.top) / (r.height + vh * 0.35), n = Math.round(Math.max(0, Math.min(1, k)) * words.length); words.forEach((w, i) => w.classList.toggle('on', i < n)); }
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

/* ---------------- reveals, counters, bars ---------------- */
function countUp(el) {
  const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '', sep = el.dataset.sep, t1 = performance.now(), dur = 1500;
  (function tick(now) { const u = Math.min(1, (now - t1) / dur), e = 1 - Math.pow(1 - u, 4), v = to * e; let s = v.toFixed(dec); if (sep) s = Math.round(v).toLocaleString('en-US'); el.textContent = pre + s + suf; if (u < 1) requestAnimationFrame(tick); })(t1);
}
function activate(el) {
  el.classList.add('in');
  el.querySelectorAll('.bar').forEach((b) => { b.querySelector('i').style.width = b.dataset.w + '%'; });
  if (!SHOT && !reduce) el.querySelectorAll('b[data-to]').forEach(countUp);
}
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { activate(e.target); io.unobserve(e.target); } }), { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el) => { if (SHOT) activate(el); else io.observe(el); });
document.querySelectorAll('.case,.mini-case').forEach((c) => c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));

/* ---------------- live privacy meter ---------------- */
let total = 0, third = 0; const seen = new Set();
function count(list) {
  list.forEach((r) => { const k = r.name + r.startTime; if (seen.has(k)) return; seen.add(k); let host = ''; try { host = new URL(r.name).hostname; } catch (e) {} total++; if (host && host !== location.hostname) third++; });
  $('reqTotal').textContent = total + 1; $('reqThird').textContent = third; $('tpPct').textContent = Math.round(third / (total + 1) * 100) + '%';
  $('footTally').textContent = 'No trackers. No cookies. ' + third + ' third-party requests.';
}
count(performance.getEntriesByType('resource'));
try { new PerformanceObserver((l) => count(l.getEntries())).observe({ type: 'resource', buffered: true }); } catch (e) {}

/* ---------------- mini trace (mirrors the hero signal) ---------------- */
const mini = $('mini'), mx = mini.getContext('2d'); let mW = 0, mH = 0; const dpr = Math.min(devicePixelRatio || 1, 2);
function drawMini() {
  requestAnimationFrame(drawMini);
  const r = mini.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
  if (mini.clientWidth !== mW || mini.clientHeight !== mH) { mW = mini.clientWidth; mH = mini.clientHeight; mini.width = mW * dpr; mini.height = mH * dpr; mx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  mx.clearRect(0, 0, mW, mH);
  const alert = document.body.classList.contains('is-falling'), bufs = scene ? scene.signal : null, n = 300;
  for (let a = 0; a < 3; a++) {
    mx.beginPath(); mx.lineWidth = a === 2 ? 2 : 1.2; mx.strokeStyle = alert ? '#ff3b2f' : (a === 2 ? '#5ff2b6' : '#cfe0ff'); mx.globalAlpha = a === 2 ? 1 : 0.35;
    if (a === 2) { mx.shadowColor = mx.strokeStyle; mx.shadowBlur = 10; } else mx.shadowBlur = 0;
    const mid = mH * (0.22 + a * 0.27);
    for (let i = 0; i < n; i++) { const v = bufs ? bufs[a][bufs[a].length - n + i] : Math.sin(i * 0.1 + a) * 0.1; const x = i / (n - 1) * mW, y = mid - Math.max(-0.5, Math.min(0.5, v)) * mH * 0.42; i ? mx.lineTo(x, y) : mx.moveTo(x, y); }
    mx.stroke();
  }
  mx.globalAlpha = 1; mx.shadowBlur = 0;
}
drawMini();

/* ---------------- bifilar pendulum ---------------- */
const pc = $('pend'), px = pc.getContext('2d'), pState = $('pendState'), pT = $('pT'), pI = $('pI');
const M = 68, G = 9.81, L = 2, D = 1; let I = 18, th = SHOT ? 0.5 : 0, om = 0, drag = false, grab = 0, lastCross = null, crossings = [], lastT = performance.now(), PW = 0, PH = 0, kicked = false;
const ang = (e) => { const r = pc.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
function resetRead() { crossings = []; lastCross = null; pT.textContent = '0.00'; pI.textContent = '0.00'; }
pc.addEventListener('pointerdown', (e) => { drag = true; pc.setPointerCapture(e.pointerId); grab = ang(e) - th; om = 0; resetRead(); pState.textContent = 'twisting'; });
pc.addEventListener('pointermove', (e) => { if (!drag) return; let a = ang(e) - grab; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; th = Math.max(-1.1, Math.min(1.1, a)); });
const release = () => { if (!drag) return; drag = false; pState.textContent = 'swinging, timing'; };
pc.addEventListener('pointerup', release); pc.addEventListener('pointercancel', release);
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach((o) => o.classList.remove('on')); b.classList.add('on'); I = +b.dataset.i; resetRead();
  if (!drag && Math.abs(th) < 0.08) { th = 0.7; om = 0; } pState.textContent = 'swinging, timing';
}));
function pstep(now) {
  requestAnimationFrame(pstep);
  const dt = Math.min((now - lastT) / 1000, 0.033); lastT = now;
  const r = pc.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  if (pc.clientWidth !== PW || pc.clientHeight !== PH) { PW = pc.clientWidth; PH = pc.clientHeight; pc.width = PW * dpr; pc.height = PH * dpr; px.setTransform(dpr, 0, 0, dpr, 0, 0); }
  if (PW < 60 || PH < 60) return;
  if (!kicked && !SHOT && r.top < innerHeight * 0.7) { kicked = true; th = 0.75; om = 0; pState.textContent = 'swinging, timing'; }
  if (!drag && !SHOT) {
    const k = M * G * D * D / (4 * L), prev = th; om += (-k / I * th - 0.05 * om) * dt; th += om * dt;
    if (prev < 0 && th >= 0) {
      if (lastCross !== null) { crossings.push((now - lastCross) / 1000); if (crossings.length > 3) crossings.shift(); const T = crossings.reduce((s, v) => s + v, 0) / crossings.length; pT.textContent = T.toFixed(2); pI.textContent = (M * G * D * D * T * T / (16 * Math.PI * Math.PI * L)).toFixed(1); pState.textContent = 'measured'; }
      lastCross = now;
    }
  }
  px.clearRect(0, 0, PW, PH);
  const cx = PW / 2, cy = PH / 2, s = Math.min(PW * 0.46, PH * 0.5 - 8);
  px.strokeStyle = 'rgba(255,255,255,.1)'; px.lineWidth = 1;
  px.beginPath(); px.arc(cx, cy, s, 0, Math.PI * 2); px.stroke();
  px.setLineDash([3, 6]); px.beginPath(); px.moveTo(cx - s, cy); px.lineTo(cx + s, cy); px.stroke(); px.setLineDash([]);
  for (let k2 = -6; k2 <= 6; k2++) { const a = k2 * Math.PI / 18; px.beginPath(); px.moveTo(cx + Math.cos(a) * (s - 6), cy + Math.sin(a) * (s - 6)); px.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); px.stroke(); }
  px.strokeStyle = 'rgba(255,59,47,.35)'; px.lineWidth = 2; px.beginPath(); px.arc(cx, cy, s, Math.min(0, th), Math.max(0, th)); px.stroke();
  px.save(); px.translate(cx, cy); px.rotate(th);
  const grad = px.createLinearGradient(-s, 0, s, 0); grad.addColorStop(0, '#8e98ad'); grad.addColorStop(0.5, '#f3f4f6'); grad.addColorStop(1, '#8e98ad');
  px.fillStyle = grad; px.shadowColor = 'rgba(207,224,255,.35)'; px.shadowBlur = 18;
  px.beginPath(); px.moveTo(-s * 0.9, -2); px.lineTo(-s * 0.12, -9); px.lineTo(s * 0.12, -9); px.lineTo(s * 0.9, -2); px.lineTo(s * 0.9, 3); px.lineTo(s * 0.12, 9); px.lineTo(-s * 0.12, 9); px.lineTo(-s * 0.9, 3); px.closePath(); px.fill();
  px.beginPath(); px.moveTo(0, -s * 0.5); px.quadraticCurveTo(11, -s * 0.34, 9, -s * 0.05); px.lineTo(6, s * 0.46); px.lineTo(-6, s * 0.46); px.lineTo(-9, -s * 0.05); px.quadraticCurveTo(-11, -s * 0.34, 0, -s * 0.5); px.closePath(); px.fill();
  px.beginPath(); px.moveTo(-s * 0.24, s * 0.4); px.lineTo(s * 0.24, s * 0.4); px.lineTo(s * 0.24, s * 0.44); px.lineTo(0, s * 0.48); px.lineTo(-s * 0.24, s * 0.44); px.closePath(); px.fill();
  px.shadowBlur = 0;
  if (I > 30) { px.fillStyle = '#ff3b2f'; px.shadowColor = '#ff3b2f'; px.shadowBlur = 16; px.beginPath(); px.roundRect(-s * 0.6 - 10, -11, 20, 22, 5); px.roundRect(s * 0.6 - 10, -11, 20, 22, 5); px.fill(); px.shadowBlur = 0; }
  px.fillStyle = '#06070a'; px.strokeStyle = '#ff3b2f'; px.lineWidth = 2;
  [-s * 0.3, s * 0.3].forEach((x) => { px.beginPath(); px.arc(x, 0, 5, 0, Math.PI * 2); px.fill(); px.stroke(); });
  px.restore();
}
requestAnimationFrame(pstep);

// The felt character in the summary. He looks at whatever the visitor is looking at: the pointer, or the
// thing nearest it (js/things.js names that point), or on a phone the thing nearest the middle of the screen.
// Once the head-turn clip exists (assets/felt-look.mp4, see scripts/prep_felt_clip.mjs) it is never played:
// the point he is looking at scrubs currentTime, and the next seek waits for 'seeked' so seeks never flood.
// Until then the still does the work. His eyes were blanked in scripts/prep_stage.py and are drawn here: an iris
// with its pupil, held inside the eye opening by a mask, under the shadow of the lid, with a catch-light that
// stays where the light is while the iris moves. The eyes lead, and the head leans after them.
import clip from '../assets/felt-clip.js';
import eyesAt from '../assets/felt-eyes.js';

const TRAVEL = 0.62;        // how much of the room inside the opening the iris uses: never wide-eyed
const LIFT = 0.2;           // the iris rests a little high, its top under the upper lid: white showing above it is what reads as startled
const DOCK_SCALE = 0.62;    // his size while he stands beside the summary's copy
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createFelt(root, section, reduced) {
  const video = root.querySelector('video'), irises = [...root.querySelectorAll('.felt-irises i')], glints = [...root.querySelectorAll('.felt-glint')];
  const hover = matchMedia('(hover: hover)').matches;
  let ready = false, seeking = false, target = 0;
  let px = innerWidth * 0.75, py = innerHeight * 0.4;   // until the pointer moves he looks where the still was drawn looking
  let gx = 0.8, gy = 0, hx = 0, hy = 0, near = 0;

  // the eyes are laid out once, in fractions of his frame, so they hold at any size
  for (const [k, v] of Object.entries(eyesAt.colours)) root.style.setProperty(`--${k}`, `rgb(${v.join(',')})`);
  eyesAt.eyes.forEach((e, i) => {
    const d = e.pr * 2;
    Object.assign(irises[i].style, { width: `${d * 100}%`, left: `${(e.cx - e.pr) * 100}%`, top: `${(e.cy - e.ry * LIFT - e.pr * 1.5) * 100}%` });   // the frame is 3:2, so a width is half as much again of its height
    Object.assign(glints[i].style, { width: `${d * 20}%`, left: `${(e.cx - e.rx * 0.36) * 100}%`, top: `${(e.cy - e.ry * 0.56) * 100}%` });
  });

  function seek() {
    if (!ready || seeking || Math.abs(video.currentTime - target) < 1 / 60) return;
    seeking = true;
    video.currentTime = target;
  }
  const look = (k) => { target = Math.min(1, Math.max(0, k)) * Math.max(0, video.duration - 0.05); seek(); };

  if (clip.ready) {
    video.addEventListener('loadeddata', () => { ready = true; root.classList.add('has-clip'); look(0.5); }, { once: true });
    video.addEventListener('seeked', () => { seeking = false; seek(); });
    video.src = clip.src;
    video.load();
  }

  addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') { px = e.clientX; py = e.clientY; } }, { passive: true });

  return {
    // focus: the point on screen of the thing he should look at, or null to follow the pointer
    // dock: 0 in the middle of the stage, 1 beside the summary's copy; dockX: where his middle stands then
    update(weight, focus, dock = 0, dockX = innerWidth / 2) {
      root.style.opacity = weight.toFixed(3);
      root.style.visibility = weight < 0.01 ? 'hidden' : 'visible';
      if (weight < 0.01) return;
      const box = root.getBoundingClientRect();
      const at = focus ?? (hover ? { x: px, y: py } : { x: innerWidth / 2, y: innerHeight * 0.4 });
      // where he is looking, from between his eyes: -1..1 each way, full reach a third of the window away
      const ex = box.left + box.width * (eyesAt.eyes[0].cx + eyesAt.eyes[1].cx) / 2, ey = box.top + box.height * (eyesAt.eyes[0].cy + eyesAt.eyes[1].cy) / 2;
      let tx = (at.x - ex) / (innerWidth * 0.3), ty = (at.y - ey) / (innerHeight * 0.34);
      const len = Math.hypot(tx, ty);
      if (len > 1) { tx /= len; ty /= len; }
      // the eyes lead, the head follows
      const ke = reduced ? 1 : 0.2, kh = reduced ? 1 : 0.07;
      gx += (tx - gx) * ke; gy += (ty - gy) * ke;
      hx += (tx - hx) * kh; hy += (ty - hy) * kh;
      near += (1 - smooth(0.12, 0.45, Math.hypot(at.x - ex, at.y - ey) / innerHeight) - near) * ke;

      if (ready) look(0.5 + hx * 0.5);
      else irises.forEach((iris, i) => {
        const e = eyesAt.eyes[i], prY = e.pr * 1.5;
        // both take the same offset; on something close they turn in a little toward each other
        const ox = gx * (e.rx - e.pr * 0.8) * TRAVEL + (i ? -1 : 1) * near * e.rx * 0.1, oy = gy * (e.ry - prY * 0.8) * TRAVEL * (gy < 0 ? 0.9 : 0.4);   // he looks up freely, and down mostly with his head
        // it sits on a ball: toward the rim it is seen edge on, so it narrows along the way it has gone
        const far = Math.min(1, Math.hypot(ox / (e.rx - e.pr * 0.8), oy / (e.ry - prY * 0.8))), turn = Math.atan2(oy * 1.5, ox);
        iris.style.transform = `translate(${(ox / (e.pr * 2) * 100).toFixed(1)}%, ${(oy / (prY * 2) * 100).toFixed(1)}%) rotate(${turn.toFixed(3)}rad) scaleX(${(1 - 0.24 * far * far).toFixed(3)}) rotate(${(-turn).toFixed(3)}rad)`;
        // and the pupil rides toward the side he is looking to, as it does in the picture he was cut from
        iris.firstElementChild.style.transform = `translate(${(gx * 13).toFixed(1)}%, ${(gy * 10).toFixed(1)}%)`;
      });
      // with the clip his head does the turning, so the frame only drifts; the still leans from the shoulders
      const reach = (ready ? 10 : 30) * (1 - 0.5 * dock), lean = ready ? 0 : 3.6;
      const size = (0.94 + 0.06 * weight) * (1 + (DOCK_SCALE - 1) * dock);
      root.style.transform = `translate3d(calc(-50% + ${(dock * (dockX - innerWidth / 2) + hx * reach).toFixed(1)}px), ${(hy * 10 + (1 - weight) * 40).toFixed(1)}px, 0) rotate(${(hx * lean).toFixed(2)}deg) scale(${size.toFixed(3)})`;
    },
  };
}

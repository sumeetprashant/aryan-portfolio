// The felt character in the summary. He looks at whatever the visitor is looking at: the pointer, or the
// thing under it (js/things.js names that point), or on a phone the thing nearest the middle of the screen.
// Once the head-turn clip exists (assets/felt-look.mp4, see scripts/prep_felt_clip.mjs) it is never played:
// the point he is looking at scrubs currentTime, and the next seek waits for 'seeked' so seeks never flood.
// Until then the still does the work: his pupils are their own layer (scripts/prep_stage.py) and travel inside
// the eye whites, the eyes lead, and the head leans after them.
import clip from '../assets/felt-clip.js';
import eyesAt from '../assets/felt-eyes.js';

export function createFelt(root, section, reduced) {
  const video = root.querySelector('video'), pupils = [...root.querySelectorAll('.felt-eyes i')];
  const hover = matchMedia('(hover: hover)').matches;
  let ready = false, seeking = false, target = 0;
  let px = innerWidth * 0.75, py = innerHeight * 0.4;   // until the pointer moves he looks where the still was drawn looking
  let gx = 0.8, gy = 0, hx = 0, hy = 0, W = 0;

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
    update(weight, focus) {
      root.style.opacity = weight.toFixed(3);
      root.style.visibility = weight < 0.01 ? 'hidden' : 'visible';
      if (weight < 0.01) return;
      const w = root.offsetWidth, h = root.offsetHeight, box = root.getBoundingClientRect();
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

      if (ready) look(0.5 + hx * 0.5);
      else {
        if (w !== W) {
          W = w;
          const size = 2 * eyesAt.eyes[0].pr * w / eyesAt.sprite;
          for (const p of pupils) { p.style.width = p.style.height = `${size.toFixed(1)}px`; p.style.margin = `${(-size / 2).toFixed(1)}px`; }
        }
        pupils.forEach((p, i) => {
          const e = eyesAt.eyes[i], prY = e.pr * 1.5;   // the frame is 3:2, so a radius is half as much again of its height
          // both pupils take the same offset, so he never goes cross-eyed; they may tuck a little under the lids, as they did in the still
          const x = (e.cx + gx * (e.rx - e.pr * 0.62)) * w, y = (e.cy + gy * (e.ry - prY * 0.72)) * h;
          p.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        });
      }
      // with the clip his head does the turning, so the frame only drifts; the still leans from the shoulders
      const reach = ready ? 10 : 34, lean = ready ? 0 : 3.6;
      root.style.transform = `translate3d(calc(-50% + ${(hx * reach).toFixed(1)}px), ${(hy * 10 + (1 - weight) * 40).toFixed(1)}px, 0) rotate(${(hx * lean).toFixed(2)}deg) scale(${(0.94 + 0.06 * weight).toFixed(3)})`;
    },
  };
}

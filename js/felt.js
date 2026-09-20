// The felt character in the summary. Once the head-turn clip exists (assets/felt-look.mp4, see
// scripts/prep_felt_clip.mjs) it is never played: the pointer's horizontal position scrubs
// currentTime, and the next seek waits for 'seeked' so seeks never flood. Until then a still
// stands in, and the whole figure leans after the pointer so the response is unmistakable.
import clip from '../assets/felt-clip.js';

export function createFelt(root, section, reduced) {
  const video = root.querySelector('video');
  let ready = false, seeking = false, target = 0, mx = 0, my = 0, ex = 0, ey = 0;

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

  addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2;
    if (e.pointerType !== 'touch') look(e.clientX / innerWidth);
  }, { passive: true });
  // no pointer to follow on a phone: he looks across as the summary scrolls past
  if (!matchMedia('(hover: hover)').matches) {
    addEventListener('scroll', () => { const r = section.getBoundingClientRect(); look(0.15 - r.top / innerHeight * 0.7); }, { passive: true });
  }

  return {
    update(weight) {
      root.style.opacity = weight.toFixed(3);
      root.style.visibility = weight < 0.01 ? 'hidden' : 'visible';
      if (weight < 0.01) return;
      const k = reduced ? 1 : 0.09;
      ex += (mx - ex) * k; ey += (my - ey) * k;
      // with the clip his head does the turning, so the frame only drifts; the still has to carry it alone
      const reach = ready ? 10 : 46, lean = ready ? 0 : 2.4;
      root.style.transform = `translate3d(calc(-50% + ${(ex * reach).toFixed(1)}px), ${(ey * 12 + (1 - weight) * 40).toFixed(1)}px, 0) rotate(${(ex * lean).toFixed(2)}deg) scale(${(0.94 + 0.06 * weight).toFixed(3)})`;
    },
  };
}

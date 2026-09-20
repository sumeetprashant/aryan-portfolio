// These are explicitly labeled illustrations. No synthetic samples are
// presented as measurements from Aryan's studies.
const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

export function createInstruments() {
  let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let suspended = false;
  let time = 0;
  let last = 0;
  let raf = 0;
  let signalTarget = 1;
  let signalBlend = 1;
  let privacyTarget = 35.9;
  let privacyBlend = 35.9;
  let forecast = 'prognosis';
  const views = [];
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const view = views.find(item => item.canvas === entry.target);
      if (view) view.visible = entry.isIntersecting;
    });
    requestDraw();
  }, { rootMargin: '100px' });

  function add(id, paint) {
    const canvas = document.getElementById(id);
    const context = canvas?.getContext('2d');
    if (!context) return;
    const view = { canvas, context, paint, width: 0, height: 0, visible: false, pointer: 0 };
    views.push(view);
    canvas.parentElement.classList.add('canvas-ready');
    new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      view.width = rect.width;
      view.height = rect.height;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      requestDraw();
    }).observe(canvas);
    canvas.parentElement.addEventListener('pointermove', event => {
      if (!running || event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();
      view.pointer = (event.clientX - rect.left) / rect.width - .5;
      requestDraw();
    }, { passive: true });
    canvas.parentElement.addEventListener('pointerleave', () => { view.pointer = 0; requestDraw(); });
    visibility.observe(canvas);
  }

  function drawSignal(view) {
    const { context: ctx, width: w, height: h } = view;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const scale = w / 610;
    const cy = h * .38;
    const yaw = -.17 + view.pointer * .1;
    const phase = time * .35;
    // 69 filaments refer to the 69 model configurations, not sensor data.
    for (let row = 0; row < 69; row++) {
      const v = row / 68;
      const z = (v - .5) * 280;
      ctx.beginPath();
      const opacity = .13 + Math.sin(v * Math.PI) * .54;
      ctx.strokeStyle = signalBlend > .5 ? `rgba(198,216,168,${opacity})` : `rgba(212,165,112,${opacity})`;
      ctx.lineWidth = row % 9 === 0 ? 1.3 : .65;
      for (let j = 0; j <= 110; j++) {
        const u = j / 110;
        const x = (u - .5) * 620;
        const envelope = Math.exp(-((u - .53) ** 2) * 21);
        const shaped = Math.sin(u * 8.4 - v * 3.3 + phase) * 88 * envelope
          + Math.cos(u * 4.5 + v * 2) * 20;
        const noisy = Math.sin(u * 77 + v * 42 + phase) * 21 + Math.sin(u * 37 - v * 29) * 26
          + Math.cos(u * 21 + v * 65 + phase) * 18;
        const y = mix(noisy, shaped, signalBlend);
        const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
        const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
        const px = w * .52 + (rx + rz * .23) * scale;
        const py = cy + (y - rz * .32) * scale;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }

  function bezier(a, b, c, d, t) {
    const q = 1 - t;
    return q ** 3 * a + 3 * q * q * t * b + 3 * q * t * t * c + t ** 3 * d;
  }

  function drawPrivacy(view) {
    const { context: ctx, width: w, height: h } = view;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const x1 = 28, x4 = w - 27;
    const top = h * .5;
    const band = Math.min(125, h * .27);
    for (let i = 0; i < 100; i++) {
      const third = i < privacyBlend;
      const y1 = top + i * band / 100;
      const y4 = third ? top - 29 + i * .52 : top + 47 + (i - privacyBlend) * 1.05;
      const y2 = y1, y3 = y4;
      const x2 = w * .5, x3 = w * .57;
      ctx.strokeStyle = third ? 'rgba(165,95,54,.32)' : 'rgba(76,94,62,.19)';
      ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4); ctx.stroke();
      if (i % 7 === 0) {
        const t = ((time * .15 + i * .067) % 1);
        const x = bezier(x1, x2, x3, x4, t);
        const y = bezier(y1, y2, y3, y4, t);
        ctx.fillStyle = third ? '#a66542' : '#62714f';
        ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
      }
    }
  }

  function heightAt(x, z) {
    const hill1 = Math.exp(-((x - .2) ** 2 * 2.9 + (z + .1) ** 2 * 3.6));
    const hill2 = Math.exp(-((x + .85) ** 2 * 3 + (z - .4) ** 2 * 4)) * .6;
    const hill3 = Math.exp(-((x - 1.05) ** 2 * 5 + (z - .75) ** 2 * 4)) * .4;
    return (hill1 + hill2 + hill3) * 135 + Math.sin(x * 3.4 + z * 1.6) * 9;
  }

  function drawTerrain(view) {
    const { context: ctx, width: w, height: h } = view;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const s = w / 610;
    const yaw = -.55 + view.pointer * .08 + Math.sin(time * .13) * .04;
    const cx = w * .5, cy = h * .44;
    function project(x, z) {
      const y = heightAt(x, z);
      const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
      const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      return [cx + rx * 149 * s, cy + (rz * 65 - y) * s];
    }
    for (let row = 0; row <= 54; row++) {
      const z = -1.6 + row / 54 * 3.2;
      ctx.beginPath();
      ctx.lineWidth = row % 9 === 0 ? 1.1 : .7;
      ctx.strokeStyle = `rgba(133,193,175,${.17 + row / 54 * .41})`;
      for (let j = 0; j <= 80; j++) {
        const p = project(-1.7 + j / 80 * 3.4, z);
        j ? ctx.lineTo(...p) : ctx.moveTo(...p);
      }
      ctx.stroke();
    }
    for (let col = 0; col <= 42; col++) {
      const x = -1.7 + col / 42 * 3.4;
      ctx.beginPath(); ctx.lineWidth = .55; ctx.strokeStyle = 'rgba(133,193,175,.17)';
      for (let j = 0; j <= 65; j++) { const p = project(x, -1.6 + j / 65 * 3.2); j ? ctx.lineTo(...p) : ctx.moveTo(...p); }
      ctx.stroke();
    }
    // Moving contour stands for the changing forecast horizon, not a real map.
    const horizon = forecast === 'prognosis' ? .22 : -.48;
    for (let ring = 0; ring < 3; ring++) {
      const radius = .17 + ring * .18 + (Math.sin(time * .7) + 1) * .025;
      ctx.beginPath(); ctx.strokeStyle = `rgba(229,194,138,${.9 - ring * .23})`; ctx.lineWidth = 1.25;
      for (let j = 0; j <= 100; j++) {
        const a = j / 100 * TAU;
        const p = project(horizon + Math.cos(a) * radius, -.05 + Math.sin(a) * radius);
        j ? ctx.lineTo(...p) : ctx.moveTo(...p);
      }
      ctx.stroke();
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000 || 0, .05);
    last = now;
    if (running && !suspended && !document.hidden) time += dt;
    const active = views.some(view => view.visible);
    signalBlend = running ? mix(signalBlend, signalTarget, .07) : signalTarget;
    privacyBlend = running ? mix(privacyBlend, privacyTarget, .08) : privacyTarget;
    if (!suspended && !document.hidden) views.forEach(view => { if (view.visible) view.paint(view); });
    if (running && active && !suspended && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function requestDraw() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', requestDraw);
  add('signal-canvas', drawSignal);
  add('privacy-canvas', drawPrivacy);
  add('terrain-canvas', drawTerrain);
  return {
    setMotion(value) { running = value; requestDraw(); },
    setSuspended(value) { suspended = value; requestDraw(); },
    setSignal(value) { signalTarget = value === 'model' ? 1 : 0; requestDraw(); },
    setPrivacy(value) { privacyTarget = value; requestDraw(); },
    setForecast(value) { forecast = value; requestDraw(); }
  };
}

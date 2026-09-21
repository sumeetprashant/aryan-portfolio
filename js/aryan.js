// Aryan in the summary: his own pixel-art clips, made on Sumeet's machine against a green screen, cut out here
// and drawn straight onto the page. He works at a desk in the upper middle while the visitor meets the things
// (and turns his head toward the one that has attention), walks down when the copy arrives, sits on the letters
// of the Kiwi heading and keeps working, then melts. All four clips share one scene of 1920 x 1080 units.
export const SCENE = {
  cx: 960,                          // his centre line
  seat: 863,                        // the line he sits on (a hair below the thighs' soft edge, so he rests on the letters)
  top: 46,                          // his hair when he stands up from the desk
  desk: [708, 163, 1199, 512],      // the desk, with him at it
  seated: [836, 633, 1051, 1000],   // him, seated
  legs: [851, 942],                 // where his lower legs hang, seated, at rest (by the heading)
  swing: [800, 960],                // where his feet reach as they swing (below the heading)
  deskImg: [550, 80, 806, 457],     // assets/clips/desk.png, the desk alone (x, y, w, h)
  block: 3,                         // the size of his pixels, in units
};
// the clips were rendered at 0.7 of a 1920 x 1080 frame, with 6 px of green above and below; each fills a window of
// the scene (x, y, w, h), and walk.mp4 is cropped to where he moves (x, y, w, h in clip pixels)
const CLIPS = {
  work: { src: 'assets/clips/work.mp4', win: [513, 90, 880, 495], crop: [0, 0, 1344, 768], loop: true },
  look: { src: 'assets/clips/look.mp4', win: [513, 90, 880, 495], crop: [0, 0, 1344, 768] },
  walk: { src: 'assets/clips/walk.mp4', win: [0, 0, 1920, 1080], crop: [432, 24, 592, 704] },
  sit: { src: 'assets/clips/sit.mp4', win: [504, 569, 880, 495], crop: [0, 0, 1344, 768], loop: true },
};
const LOOK = [1.1, 3.1];            // look.mp4: looking to screen-left, then to screen-right
const FADE = 0.12;                  // cross-fades between clips, seconds

const VS = `#version 300 es
uniform vec4 uQuad;
uniform vec2 uRes;
out vec2 vPx;
void main(){
  vec2 c = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
  vPx = uQuad.xy + c * uQuad.zw;
  gl_Position = vec4(vPx.x / uRes.x * 2. - 1., 1. - vPx.y / uRes.y * 2., 0., 1.);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uOrigin;
uniform float uScale, uAlpha, uKey, uBlock, uMelt, uFig;
uniform vec4 uRect;
in vec2 vPx;
out vec4 o;
float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  vec2 u = (vPx - uOrigin) / uScale;
  // the melt, as the hero does it: every column of his pixels runs down like wax, each at its own pace
  float m = uMelt;
  if (m > 0.){
    float cx = floor(u.x / (uBlock > 0. ? uBlock * 2. : 6.));
    float cn = h11(cx + 3.1), n = mix(cn, h11(floor(cx * .5) + 9.7), step(.45, h11(cx * 1.7)));
    float sag = .5 + .5 * sin(cx * .21 + 1.3) * sin(cx * .083 + .4);
    u.y -= uFig * (m * (.03 + .1 * sag + .5 * pow(n, 3.)) + smoothstep(.2, 1., m) * (.3 + .3 * sag + .25 * cn) + smoothstep(.55, 1., m) * .5);
  }
  // back onto his own pixel grid, so any smear from the video model reads as square pixels again
  if (uBlock > 0.) u = (floor(u / uBlock) + .5) * uBlock;
  vec2 t = (u - uRect.xy) / uRect.zw;
  if (t.x < 0. || t.y < 0. || t.x > 1. || t.y > 1.) discard;
  vec4 c = texture(uTex, t);
  float a = c.a;
  if (uKey > .5){
    // the green screen, keyed by how much greener than red and blue a pixel is (its shade drifts from clip to clip)
    float g = c.g - max(c.r, c.b);
    a = 1. - smoothstep(.14, .3, g);
    c.g = min(c.g, max(c.r, c.b) + .05);
  }
  a *= uAlpha * (1. - smoothstep(.6, 1., m));
  if (a < .004) discard;
  o = vec4(c.rgb * a, a);
}`;

function compile(gl) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  gl.useProgram(p);
  return u;
}

function texture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// where the whole clip lies in the scene
function rectOf(c) {
  const [wx, wy, ww, wh] = c.win, [cx, cy, cw, ch] = c.crop, kx = ww / 1920 / 0.7, ky = wh / 1080 / 0.7;
  return [wx + cx * kx, wy + (cy - 6) * ky, cw * kx, ch * ky];
}

function video(src, loop, preload) {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = !!loop; v.preload = preload;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.src = src;
  // seeks are queued, never stacked: while one is under way the latest wish waits for it (temp03's scrub)
  v.want = null;
  v.addEventListener('seeked', () => { if (v.want !== null) { const t = v.want; v.want = null; if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t; } });
  v.load();
  return v;
}
function seek(v, t) {
  if (v.seeking) { v.want = t; return; }
  if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t;
}
const play = (v) => { if (v.paused) v.play().catch(() => {}); };

export async function createAryan(canvas, reduced) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const u = compile(gl);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // a phone only ever shows him seated, so it only fetches that clip
  const phone = matchMedia('(max-width: 820px)').matches, layers = {};
  for (const [name, c] of Object.entries(CLIPS)) layers[name] = { ...c, v: video(c.src, c.loop, phone && name !== 'sit' ? 'none' : 'auto'), tex: texture(gl), rect: rectOf(c), a: 0, want: 0, key: 1 };
  const img = new Image();
  img.src = 'assets/clips/desk.png';
  await img.decode();
  const desk = { tex: texture(gl), rect: SCENE.deskImg, a: 0, want: 0, key: 0 };
  gl.bindTexture(gl.TEXTURE_2D, desk.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  const hover = matchMedia('(hover: hover)').matches;
  let live = !reduced, phase = 'desk', mode = 'work', walkDir = 1, lookT = 0, last = performance.now(), shown = false;
  const { work, look, walk, sit } = layers;

  function stopAll() { for (const l of Object.values(layers)) if (!l.v.paused) l.v.pause(); }

  // the phase follows the page: at the desk until the copy has arrived under him, walking, then seated on its heading
  function step(dt, p) {
    if (p.small) phase = 'seat';
    else if (phase === 'desk' && p.arrived) {
      if (live) { phase = 'walk'; walkDir = 1; walk.v.currentTime = 0; } else phase = 'seat';
    } else if (phase === 'walk') {
      walkDir = p.arrived ? 1 : -1;
      const end = (walk.v.duration || 8) - 0.05;
      if (walkDir > 0 && (walk.v.ended || walk.v.currentTime >= end)) { phase = 'seat'; sit.v.currentTime = 0; }
      else if (walkDir < 0 && walk.v.currentTime <= 0.03) { phase = 'desk'; mode = 'work'; work.v.currentTime = 0; }
    } else if (phase === 'seat' && !p.arrived) {
      if (live) { phase = 'walk'; walkDir = -1; walk.v.currentTime = Math.max(0, (walk.v.duration || 8) - 0.05); }
      else { phase = 'desk'; mode = 'work'; }
    }

    // at the desk he turns his head toward the thing that has attention: the pointer scrubs his head turn
    if (phase === 'desk') {
      const want = live && hover && p.focus;
      if (want && mode === 'work') { mode = 'look'; lookT = 0; look.v.currentTime = 0; }
      let target = 0;
      if (want) {
        const head = p.scene.x + SCENE.cx * p.scene.s;
        const f = Math.max(-1, Math.min(1, (p.focus.x - head) / (innerWidth * 0.3)));
        target = (LOOK[0] + LOOK[1]) / 2 + f * (LOOK[1] - LOOK[0]) / 2;
      }
      lookT += (target - lookT) * (1 - Math.exp(-dt * 5));
      if (mode === 'look') {
        seek(look.v, lookT);
        if (!want && lookT < 0.04) { mode = 'work'; work.v.currentTime = 0; }
      }
    }

    for (const l of Object.values(layers)) l.want = 0;
    if (phase === 'desk') layers[mode].want = 1;
    else if (phase === 'walk') walk.want = 1;
    else sit.want = 1;
    desk.want = phase !== 'desk' && !p.small ? 1 : 0;

    const k = live ? 1 - Math.exp(-dt / FADE) : 1;
    for (const l of Object.values(layers)) l.a += (l.want - l.a) * k;
    desk.a = desk.want;   // the desk never fades: it is there, the same place, under whichever clip shows it

    // only what is seen plays; the rest waits
    if (!live) { stopAll(); return; }
    work.want && work.a > 0.01 ? play(work.v) : work.v.paused || work.v.pause();
    sit.want && sit.a > 0.01 ? play(sit.v) : sit.v.paused || sit.v.pause();
    if (!look.v.paused) look.v.pause();
    if (phase === 'walk') {
      if (walkDir > 0) play(walk.v);
      else { if (!walk.v.paused) walk.v.pause(); seek(walk.v, Math.max(0, walk.v.currentTime - dt * 1.6)); }
    } else if (!walk.v.paused) walk.v.pause();
  }

  function draw(l, p, dpr, melt) {
    if (l.a < 0.004) return;
    if (l.v) {
      if (l.v.readyState < 2) return;
      gl.bindTexture(gl.TEXTURE_2D, l.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l.v);
    } else gl.bindTexture(gl.TEXTURE_2D, l.tex);
    const s = p.scene.s * dpr, ox = p.scene.x * dpr, oy = p.scene.y * dpr, [x, y, w, h] = l.rect;
    const fig = (SCENE.seated[3] - SCENE.seated[1]);
    gl.uniform4f(u.uQuad, ox + x * s, oy + y * s, w * s, (h + (melt > 0 ? fig * 1.4 : 0)) * s);
    gl.uniform4f(u.uRect, x, y, w, h);
    gl.uniform2f(u.uOrigin, ox, oy); gl.uniform1f(u.uScale, s);
    gl.uniform1f(u.uAlpha, l.a * p.weight); gl.uniform1f(u.uKey, l.key);
    gl.uniform1f(u.uBlock, SCENE.block * s >= 2 ? SCENE.block : 0);
    gl.uniform1f(u.uMelt, melt); gl.uniform1f(u.uFig, fig);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const boxOf = (b, p) => ({ left: p.scene.x + b[0] * p.scene.s, top: p.scene.y + b[1] * p.scene.s, width: (b[2] - b[0]) * p.scene.s, height: (b[3] - b[1]) * p.scene.s });

  return {
    // p: { weight (0..1, how far he has arrived), scene ({x, y, s}: where the scene's corner stands, in CSS px, and CSS px
    // per unit), arrived (the copy is held under him), leave (0..1 as he melts), focus (the thing with attention, or null),
    // small (a phone) }. Returns the box he fills on the page, or null while he is away
    update(p) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const away = p.weight < 0.01 || p.leave >= 0.999;
      if (away) {
        if (shown) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); shown = false; stopAll(); }
        return null;
      }
      shown = true;
      step(dt, p);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, w, h);
      const melt = p.leave > 0 ? Math.min(1, p.leave / 0.7) ** 1.2 : 0;
      draw(desk, p, dpr, melt);
      for (const name of ['work', 'look', 'walk', 'sit']) draw(layers[name], p, dpr, melt);
      const seated = phase === 'seat' || (phase === 'walk' && walk.v.currentTime > 5.8);
      return boxOf(seated ? SCENE.seated : SCENE.desk, p);
    },
    setMotion(on) { live = on && !reduced; if (!live) stopAll(); },
    state() { return { phase, mode, walk: walk.v.currentTime, look: lookT, ready: Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, l.v.readyState])) }; },   // read by shots/
  };
}

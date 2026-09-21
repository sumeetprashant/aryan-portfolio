// Aryan in the summary: his own pixel-art clips, made on Sumeet's machine against a green screen, cut out here
// and drawn straight onto the page. He works at a desk in the upper middle while the visitor meets the things
// (and turns his head toward the one that has attention), walks down when the copy arrives, sits on the letters
// of the Kiwi heading and keeps working while the desk he left breaks into particles; as the copy goes on up he
// rides up with it and breaks into particles himself. All four clips share one scene of 1920 x 1080 units.
export const SCENE = {
  cx: 960,                          // his centre line
  seat: 863,                        // the line he sits on (fitted to the tops of the letters)
  top: 46,                          // his hair when he stands up from the desk
  desk: [708, 163, 1199, 512],      // the desk, with him at it
  seated: [836, 633, 1051, 1000],   // him, seated
  legs: [851, 942],                 // where his lower legs hang, seated, at rest (by the heading)
  swing: [800, 960],                // where his feet reach as they swing (below the heading)
  deskImg: [550, 80, 806, 457],     // assets/clips/desk.png, the desk alone (x, y, w, h)
  block: 3,                         // the size of his pixels, in units
};
// the clips were rendered at 0.7 of a 1920 x 1080 frame, with 6 px of green above and below; each fills a window of
// the scene (x, y, w, h), and walk.mp4 is cropped to where he moves (x, y, w, h in clip pixels). box: the part of the
// scene he fills in that clip, which is what breaks into particles
const CLIPS = {
  work: { src: 'assets/clips/work.mp4', win: [513, 90, 880, 495], crop: [0, 0, 1344, 768], loop: true, box: [696, 150, 1212, 522] },
  look: { src: 'assets/clips/look.mp4', win: [513, 90, 880, 495], crop: [0, 0, 1344, 768], box: [696, 150, 1212, 522] },
  walk: { src: 'assets/clips/walk.mp4', win: [0, 0, 1920, 1080], crop: [432, 24, 592, 704], box: [617, 26, 1463, 1032] },
  sit: { src: 'assets/clips/sit.mp4', win: [504, 569, 880, 495], crop: [0, 0, 1344, 768], loop: true, box: [790, 620, 1070, 1012] },
};
const LOOK = [1.1, 3.1];            // look.mp4: looking to screen-left, then to screen-right
const FADE = 0.12;                  // cross-fades between clips, seconds

// the green screen: a pixel is keyed by how much greener than red and blue it is (the shade drifts from clip to clip).
// The video's compression leaves a dark green rim around him, so next to the green the test is stricter, and every
// pixel that is left gives up any green it has over its red and blue
const KEY = `
float greener(vec3 c){ return c.g - max(c.r, c.b); }
vec4 keyed(sampler2D tex, vec2 t, float isClip){
  ivec2 n = textureSize(tex, 0), p = clamp(ivec2(t * vec2(n)), ivec2(0), n - 1);
  vec4 c = texelFetch(tex, p, 0);
  if (isClip < .5){ c.g = min(c.g, max(c.r, c.b) + .02); return vec4(c.rgb, step(.5, c.a)); }
  float g = greener(c.rgb), a = 1. - smoothstep(.035, .09, g);
  float edge = 0.;
  for (int i = 0; i < 4; i++){
    ivec2 o = ivec2(i == 0 ? 2 : i == 1 ? -2 : 0, i == 2 ? 2 : i == 3 ? -2 : 0);
    edge = max(edge, step(.09, greener(texelFetch(tex, clamp(p + o, ivec2(0), n - 1), 0).rgb)));
  }
  a = min(a, mix(1., 1. - smoothstep(-.01, .03, g), edge));
  c.g = min(c.g, max(c.r, c.b));
  return vec4(c.rgb, a);
}`;

const QUAD_VS = `#version 300 es
uniform vec4 uQuad;
uniform vec2 uRes;
out vec2 vPx;
void main(){
  vec2 c = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
  vPx = uQuad.xy + c * uQuad.zw;
  gl_Position = vec4(vPx.x / uRes.x * 2. - 1., 1. - vPx.y / uRes.y * 2., 0., 1.);
}`;

const QUAD_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uOrigin;
uniform float uScale, uAlpha, uClip, uBlock;
uniform vec4 uRect;
in vec2 vPx;
out vec4 o;
${KEY}
void main(){
  vec2 u = (vPx - uOrigin) / uScale;
  // back onto his own pixel grid, so any smear from the video model reads as square pixels again
  if (uBlock > 0.) u = (floor(u / uBlock) + .5) * uBlock;
  vec2 t = (u - uRect.xy) / uRect.zw;
  if (t.x < 0. || t.y < 0. || t.x > 1. || t.y > 1.) discard;
  vec4 c = keyed(uTex, t, uClip);
  float a = c.a * uAlpha;
  if (a < .004) discard;
  o = vec4(c.rgb * a, a);
}`;

// the particles: one square per pixel of him (or of the desk), each taking its colour from the clip at that place,
// each leaving on its own delay, out and mostly up, growing a little and fading into the room's own dust
const DOTS_VS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uOrigin;
uniform float uScale, uAlpha, uClip, uBlock, uProg, uCols, uRows;
uniform vec4 uRect, uBox;
out vec4 vC;
${KEY}
float h(float n){ return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
void main(){
  float id = float(gl_InstanceID), col = mod(id, uCols), row = floor(id / uCols);
  vec2 u = uBox.xy + (vec2(col, row) + .5) * uBlock;
  vec2 t = (u - uRect.xy) / uRect.zw;
  vec4 c = (t.x < 0. || t.y < 0. || t.x > 1. || t.y > 1.) ? vec4(0.) : keyed(uTex, t, uClip);
  float r1 = h(id), r2 = h(id + 17.3), r3 = h(id + 41.7);
  float delay = .3 * r1 + .15 * (row / uRows);          // his top goes a moment before his feet
  float e = clamp((uProg - delay) / .5, 0., 1.);
  e = e * e * (3. - 2. * e);
  float ang = r2 * 6.2832;
  vec2 off = vec2(cos(ang), sin(ang) * .6 - .55) * (30. + 300. * r3 * r3) * e;
  float size = uBlock * (1. + .7 * e * r3);
  float a = c.a * uAlpha * (1. - smoothstep(.45, 1., e));
  vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1) - .5;
  vec2 px = uOrigin + (u + off + corner * size) * uScale;
  if (a < .01) px = vec2(-1e5);
  vC = vec4(c.rgb * a, a);
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);
}`;

const DOTS_FS = `#version 300 es
precision highp float;
in vec4 vC;
out vec4 o;
void main(){ o = vC; }`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

function texture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function createAryan(canvas, reduced) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const quad = program(gl, QUAD_VS, QUAD_FS), dots = program(gl, DOTS_VS, DOTS_FS);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // a phone only ever shows him seated, so it only fetches that clip
  const phone = matchMedia('(max-width: 820px)').matches, layers = {};
  for (const [name, c] of Object.entries(CLIPS)) layers[name] = { ...c, v: video(c.src, c.loop, phone && name !== 'sit' ? 'none' : 'auto'), tex: texture(gl), rect: rectOf(c), a: 0, want: 0, clip: 1 };
  const img = new Image();
  img.src = 'assets/clips/desk.png';
  await img.decode();
  const [dx, dy, dw, dh] = SCENE.deskImg;
  const desk = { tex: texture(gl), rect: SCENE.deskImg, box: [dx, dy, dx + dw, dy + dh], a: 0, want: 0, clip: 0 };
  gl.bindTexture(gl.TEXTURE_2D, desk.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  const hover = matchMedia('(hover: hover)').matches;
  let live = !reduced, phase = 'desk', mode = 'work', walkDir = 1, lookT = 0, gone = 0, open = 0, last = performance.now(), shown = false;
  const { work, look, walk, sit } = layers;
  const walkEnd = () => (walk.v.duration || 8) - 0.05;

  function stopAll() { for (const l of Object.values(layers)) if (!l.v.paused) l.v.pause(); }

  // the phase follows the page: at the desk until the copy has arrived under him, walking, then seated on its heading.
  // gone: how far the desk he left has broken up (it gathers again before he walks back to it)
  function step(dt, p) {
    if (p.small) phase = 'seat';
    else if (phase === 'desk' && p.arrived) {
      if (live) { phase = 'walk'; walkDir = 1; walk.v.currentTime = 0; } else phase = 'seat';
    } else if (phase === 'walk') {
      walkDir = p.arrived ? 1 : -1;
      if (walkDir > 0 && (walk.v.ended || walk.v.currentTime >= walkEnd())) { phase = 'seat'; sit.v.currentTime = 0; gone = -0.25; }
      else if (walkDir < 0 && walk.v.currentTime <= 0.03) { phase = 'desk'; mode = 'work'; work.v.currentTime = 0; }
    } else if (phase === 'seat' && !p.arrived) {
      if (!live) { phase = 'desk'; mode = 'work'; gone = 0; }
      else if (gone <= 0) { phase = 'walk'; walkDir = -1; walk.v.currentTime = walkEnd(); }
    }
    if (phase === 'seat' && !p.small) gone = live ? (p.arrived ? Math.min(1, gone + dt / 1.6) : Math.max(0, gone - dt / 0.7)) : 1;
    else if (phase !== 'seat') gone = 0;

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
    const k = live ? 1 - Math.exp(-dt / FADE) : 1;
    for (const l of Object.values(layers)) l.a += (l.want - l.a) * k;
    // the desk image stands exactly where the walk's own desk is, under it, so it never fades: it is there or it is not
    desk.a = phase !== 'desk' && !p.small ? 1 : 0;

    // the heading opens for his legs as he comes to sit, and closes again as he leaves
    const seated = phase === 'seat' ? 1 : phase === 'walk' ? smooth(5.2, 6.6, walk.v.currentTime) : 0;
    const want = seated * (1 - smooth(0.3, 0.75, p.leave));
    open += (want - open) * (live ? 1 - Math.exp(-dt / 0.25) : 1);

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

  function upload(l) {
    if (!l.v) { gl.bindTexture(gl.TEXTURE_2D, l.tex); return true; }
    if (l.v.readyState < 2) return false;
    gl.bindTexture(gl.TEXTURE_2D, l.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l.v);
    return true;
  }

  function draw(l, p, dpr, prog, W, H) {
    if (l.a < 0.004 || prog >= 1 || !upload(l)) return;
    const s = p.scene.s * dpr, ox = p.scene.x * dpr, oy = p.scene.y * dpr, [x, y, w, h] = l.rect;
    if (prog <= 0.001) {
      gl.useProgram(quad.p); const u = quad.u;
      gl.uniform2f(u.uRes, W, H);
      gl.uniform4f(u.uQuad, ox + x * s, oy + y * s, w * s, h * s);
      gl.uniform4f(u.uRect, x, y, w, h);
      gl.uniform2f(u.uOrigin, ox, oy); gl.uniform1f(u.uScale, s);
      gl.uniform1f(u.uAlpha, l.a * p.weight); gl.uniform1f(u.uClip, l.clip);
      gl.uniform1f(u.uBlock, SCENE.block * s >= 2 ? SCENE.block : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    gl.useProgram(dots.p); const u = dots.u, B = SCENE.block, [bx0, by0, bx1, by1] = l.box;
    const cols = Math.ceil((bx1 - bx0) / B), rows = Math.ceil((by1 - by0) / B);
    gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uOrigin, ox, oy); gl.uniform1f(u.uScale, s);
    gl.uniform4f(u.uRect, x, y, w, h); gl.uniform4f(u.uBox, bx0, by0, bx1, by1);
    gl.uniform1f(u.uCols, cols); gl.uniform1f(u.uRows, rows); gl.uniform1f(u.uBlock, B);
    gl.uniform1f(u.uAlpha, l.a * p.weight); gl.uniform1f(u.uClip, l.clip); gl.uniform1f(u.uProg, prog);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);
  }

  const boxOf = (b, p) => ({ left: p.scene.x + b[0] * p.scene.s, top: p.scene.y + b[1] * p.scene.s, width: (b[2] - b[0]) * p.scene.s, height: (b[3] - b[1]) * p.scene.s });

  return {
    // p: { weight (0..1, how far he has arrived), scene ({x, y, s}: where the scene's corner stands, in CSS px, and CSS px
    // per unit), arrived (the copy is held under him), leave (0..1 as he breaks up and goes), focus (the thing with
    // attention, or null), small (a phone) }. Returns the box he fills on the page and how far the heading is open for
    // his legs (open, 0..1), or null while he is away
    update(p) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const away = p.weight < 0.01 || p.leave >= 0.999;
      if (away) {
        if (shown) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); shown = false; stopAll(); open = 0; }
        return null;
      }
      shown = true;
      step(dt, p);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const leave = smooth(0, 1, p.leave);
      draw(desk, p, dpr, Math.max(smooth(0, 1, gone), leave), W, H);
      for (const name of ['work', 'look', 'walk', 'sit']) draw(layers[name], p, dpr, leave, W, H);
      const seated = phase === 'seat' || (phase === 'walk' && walk.v.currentTime > 5.8);
      return { ...boxOf(seated ? SCENE.seated : SCENE.desk, p), open };
    },
    setMotion(on) { live = on && !reduced; if (!live) stopAll(); },
    state() { return { phase, mode, walk: walk.v.currentTime, look: lookT, gone, open, ready: Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, l.v.readyState])) }; },   // read by shots/
  };
}

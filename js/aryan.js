// Aryan in the summary: his own pixel-art clips, made on Sumeet's machine against a green screen, cut out here
// and drawn straight onto the page. The room's points gather into him, floating cross-legged in the upper middle,
// working on his laptop while the visitor meets the things (he turns his head toward the one that has attention).
// When the copy arrives he uncrosses his legs, gets to his feet, walks down, sits on the letters of the Kiwi heading
// and keeps working (rise.mp4 starts on the very picture he floats in); as the copy goes on up he rides up with it
// and breaks into points. One scene of 1920 x 1080 units.
export const SCENE = {
  cx: 960,                          // his centre line
  seat: 863,                        // the line he sits on (fitted to the tops of the letters)
  top: 46,                          // his hair at its highest, as he walks down
  float: [708, 163, 1199, 512],     // the room he floats in, in the upper middle: the things are placed around it
  floating: [830, 182, 1076, 515],  // him, floating cross-legged
  seated: [836, 633, 1051, 1000],   // him, seated
  legs: [851, 942],                 // where his lower legs hang, seated, at rest (by the heading)
  swing: [800, 960],                // where his feet reach as they swing (below the heading)
  block: 3,                         // the size of his pixels, in units
};
// walk and sit were rendered at 0.7 of a 1920 x 1080 frame, with 6 px of green above and below; each fills a window of
// the scene (x, y, w, h), and walk.mp4 is cropped to where he moves (x, y, w, h in clip pixels). The float clips are
// 1344 x 768 with him larger in the frame: rect puts them in the scene at the size of the man who walks (his head, 151 px
// across there, is 55 px in the walk), centred on his line, where the desk used to stand. box: the part of the scene he
// fills in that clip, which is what gathers from points and breaks into them
const CLIPS = {
  work: { src: 'assets/clips/float-work.mp4', rect: [601, 156, 699, 399.5], loop: true, box: [828, 180, 1077, 516], floats: true },
  look: { src: 'assets/clips/float-look.mp4', rect: [601, 156, 699, 399.5], box: [828, 180, 1077, 516], floats: true },
  walk: { src: 'assets/clips/rise.mp4', win: [0, 0, 1920, 1080], crop: [524, 58, 430, 668], box: [748, 74, 1363, 1029] },
  sit: { src: 'assets/clips/sit.mp4', win: [504, 569, 880, 495], crop: [0, 0, 1344, 768], loop: true, box: [790, 620, 1070, 1012] },
};
const LOOK = [1.25, 2.0, 3.5];      // float-look.mp4: looking to screen-left, straight out, to screen-right
const FADE = 0.12;                  // cross-fades between clips, seconds
const T0 = 0;                       // rise.mp4 starts floating, exactly as the float clips do
const SWAP = 0.12;                  // the float clip hands over to rise.mp4 on the same picture

// the green screen: a pixel is keyed by how much greener than red and blue it is. The video's compression smears the
// green a few pixels into him (a dark green or olive rim), so within three pixels of the green the test is absolute:
// nothing with any green cast stays, and what stays may not be greener than the mean of its red and blue.
// The desk in the walk clip never moves, so a pixel that still shows the desk (uRef) is cut; where he crosses in front of
// it the pixel is his and stays. Lone pixels left by the video's flicker inside the desk go too
const KEY = `
uniform sampler2D uRef;
uniform float uMask, uPlain;
float greener(vec3 c){ return c.g - max(c.r, c.b); }
const ivec2 RING[12] = ivec2[12](ivec2(3,0), ivec2(-3,0), ivec2(0,3), ivec2(0,-3), ivec2(2,2), ivec2(-2,2), ivec2(2,-2), ivec2(-2,-2),
  ivec2(1,0), ivec2(-1,0), ivec2(0,1), ivec2(0,-1));
float his(sampler2D tex, ivec2 p){
  vec3 c = texelFetch(tex, p, 0).rgb; vec4 r = texelFetch(uRef, p, 0);
  vec3 d = abs(c - r.rgb);
  return step(greener(c), .035) * (1. - step(.5, r.a) * step(max(d.r, max(d.g, d.b)), .18));
}
vec4 keyed(sampler2D tex, vec2 t){
  ivec2 n = textureSize(tex, 0), p = clamp(ivec2(t * vec2(n)), ivec2(0), n - 1);
  vec4 c = texelFetch(tex, p, 0);
  if (uPlain > .5) return vec4(c.rgb, step(.12, c.a));   // a thing's own canvas: nothing to key
  float g = greener(c.rgb), edge = 0.;
  for (int i = 0; i < 12; i++) edge = max(edge, step(.09, greener(texelFetch(tex, clamp(p + RING[i], ivec2(0), n - 1), 0).rgb)));
  float a = edge > .5 ? step(g, -.004) : step(g, .03);
  if (uMask > .5 && texelFetch(uRef, p, 0).a > .5){
    float mine = 0.;
    for (int i = 0; i < 4; i++) mine += his(tex, clamp(p + RING[i], ivec2(0), n - 1));
    a *= his(tex, p) * step(2.5, mine);
  }
  c.g = min(c.g, edge > .5 ? (c.r + c.b) * .5 : max(c.r, c.b));
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
uniform float uScale, uAlpha, uBlock;
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
  vec4 c = keyed(uTex, t);
  float a = c.a * uAlpha;
  if (a < .004) discard;
  o = vec4(c.rgb * a, a);
}`;

// the particles: one square per pixel of him, each taking its colour from the clip's live frame at that place, each
// leaving on its own delay, out and mostly up, growing a little and fading into the room's own dust. Run backwards
// (uProg from 1 to 0) the same points gather into him
const DOTS_VS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uOrigin;
uniform float uScale, uAlpha, uBlock, uProg, uCols, uRows;
uniform vec4 uRect, uBox;
out vec4 vC;
${KEY}
float h(float n){ return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
void main(){
  float id = float(gl_InstanceID), col = mod(id, uCols), row = floor(id / uCols);
  vec2 u = uBox.xy + (vec2(col, row) + .5) * uBlock;
  vec2 t = (u - uRect.xy) / uRect.zw;
  vec4 c = (t.x < 0. || t.y < 0. || t.x > 1. || t.y > 1.) ? vec4(0.) : keyed(uTex, t);
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
  if (c.rect) return c.rect;
  const [wx, wy, ww, wh] = c.win, [cx, cy, cw, ch] = c.crop, kx = ww / 1920 / 0.7, ky = wh / 1080 / 0.7;
  return [wx + cx * kx, wy + (cy - 6) * ky, cw * kx, ch * ky];
}

function video(src, loop) {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = !!loop; v.preload = 'none';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.src = src;
  // seeks are queued, never stacked: while one is under way the latest wish waits for it (temp03's scrub)
  v.want = null;
  v.addEventListener('seeked', () => { if (v.want !== null) { const t = v.want; v.want = null; if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t; } });
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

  // a phone only ever shows him seated, so it only fetches that clip; nothing is fetched until the summary comes near (wake)
  const phone = matchMedia('(max-width: 820px)').matches, layers = {};
  for (const [name, c] of Object.entries(CLIPS)) if (!phone || name === 'sit') layers[name] = { ...c, v: video(c.src, c.loop), tex: texture(gl), rect: rectOf(c), a: 0, want: 0, prog: 1 };
  const all = Object.values(layers), { work, look, walk, sit } = layers;
  const ref = texture(gl);   // the mask slot, unused now (uMask stays 0)
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ref); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); gl.activeTexture(gl.TEXTURE0);
  for (const pr of [quad, dots]) { gl.useProgram(pr.p); gl.uniform1i(pr.u.uTex, 0); gl.uniform1i(pr.u.uRef, 1); }

  const hover = matchMedia('(hover: hover)').matches;
  let live = !reduced, awake = false, phase = phone ? 'seat' : 'float', mode = 'work', walkDir = 1, lookT = 0, swap = 0, open = 0, last = performance.now(), shown = false;
  const walkEnd = () => (walk.v.duration || 8) - 0.05;

  const thingTex = new Map();
  function stopAll() { for (const l of all) if (!l.v.paused) l.v.pause(); }

  // the phase follows the page: floating until the copy has arrived under him; then his points go over to him standing (swap, 0..1),
  // he walks, and sits on its heading. Scrolling back runs all of it backwards
  function step(dt, p) {
    if (p.small || phone) phase = 'seat';
    else if (phase === 'float' && p.arrived) {
      if (live) { phase = 'walk'; walkDir = 1; walk.v.currentTime = T0; } else { phase = 'seat'; swap = 1; }
    } else if (phase === 'walk') {
      walkDir = p.arrived ? 1 : -1;
      if (walkDir > 0) {
        swap = Math.min(1, swap + dt / SWAP);
        // his walk keeps pace with the scroll: the further the visitor is through the hold, the further along he must be (he hurries
        // to catch up), and if the copy moves on before he is down he is simply seated: nothing of him is ever left behind up there
        const due = walkEnd() * smooth(0.05, 0.8, p.hold);
        walk.v.playbackRate = walk.v.currentTime < due - 0.3 ? 3 : 1;
        if (p.leave > 0.01 || p.hold >= 0.98) walk.v.currentTime = walkEnd();
        if (walk.v.ended || walk.v.currentTime >= walkEnd()) { phase = 'seat'; sit.v.currentTime = 0; }
      } else if (walk.v.currentTime <= T0 + 0.04) {
        swap = Math.max(0, swap - dt / SWAP);
        if (swap <= 0) { phase = 'float'; mode = 'work'; work.v.currentTime = 0; }
      }
    } else if (phase === 'seat' && !p.arrived) {
      if (!live) { phase = 'float'; mode = 'work'; swap = 0; }
      else { phase = 'walk'; walkDir = -1; walk.v.currentTime = walkEnd(); }
    }

    // floating, he turns his head toward the thing that has attention: its place across the window scrubs his head turn
    if (phase === 'float') {
      const want = live && hover && p.focus && p.here;
      if (want && mode === 'work') { mode = 'look'; lookT = 0; look.v.currentTime = 0; }
      let target = 0;
      if (want) {
        const head = p.scene.x + SCENE.cx * p.scene.s;
        const f = Math.max(-1, Math.min(1, (p.focus.x - head) / (innerWidth * 0.3)));
        target = LOOK[1] + (f < 0 ? (LOOK[1] - LOOK[0]) * f : (LOOK[2] - LOOK[1]) * f);
      }
      lookT += (target - lookT) * (1 - Math.exp(-dt * 5));
      if (mode === 'look') {
        seek(look.v, lookT);
        if (!want && lookT < 0.04) { mode = 'work'; work.v.currentTime = 0; }
      }
    }

    for (const l of all) l.want = 0;
    // the seated clip takes over only once it has a frame to show; until then the last frame of the walk stays, so he never drops out
    if (phase === 'seat') { if (!sit.has && walk && walk.has) { upload(sit); walk.want = 1; } else sit.want = 1; }
    else {
      if (phase === 'walk') walk.want = 1;
      else layers[mode].want = 1;
    }
    // a clip that comes in is there at once and the one it replaces fades off it: two half-faded copies of him would let the room
    // show through for a moment, which read as him starting to break up
    const k = live ? 1 - Math.exp(-dt / FADE) : 1;
    for (const l of all) l.a = l.want ? (l.has || l.v.readyState >= 2 ? 1 : l.a) : l.a + (0 - l.a) * k;

    // the heading opens for his legs as he comes to sit, and closes again as he leaves
    const seated = phase === 'seat' ? 1 : phase === 'walk' ? smooth(5.2, 6.6, walk.v.currentTime) : 0;
    const wantOpen = seated * (1 - smooth(0.3, 0.75, p.leave));
    open += (wantOpen - open) * (live ? 1 - Math.exp(-dt / 0.25) : 1);

    // only what is seen plays; the rest waits
    if (!live) { stopAll(); return; }
    for (const l of [work, sit]) if (l) l.want && l.a > 0.01 ? play(l.v) : l.v.paused || l.v.pause();
    if (look && !look.v.paused) look.v.pause();
    if (!walk) return;
    if (phase === 'walk' && walkDir > 0 && swap > 0.55) play(walk.v);
    else {
      if (!walk.v.paused) walk.v.pause();
      if (phase === 'walk' && walkDir < 0) seek(walk.v, Math.max(T0, walk.v.currentTime - dt * 1.6));
    }
  }

  // a video is briefly without a frame at its loop's seam or during a seek: he keeps his last frame then, so he never blinks
  function upload(l) {
    gl.bindTexture(gl.TEXTURE_2D, l.tex);
    if (l.v.readyState < 2 || l.v.seeking) return !!l.has;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l.v);
    return (l.has = true);
  }

  function draw(l, p, dpr, W, H, bob) {
    const prog = l.prog;
    if (l.a < 0.004 || prog >= 1 || !upload(l)) return;
    const s = p.scene.s * dpr, ox = p.scene.x * dpr, oy = (p.scene.y + (l.floats ? bob : 0)) * dpr, [x, y, w, h] = l.rect;
    if (prog <= 0.001) {
      gl.useProgram(quad.p); const u = quad.u;
      gl.uniform2f(u.uRes, W, H);
      gl.uniform4f(u.uQuad, ox + x * s, oy + y * s, w * s, h * s);
      gl.uniform4f(u.uRect, x, y, w, h);
      gl.uniform2f(u.uOrigin, ox, oy); gl.uniform1f(u.uScale, s);
      gl.uniform1f(u.uAlpha, l.a); gl.uniform1f(u.uMask, l.mask ? 1 : 0); gl.uniform1f(u.uPlain, 0);
      gl.uniform1f(u.uBlock, SCENE.block * s >= 2 ? SCENE.block : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    gl.useProgram(dots.p); const u = dots.u, B = SCENE.block, [bx0, by0, bx1, by1] = l.box;
    const cols = Math.ceil((bx1 - bx0) / B), rows = Math.ceil((by1 - by0) / B);
    gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uOrigin, ox, oy); gl.uniform1f(u.uScale, s);
    gl.uniform4f(u.uRect, x, y, w, h); gl.uniform4f(u.uBox, bx0, by0, bx1, by1);
    gl.uniform1f(u.uCols, cols); gl.uniform1f(u.uRows, rows); gl.uniform1f(u.uBlock, B);
    gl.uniform1f(u.uAlpha, l.a); gl.uniform1f(u.uMask, l.mask ? 1 : 0); gl.uniform1f(u.uPlain, 0); gl.uniform1f(u.uProg, prog);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);
  }

  const boxOf = (b, p) => ({ left: p.scene.x + b[0] * p.scene.s, top: p.scene.y + b[1] * p.scene.s, width: (b[2] - b[0]) * p.scene.s, height: (b[3] - b[1]) * p.scene.s });

  return {
    // the summary is coming: fetch his clips now
    wake() { if (awake) return; awake = true; for (const l of all) { l.v.preload = 'auto'; l.v.load(); } },
    // p: { hold (0..1: how far the visitor has scrolled through the copy's hold), weight (0..1: the room's points gathering into him), scene ({x, y, s}: where the scene's corner stands, in CSS px, and
    // CSS px per unit), arrived (the copy is held under him), leave (0..1 as he breaks into points and goes), focus (the thing
    // with attention, or null), small (a phone) }. Returns the box he fills on the page and how far the heading is open for
    // his legs (open, 0..1), or null while he is away
    update(p) {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      // he is never faded or cut in: he gathers from points and leaves as points. With motion off he is there, or he is not
      const gone = live ? Math.max(1 - smooth(0.04, 0.96, p.weight), smooth(0.06, 1, p.leave)) : p.weight < 0.5 || p.leave > 0.5 ? 1 : 0;
      if (gone >= 0.999 || !awake) {
        if (shown) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); shown = false; stopAll(); open = 0; }
        return null;
      }
      shown = true;
      step(dt, { ...p, here: gone < 0.02 });
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      for (const l of all) l.prog = gone;   // points only ever mean arriving or leaving; between clips he simply cross-fades on the same picture
      // floating, he bobs a little (the page's doing, not the clip's); not once he stands, and not with motion off
      const bob = live ? Math.sin(now / 4000 * 6.2832) * 5 : 0;
      for (const l of all) draw(l, p, dpr, W, H, bob);
      // the things around him break into points with him (p.things: their canvases and where they stand, in CSS px)
      if (live && gone > 0.001 && p.leave > 0) for (const t of p.things || []) {
        let tex = thingTex.get(t.canvas);
        if (!tex) thingTex.set(t.canvas, tex = texture(gl));
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (!tex.done || gone < 0.05) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.canvas); tex.done = true; } catch { continue; } }
        gl.useProgram(dots.p); const u = dots.u, B = 2, cols = Math.ceil(t.w / B), rows = Math.ceil(t.h / B);
        gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uOrigin, 0, 0); gl.uniform1f(u.uScale, dpr);
        gl.uniform4f(u.uRect, t.x, t.y, t.w, t.h); gl.uniform4f(u.uBox, t.x, t.y, t.x + t.w, t.y + t.h);
        gl.uniform1f(u.uCols, cols); gl.uniform1f(u.uRows, rows); gl.uniform1f(u.uBlock, B);
        gl.uniform1f(u.uAlpha, 1); gl.uniform1f(u.uMask, 0); gl.uniform1f(u.uPlain, 1); gl.uniform1f(u.uProg, gone);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);
      }
      const seated = phase === 'seat' || (phase === 'walk' && walk.v.currentTime > 5.8);
      const walked = phase === 'seat' ? 1 : phase === 'walk' ? smooth(1.5, walkEnd(), walk.v.currentTime) : 0;
      return { ...boxOf(seated ? SCENE.seated : SCENE.floating, p), open, walked };
    },
    setMotion(on) { live = on && !reduced; if (!live) stopAll(); },
    state() { return { phase, mode, swap, walk: walk ? walk.v.currentTime : 0, look: lookT, open, awake, ready: Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, l.v.readyState])) }; },   // read by shots/
  };
}

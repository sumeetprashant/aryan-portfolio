// The portrait stage. One fixed WebGL2 canvas redraws Aryan in a different
// material per chapter. Every source image is registered to the same frame
// (see scripts/prep_stage.py), so states can dissolve into each other in place.

export const STATE = { melt: 0, clay: 1, ascii: 2, signal: 3, blocks: 4, felt: 5, real: 6 };

const GLYPHS = ' .,:;~-=+*xo#%@';
const FRAME_ASPECT = 1024 / 1536;

const QUAD_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const QUAD_FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uPtr, uCenter;
uniform float uTime, uScale, uA, uB, uMix, uMelt, uBuild, uFine, uGlyphN;
uniform sampler2D uReal, uClay, uFelt, uGlyph;
out vec4 o;

const vec3 LUMA = vec3(.299, .587, .114);
const vec3 PEACH = vec3(.95, .68, .47);
const vec3 CREAM = vec3(.96, .91, .83);
const vec2 GRID = vec2(112., 168.);
const float BUST_END = .612;

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 tex(sampler2D t, vec2 uv, float fade){
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > BUST_END) return vec4(0.);
  float x = clamp(uv.x, .002, .998) * .5;
  vec4 c = vec4(texture(t, vec2(x, uv.y)).rgb, texture(t, vec2(x + .5, uv.y)).r);
  c.a *= 1. - smoothstep(.535, BUST_END, uv.y) * fade;
  return c;
}

float ptrDist(vec2 uv){ return length((uv - uPtr) * vec2(1., 1.5)); }

vec3 vivid(vec3 c){
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, 1.6) * vec3(1.2, 1.08, .98);
  c += smoothstep(.02, .14, c.b - c.r) * vec3(.0, .05, .30);
  return c;
}

vec4 cubes(vec2 uv, float amount){
  vec4 acc = vec4(0.);
  for (int i = 0; i < 22; i++){
    float s = float(i);
    float depth = .4 + h11(s + 2.3);
    vec2 p = vec2(.5 + (h11(s) - .5) * .86, fract(h11(s + 5.1) - uTime * .006 * depth) * .74 + .04);
    p.x += sign(p.x - .5) * .07;
    p += (uPtr - .5) * depth * .035 + vec2(0., sin(uTime * .5 + s) * .006);
    float size = (1. + floor(h11(s + 8.7) * 3.)) / GRID.x;
    vec2 d = (uv - p) * vec2(1., 1.5) / size;
    if (max(abs(d.x), abs(d.y)) < .5 && h11(s + 1.9) < amount){
      float pick = h11(s + 4.4);
      vec3 c = pick < .5 ? vec3(.17, .25, .74) : pick < .8 ? PEACH : CREAM;
      c *= 1. + .3 * step(d.y, -.3) + .18 * step(d.x, -.3) - .35 * step(.3, d.y) - .25 * step(.3, d.x);
      float fadeEdge = smoothstep(.04, .14, p.y) * (1. - smoothstep(.68, .78, p.y));
      acc = vec4(c, 1.) * fadeEdge * (.55 + .45 * depth);
    }
  }
  return acc;
}

vec4 pixelState(vec2 uv, float melt, float build, float floaters){
  vec2 g = uv * GRID, cell = floor(g), f = fract(g);
  vec2 cuv = (cell + .5) / GRID;
  float cn = h11(cell.x + 3.1);
  float n = mix(cn, h11(floor(cell.x * .5) + 9.7), step(.45, h11(cell.x * 1.7)));
  float sag = .5 + .5 * sin(cell.x * .21 + 1.3) * sin(cell.x * .083 + .4);
  float drip = melt * (.012 + .05 * sag + .34 * pow(n, 5.)) * (.88 + .12 * sin(uTime * .6 + cn * 6.28));
  // past the hero the whole figure slumps like wax: neighbouring columns move together
  float low = .5 + .5 * sin(cell.x * .11 + .7 + uTime * .05) * sin(cell.x * .047 + 2.1);
  float slump = smoothstep(.3, 1., melt) * (.04 + .13 * low);
  float L = drip + slump;
  float d = slump * smoothstep(.12, .56, cuv.y) + drip * smoothstep(.47, BUST_END, cuv.y);
  vec4 c = tex(uReal, vec2(cuv.x, cuv.y - d), 0.);
  vec3 col = vivid(c.rgb);
  col = floor(col * 9. + .5) / 9.;
  float a = step(.5, c.a);

  if (cuv.y > BUST_END){
    float t = (cuv.y - BUST_END) / max(L, 1e-4);
    col = mix(col, PEACH, smoothstep(.5, 1., t) * .9);
    if (n > .5 && melt > .05){
      float yd = BUST_END + L + fract(uTime * (.035 + .04 * cn) + cn * 7.) * .2;
      if (cell.y == floor(yd * GRID.y)){ col = PEACH; a = 1. - fract(uTime * (.035 + .04 * cn) + cn * 7.); }
    }
  }

  float local = 1.;
  if (build < 1.){
    float th = clamp((BUST_END - cuv.y) / .5, 0., 1.) * .75 + h21(cell + 7.) * .25;
    local = clamp((build * 1.2 - th) / .1, 0., 1.);
    if (local <= 0.){
      return vec4(PEACH, 1.) * a * step(length(f - .5), .17) * .3;
    }
    col = mix(vec3(1., .88, .74), col, local);
  }

  float lift = smoothstep(.10, 0., ptrDist(cuv));
  float inset = (1. - local) * .5 + lift * .13;
  if (f.x < inset || f.y < inset || f.x > 1. - inset || f.y > 1. - inset) a = 0.;
  col *= 1. + .22 * max(step(f.x, .12), step(f.y, .12)) - .30 * max(step(.88, f.x), step(.88, f.y));
  col *= (.93 + .14 * h21(cell)) * (1. + lift * .55);

  vec4 outc = vec4(col, 1.) * a;
  if (floaters < .5) return outc;
  vec4 cb = cubes(uv, build < 1. ? mix(.9, .3, build) : .9);
  return outc + cb * (1. - outc.a);
}

vec4 asciiState(vec2 uv){
  float cols = mix(44., 86., uFine);
  vec2 G = vec2(cols, cols * .9);
  vec2 g = uv * G, cell = floor(g), f = fract(g);
  vec2 cuv = (cell + .5) / G;
  vec4 c = tex(uReal, cuv, 1.);
  float l = pow(smoothstep(.04, .72, dot(c.rgb, LUMA)), .85) * c.a;
  float idx = floor(l * (uGlyphN - 1.) + .5);
  if (h21(cell + floor(uTime * 7.)) > .988) idx = floor(h21(cell + uTime) * uGlyphN);
  float cov = texture(uGlyph, vec2((idx + f.x) / uGlyphN, f.y)).r;
  vec3 col = mix(CREAM, c.rgb * 2., .28) * (.4 + .8 * l);
  float scan = (cuv.y - fract(uTime * .06) * .7) * 26.;
  col *= 1. + .9 * exp(-scan * scan);
  vec4 outc = vec4(col, 1.) * cov * step(.03, l);
  float k = smoothstep(.13, .05, ptrDist(uv));
  vec4 photo = tex(uReal, uv, 1.);
  return mix(outc, vec4(photo.rgb, 1.) * photo.a, k);
}

vec4 photoState(sampler2D t, vec2 uv, float emboss, float warm){
  vec4 c = tex(t, uv, 1.);
  float l = dot(c.rgb, LUMA);
  vec2 e = vec2(2.5 / 1024., 2.5 / 1536.);
  vec2 gr = vec2(dot(tex(t, uv + vec2(e.x, 0.), 1.).rgb - tex(t, uv - vec2(e.x, 0.), 1.).rgb, LUMA),
                 dot(tex(t, uv + vec2(0., e.y), 1.).rgb - tex(t, uv - vec2(0., e.y), 1.).rgb, LUMA)) * 4.;
  vec2 ld = normalize(vec2(uPtr.x - .5, uPtr.y - .31) + vec2(-.35, -.45));
  vec3 col = c.rgb * (1. + clamp(dot(gr, -ld) * emboss, -.3, .4));
  col = mix(col, l * vec3(1.16, .93, .66), warm);
  float spot = 1.12 - .5 * length((uv - vec2(.5 + (uPtr.x - .5) * .25, .33)) * vec2(1., 1.5));
  return vec4(col * clamp(spot, .55, 1.15), 1.) * c.a;
}

vec4 realState(vec2 uv){
  vec4 c = photoState(uReal, uv, 0., .3);
  // the part of him that has not settled yet: a few pixels on one shoulder, one slow drip
  vec2 g = uv * GRID, cell = floor(g), f = fract(g), cuv = (cell + .5) / GRID;
  float region = smoothstep(.14, .02, length((cuv - vec2(.70, .50)) * vec2(1., 1.5)));
  float flick = step(.93, h21(cell + floor(uTime * 1.3)));
  if (h21(cell) < region * .8 + flick * region){
    vec4 p = photoState(uReal, cuv, 0., .3);
    p.rgb *= 1.25 + .25 * max(step(f.x, .12), step(f.y, .12)) - .3 * max(step(.88, f.x), step(.88, f.y));
    float inset = .06 + flick * .1;
    c = (f.x < inset || f.y < inset) ? vec4(0.) : p;
  }
  if (cell.x == 76. || cell.x == 79.){
    float len = (cell.x == 76. ? .085 : .05) * (.8 + .2 * sin(uTime * .5 + cell.x));
    float t = (cuv.y - .585) / len;
    if (t > 0. && t < 1.) c = vec4(mix(vec3(.17, .2, .42), PEACH, smoothstep(.4, 1., t)), 1.) * .9;
  }
  return c;
}

vec4 stateColor(float s, vec2 uv){
  if (s < .5) return pixelState(uv, uMelt, 1., 1.);
  if (s < 1.5) return photoState(uClay, uv, .7, .06);
  if (s < 2.5) return asciiState(uv);
  if (s < 3.5) return vec4(0.);
  if (s < 4.5) return pixelState(uv, 0., uBuild, 1.);
  if (s < 5.5) return photoState(uFelt, uv, .5, .08);
  return realState(uv);
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (px - uCenter) / vec2(uScale * ${FRAME_ASPECT.toFixed(6)}, uScale) + .5;
  vec2 gq = (uv - vec2(.5, .36)) * vec2(1., 1.5);
  vec4 glow = vec4(PEACH, 1.) * .085 * exp(-dot(gq, gq) * 5.5);
  vec4 c = vec4(0.);
  if (uv.x > -.02 && uv.x < 1.02 && uv.y > -.02 && uv.y < 1.02){
    if (uMix < .002) c = stateColor(uA, uv);
    else if (uMix > .998) c = stateColor(uB, uv);
    else {
      vec4 a = stateColor(uA, uv), b = stateColor(uB, uv);
      float n = h21(floor(uv * vec2(34., 51.))) * .5 + (1. - uv.y / .72) * .5;
      float t = uMix * 1.3 - .15;
      c = mix(a, b, step(n, t));
      c.rgb += PEACH * smoothstep(.035, 0., abs(n - t)) * .55 * max(a.a, b.a);
    }
  }
  o = c + glow * (1. - c.a);
}`;

const POINT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aHome;
layout(location = 1) in vec4 aSeed;
layout(location = 2) in vec3 aCol;
uniform vec2 uRes, uPtr, uCenter;
uniform float uTime, uScale, uConv, uOpacity, uDpr;
out vec4 vCol;
void main(){
  vec2 far = aHome + (aSeed.xy - .5) * vec2(2.0, 1.3);
  far += .05 * vec2(sin(uTime * .25 + aSeed.z * 30.), cos(uTime * .2 + aSeed.w * 30.));
  float k = smoothstep(aSeed.z * .55, .45 + aSeed.z * .55, uConv);
  k = k * k * (3. - 2. * k);
  vec2 p = mix(far, aHome, k);
  p += .0035 * vec2(sin(uTime * .9 + aSeed.w * 40.), cos(uTime * .7 + aSeed.x * 40.));
  vec2 d = (p - uPtr) * vec2(1., 1.5);
  p += normalize(d + 1e-5) / vec2(1., 1.5) * .045 * exp(-dot(d, d) / .005);
  vec2 px = uCenter + (p - .5) * vec2(uScale * ${FRAME_ASPECT.toFixed(6)}, uScale);
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);
  gl_PointSize = (1.1 + aSeed.w * 1.9) * uDpr * uScale / 1100.;
  vCol = vec4(aCol, 1.) * uOpacity * (.25 + .75 * k) * (1. - smoothstep(.5, .64, aHome.y) * k);
}`;

const POINT_FS = `#version 300 es
precision highp float;
in vec4 vCol; out vec4 o;
void main(){ vec2 q = gl_PointCoord - .5; o = vCol * smoothstep(.5, .1, length(q)); }`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

function texture(gl, unit, source, linear = true) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

async function glyphAtlas() {
  try { await document.fonts.load('700 40px "Space Mono"'); } catch { /* falls back to monospace */ }
  const w = 36, h = 60, c = document.createElement('canvas');
  c.width = w * GLYPHS.length; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, h);
  x.fillStyle = '#fff'; x.font = '700 44px "Space Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [...GLYPHS].forEach((ch, i) => x.fillText(ch, i * w + w / 2, h / 2 + 2));
  return c;
}

function samplePoints(img, count) {
  const w = 256, h = 384, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  const half = img.naturalWidth / 2;
  x.drawImage(img, half, 0, half, img.naturalHeight, 0, 0, w, h);
  const matte = x.getImageData(0, 0, w, h).data;
  x.drawImage(img, 0, 0, half, img.naturalHeight, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const home = new Float32Array(count * 2), seed = new Float32Array(count * 4), col = new Float32Array(count * 3);
  let i = 0, guard = 0;
  while (i < count && guard++ < count * 60) {
    const u = Math.random(), v = Math.random() * 0.64;
    const k = ((v * h | 0) * w + (u * w | 0)) * 4;
    if (matte[k] < 128) continue;
    const r = d[k] / 255, g = d[k + 1] / 255, b = d[k + 2] / 255, l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (Math.random() > 0.12 + l * 1.3) continue;
    home.set([u, v], i * 2);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const glow = 0.35 + l * 1.25;
    col.set([(0.55 * r + 0.45) * glow, (0.55 * g + 0.34) * glow, (0.55 * b + 0.22) * glow], i * 3);
    i++;
  }
  return { home, seed, col, count: i };
}

export async function createStage(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const quad = program(gl, QUAD_VS, QUAD_FS);
  const points = program(gl, POINT_VS, POINT_FS);
  const [real, clay, felt, atlas] = await Promise.all([
    loadImage('assets/stage/real.jpg'), loadImage('assets/stage/clay.jpg'), loadImage('assets/stage/felt.jpg'), glyphAtlas(),
  ]);
  texture(gl, 0, real); texture(gl, 1, clay); texture(gl, 2, felt); texture(gl, 3, atlas);

  const small = matchMedia('(max-width: 820px)').matches;
  const cloud = samplePoints(real, small ? 26000 : 64000);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  [[cloud.home, 2], [cloud.seed, 4], [cloud.col, 3]].forEach(([data, size], loc) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  });
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);

  const view = { a: 0, b: 0, mix: 0, melt: 0.3, build: 1, fine: 1, conv: 0, cx: 0.7, cy: 0.66, scale: 1.3 };
  const ptr = { x: 0.1, y: -0.35, tx: 0.1, ty: -0.35 }; // parked off the figure until the pointer moves
  let dpr = 1, frozenTime = null, running = true, t0 = performance.now();

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function frame(now) {
    if (!running) return;
    resize();
    ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
    const time = frozenTime ?? (now - t0) / 1000;
    const W = canvas.width, H = canvas.height, scale = view.scale * H;
    const cx = view.cx * W + (ptr.x - 0.5) * -10 * dpr, cy = view.cy * H + (ptr.y - 0.3) * -6 * dpr;

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(quad.p);
    let u = quad.u;
    gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uPtr, ptr.x, ptr.y); gl.uniform2f(u.uCenter, cx, cy);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uA, view.a); gl.uniform1f(u.uB, view.b); gl.uniform1f(u.uMix, view.mix);
    gl.uniform1f(u.uMelt, view.melt); gl.uniform1f(u.uBuild, view.build); gl.uniform1f(u.uFine, view.fine);
    gl.uniform1f(u.uGlyphN, GLYPHS.length);
    gl.uniform1i(u.uReal, 0); gl.uniform1i(u.uClay, 1); gl.uniform1i(u.uFelt, 2); gl.uniform1i(u.uGlyph, 3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const weight = (view.a === STATE.signal ? 1 - view.mix : 0) + (view.b === STATE.signal ? view.mix : 0);
    if (weight > 0.002) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(points.p);
      u = points.u;
      gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uPtr, ptr.x, ptr.y); gl.uniform2f(u.uCenter, cx, cy);
      gl.uniform1f(u.uTime, time); gl.uniform1f(u.uScale, scale); gl.uniform1f(u.uDpr, dpr);
      gl.uniform1f(u.uConv, view.conv); gl.uniform1f(u.uOpacity, Math.min(1, weight * 1.4) * 0.8);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, cloud.count);
      gl.bindVertexArray(null);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('pointermove', (e) => {
    const scale = view.scale * innerHeight;
    ptr.tx = (e.clientX - view.cx * innerWidth) / (scale * FRAME_ASPECT) + 0.5;
    ptr.ty = (e.clientY - view.cy * innerHeight) / scale + 0.5;
  }, { passive: true });

  const api = {
    view,
    setRunning(on) { if (on && !running) { running = true; requestAnimationFrame(frame); } else if (!on) running = false; },
    setMotion(on) { frozenTime = on ? null : 12.5; },
  };
  document.addEventListener('visibilitychange', () => api.setRunning(!document.hidden));
  requestAnimationFrame(frame);
  return api;
}

// The monitor in the summary. It is one more object on the desk, and he is in it: his registered photo
// (assets/stage/real.jpg, the same picture the stage is made of) drawn at close to full resolution, with the
// screen sitting lightly on top of it: fine scanlines, a little bloom, a slight barrel curve, a soft vignette.
// He attends: the face slides and turns a little inside the glass toward the pointer, or toward the thing that
// has his attention (js/things.js names it), and the line under him names that thing. As the summary's copy
// leaves, the picture breaks into the hero's pixels and runs down the glass the way the hero melts.
const VMAX = 0.78125;                 // mirrored from js/stage.js: how much of the 2:3 frame the texture stores
export const FACE = [0.495, 0.325];          // the middle of his face in the portrait's frame
export const CROP = { v: 0.335, dv: 0.47 };  // the band of the frame the glass shows: hair to collar
const COLUMNS = 56;                   // the melt's columns across the glass, about as wide as the hero's pixels

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const FS = `#version 300 es
precision highp float;
const float VMAX = ${VMAX.toFixed(5)};
const vec3 LUMA = vec3(.299, .587, .114);
uniform sampler2D uReal;
uniform vec2 uRes, uLook;
uniform vec4 uCrop;                   // centre u, centre v, width, height, in the portrait's frame
uniform float uTime, uOn, uMelt, uDark, uFlick, uPitch, uLod, uTileLod, uRoll;
out vec4 o;

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// packed texture: colour on the left half, matte on the right half, v stored up to VMAX
vec4 texP(vec2 uv, float lod){
  vec2 q = vec2(clamp(uv.x, .012, .988) * .5, clamp(uv.y / VMAX, .003, .997));
  float a = textureLod(uReal, q + vec2(.5, 0.), lod).r;
  a *= step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, VMAX);
  return vec4(textureLod(uReal, q, lod).rgb, a);
}
// the hero's pixel look (js/stage.js warm, q9), so the melt here and the melt there are made of the same stuff
vec3 warm(vec3 c){
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, 1.6) * vec3(1.2, 1.08, .98);
  c += smoothstep(.02, .14, c.b - c.r) * vec3(.0, .05, .30);
  return c;
}
vec3 q9(vec3 c){ return floor(clamp(c, 0., 1.) * 9. + .5) / 9.; }

// him over the room behind him, at one point of the glass
vec3 picture(vec2 f, float lod, float plain){
  vec2 uv = uCrop.xy + (f - .5) * uCrop.zw;
  // he attends: the whole face slides toward what he looks at, and its middle goes further than its edges,
  // which squeezes the side he turns to and opens the other
  vec2 d = (uv - vec2(${FACE[0]}, ${FACE[1]})) / vec2(.2, .24);
  float w = exp(-dot(d, d) * 1.3);
  uv -= uLook * (vec2(.016, .009) + vec2(.017, .008) * w);
  vec4 s = texP(uv, lod);
  float l = length((f - vec2(.5, .4)) * vec2(1., 1.15));
  vec3 room = mix(vec3(.47, .5, .57), vec3(.13, .15, .21), smoothstep(.05, .8, l));
  room = mix(room, vec3(dot(room, LUMA)) * vec3(.9, .94, 1.), plain);   // as pixels the room stays grey: the hero's colours are his, not the wall's
  vec3 c = mix(room, s.rgb, smoothstep(.3, .8, s.a));
  // a little bloom: the bright parts of him spread a touch, as phosphor does
  vec4 wide = texP(uv, lod + 3.2);
  c += .1 * wide.rgb * smoothstep(.55, .95, dot(wide.rgb, LUMA)) * wide.a;
  return c;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  // the glass is slightly convex: the picture bows, and runs out just short of the corners
  vec2 c = p - .5;
  vec2 f = .5 + c * (1. + .1 * dot(c, c)) / 1.025;
  float inside = step(0., f.x) * step(f.x, 1.) * step(0., f.y) * step(f.y, 1.);

  // the melt, as the hero does it: the picture becomes pixels, and every column of them runs down like wax
  float m = uMelt;
  vec2 grid = vec2(${COLUMNS}., floor(${COLUMNS}. * uRes.y / uRes.x + .5));
  float cx = floor(f.x * grid.x);
  float cn = h11(cx + 3.1);
  float n = mix(cn, h11(floor(cx * .5) + 9.7), step(.45, h11(cx * 1.7)));
  float sag = .5 + .5 * sin(cx * .21 + 1.3) * sin(cx * .083 + .4);
  float run = m * (.03 + .1 * sag + .5 * pow(n, 3.)) * (.9 + .1 * sin(uTime * .6 + cn * 6.28))
    + smoothstep(.2, 1., m) * (.3 + .3 * sag + .25 * cn) + smoothstep(.55, 1., m) * .5;
  vec2 g = vec2(f.x, f.y - run);
  vec2 cell = floor(g * grid), q = fract(g * grid);
  float gone = step(g.y, 0.);   // above the top of the picture there is only dark glass

  vec3 col = picture(f, uLod, 0.);
  if (m > .001){
    vec3 tile = q9(warm(picture((cell + .5) / grid, uTileLod, .8)));
    tile *= 1. + .22 * max(step(q.x, .12), step(q.y, .12)) - .30 * max(step(.88, q.x), step(.88, q.y));
    tile *= .93 + .14 * h21(cell);
    // it turns to pixels a column at a time, a moment before that column starts to run
    col = mix(col, tile, smoothstep(.0, .22, m * (1.15 + .5 * n)));
    col *= 1. - gone;
  }

  // the screen, lightly: scanlines counted in device pixels so they never beat against the display, softer where he is bright
  float l = dot(col, LUMA);
  col *= 1.05 - .15 * (.5 + .5 * cos(6.28318 * gl_FragCoord.y / uPitch)) * (1. - .55 * l);
  // idle life: one soft band rolling slowly down
  float roll = p.y - fract(uTime * .045) * 1.4 + .2;
  col *= 1. + .05 * uRoll * exp(-roll * roll * 90.);
  col *= uFlick;
  col *= mix(.5, 1., smoothstep(.78, .4, length(c * vec2(1., 1.06))));   // a soft vignette at the edge of the glass
  col *= uOn * inside;
  col = mix(col, vec3(.014, .016, .022), uDark);
  o = vec4(col, 1.);
}`;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

export async function createCrt(root, idle, reduced) {
  const glass = root.querySelector('.crt-glass'), canvas = glass.querySelector('canvas'), line = root.querySelector('.crt-line span');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return null;
  const u = compile(gl);
  const img = new Image();
  img.src = 'assets/stage/real.jpg';
  await img.decode();
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);

  const hover = matchMedia('(hover: hover)').matches;
  let live = !reduced, px = innerWidth / 2, py = innerHeight * 0.3, gx = 0, gy = 0, named = null, said = 0;
  let flickAt = performance.now() + 9000, frozen = 12.5;
  const t0 = performance.now();
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') { px = e.clientX; py = e.clientY; } }, { passive: true });

  // the line under him: the chapter's own head line until something has his attention, then that thing's name
  function say(text) {
    if (text === named) return;
    named = text;
    const id = ++said;
    line.parentElement.classList.add('is-changing');
    setTimeout(() => { if (id === said) { line.textContent = text; line.parentElement.classList.remove('is-changing'); } }, reduced ? 0 : 110);
  }

  return {
    // weight: how far he has arrived. focus: the thing that has his attention ({x, y, name}) or null for the pointer.
    // at: where the monitor stands ({x, y, s}: its middle, and its size against its full size). leave: 0..1 as the copy goes
    update(weight, focus, at, leave) {
      const show = weight * (1 - smooth(0.78, 1, leave));
      root.style.opacity = show.toFixed(3);
      root.style.visibility = show < 0.01 ? 'hidden' : 'visible';
      if (show < 0.01) return null;
      root.style.transform = `translate3d(${at.x.toFixed(1)}px, ${(at.y + (1 - weight) * 28).toFixed(1)}px, 0) translate(-50%, -50%) scale(${at.s.toFixed(4)})`;
      root.style.setProperty('--s', at.s.toFixed(3));   // the line under him stays one size whatever the monitor's scale
      const dark = smooth(0.5, 0.85, leave);
      root.style.setProperty('--lit', ((1 - dark) * weight).toFixed(3));
      root.style.setProperty('--said', ((1 - smooth(0.3, 0.6, leave)) * smooth(0.6, 1, weight)).toFixed(3));   // his line goes out with his picture

      // where he is looking, from the middle of the glass: -1..1 each way, full reach a third of the window away
      const box = glass.getBoundingClientRect();
      const to = focus ?? (hover ? { x: px, y: py } : null);
      let tx = 0, ty = 0;
      if (to) {
        tx = (to.x - box.left - box.width / 2) / (innerWidth * 0.3); ty = (to.y - box.top - box.height * 0.42) / (innerHeight * 0.34);
        const len = Math.hypot(tx, ty);
        if (len > 1) { tx /= len; ty /= len; }
      }
      const k = reduced ? 1 : 0.09;
      gx += (tx - gx) * k; gy += (ty - gy) * k;
      root.style.setProperty('--gx', gx.toFixed(3)); root.style.setProperty('--gy', gy.toFixed(3));   // the glare on the glass goes the other way (journey.css)
      say(focus?.name ? focus.name : idle);

      // drawn at the size it is shown, in device pixels (in steps, so a change of size is not a new buffer every frame):
      // his face is as sharp as the photo allows and the scanlines land on whole pixels
      const dpr = Math.min(devicePixelRatio || 1, 2) * Math.max(0.3, Math.round(at.s * 40) / 40);
      const w = Math.round(glass.clientWidth * dpr), h = Math.round(glass.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const now = performance.now(), time = live ? (now - t0) / 1000 : frozen;
      let flick = 1;
      if (live && now > flickAt) { flick = 0.9; flickAt = now + 7000 + Math.random() * 9000; }   // a rare one-frame flicker
      const du = CROP.dv * 1.5 * w / h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h); gl.uniform2f(u.uLook, gx, gy);
      gl.uniform4f(u.uCrop, FACE[0], CROP.v, du, CROP.dv);
      gl.uniform1f(u.uTime, time); gl.uniform1f(u.uOn, smooth(0.35, 1, weight)); gl.uniform1f(u.uMelt, smooth(0, 0.7, leave)); gl.uniform1f(u.uDark, dark);
      gl.uniform1f(u.uFlick, flick); gl.uniform1f(u.uRoll, live ? 1 : 0);
      gl.uniform1f(u.uPitch, Math.max(3, Math.round(h / 150)));   // about 150 lines down the glass, never finer than three device pixels
      gl.uniform1f(u.uLod, Math.max(0, Math.log2(du * 1280 / w)));
      gl.uniform1f(u.uTileLod, Math.max(0, Math.log2(du * 1280 / COLUMNS) - 0.4));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return box;
    },
    setMotion(on) { live = on && !reduced; },
  };
}

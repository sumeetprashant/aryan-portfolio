// WebGL2 port of Acerola's ASCII shader (AcerolaFX_ASCII.fx).
// Pipeline per frame:
//   1. luminance          (full res, R16F)
//   2. downscale          (1 texel per tile, RGBA8: tile colour + tile luminance)
//   3. horizontal blur    (full res, RG16F: two gaussians, sigma and sigma*sigmaScale)
//   4. vertical blur+DoG  (full res, R8: thresholded difference of gaussians)
//   5. horizontal Sobel   (full res, RG16F, 3/10/3 separable kernel)
//   6. vertical Sobel     (full res, RG16F: edge angle theta + magnitude flag)
//   7. tile vote          (1 texel per tile: most common edge direction, or none)
//   8. composite          (glyph lookup + the human/machine dial)
// Step 7 replaces the original's compute shader: each vote fragment loops its own
// tile's texels, so the histogram costs ~1 tap per source pixel overall.
//
// The dial is uProgress in [0,1]: 0 = pure ASCII (machine view), 1 = pure footage
// (human view). Colour arrives first, then tiles resolve to footage in a hashed
// stagger; edge tiles resolve last (the machine holds onto structure longest).

import { buildFillAtlas, buildEdgeAtlas, DEFAULT_RAMP } from './atlas.js';

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_LUM = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uRes;
uniform vec2 uCover;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 vuv = 0.5 + (uv - 0.5) * uCover;
  vec3 c = texture(uVideo, vuv).rgb;
  o = vec4(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 0.0, 1.0);
}`;

const FRAG_DOWNSCALE = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uRes;
uniform vec2 uCover;
out vec4 o;
void main() {
  vec2 px = 1.0 / uRes;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 off = vec2(i < 2 ? -0.25 : 0.25, (i & 1) == 0 ? -0.25 : 0.25);
    vec2 uv = (gl_FragCoord.xy + off) / uRes;
    vec2 vuv = 0.5 + (uv - 0.5) * uCover;
    acc += texture(uVideo, vuv).rgb;
  }
  acc *= 0.25;
  o = vec4(acc, dot(acc, vec3(0.2126, 0.7152, 0.0722)));
}`;

const FRAG_BLUR_H = `#version 300 es
precision highp float;
uniform sampler2D uLum;
uniform int uRadius;
uniform float uSigma;
uniform float uSigmaScale;
out vec4 o;
float g(float s, float x) { return exp(-x * x / (2.0 * s * s)); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uLum, 0);
  vec2 blur = vec2(0.0);
  vec2 ksum = vec2(0.0);
  for (int x = -32; x <= 32; x++) {
    if (x < -uRadius || x > uRadius) continue;
    float l = texelFetch(uLum, clamp(p + ivec2(x, 0), ivec2(0), sz - 1), 0).r;
    vec2 w = vec2(g(uSigma, float(x)), g(uSigma * uSigmaScale, float(x)));
    blur += l * w;
    ksum += w;
  }
  o = vec4(blur / ksum, 0.0, 1.0);
}`;

const FRAG_BLUR_V_DOG = `#version 300 es
precision highp float;
uniform sampler2D uBlurH;
uniform int uRadius;
uniform float uSigma;
uniform float uSigmaScale;
uniform float uTau;
uniform float uThreshold;
out vec4 o;
float g(float s, float x) { return exp(-x * x / (2.0 * s * s)); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uBlurH, 0);
  vec2 blur = vec2(0.0);
  vec2 ksum = vec2(0.0);
  for (int y = -32; y <= 32; y++) {
    if (y < -uRadius || y > uRadius) continue;
    vec2 l = texelFetch(uBlurH, clamp(p + ivec2(0, y), ivec2(0), sz - 1), 0).rg;
    vec2 w = vec2(g(uSigma, float(y)), g(uSigma * uSigmaScale, float(y)));
    blur += l * w;
    ksum += w;
  }
  blur /= ksum;
  float D = blur.x - uTau * blur.y;
  o = vec4(D >= uThreshold ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}`;

const FRAG_SOBEL_H = `#version 300 es
precision highp float;
uniform sampler2D uDoG;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uDoG, 0);
  float l1 = texelFetch(uDoG, clamp(p + ivec2(-1, 0), ivec2(0), sz - 1), 0).r;
  float l2 = texelFetch(uDoG, p, 0).r;
  float l3 = texelFetch(uDoG, clamp(p + ivec2(1, 0), ivec2(0), sz - 1), 0).r;
  float gx = 3.0 * l1 - 3.0 * l3;
  float gy = 3.0 * l1 + 10.0 * l2 + 3.0 * l3;
  o = vec4(gx, gy, 0.0, 1.0);
}`;

const FRAG_SOBEL_V = `#version 300 es
precision highp float;
uniform sampler2D uSobelH;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(uSobelH, 0);
  vec2 g1 = texelFetch(uSobelH, clamp(p + ivec2(0, 1), ivec2(0), sz - 1), 0).rg;
  vec2 g2 = texelFetch(uSobelH, p, 0).rg;
  vec2 g3 = texelFetch(uSobelH, clamp(p + ivec2(0, -1), ivec2(0), sz - 1), 0).rg;
  float Gx = 3.0 * g1.x + 10.0 * g2.x + 3.0 * g3.x;
  float Gy = 3.0 * g1.y - 3.0 * g3.y;
  float mag = length(vec2(Gx, Gy));
  float theta = atan(Gy, Gx);
  o = vec4(theta, mag > 1e-4 ? 1.0 : 0.0, 0.0, 1.0);
}`;

const FRAG_VOTE = `#version 300 es
precision highp float;
#define PI 3.14159265359
uniform sampler2D uSobel;
uniform int uTile;
uniform int uEdgeThreshold;
out vec4 o;
void main() {
  ivec2 tile = ivec2(gl_FragCoord.xy);
  ivec2 base = tile * uTile;
  ivec2 sz = textureSize(uSobel, 0);
  ivec4 buckets = ivec4(0);
  for (int y = 0; y < 32; y++) {
    if (y >= uTile) break;
    for (int x = 0; x < 32; x++) {
      if (x >= uTile) break;
      ivec2 q = base + ivec2(x, y);
      if (q.x >= sz.x || q.y >= sz.y) continue;
      vec2 s = texelFetch(uSobel, q, 0).rg;
      if (s.g < 0.5) continue;
      float t = s.r;
      float a = abs(t) / PI;
      int d = -1;
      // buckets 2/3 are swapped vs the HLSL original: our y axis points up
      if (a < 0.05 || a > 0.9) d = 0;                      // vertical
      else if (a > 0.45 && a < 0.55) d = 1;                // horizontal
      else if (a >= 0.05 && a <= 0.45) d = t > 0.0 ? 2 : 3; // diagonal "/"
      else d = t > 0.0 ? 3 : 2;                            // diagonal "\\"
      buckets += ivec4(d == 0 ? 1 : 0, d == 1 ? 1 : 0, d == 2 ? 1 : 0, d == 3 ? 1 : 0);
    }
  }
  int best = -1;
  int bestC = 0;
  if (buckets.x > bestC) { bestC = buckets.x; best = 0; }
  if (buckets.y > bestC) { bestC = buckets.y; best = 1; }
  if (buckets.z > bestC) { bestC = buckets.z; best = 2; }
  if (buckets.w > bestC) { bestC = buckets.w; best = 3; }
  if (bestC < uEdgeThreshold) best = -1;
  o = vec4(float(best + 1) / 8.0, 0.0, 0.0, 1.0);
}`;

const FRAG_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uVideo;
uniform sampler2D uVote;
uniform sampler2D uDown;
uniform sampler2D uFillAtlas;
uniform sampler2D uEdgeAtlas;
uniform sampler2D uDoG;
uniform vec2 uRes;
uniform vec2 uCover;
uniform int uTile;
uniform int uFillN;
uniform float uExposure;
uniform float uAttenuation;
uniform float uBlend;
uniform float uProgress;
uniform vec3 uAsciiColor;
uniform vec3 uBgColor;
uniform int uEdgesOn;
uniform int uFillOn;
uniform int uInvert;
uniform int uDebug;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  ivec2 pix = ivec2(gl_FragCoord.xy);
  ivec2 tile = pix / uTile;
  ivec2 local = pix - tile * uTile;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 vuv = 0.5 + (uv - 0.5) * uCover;
  vec3 video = texture(uVideo, vuv).rgb;

  vec4 down = texelFetch(uDown, tile, 0);
  int edgeIdx = int(floor(texelFetch(uVote, tile, 0).r * 8.0 + 0.5)) - 1;

  bool isEdge = edgeIdx >= 0 && uEdgesOn == 1;
  int atlasY = uTile - 1 - local.y;
  float glyph = 0.0;
  if (isEdge) {
    glyph = texelFetch(uEdgeAtlas, ivec2(edgeIdx * uTile + local.x, atlasY), 0).r;
  } else if (uFillOn == 1) {
    float lum = clamp(pow(down.a * uExposure, uAttenuation), 0.0, 1.0);
    if (uInvert == 1) lum = 1.0 - lum;
    int idx = clamp(int(floor(lum * float(uFillN))) - 1, 0, uFillN - 1);
    glyph = texelFetch(uFillAtlas, ivec2(idx * uTile + local.x, atlasY), 0).r;
  }

  // The dial. Colour first, then a hashed per-tile resolve into real footage.
  float colorBlend = max(uBlend, smoothstep(0.05, 0.55, uProgress));
  vec3 charCol = mix(uAsciiColor, down.rgb, colorBlend);
  vec3 ascii = mix(uBgColor, charCol, glyph);

  // Resolve is a scan front sweeping down the frame — the machine rendering the
  // film pass by pass, not random static. Bright tiles resolve slightly sooner
  // (light is understood first); edge tiles hold longest (structure persists).
  float reveal = smoothstep(0.25, 0.97, uProgress);
  float ny = 1.0 - gl_FragCoord.y / uRes.y;
  float h = hash(vec2(tile));
  float jitter = (h - 0.5) * 0.35 - down.a * 0.15;
  if (isEdge) jitter += 0.22;
  float band = 0.16;
  float front = mix(-band - 0.6, 1.0 + band + 0.6, reveal);
  float t = 1.0 - smoothstep(front - band, front + band, ny + jitter);
  vec3 col = mix(ascii, video, t);

  if (uDebug == 1) col = vec3(texelFetch(uDoG, pix, 0).r);
  if (uDebug == 2) {
    col = vec3(0.0);
    if (edgeIdx == 0) col = vec3(1.0, 0.0, 0.0);
    if (edgeIdx == 1) col = vec3(0.0, 1.0, 0.0);
    if (edgeIdx == 2) col = vec3(0.0, 1.0, 1.0);
    if (edgeIdx == 3) col = vec3(1.0, 1.0, 0.0);
  }
  if (uDebug == 3) col = video;
  o = vec4(col, 1.0);
}`;

const DEFAULTS = {
  cellSize: 8,          // CSS px; multiplied by dpr for the device-pixel tile
  sigma: 2.0,
  sigmaScale: 1.6,
  tau: 1.0,
  threshold: 0.005,
  edgeThreshold: 8,     // of 64 texels at tile=8; rescaled with tile area
  exposure: 1.0,
  attenuation: 1.0,
  blendWithBase: 0.0,
  progress: 0.0,
  asciiColor: [0.92, 0.9, 0.85],
  bgColor: [0.047, 0.039, 0.035],
  edges: true,
  fill: true,
  invert: false,
  debug: 0,             // 0 result, 1 DoG, 2 edge directions, 3 raw video
  ramp: DEFAULT_RAMP,
  maxDpr: 1.5,
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function makeProgram(gl, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export class AsciiEngine {
  constructor(canvas, params = {}) {
    this.canvas = canvas;
    this.params = { ...DEFAULTS, ...params };
    this.video = null;
    this._lastTime = -1;
    this._raf = 0;
    this._running = false;
    this._sourceDirty = true;

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) { this.supported = false; return; }
    this.gl = gl;
    const ext = gl.getExtension('EXT_color_buffer_float') ||
                gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) { this.supported = false; return; }
    this.supported = true;

    this.progs = {
      lum: makeProgram(gl, FRAG_LUM),
      down: makeProgram(gl, FRAG_DOWNSCALE),
      blurH: makeProgram(gl, FRAG_BLUR_H),
      dog: makeProgram(gl, FRAG_BLUR_V_DOG),
      sobelH: makeProgram(gl, FRAG_SOBEL_H),
      sobelV: makeProgram(gl, FRAG_SOBEL_V),
      vote: makeProgram(gl, FRAG_VOTE),
      comp: makeProgram(gl, FRAG_COMPOSITE),
    };
    this.uniforms = {};
    for (const [name, prog] of Object.entries(this.progs)) {
      const u = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        u[info.name] = gl.getUniformLocation(prog, info.name);
      }
      this.uniforms[name] = u;
    }

    this.videoTex = this._makeTex(gl.LINEAR, gl.CLAMP_TO_EDGE);
    this.fillTex = this._makeTex(gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.edgeTex = this._makeTex(gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.targets = {};   // name -> {tex, fbo, w, h}
    this.vao = gl.createVertexArray();

    this._tile = 8;
    this._buildAtlases();
    this._resize();
    this._ro = new ResizeObserver(() => { this._resize(); });
    this._ro.observe(canvas);
    // Re-render atlases once webfonts are in (JetBrains Mono may load late).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (this.gl) this._buildAtlases(); });
    }
  }

  _makeTex(filter, wrap) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  _makeTarget(name, w, h, internal, format, type) {
    const gl = this.gl;
    const old = this.targets[name];
    if (old && old.w === w && old.h === h) return old;
    if (old) { gl.deleteTexture(old.tex); gl.deleteFramebuffer(old.fbo); }
    const tex = this._makeTex(gl.NEAREST, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const t = { tex, fbo, w, h };
    this.targets[name] = t;
    return t;
  }

  _buildAtlases() {
    const gl = this.gl;
    const tile = this._tile;
    const fill = buildFillAtlas(tile, this.params.ramp);
    const edge = buildEdgeAtlas(tile);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.fillTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fill);
    gl.bindTexture(gl.TEXTURE_2D, this.edgeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, edge);
  }

  _resize() {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.params.maxDpr);
    const w = Math.max(2, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const tile = Math.max(4, Math.round(this.params.cellSize * dpr));
    if (tile !== this._tile) {
      this._tile = tile;
      this._buildAtlases();
    }
    const tw = Math.ceil(w / tile);
    const th = Math.ceil(h / tile);
    this._makeTarget('lum', w, h, gl.R16F, gl.RED, gl.HALF_FLOAT);
    this._makeTarget('blurH', w, h, gl.RG16F, gl.RG, gl.HALF_FLOAT);
    this._makeTarget('dog', w, h, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
    this._makeTarget('sobelH', w, h, gl.RG16F, gl.RG, gl.HALF_FLOAT);
    this._makeTarget('sobelV', w, h, gl.RG16F, gl.RG, gl.HALF_FLOAT);
    this._makeTarget('down', tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this._makeTarget('vote', tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this._sourceDirty = true;
  }

  setSource(video) {
    this.video = video;
    this._lastTime = -1;
    this._sourceDirty = true;
  }

  setProgress(p) {
    this.params.progress = Math.min(1, Math.max(0, p));
  }

  setParams(patch) {
    const rampChanged = patch.ramp !== undefined && patch.ramp !== this.params.ramp;
    const cellChanged = patch.cellSize !== undefined && patch.cellSize !== this.params.cellSize;
    Object.assign(this.params, patch);
    if (cellChanged) this._resize();
    else if (rampChanged) this._buildAtlases();
    this._sourceDirty = true;
  }

  start() {
    if (this._running || !this.supported) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this.renderFrame();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  dispose() {
    this.stop();
    if (this._ro) this._ro.disconnect();
    this.gl = null;
  }

  _cover() {
    const v = this.video;
    const cw = this.canvas.width, ch = this.canvas.height;
    if (!v || !v.videoWidth) return [1, 1];
    const ca = cw / ch;
    const va = v.videoWidth / v.videoHeight;
    return ca > va ? [1, va / ca] : [ca / va, 1];
  }

  _uploadVideo() {
    const gl = this.gl;
    const v = this.video;
    if (!v || v.readyState < 2) return false;
    if (v.currentTime === this._lastTime && !this._sourceDirty) return false;
    this._lastTime = v.currentTime;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return true;
  }

  _pass(progName, target, setup) {
    const gl = this.gl;
    const prog = this.progs[progName];
    const u = this.uniforms[progName];
    gl.useProgram(prog);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    setup(u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _bind(unit, tex) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  renderFrame() {
    const gl = this.gl;
    if (!gl || !this.supported) return;
    const p = this.params;
    const T = this.targets;
    const tile = this._tile;
    const newFrame = this._uploadVideo();
    if (!this.video || this.video.readyState < 2) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(p.bgColor[0], p.bgColor[1], p.bgColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const cover = this._cover();
    const radius = Math.min(12, Math.max(2, Math.ceil(2 * p.sigma * Math.max(1, p.sigmaScale))));
    // edgeThreshold is defined against Acerola's 8px tile. DoG regions are filled
    // masses, so only boundary pixels carry gradient — vote counts grow linearly
    // with tile size, not quadratically.
    const edgeThreshold = Math.max(1, Math.round(p.edgeThreshold * tile / 8));
    gl.bindVertexArray(this.vao);

    if (newFrame || this._sourceDirty) {
      this._sourceDirty = false;
      this._pass('lum', T.lum, (u) => {
        gl.uniform1i(u.uVideo, this._bind(0, this.videoTex));
        gl.uniform2f(u.uRes, T.lum.w, T.lum.h);
        gl.uniform2f(u.uCover, cover[0], cover[1]);
      });
      this._pass('down', T.down, (u) => {
        gl.uniform1i(u.uVideo, this._bind(0, this.videoTex));
        gl.uniform2f(u.uRes, T.down.w, T.down.h);
        gl.uniform2f(u.uCover, cover[0], cover[1]);
      });
      this._pass('blurH', T.blurH, (u) => {
        gl.uniform1i(u.uLum, this._bind(0, T.lum.tex));
        gl.uniform1i(u.uRadius, radius);
        gl.uniform1f(u.uSigma, p.sigma);
        gl.uniform1f(u.uSigmaScale, p.sigmaScale);
      });
      this._pass('dog', T.dog, (u) => {
        gl.uniform1i(u.uBlurH, this._bind(0, T.blurH.tex));
        gl.uniform1i(u.uRadius, radius);
        gl.uniform1f(u.uSigma, p.sigma);
        gl.uniform1f(u.uSigmaScale, p.sigmaScale);
        gl.uniform1f(u.uTau, p.tau);
        gl.uniform1f(u.uThreshold, p.threshold);
      });
      this._pass('sobelH', T.sobelH, (u) => {
        gl.uniform1i(u.uDoG, this._bind(0, T.dog.tex));
      });
      this._pass('sobelV', T.sobelV, (u) => {
        gl.uniform1i(u.uSobelH, this._bind(0, T.sobelH.tex));
      });
      this._pass('vote', T.vote, (u) => {
        gl.uniform1i(u.uSobel, this._bind(0, T.sobelV.tex));
        gl.uniform1i(u.uTile, tile);
        gl.uniform1i(u.uEdgeThreshold, edgeThreshold);
      });
    }

    this._pass('comp', null, (u) => {
      gl.uniform1i(u.uVideo, this._bind(0, this.videoTex));
      gl.uniform1i(u.uVote, this._bind(1, T.vote.tex));
      gl.uniform1i(u.uDown, this._bind(2, T.down.tex));
      gl.uniform1i(u.uFillAtlas, this._bind(3, this.fillTex));
      gl.uniform1i(u.uEdgeAtlas, this._bind(4, this.edgeTex));
      gl.uniform1i(u.uDoG, this._bind(5, T.dog.tex));
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform2f(u.uCover, cover[0], cover[1]);
      gl.uniform1i(u.uTile, tile);
      gl.uniform1i(u.uFillN, this.params.ramp.length);
      gl.uniform1f(u.uExposure, p.exposure);
      gl.uniform1f(u.uAttenuation, p.attenuation);
      gl.uniform1f(u.uBlend, p.blendWithBase);
      gl.uniform1f(u.uProgress, p.progress);
      gl.uniform3f(u.uAsciiColor, ...p.asciiColor);
      gl.uniform3f(u.uBgColor, ...p.bgColor);
      gl.uniform1i(u.uEdgesOn, p.edges ? 1 : 0);
      gl.uniform1i(u.uFillOn, p.fill ? 1 : 0);
      gl.uniform1i(u.uInvert, p.invert ? 1 : 0);
      gl.uniform1i(u.uDebug, p.debug);
    });
  }
}

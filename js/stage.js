// The portrait stage. One fixed WebGL2 canvas, one set of cells. Every cell has a home
// on the registered portrait (scripts/prep_stage.py) and scroll decides what it is right
// now: goo, a free point, part of a glyph, a lit cube, part of a brick, a tuft of felt, a
// photo texel. Nothing swaps; position, size, shape and shading all interpolate.

const ASPECT = 2 / 3;
const VMAX = 0.78125;
const FLOOR = 0.69;
const GLYPHS = ' .,:;~-=+*xo#%@';
const DRIPS = 16;
const FLOATERS = 34;

const COMMON = `#version 300 es
precision highp float;
precision highp int;
const float ASPECT = ${ASPECT.toFixed(7)};
const float VMAX = ${VMAX.toFixed(5)};
const float FLOOR = ${FLOOR.toFixed(3)};
const vec3 LUMA = vec3(.299, .587, .114);
const vec3 BLUE = vec3(.482, .576, .96);
const vec3 DEEP = vec3(.16, .24, .72);
const vec3 BONE = vec3(.93, .92, .89);
uniform vec2 uRes, uCenter, uPtr, uGrid;
uniform float uTime, uScale, uSub, uLod, uCellLod, uCellPx, uGlyphN, uBust, uSmall;
uniform float uMelt, uLiquid, uDrain, uHero, uDisperse, uFree, uGather, uSnap, uGlyph, uFill, uCube, uStud, uBuild, uSoft, uPhoto, uTurn;
uniform sampler2D uReal, uLego, uFelt, uAtlas;

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// packed texture: colour on the left half, matte on the right half, v stored up to VMAX
vec4 texP(sampler2D t, vec2 uv, float lod){
  vec2 q = vec2(clamp(uv.x, .012, .988) * .5, clamp(uv.y / VMAX, .003, .997));
  float a = textureLod(t, q + vec2(.5, 0.), lod).r;
  a *= step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, VMAX);
  return vec4(textureLod(t, q, lod).rgb, a);
}
vec3 vivid(vec3 c){
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, 1.36) * vec3(1.08, 1.04, 1.02);
  c += smoothstep(.0, .10, c.b - c.r) * vec3(.0, .05, .30) * smoothstep(.02, .2, l);
  return c;
}
// the ragged line the melt has eaten up to; js mirrors this in cutLine()
float cutLine(float u){
  float w = sin(u * 21. + 1.3) * .5 + sin(u * 47. + uTime * .11) * .3 + sin(u * 9. - .7) * .6;
  return .648 - .078 * uMelt + w * (.009 + .009 * uMelt);
}
`;

const CELL_VS = COMMON + `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aCell;
layout(location = 2) in vec4 aSeed;
out vec2 vQ; out vec2 vP;
flat out vec2 vCell;
flat out vec4 vReal, vLego, vPair, vW1, vW2, vW3, vBrick;

float loc(float U, float th, float w){ float a = th * (1. - w); return smoothstep(a, a + w, U); }
bool edge(float c2, float R){ return h21(vec2(c2, R) * 1.37 + 5.) < .36 || mod(c2 + floor(h11(R + .5) * 4.), 4.) < .5; }

void main(){
  vec2 cell = aCell.xy, sub = aCell.zw, cs = 1. / uGrid;
  vec2 cuv = (cell + .5) * cs;
  float hc = h21(cell + .37), hs = aSeed.x;
  float pairRow = floor(cell.y * .5);
  float hp = h21(vec2(cell.x, pairRow) + 3.1);

  vec4 real = texP(uReal, cuv, uCellLod);
  vec4 pr = texP(uReal, vec2(cell.x + .5, pairRow * 2. + 1.) * cs, uCellLod + .5);

  // which brick this cell belongs to: courses are two cells tall, bricks 2 to 8 cells long
  float c2 = floor(cell.x * .5), s0 = c2, s1 = c2 + 1.;
  for (int k = 0; k < 4; k++){ if (edge(s0, pairRow)) break; s0 -= 1.; }
  for (int k = 0; k < 4; k++){ if (edge(s1, pairRow)) break; s1 += 1.; }
  vec2 bC = vec2(s0 + s1, pairRow * 2. + 1.) * cs;
  float bh = h21(vec2(s0, pairRow) + 11.), bh2 = h21(vec2(s0, pairRow) + 3.);
  vec4 lego = texP(uLego, bC, uCellLod + 1.);

  // local progress of every change, staggered so each one ripples through the figure
  float rise = 1. - clamp(cuv.y / FLOOR, 0., 1.);
  float cut = cutLine(cuv.x);
  float gone = smoothstep(cut - .013, cut + .001, cuv.y) * uLiquid;
  float free = loc(uFree, rise * .55 + hs * .45, .4);
  float gat = loc(uGather, hs * .45 + rise * .35 + hc * .2, .45);
  float snap = loc(uSnap, hc * .5 + cuv.y * .7, .35);
  float kg = loc(uGlyph, hp * .5 + cuv.y * .7, .3);
  float centre = length((cuv - vec2(.5, .33)) * vec2(1., 1.15));
  float fill = loc(uFill, hp * .4 + centre * 1.1, .3);
  float cube = loc(uCube, hp * .4 + centre * 1.1, .3);
  float st = loc(uStud, bh * .6 + rise * .4, .35);
  float land = loc(uBuild, clamp(1. - bC.y / .75, 0., 1.) * .86 + bh * .14, .1);
  float so = loc(uSoft, vnoise(bC * vec2(5., 7.5)) * .75 + bh * .25, .4);
  float ph = loc(uPhoto, centre * .85 + vnoise(cuv * 9.) * .3, .4);

  vec2 home = (cell + (sub + .5) / uSub) * cs;
  vec2 pos = home;

  // melt: the rows above the cut slump, and the top of the head lets go of a few cubes
  pos.y += uLiquid * uMelt * .016 * smoothstep(cut - .13, cut, cuv.y);
  float heroWin = uHero * smoothstep(.235, .10, length((cuv - vec2(.485, .335)) * vec2(1.15, 1.)) + (hc - .5) * .07);
  float faceD = length((cuv - vec2(.5, .33)) * vec2(1.25, 1.));
  float dsp = uDisperse * step(.45, hc) * smoothstep(.2, .75, (cuv.x - .5) * 1.7 + (.3 - cuv.y) * 2.3 + (hc - .45) * .5) * smoothstep(.13, .2, faceD) * (1. - heroWin);
  pos += dsp * vec2(.035 + .13 * h21(cell + 2.), -.03 - .15 * h21(cell + 7.)) * (.78 + .22 * sin(uTime * .35 + hc * 6.28));

  // particles: what melted lifts off the puddle, what was still standing loosens in place
  vec2 jit = (aSeed.yz - .5) * cs * 1.7 + .0035 * vec2(sin(uTime * .9 + hs * 40.), cos(uTime * .7 + hs * 31.));
  vec2 pud = vec2(.5 + (cuv.x - .5) * .8 + (aSeed.y - .5) * .07, FLOOR + .002 + .016 * aSeed.z);
  vec2 start = mix(home + (aSeed.yz - .5) * vec2(.07, .05), pud, gone);
  float g2 = gat * gat * (3. - 2. * gat);
  vec2 fly = mix(start, home + jit, g2);
  fly.x += sin(g2 * 5. + hs * 30. + uTime * .3) * .03 * (1. - g2) * g2 * 4.;
  fly.y -= (1. - g2) * g2 * (.05 + .1 * aSeed.w) * gone;
  fly = mix(fly, home, snap);
  vec2 dp = (fly - uPtr) * vec2(ASPECT, 1.);
  fly += normalize(dp + 1e-5) / vec2(ASPECT, 1.) * .04 * exp(-dot(dp, dp) / .004) * (1. - snap);
  pos = mix(pos, fly, free);

  // bricks: the course loosens and hovers, then drops home from the base up
  float back = land - 1.;
  float seat = 1. + 2.2 * back * back * back + 1.2 * back * back;   // overshoots, then seats
  float hov = st * (1. - seat);
  float bump = land * (1. - land) * 4.;
  vec2 off = vec2((bh - .5) * .012, -(max(.75 - bC.y, 0.) * .1 + .0035 * bh2)) * hov;   // an exploded view: every course lifts clear of the one below
  off += hov * .005 * vec2(sin(uTime * .8 + bh * 20.), cos(uTime * .6 + bh * 14.));
  vec2 bp = (bC + off - uPtr) * vec2(ASPECT, 1.);
  off += normalize(bp + 1e-5) / vec2(ASPECT, 1.) * .03 * exp(-dot(bp, bp) / .006) * hov;
  float ang = (bh - .5) * .16 * hov;
  vec2 rel = (pos - bC) * vec2(ASPECT, 1.);
  pos += (rot(ang) * rel * (1. + .1 * bump * st) - rel) / vec2(ASPECT, 1.) + off;

  float lum = dot(real.rgb, LUMA);
  float wPoint = free * (1. - kg);
  float size = mix(1., (.75 + .9 * lum + .7 * aSeed.w) * (1.1 + uSmall * .5), wPoint);
  size *= mix(1. - gone, 1., free) * (1. - .35 * dsp);

  vec2 hf = cs / (2. * uSub);
  vec2 corner = (cell * uSub + sub + aCorner * .5 + .5) / (uGrid * uSub);   // shared bit for bit with its neighbours
  vec2 cr = aCorner * hf * (size - 1.);
  if (ang != 0.) cr += rot(ang) * (aCorner * hf * size * vec2(ASPECT, 1.)) / vec2(ASPECT, 1.) - aCorner * hf * size;
  vec2 px = uCenter + (corner + (pos - home) + cr - .5) * vec2(uScale * ASPECT, uScale);
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);

  vQ = (sub + aCorner * .5 + .5) / uSub;
  vP = aCorner;
  vCell = cell;
  vReal = real; vLego = lego;
  vPair = vec4(pr.rgb, pow(smoothstep(.02, .84, dot(pr.rgb, LUMA)), 1.1) * pr.a);
  vW1 = vec4(wPoint, kg * free, fill, cube);
  vW2 = vec4(st, smoothstep(.72, 1., land), so, ph);
  vW3 = vec4(heroWin, bump * st, dsp, gat);
  vBrick = vec4(s0 * 2., (s1 - s0) * 2., bh, hov);
}`;

const CELL_FS = COMMON + `
in vec2 vQ; in vec2 vP;
flat in vec2 vCell;
flat in vec4 vReal, vLego, vPair, vW1, vW2, vW3, vBrick;
out vec4 o;

float sdBox(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }

// a few degrees of head turn from a flat picture: the face sits proud of the shoulders
vec2 turn(vec2 uv){
  vec2 d = (uv - vec2(.5, .34)) / vec2(.2, .23);
  float depth = exp(-dot(d, d) * 1.6);
  uv.x -= uTurn * .02 * depth;
  vec2 e1 = uv - vec2(.4382, .3062), e2 = uv - vec2(.5618, .3188);
  float eyes = exp(-dot(e1, e1) / .00011) + exp(-dot(e2, e2) / .00011);
  uv.x -= uTurn * .0035 * eyes;
  return uv;
}

void main(){
  vec2 q = vQ;
  vec2 uv = (vCell + q) / uGrid;
  float wPoint = vW1.x, kg = vW1.y, fill = vW1.z, cube = vW1.w;
  float st = vW2.x, win = vW2.y, so = vW2.z, ph = vW2.w;

  // ---- the cell as a lit square
  vec3 cR = floor(vivid(vReal.rgb) * 9. + .5) / 9.;
  float lumC = dot(vReal.rgb, LUMA);
  float inset = .055 * (1. - cube);
  vec2 dq = min(q, 1. - q) - inset;
  float sq = clamp(min(dq.x, dq.y) * uCellPx + .5, 0., 1.);
  float tl = max(step(q.x, .15), step(q.y, .15)), br = max(step(.85, q.x), step(.85, q.y));
  float hgt = h21(vCell + 21.) * .55 + lumC * .45;
  float hUp = h21(vCell + vec2(-1., -1.) + 21.) * .55;
  vec3 col = cR * (.94 + .12 * h21(vCell));
  col *= 1. + (.22 * tl * (1. - br) - .30 * br) * (.8 + .5 * cube);
  col *= 1. + cube * ((hgt - .45) * .5 - .28 * smoothstep(.0, .35, hUp - hgt * .55) * smoothstep(.5, .0, min(q.x, q.y)));
  float face = 1. - cube * (.12 + .14 * hgt);
  float sideR = step(face, q.x) * step(q.y - face, q.x - face), sideB = step(face, q.y) * (1. - sideR);
  col *= 1. - cube * (sideR * .42 + sideB * .62);
  // wet shine while it melts
  col += uLiquid * .16 * smoothstep(.75, 1., vnoise(uv * vec2(90., 60.) + uTime * .05)) * (1. - wPoint);
  float lift = smoothstep(.09, 0., length((uv - uPtr) * vec2(ASPECT, 1.))) * (1. - st);
  col *= 1. + lift * .45;
  float cov = sq;
  float alpha = smoothstep(.3, .6, vReal.a);

  // ---- as a glyph: two stacked cells share one character
  if (kg > .001){
    float l = vPair.a;
    float idx = floor(l * (uGlyphN - 1.) + .5);
    vec2 pc = vec2(vCell.x, floor(vCell.y * .5));
    if (h21(pc + floor(uTime * 7.)) > .99) idx = floor(h21(pc + uTime) * uGlyphN);
    vec2 gq = vec2(clamp(q.x, 0., 1.), (clamp(q.y, 0., 1.) + mod(vCell.y, 2.)) * .5);
    vec2 at = texture(uAtlas, vec2((idx + gq.x * .94 + .03) / uGlyphN, gq.y)).rg;
    float swell = smoothstep(.5 - fill * .7, .58 - fill * .7, at.g);
    float gc = max(mix(at.r, swell, smoothstep(0., .2, fill)), smoothstep(.5, 1., fill) * sq);
    gc *= mix(step(.03, l), 1., fill);
    vec3 gcol = mix(BONE, vivid(vPair.rgb) * 2.1, .5) * (.74 + .62 * l);
    float scan = (uv.y - fract(uTime * .06) * .7) * 26.;
    gcol *= 1. + .9 * exp(-scan * scan) * (1. - fill);
    col = mix(col, mix(gcol, col, smoothstep(.0, .42, fill)), kg);
    cov = mix(cov, gc, kg * (1. - smoothstep(.95, 1., fill)));
    alpha = mix(alpha, smoothstep(.3, .6, mix(vPair.a / max(l, 1e-3) * step(1e-3, l), vReal.a, fill)), 0.);
  }

  // ---- as a free point of light
  if (wPoint > .001){
    float disc = smoothstep(1., .12, length(vP));
    vec3 pcol = (vivid(vReal.rgb) * .95 + vec3(.05, .07, .16)) * (.5 + .7 * lumC);
    col = mix(col, pcol, wPoint);
    cov = mix(cov, disc, wPoint);
    alpha = mix(alpha, smoothstep(.3, .6, vReal.a) * (.3 + .7 * vW3.w), wPoint);
  }

  // ---- as part of a brick, seen from the side with its studs on top
  if (st > .001){
    float len = vBrick.y;
    vec2 bs = vec2(len, 2.) * uCellPx;
    vec2 bp = vec2(vCell.x + q.x - vBrick.x, mod(vCell.y, 2.) + q.y) * uCellPx;
    float sh = bs.y * .17, unit = 2. * uCellPx, e = uCellPx * .1;   // e: every edge detail scales with the brick
    float dBody = sdBox(bp - vec2(bs.x * .5, (bs.y + sh) * .5), vec2(bs.x * .5 - .35 * e, (bs.y - sh) * .5 - .35 * e), 1.2 * e);
    float dStud = sdBox(vec2(mod(bp.x, unit) - unit * .5, bp.y - sh * .6), vec2(unit * .28, sh * .55), .9 * e);
    float d = min(dBody, dStud);
    vec3 pl = vLego.rgb * 1.06 + .01;
    float gy = (bp.y - sh) / (bs.y - sh);
    pl *= mix(1.1, .84, clamp(gy, 0., 1.));
    pl += .26 * smoothstep(1.6 * e, .3 * e, abs(dBody + 1.3 * e)) * step(bp.y, bs.y * .5) * step(dBody, 0.);
    pl *= 1. - .3 * smoothstep(1.8 * e, .0, -dBody) * step(bs.y * .6, bp.y);
    if (dStud < dBody) pl = vLego.rgb * (1.16 - .3 * smoothstep(-.2, 1., (bp.y - sh * .2) / sh)) + .05;
    float sweep = (bp.x + bp.y * .7) / (bs.x + bs.y * .7) - .5 - (uPtr.x - .5) * .8 + (vBrick.z - .5) * .6 + sin(uTime * .25) * .2;
    pl += .34 * exp(-sweep * sweep * 22.) * step(dBody, 0.);
    float bcov = clamp(.5 - d / max(e, .6), 0., 1.);
    col = mix(col, pl, st);
    cov = mix(cov, bcov, st);
    alpha = mix(alpha, smoothstep(.3, .6, vLego.a), st);
  }
  col *= 1. + vW3.y * .5;

  // ---- as a window on a picture: the Lego build, then felt, then the photograph
  float a = alpha * cov;
  if (win > .001){
    vec4 lg = texP(uLego, uv, uLod);
    vec3 wc = lg.rgb;
    float wa = lg.a;
    if (so > .001){
      vec2 fuv = turn(uv);
      float th = vnoise(fuv * vec2(7., 9.)) * 6.283;
      float fib = vnoise(rot(th) * (fuv * vec2(1150., 1720.)) * vec2(1., .16));
      float fine = vnoise(fuv * vec2(2300., 3400.));
      float fuzz = (1. - ph) * smoothstep(.15, .9, so);
      vec2 off = (vec2(fib, fine) - .5) * .0075 * fuzz;
      vec4 ft = texP(uFelt, fuv + off * .35, uLod);
      float fa = texP(uFelt, fuv + off, uLod + 1.).a;
      // raking light picks the fibres out, and follows the pointer
      vec2 e = vec2(2.2 / 1280., 2.2 / 1920.);
      vec2 gr = vec2(dot(texP(uFelt, fuv + vec2(e.x, 0.), uLod).rgb - texP(uFelt, fuv - vec2(e.x, 0.), uLod).rgb, LUMA),
                     dot(texP(uFelt, fuv + vec2(0., e.y), uLod).rgb - texP(uFelt, fuv - vec2(0., e.y), uLod).rgb, LUMA)) * 4.;
      vec2 ld = normalize(vec2(uPtr.x - .5, uPtr.y - .31) + vec2(-.35, -.45));
      vec3 fc = ft.rgb * (1. + clamp(dot(gr, -ld) * .9, -.35, .45));
      fc *= 1. + ((fib - .5) * .42 + (fine - .5) * .2) * fuzz;
      fc += .05 * smoothstep(.72, 1., fib) * fuzz;
      float fmix = smoothstep(.08, .92, so);
      wc = mix(wc, fc, fmix);
      wa = mix(wa, fa, fmix);
      if (ph > .001){
        vec4 rl = texP(uReal, uv, uLod);
        wc = mix(wc, rl.rgb, ph);
        wa = mix(wa, rl.a, ph);
      }
    }
    col = mix(col, wc, win);
    a = mix(a, wa, win);
  }

  // ---- hero: his real face shows through where the pixels have not taken over yet
  if (vW3.x > .001){
    vec4 rl = texP(uReal, uv, uLod);
    vec3 face = rl.rgb * (.96 + .04 * sq);
    col = mix(col, face, vW3.x * (1. - wPoint));
    a = mix(a, rl.a, vW3.x * (1. - wPoint));
  }

  a *= 1. - smoothstep(uBust - .075, uBust, uv.y);
  a *= smoothstep(0., .04, uv.x) * smoothstep(1., .96, uv.x);
  o = vec4(col * a, a * (1. - wPoint * .55));
}`;

const QUAD_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

const BACK_FS = COMMON + `
uniform float uGlow;
out vec4 o;
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (px - uCenter) / vec2(uScale * ASPECT, uScale) + .5;
  vec2 gq = (uv - vec2(.5, .36)) * vec2(ASPECT * 1.45, 1.);
  o = vec4(mix(DEEP, BLUE, .35), 1.) * .10 * uGlow * exp(-dot(gq, gq) * 6.5);
}`;

const LIQUID_FS = COMMON + `
uniform vec4 uDrip[${DRIPS}];    // u, root v, length, radius
uniform vec4 uDripB[${DRIPS}];   // neck, droplet v, droplet radius, stream
uniform vec4 uRipple[4];         // u, age, strength
uniform float uPuddle;
out vec4 o;

float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }

float drips(vec2 P){
  float d = 1e3, keep = 1. - uDrain;
  for (int i = 0; i < ${DRIPS}; i++){
    vec4 A = uDrip[i], B = uDripB[i];
    if (A.w <= 0. || keep < .03) continue;
    float fi = float(i);
    float y0 = A.y - .012, y1 = A.y + A.z;
    float t = clamp((P.y - y0) / max(y1 - y0, 1e-4), 0., 1.);
    // a stream sways a little on its way down and pinches where it is about to let go
    float x = A.x * ASPECT + sin(t * 5. + uTime * .6 + fi * 2.1) * .0022 * B.w * t;
    float r = A.w * mix(1.35, .46, smoothstep(0., .38, t)) * keep;
    r *= 1. - B.x * exp(-pow((t - .62) / .16, 2.));
    r *= 1. + B.w * (.24 * sin(t * 13. - uTime * 2.4 + fi * 1.7) + .5 * smoothstep(.9, 1., t));
    float stem = length(P - vec2(x, mix(y0, y1, t))) - r;
    float tip = length((P - vec2(x, y1)) * vec2(1., .8)) - A.w * mix(1.05, .5, B.w) * keep;
    float dd = smin(stem, tip, .008);
    if (B.y > 0.) dd = min(dd, length((P - vec2(A.x * ASPECT, B.y)) * vec2(1., .78)) - B.z);
    d = smin(d, dd, .006);
  }
  return d;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (px - uCenter) / vec2(uScale * ASPECT, uScale) + .5;
  vec2 P = vec2(uv.x * ASPECT, uv.y);
  float cut = cutLine(uv.x);
  float side = smoothstep(.015, .09, uv.x) * smoothstep(.985, .91, uv.x);

  // the lip of goo along the ragged edge of what is left of him: thin, uneven, heavy where a drip hangs
  float sil = texP(uReal, vec2(uv.x, min(uv.y, cut - .004)), 4.6).a;
  float lump = vnoise(vec2(uv.x * 26., uTime * .05)) * .7 + vnoise(vec2(uv.x * 61., 3.)) * .3;
  float bandH = (.006 + .011 * uMelt) * (.35 + 1.3 * lump) * (1. - uDrain) * side * smoothstep(.42, .9, sil);
  float dBand = max(max(cut - bandH - uv.y, uv.y - cut - .003), (.5 - sil) * .03) - .0035;
  dBand = mix(1e3, dBand, step(.0005, bandH));
  float dDrip = drips(P);
  float d = smin(dBand, dDrip, .011);

  // the puddle, seen low across the floor
  vec2 pc = vec2(.5 * ASPECT, FLOOR + .016);
  vec2 pr = vec2(.05 + .24 * uPuddle, .0045 + .0135 * uPuddle) * step(.004, uPuddle);
  vec2 pe = (P - pc) / max(pr, vec2(1e-4));
  float ang = atan(pe.y, pe.x);
  float dP = (length(pe) - 1. - .06 * sin(ang * 5. + 1.) - .045 * sin(ang * 9. + uTime * .2) - .03 * sin(ang * 3. - .6)) * pr.y;
  dP = mix(1e3, dP, step(.004, uPuddle));
  float dAll = smin(d, dP, .013);

  float isPuddle = smoothstep(.003, -.003, dP - d);
  float R = mix(.0078, .0045, isPuddle);
  float inside = clamp(-dAll / R, 0., 1.);
  float hgt = sqrt(1. - (1. - inside) * (1. - inside)) * R * uScale;
  vec3 N = normalize(vec3(-dFdx(hgt), -dFdy(hgt), 1.));
  float aa = clamp(.5 - dAll * uScale, 0., 1.);

  // goo takes the colour of what is melting right above it; the puddle is all of it stirred together
  vec3 above = vivid(texP(uReal, vec2(uv.x, cutLine(uv.x) - .028), 4.2).rgb);
  float swirl = vnoise(vec2(uv.x * 7. + uTime * .015, uv.y * 90.)) - .5;
  float pu = .5 + (uv.x - .5) * .55 + swirl * .16;
  vec3 pool = vivid(texP(uReal, vec2(pu, .625 + swirl * .03), 4.6).rgb);
  vec3 base = mix(above * 1.05 + vec3(.01, .015, .04), pool * .62, isPuddle);

  vec3 L = normalize(vec3(-.5, .62, .6)), H = normalize(L + vec3(0., 0., 1.));
  float diff = .5 + .5 * dot(N, L);
  float nh = max(dot(N, H), 0.);
  float spec = pow(nh, 80.) * 1.25 + pow(nh, 10.) * .14;
  float rim = pow(1. - N.z, 2.2);
  vec3 col = base * (.32 + .86 * diff) + spec * vec3(1.) + rim * mix(BLUE, vec3(1.), .45) * .4;

  // puddle gloss: long glints, the streams mirrored in it, rings where a drop lands
  float inP = isPuddle * smoothstep(0., -.003, dP);
  float gl = smoothstep(.7, 1., vnoise(vec2(uv.x * 8. + uTime * .02, uv.y * 230.)));
  float mir = smoothstep(.003, -.002, drips(vec2(P.x, 2. * (FLOOR + .004) - P.y)));
  float rings = 0.;
  for (int i = 0; i < 4; i++){
    vec4 rp = uRipple[i];
    float rr = length((P - vec2(rp.x * ASPECT, FLOOR + .016)) / vec2(1., .2)) - rp.y * .045;
    rings += rp.z * sin(rr * 380.) * exp(-pow(rr / .013, 2.)) * exp(-rp.y * 1.5);
  }
  col += inP * (gl * .2 + mir * .42 * (above + .05) + rings * .4);
  col += inP * mix(BLUE, vec3(1.), .5) * .16 * smoothstep(.55, 1., length(pe)) * step(pe.y, 0.);

  // the floor: a faint sheen under him, and the streams reflected past the puddle's edge
  float fl = smoothstep(FLOOR - .004, FLOOR + .008, uv.y);
  float sheen = exp(-pow((uv.x - .5) / .42, 2.)) * exp(-(uv.y - FLOOR) * 9.) * fl;
  vec3 floorCol = mix(DEEP, BLUE, .3) * .08 * sheen + mir * fl * .13 * above * exp(-(uv.y - FLOOR) * 24.);
  floorCol += BLUE * .045 * exp(-pow((uv.y - FLOOR + .002) / .0016, 2.)) * exp(-pow((uv.x - .5) / .5, 2.));

  vec4 liquid = vec4(col, 1.) * aa;
  o = (liquid + vec4(floorCol, 0.) * (1. - liquid.a)) * uLiquid;
}`;

// loose pieces: cubes while he is pixels, bricks while he is Lego. Ray-traced boxes with studs.
const FLOAT_VS = COMMON + `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aA;   // home u, home v, depth, seed
layout(location = 2) in vec4 aB;   // size, colour pick, fall flag, phase
uniform float uFloat, uBrick;
out vec2 vP; flat out vec4 vA; flat out vec4 vB; flat out vec3 vCol; flat out float vLife;
void main(){
  float s = aA.w, depth = aA.z;
  vec2 c = aA.xy;
  float life = 1.;
  if (aB.z > .5){
    // a cube that lets go at the melt line, tumbles, lands in the puddle and sinks
    float cyc = fract(uTime * (.05 + .03 * s) + aB.w);
    float y0 = cutLine(c.x) - .01, fallT = clamp((cyc - .25) / .3, 0., 1.);
    float y = mix(y0, FLOOR + .012, fallT * fallT);
    float slide = smoothstep(0., .25, cyc) * .012;
    c = vec2(c.x + (s - .5) * .05 * fallT, min(y + slide, FLOOR + .012));
    life = smoothstep(0., .08, cyc) * (1. - smoothstep(.72, .98, cyc)) * uLiquid * step(.1, texP(uReal, vec2(aA.x, y0 - .02), 4.).a);
    c.y += smoothstep(.6, 1., cyc) * .012;
  } else {
    c.y = fract(c.y - uTime * .004 * depth) * .66 + .03;
    c += (uPtr - .5) * depth * .05 + vec2(sin(uTime * .31 + s * 40.), cos(uTime * .27 + s * 23.)) * .008;
    vec2 dp = (c - uPtr) * vec2(ASPECT, 1.);
    c += normalize(dp + 1e-5) / vec2(ASPECT, 1.) * .05 * exp(-dot(dp, dp) / .012);
    life = smoothstep(.03, .1, c.y) * (1. - smoothstep(.6, .69, c.y));
  }
  float size = aB.x * (.6 + .4 * depth) * mix(1., 1.9, uBrick * step(aB.z, .5)) * uFloat * life;
  vec2 px = uCenter + (c - .5) * vec2(uScale * ASPECT, uScale) + aCorner * size * uScale;
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);
  vP = aCorner; vA = aA; vB = aB; vLife = life * (.5 + .5 * depth);
  vec3 photo = vivid(texP(uReal, vec2(aA.x, cutLine(aA.x) - .04), 4.).rgb);
  vec3 pick = aB.y < .5 ? DEEP * 1.25 : aB.y < .78 ? vec3(.80, .62, .42) : BONE;
  vCol = aB.z > .5 ? photo : pick;
}`;

const FLOAT_FS = COMMON + `
in vec2 vP; flat in vec4 vA; flat in vec4 vB; flat in vec3 vCol; flat in float vLife;
uniform float uBrick;
out vec4 o;

vec2 boxHit(vec3 ro, vec3 rd, vec3 b, out vec3 n){
  vec3 m = 1. / rd, k = abs(m) * b, t1 = -m * ro - k, t2 = -m * ro + k;
  float tN = max(max(t1.x, t1.y), t1.z), tF = min(min(t2.x, t2.y), t2.z);
  n = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  return vec2(tN, tF);
}
void main(){
  float s = vA.w;
  float spin = vB.z > .5 ? 2.2 : .25;
  vec3 ax = vec3(uTime * spin * (.6 + s) + s * 9., uTime * spin * .7 + s * 17., s * 4. + (uPtr.x - .5));
  mat3 Rm = mat3(1.);
  { float c = cos(ax.x), n = sin(ax.x); Rm = mat3(1., 0., 0., 0., c, n, 0., -n, c) * Rm; }
  { float c = cos(ax.y), n = sin(ax.y); Rm = mat3(c, 0., -n, 0., 1., 0., n, 0., c) * Rm; }
  { float c = cos(ax.z), n = sin(ax.z); Rm = mat3(c, n, 0., -n, c, 0., 0., 0., 1.) * Rm; }
  float brick = uBrick * step(vB.z, .5);
  vec3 b = mix(vec3(.5), vec3(.62, .3, .31), brick);
  vec3 ro = Rm * vec3(vP * 1.05, 3.), rd = Rm * vec3(0., 0., -1.);
  vec3 n; vec2 t = boxHit(ro, rd, b, n);
  float best = 1e3; vec3 bn = vec3(0.);
  if (t.x < t.y && t.y > 0.){ best = t.x; bn = n; }
  if (brick > .01){
    // studs: short cylinders on the top face (+y), 2 by 2
    for (int i = 0; i < 4; i++){
      vec2 c = vec2(i < 2 ? -.31 : .31, (i % 2 == 0) ? -.155 : .155);
      float r = .105, y0 = b.y, y1 = b.y + .1 * brick;
      vec2 oc = ro.xz - c; vec2 dd = rd.xz;
      float A = dot(dd, dd), B = dot(oc, dd), C = dot(oc, oc) - r * r, disc = B * B - A * C;
      if (disc > 0. && A > 1e-6){
        float tt = (-B - sqrt(disc)) / A; float y = ro.y + rd.y * tt;
        if (tt > 0. && y > y0 && y < y1 && tt < best){ best = tt; bn = normalize(vec3(oc.x + dd.x * tt, 0., oc.y + dd.y * tt)); }
      }
      if (abs(rd.y) > 1e-5){
        float tt = (y1 - ro.y) / rd.y; vec2 h = ro.xz + rd.xz * tt - c;
        if (tt > 0. && dot(h, h) < r * r && tt < best){ best = tt; bn = vec3(0., 1., 0.); }
      }
    }
  }
  if (best > 999.){ o = vec4(0.); return; }
  vec3 nw = transpose(Rm) * bn;
  vec3 L = normalize(vec3(-.5, .7, .62));
  float diff = max(dot(nw, L), 0.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(nw, H), 0.), mix(18., 60., brick)) * mix(.25, .7, brick);
  vec3 col = vCol * (.28 + .85 * diff) + spec + BLUE * .12 * pow(1. - abs(nw.z), 2.);
  o = vec4(col, 1.) * vLife;
}`;

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
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

function texture(gl, unit, source, mips) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}

// red: the glyph. green: the same glyph spread wide, so a character can swell into a solid cell
async function glyphAtlas() {
  try { await document.fonts.load('700 40px "Space Mono"'); } catch { /* falls back to monospace */ }
  const w = 32, h = 64, n = GLYPHS.length;
  const draw = (spread) => {
    const c = document.createElement('canvas');
    c.width = w * n; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, h);
    x.fillStyle = '#fff'; x.font = '700 50px "Space Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [...GLYPHS].forEach((ch, i) => {
      x.save(); x.beginPath(); x.rect(i * w, 0, w, h); x.clip();
      if (!spread) x.fillText(ch, i * w + w / 2, h / 2 + 2);
      else {
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.05;
        for (let k = 0; k < 40; k++) { const a = k * 2.399, r = 11 * Math.sqrt((k + 0.5) / 40); x.fillText(ch, i * w + w / 2 + Math.cos(a) * r, h / 2 + 2 + Math.sin(a) * r * 1.5); }
      }
      x.restore();
    });
    return x.getImageData(0, 0, c.width, h);
  };
  const sharp = draw(false), wide = draw(true);
  for (let i = 0; i < sharp.data.length; i += 4) { sharp.data[i + 1] = wide.data[i]; sharp.data[i + 3] = 255; }
  return sharp;
}

// every cell that any version of him covers, each split into sub by sub movable pieces
function buildCells(images, cols, sub) {
  const rows = Math.round(cols / ASPECT), used = Math.ceil(rows * VMAX);
  const c = document.createElement('canvas');
  c.width = cols; c.height = used;
  const x = c.getContext('2d', { willReadFrequently: true });
  const any = new Uint8Array(cols * used);
  const mattes = images.map((img) => {
    const half = img.naturalWidth / 2;
    x.clearRect(0, 0, cols, used);
    x.drawImage(img, half, 0, half, img.naturalHeight, 0, 0, cols, used);
    const d = x.getImageData(0, 0, cols, used).data;
    for (let i = 0; i < any.length; i++) if (d[i * 4] > 10) any[i] = 1;
    return d;
  });
  const keep = [];
  for (let j = used - 1; j >= 0; j--) for (let i = 0; i < cols; i++) {
    let on = 0;
    for (let dj = -1; dj <= 1 && !on; dj++) for (let di = -1; di <= 1 && !on; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < cols && jj < used && any[jj * cols + ii]) on = 1;
    }
    if (on) keep.push(i, j);
  }
  const count = keep.length / 2 * sub * sub;
  const cell = new Float32Array(count * 4), seed = new Float32Array(count * 4);
  let k = 0;
  for (let n = 0; n < keep.length; n += 2) for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
    cell.set([keep[n], keep[n + 1], sx, sy], k * 4);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], k * 4);
    k++;
  }
  const real = mattes[0];
  const matteAt = (u, v) => { const i = Math.min(cols - 1, Math.max(0, u * cols | 0)), j = v / VMAX * used | 0; return j >= 0 && j < used ? real[(j * cols + i) * 4] / 255 : 0; };
  return { cell, seed, count, rows, matteAt };
}

function instanced(gl, streams) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  streams.forEach((data, i) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(i + 1);
    gl.vertexAttribPointer(i + 1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(i + 1, 1);
  });
  gl.bindVertexArray(null);
  return vao;
}

export async function createStage(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const cellProg = program(gl, CELL_VS, CELL_FS), backProg = program(gl, QUAD_VS, BACK_FS);
  const liquidProg = program(gl, QUAD_VS, LIQUID_FS), floatProg = program(gl, FLOAT_VS, FLOAT_FS);
  const [real, lego, felt, atlas] = await Promise.all([
    loadImage('assets/stage/real.jpg'), loadImage('assets/stage/lego.jpg'), loadImage('assets/stage/felt.jpg'), glyphAtlas(),
  ]);
  texture(gl, 0, real, true); texture(gl, 1, lego, true); texture(gl, 2, felt, true); texture(gl, 3, atlas, false);

  const small = matchMedia('(max-width: 820px)').matches;
  const cols = small ? 72 : 104, sub = small ? 2 : 3;
  const grid = buildCells([real, lego, felt], cols, sub);
  const cellVao = instanced(gl, [grid.cell, grid.seed]);

  const fa = new Float32Array(FLOATERS * 4), fb = new Float32Array(FLOATERS * 4);
  for (let i = 0; i < FLOATERS; i++) {
    const falling = i >= FLOATERS - 12, side = Math.random() < 0.5 ? -1 : 1;
    const u = falling ? 0.18 + 0.64 * Math.random() : 0.5 + side * (0.2 + 0.3 * Math.random());
    fa.set([u, Math.random(), 0.35 + 0.65 * Math.random(), Math.random()], i * 4);
    fb.set([falling ? 0.0075 + 0.004 * Math.random() : 0.008 + 0.014 * Math.random(), Math.random(), falling ? 1 : 0, Math.random()], i * 4);
  }
  const floatVao = instanced(gl, [fa, fb]);

  // drips are simulated here so they can grow, neck, let go and land; the shader only draws them
  const drip = Array.from({ length: DRIPS }, (_, i) => ({
    u: 0.1 + 0.8 * (i + 0.5 + (Math.random() - 0.5) * 0.7) / DRIPS, len: Math.random() * 0.02, neck: 0, rad: 0.0042 + Math.random() * 0.0045,
    max: 0.022 + Math.random() * 0.035, rate: 0.006 + Math.random() * 0.01, stream: Math.random() * 0.95 + 0.12, dropV: -1, dropVel: 0, dropR: 0, wait: Math.random() * 3,
  }));
  const ripples = [0, 0, 0, 0].map(() => ({ u: 0.5, age: 9, k: 0 }));
  let ripIndex = 0;
  const dripA = new Float32Array(DRIPS * 4), dripB = new Float32Array(DRIPS * 4), ripData = new Float32Array(16);
  const cutLine = (u, t, m) => 0.648 - 0.078 * m + (Math.sin(u * 21 + 1.3) * 0.5 + Math.sin(u * 47 + t * 0.11) * 0.3 + Math.sin(u * 9 - 0.7) * 0.6) * (0.009 + 0.009 * m);

  function stepDrips(dt, t, m, live) {
    drip.forEach((d, i) => {
      const root = cutLine(d.u, t, m), reach = FLOOR + 0.012 - root;
      const on = grid.matteAt(d.u, root - 0.02) > 0.5 && root < FLOOR - 0.01;
      const isStream = m > d.stream;
      if (live) {
        if (isStream) { d.len += (reach - d.len) * Math.min(1, dt * 1.2); d.neck *= 0.9; }
        else if (d.wait > 0) d.wait -= dt;
        else if (d.neck > 0 || d.len >= Math.min(d.max * (0.7 + m * 0.6), reach * 0.8)) {
          d.neck += dt * 1.1;
          d.len += d.rate * dt * 0.6;
          if (d.neck >= 1) { d.dropV = root + d.len; d.dropVel = 0.02; d.dropR = d.rad * 0.95; d.len *= 0.35; d.neck = 0; d.wait = 0.4 + Math.random() * 2.5; }
        } else d.len += d.rate * dt * (0.6 + m);
        if (d.dropV > 0) {
          d.dropVel += 0.55 * dt; d.dropV += d.dropVel * dt;
          if (d.dropV > FLOOR + 0.01) { d.dropV = -1; const r = ripples[ripIndex++ % 4]; r.u = d.u; r.age = 0; r.k = 1; }
        }
      }
      d.len = Math.min(d.len, reach);
      dripA.set([d.u, root, d.len, on ? d.rad * (isStream ? 0.8 : 1) : 0], i * 4);
      dripB.set([Math.min(1, d.neck), on ? d.dropV : -1, d.dropR, isStream ? Math.min(1, (d.len / reach - 0.85) / 0.15) : 0], i * 4);
    });
    ripples.forEach((r, i) => { if (live) r.age += dt; ripData.set([0.5 + (r.u - 0.5) * 0.62, r.age, r.k, 0], i * 4); });
  }

  const view = {
    cx: 0.7, cy: 0.61, scale: 1.3, bust: 0.8, glow: 1,
    melt: 0.28, liquid: 1, drain: 0, hero: 1, disperse: 1, free: 0, gather: 0, snap: 0, glyph: 0, fill: 0, cube: 0, stud: 0, build: 0, soft: 0, photo: 0,
    floaters: 1, brick: 0, puddle: 0.3, turn: 0,
  };
  const ptr = { x: 0.1, y: -0.35, tx: 0.1, ty: -0.35 }; // parked off the figure until the pointer moves
  let dpr = 1, frozenTime = null, running = true, t0 = performance.now(), last = t0, turnEase = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function shared(u, time, W, H, cx, cy, scale) {
    gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uCenter, cx, cy); gl.uniform2f(u.uPtr, ptr.x, ptr.y);
    gl.uniform2f(u.uGrid, cols, grid.rows);
    gl.uniform1f(u.uTime, time); gl.uniform1f(u.uScale, scale); gl.uniform1f(u.uSub, sub);
    const texelsPerPx = 1280 / (scale * ASPECT);
    gl.uniform1f(u.uLod, Math.max(0, Math.log2(texelsPerPx)));
    gl.uniform1f(u.uCellLod, Math.max(0, Math.log2(1280 / cols) - 0.4));
    gl.uniform1f(u.uCellPx, scale * ASPECT / cols);
    gl.uniform1f(u.uGlyphN, GLYPHS.length); gl.uniform1f(u.uBust, view.bust); gl.uniform1f(u.uSmall, small ? 1 : 0);
    for (const k of ['melt', 'liquid', 'drain', 'hero', 'disperse', 'free', 'gather', 'snap', 'glyph', 'fill', 'cube', 'stud', 'build', 'soft', 'photo']) {
      gl.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], view[k]);
    }
    gl.uniform1f(u.uTurn, turnEase);
    gl.uniform1i(u.uReal, 0); gl.uniform1i(u.uLego, 1); gl.uniform1i(u.uFelt, 2); gl.uniform1i(u.uAtlas, 3);
  }

  function frame(now) {
    if (!running) return;
    resize();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
    turnEase += (view.turn - turnEase) * 0.07;
    const time = frozenTime ?? (now - t0) / 1000;
    const W = canvas.width, H = canvas.height, scale = view.scale * H;
    const cx = view.cx * W + (ptr.x - 0.5) * -10 * dpr, cy = view.cy * H + (ptr.y - 0.3) * -6 * dpr;

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(backProg.p);
    shared(backProg.u, time, W, H, cx, cy, scale);
    gl.uniform1f(backProg.u.uGlow, view.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(cellProg.p);
    shared(cellProg.u, time, W, H, cx, cy, scale);
    gl.bindVertexArray(cellVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, grid.count);

    if (view.liquid > 0.003) {
      stepDrips(dt, time, view.melt, frozenTime === null);
      gl.useProgram(liquidProg.p);
      shared(liquidProg.u, time, W, H, cx, cy, scale);
      gl.uniform4fv(liquidProg.u.uDrip, dripA); gl.uniform4fv(liquidProg.u.uDripB, dripB); gl.uniform4fv(liquidProg.u.uRipple, ripData);
      gl.uniform1f(liquidProg.u.uPuddle, view.puddle);
      // only the band of the frame that can hold goo or floor
      const top = Math.max(0, Math.round(H - (cy + (FLOOR + 0.12 - 0.5) * scale))), bottom = Math.min(H, Math.round(H - (cy + (0.36 - 0.5) * scale)));
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, top, W, Math.max(1, bottom - top));
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }

    if (view.floaters > 0.003) {
      gl.useProgram(floatProg.p);
      shared(floatProg.u, time, W, H, cx, cy, scale);
      gl.uniform1f(floatProg.u.uFloat, view.floaters); gl.uniform1f(floatProg.u.uBrick, view.brick);
      gl.bindVertexArray(floatVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, FLOATERS);
    }
    gl.bindVertexArray(null);
    requestAnimationFrame(frame);
  }

  addEventListener('pointermove', (e) => {
    const scale = view.scale * innerHeight;
    ptr.tx = (e.clientX - view.cx * innerWidth) / (scale * ASPECT) + 0.5;
    ptr.ty = (e.clientY - view.cy * innerHeight) / scale + 0.5;
  }, { passive: true });

  const api = {
    view, small,
    // where a point of the portrait frame sits on screen, in CSS pixels
    place(u, v) { const s = view.scale * innerHeight; return [view.cx * innerWidth + (u - 0.5) * s * ASPECT, view.cy * innerHeight + (v - 0.5) * s]; },
    setRunning(on) { if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!on) running = false; },
    setMotion(on) { frozenTime = on ? null : 12.5; },
  };
  document.addEventListener('visibilitychange', () => api.setRunning(!document.hidden));
  requestAnimationFrame(frame);
  return api;
}

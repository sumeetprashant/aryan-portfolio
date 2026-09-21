// The portrait stage. One fixed WebGL2 canvas, one set of cells. Every cell has a home
// on the registered portrait (scripts/prep_stage.py) and scroll decides what it is right
// now: a pixel, a free point, part of a character, a lit cube, part of a brick, a photo
// texel. Nothing swaps; between versions the cells break into points and re-gather.

const ASPECT = 2 / 3;
const VMAX = 0.78125;
const BUST_END = 0.64;      // where the bust stops while he melts; the columns run on below it
const DRIP_ROWS = 0.92;     // how far down the frame the melt may reach
const GLYPHS = ' .,:;~-=+*xo#%@';
const DIGITS = ' .,:;1732459608';   // the same ramp in numbers, for the forecasting chapter
const FLOATERS = 34;

const COMMON = `#version 300 es
precision highp float;
precision highp int;
const float ASPECT = ${ASPECT.toFixed(7)};
const float VMAX = ${VMAX.toFixed(5)};
const float BUST_END = ${BUST_END.toFixed(3)};
const vec3 LUMA = vec3(.299, .587, .114);
const vec3 BLUE = vec3(.482, .576, .96);
const vec3 DEEP = vec3(.16, .24, .72);
const vec3 BONE = vec3(.93, .92, .89);
const vec3 PEACH = vec3(.95, .68, .47);
uniform vec2 uRes, uCenter, uPtr, uGrid;
uniform vec4 uKeepA, uKeepB, uKeepC, uFeltBox;
uniform float uTime, uScale, uSub, uLod, uCellLod, uCellPx, uGlyphN, uBust, uSmall, uKeepM;
uniform float uMelt, uLiquid, uDisperse, uFree, uGather, uSnap, uGlyph, uRamp, uSolid, uStud, uBuild, uScatter, uRegather, uDust, uPhoto, uEnd, uLight;
uniform sampler2D uReal, uLego, uAtlas;

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
// the pixel look: warm, ten even levels a channel, no dither
vec3 warm(vec3 c){
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, 1.6) * vec3(1.2, 1.08, .98);
  c += smoothstep(.02, .14, c.b - c.r) * vec3(.0, .05, .30);
  return c;
}
vec3 q9(vec3 c){ return floor(clamp(c, 0., 1.) * 9. + .5) / 9.; }
// The melt, as site commit 32274e3 drew it: every column of pixels runs downward like wax, and past the
// hero the whole figure slumps with it. x: how far this column drips, y: how far it slumps, z: its roll, w: its seed
vec4 meltCol(float cx){
  float m = uMelt * smoothstep(0., .5, uLiquid);
  float cn = h11(cx + 3.1);
  float n = mix(cn, h11(floor(cx * .5) + 9.7), step(.45, h11(cx * 1.7)));
  float sag = .5 + .5 * sin(cx * .21 + 1.3) * sin(cx * .083 + .4);
  float drip = m * (.012 + .05 * sag + .34 * pow(n, 5.)) * (.88 + .12 * sin(uTime * .6 + cn * 6.28));
  float low = .5 + .5 * sin(cx * .11 + .7 + uTime * .05) * sin(cx * .047 + 2.1);
  float slump = smoothstep(.3, 1., m) * (.04 + .13 * low);
  return vec4(drip, slump, n, cn);
}
`;

const CELL_VS = COMMON + `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aCell;
layout(location = 2) in vec4 aSeed;
out vec2 vQ; out vec2 vP;
flat out vec2 vCell;
flat out vec4 vReal, vLego, vPair, vW1, vW2, vW3, vW4, vBrick;

float loc(float U, float th, float w){ float a = th * (1. - w); return smoothstep(a, a + w, U); }
bool edge(float c2, float R){ return h21(vec2(c2, R) * 1.37 + 5.) < .36 || mod(c2 + floor(h11(R + .5) * 4.), 4.) < .5; }
// 1 outside the box, 0 inside it, soft over uKeepM pixels
float outside(vec4 box, vec2 p){ return smoothstep(0., uKeepM, length(max(max(box.xy - p, p - box.zw), 0.))); }

void main(){
  vec2 cell = aCell.xy, sub = aCell.zw, cs = 1. / uGrid;
  vec2 cuv = (cell + .5) * cs;
  float hc = h21(cell + .37), hs = aSeed.x;
  float pairRow = floor(cell.y * .5);
  vec2 pairUv = vec2(cell.x + .5, pairRow * 2. + 1.) * cs;
  float hp = h21(vec2(cell.x, pairRow) + 3.1);
  float ph = step(.5, uPhoto);

  // the melt: this cell shows the pixel from further up its column
  vec4 mc = meltCol(cell.x);
  float wet = smoothstep(0., .5, uLiquid), L = mc.x + mc.y;
  float d = mc.y * smoothstep(.12, .56, cuv.y) + mc.x * smoothstep(.47, BUST_END, cuv.y);
  vec2 suv = vec2(cuv.x, cuv.y - d);
  vec4 real = texP(uReal, suv, uCellLod);
  real.a *= step(suv.y, mix(2., BUST_END, wet));
  float smear = wet * step(BUST_END, cuv.y) * smoothstep(.5, 1., (cuv.y - BUST_END) / max(L, 1e-4)) * .9;
  float drop = 0.;
  if (mc.z > .5 && uMelt * wet > .05){
    float fall = fract(uTime * (.035 + .04 * mc.w) + mc.w * 7.);
    if (cell.y == floor((BUST_END + L + fall * .2) * uGrid.y)) drop = (1. - fall) * wet;
  }
  vec4 pr = texP(uReal, pairUv, uCellLod + .5);

  // which brick this cell belongs to: courses are two cells tall, bricks 2 to 8 cells long
  float c2 = floor(cell.x * .5), s0 = c2, s1 = c2 + 1.;
  for (int k = 0; k < 4; k++){ if (edge(s0, pairRow)) break; s0 -= 1.; }
  for (int k = 0; k < 4; k++){ if (edge(s1, pairRow)) break; s1 += 1.; }
  vec2 bC = vec2(s0 + s1, pairRow * 2. + 1.) * cs;
  float bh = h21(vec2(s0, pairRow) + 11.), bh2 = h21(vec2(s0, pairRow) + 3.);
  vec4 lego = texP(uLego, bC, uCellLod + 1.);

  // local progress of every change, staggered so each one ripples through the figure
  float rise = 1. - clamp(cuv.y / .69, 0., 1.);
  float free = loc(uFree, rise * .55 + hs * .45, .4);
  float gat = loc(uGather, hs * .45 + rise * .35 + hc * .2, .45);
  float snap = loc(uSnap, hc * .5 + cuv.y * .7, .35);
  float kg = loc(uGlyph, hp * .5 + cuv.y * .7, .3);
  float centre = length((cuv - vec2(.5, .33)) * vec2(1., 1.15));
  float x3 = loc(uSolid, hp * .4 + centre * 1.1, .4);
  float fill = smoothstep(0., .6, x3), cube = smoothstep(.45, 1., x3) * (1. - ph);
  float st = loc(uStud, bh * .6 + rise * .4, .35) * (1. - ph);   // under the photograph he is plain pixels again
  float land = loc(uBuild, clamp(1. - bC.y / .75, 0., 1.) * .86 + bh * .14, .1);
  float x5 = loc(uScatter, hs * .5 + cuv.y * .6, .45);
  float x6 = loc(uRegather, hs * .45 + centre * .55, .45);

  vec2 home = (cell + (sub + .5) / uSub) * cs;
  vec2 pos = home;

  // hero, melt and the end: the top of the head lets go of a few pixels
  float heroWin = uEnd * ph * smoothstep(.235, .10, length((cuv - vec2(.485, .335)) * vec2(1.15, 1.)) + (hc - .5) * .07);
  float faceD = length((cuv - vec2(.5, .33)) * vec2(1.25, 1.));
  float dsp = uDisperse * step(.45, hc) * smoothstep(.2, .75, (cuv.x - .5) * 1.7 + (.3 - cuv.y) * 2.3 + (hc - .45) * .5) * smoothstep(.13, .2, faceD) * (1. - heroWin);
  pos += dsp * vec2(.035 + .13 * h21(cell + 2.), -.03 - .15 * h21(cell + 7.)) * (.78 + .22 * sin(uTime * .35 + hc * 6.28));

  // melt to characters: every pixel loosens into a point where it hangs, drifts, and gathers on its home
  vec2 jit = (aSeed.yz - .5) * cs * 1.7 + .0035 * vec2(sin(uTime * .9 + hs * 40.), cos(uTime * .7 + hs * 31.));
  vec2 start = home + (aSeed.yz - .5) * vec2(.07, .05) * (1. + 9. * d);
  float g2 = gat * gat * (3. - 2. * gat);
  vec2 fly = mix(start, home + jit, g2);
  fly.x += sin(g2 * 5. + hs * 30. + uTime * .3) * .03 * (1. - g2) * g2 * 4.;
  fly.y -= (1. - g2) * g2 * (.05 + .1 * aSeed.w) * step(.02, d);
  fly = mix(fly, home, snap);
  vec2 dp = (fly - uPtr) * vec2(ASPECT, 1.);
  fly += normalize(dp + 1e-5) / vec2(ASPECT, 1.) * .04 * exp(-dot(dp, dp) / .004) * (1. - snap);
  pos = mix(pos, fly, free);

  // characters to cubes: each cell jumps out as a point and lands as a solid
  float p3 = smoothstep(0., .3, x3) * (1. - smoothstep(.55, .95, x3));
  pos += (aSeed.yz - .5) * vec2(.2, .13) * sin(3.14159 * x3) * (.4 + .6 * aSeed.w);

  // bricks: every course lifts clear as loose bricks, then they drop home from the base up and pile into him
  float back = land - 1.;
  float seat = 1. + 2.2 * back * back * back + 1.2 * back * back;   // overshoots, then seats
  float hov = st * (1. - seat);
  float bump = land * (1. - land) * 4.;
  vec2 off = vec2((bh - .5) * .03, -(.05 + max(.75 - bC.y, 0.) * .2 + .03 * bh2)) * hov;
  off += hov * .005 * vec2(sin(uTime * .8 + bh * 20.), cos(uTime * .6 + bh * 14.));
  vec2 bp = (bC + off - uPtr) * vec2(ASPECT, 1.);
  off += normalize(bp + 1e-5) / vec2(ASPECT, 1.) * .03 * exp(-dot(bp, bp) / .006) * hov;
  float ang = (bh - .5) * .5 * hov;
  float p4 = hov * step(.86, hs);   // the dust the bricks shake loose
  vec2 rel = (pos - bC) * vec2(ASPECT, 1.);
  pos += (rot(ang) * rel * (1. + .1 * bump * st) - rel) / vec2(ASPECT, 1.) + off + p4 * (aSeed.yz - .5) * vec2(.09, .07);

  // the summary: everything lets go and circles the room; then it comes home as the last version of him
  float e5 = x5 * x5 * (3. - 2. * x5), e6 = x6 * x6 * (3. - 2. * x6);
  float out5 = e5 * (1. - e6);
  float th = hs * 6.2832 + uTime * .012 * (.4 + aSeed.w);
  float rr = .05 + .55 * pow(aSeed.y, .75);
  vec2 frame = vec2(uScale * ASPECT, uScale);
  vec2 halo = vec2(.5, .36) + vec2(cos(th) * rr * uRes.x, sin(th) * rr * .9 * uRes.y) / frame;
  // when the summary's character steps back he breaks into points too: they start on him and drift out into the room
  float base = step(.93, aSeed.w), extra = step(.7, aSeed.w) * (1. - base);
  float burst = loc(uDust, aSeed.z, .5);
  vec2 onHim = (vec2(uFeltBox.x + (home.x - .5) * .62 * uFeltBox.z, uFeltBox.y + (.2 + (home.y - .12) / .66 * .8) * uFeltBox.w) - uCenter) / frame + .5;
  halo = mix(halo, mix(onHim, halo, burst * burst * (3. - 2. * burst)), extra);
  pos = mix(pos, halo, out5);
  pos.y -= sin(3.14159 * out5) * .06 * aSeed.z;
  float p5 = smoothstep(0., .3, x5) * (1. - smoothstep(.6, 1., x6));

  float lum = dot(real.rgb, LUMA);
  float wPoint = max(max(free * (1. - kg), p3), max(p4, p5));
  float size = mix(1., (.75 + .9 * lum + .7 * aSeed.w) * (1.1 + uSmall * .5), wPoint);
  size *= 1. - .35 * dsp;
  size *= mix(1., (base + extra * smoothstep(0., .2, burst)) * 1.15, out5);   // most of him waits out of sight; the rest is the dust in the room

  vec2 hf = cs / (2. * uSub);
  vec2 corner = (cell * uSub + sub + aCorner * .5 + .5) / (uGrid * uSub);   // shared bit for bit with its neighbours
  vec2 cr = aCorner * hf * (size - 1.);
  if (ang != 0.) cr += rot(ang) * (aCorner * hf * size * vec2(ASPECT, 1.)) / vec2(ASPECT, 1.) - aCorner * hf * size;
  vec2 px = uCenter + (corner + (pos - home) + cr - .5) * frame;
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);

  // the dust never crosses the words: it thins to nothing over the summary's copy and its heading
  vec2 at = uCenter + (pos - .5) * frame;
  float clear = mix(1., outside(uKeepA, at) * outside(uKeepB, at) * outside(uKeepC, at), out5);

  // characters: keep the hair and beard on the ramp, and sharpen the features against their surroundings
  float pl = dot(pr.rgb, LUMA);
  float detail = pl - dot(texP(uReal, pairUv, uCellLod + 2.6).rgb, LUMA);
  float gl = max(clamp(pl * 1.12 + detail * 1.3, 0., 1.), .15) * step(.4, pr.a);

  vQ = (sub + aCorner * .5 + .5) / uSub;
  vP = aCorner;
  vCell = cell;
  vReal = real; vLego = lego;
  vPair = vec4(pr.rgb, gl);
  vW1 = vec4(wPoint, kg * free, fill, cube);
  vW2 = vec4(st, smoothstep(.72, 1., land) * (1. - ph), step(h21(vec2(cell.x, pairRow) + 9.), uRamp), ph);
  vW3 = vec4(hp, bump * st, mix(.3 + .7 * gat, 1., step(.001, uSolid)) * (1. - .5 * out5), heroWin);
  vW4 = vec4(smear, drop, clear, wet);
  vBrick = vec4(s0 * 2., (s1 - s0) * 2., bh, hov);
}`;

const CELL_FS = COMMON + `
in vec2 vQ; in vec2 vP;
flat in vec2 vCell;
flat in vec4 vReal, vLego, vPair, vW1, vW2, vW3, vW4, vBrick;
out vec4 o;

float sdBox(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }

void main(){
  vec2 q = vQ;
  vec2 uv = (vCell + q) / uGrid;
  float wPoint = vW1.x, kg = vW1.y, fill = vW1.z, cube = vW1.w;
  float st = vW2.x, win = vW2.y, ph = vW2.w, heroWin = vW3.w;

  // ---- the cell as a pixel: a flat warm tile, lit from the top left; where the melt has run long it smears toward peach
  vec3 pixc = mix(q9(warm(vReal.rgb)), PEACH, vW4.x);
  pixc *= 1. + .22 * max(step(q.x, .12), step(q.y, .12)) - .30 * max(step(.88, q.x), step(.88, q.y));
  pixc *= .93 + .14 * h21(vCell);

  // ---- at the end: the look site commit e2c80c4 opened with. Lit squares with a hair of room between them
  float tl = max(step(q.x, .15), step(q.y, .15)), br = max(step(.85, q.x), step(.85, q.y));
  vec3 endc = max(q9(vivid(vReal.rgb)), vec3(.12, .09, .085)) * (.94 + .12 * h21(vCell));   // the floor keeps his loose hair readable on the dark page
  endc *= 1. + (.22 * tl * (1. - br) - .30 * br) * .8;
  vec2 dq = min(q, 1. - q) - .055;
  float sq = clamp(min(dq.x, dq.y) * uCellPx + .5, 0., 1.);

  // ---- as a lit cube
  vec3 cR = floor(vivid(vReal.rgb) * 9. + .5) / 9.;
  float lumC = dot(vReal.rgb, LUMA);
  float hgt = h21(vCell + 21.) * .55 + lumC * .45;
  float hUp = h21(vCell + vec2(-1., -1.) + 21.) * .55;
  vec3 cubec = cR * (1.06 - .12 * h21(vCell));
  cubec *= 1. + (.22 * tl * (1. - br) - .30 * br) * 1.3;
  cubec *= 1. + (hgt - .45) * .5 - .28 * smoothstep(.0, .35, hUp - hgt * .55) * smoothstep(.5, .0, min(q.x, q.y));
  float face = 1. - (.12 + .14 * hgt);
  float sideR = step(face, q.x) * step(q.y - face, q.x - face), sideB = step(face, q.y) * (1. - sideR);
  cubec *= 1. - (sideR * .42 + sideB * .62);

  vec3 col = mix(mix(pixc, endc, ph), cubec, cube);
  float near = length((uv - uPtr) * vec2(ASPECT, 1.));
  col *= 1. + smoothstep(.09, 0., near) * (1. - st) * .45;
  float cov = mix(1., sq, ph);
  // cells drop out one by one where the picture runs out, so no state ends in a straight cut
  float alpha = step(vW3.x * .7 + .15, vReal.a);
  // a drop that has let go of its column
  col = mix(col, PEACH, step(.001, vW4.y));
  alpha = max(alpha, vW4.y);

  // ---- as a character: two stacked cells share one. On the light page the ink runs the other way
  if (kg > .001){
    float l = vPair.a;
    float idx = floor(mix(l, 1.04 - l, uLight) * (uGlyphN - 1.) + .5);
    vec2 pc = vec2(vCell.x, floor(vCell.y * .5));
    if (h21(pc + floor(uTime * 7.)) > .99) idx = floor(h21(pc + uTime) * uGlyphN);
    idx = clamp(idx, 0., uGlyphN - 1.) + uGlyphN * (1. - vW2.z);   // numbers first, then symbols
    vec2 gq = vec2(clamp(q.x, 0., 1.), (clamp(q.y, 0., 1.) + mod(vCell.y, 2.)) * .5);
    vec2 at = texture(uAtlas, vec2((idx + gq.x * .94 + .03) / (uGlyphN * 2.), gq.y)).rg;
    float swell = smoothstep(.5 - fill * .7, .58 - fill * .7, at.g);
    float gc = max(mix(at.r, swell, smoothstep(0., .2, fill)), smoothstep(.5, 1., fill));
    gc *= mix(step(.03, l), 1., fill);
    vec3 gcol = mix(BONE, vivid(vPair.rgb) * 2.1, .5) * (.7 + .66 * l);
    gcol = mix(gcol, mix(vec3(.05, .06, .13), vivid(vPair.rgb) * .6, .42), uLight);
    float scan = (uv.y - fract(uTime * .06) * .7) * 26.;
    gcol = mix(gcol * (1. + .9 * exp(-scan * scan) * (1. - fill)), mix(gcol, DEEP, .7 * exp(-scan * scan) * (1. - fill)), uLight);
    col = mix(col, mix(gcol, col, smoothstep(.0, .42, fill)), kg);
    cov = mix(cov, gc, kg * (1. - smoothstep(.95, 1., fill)));
  }

  // ---- as part of a brick, seen from the side with its studs on top
  if (st > .001){
    float len = vBrick.y;
    vec2 bs = vec2(len, 2.) * uCellPx;
    vec2 bp = vec2(vCell.x + q.x - vBrick.x, mod(vCell.y, 2.) + q.y) * uCellPx;
    float sh = bs.y * .17, unit = 2. * uCellPx, e = uCellPx * .1;   // e: every edge detail scales with the brick
    float dBody = sdBox(bp - vec2(bs.x * .5, (bs.y + sh) * .5), vec2(bs.x * .5 - .35 * e, (bs.y - sh) * .5 - .35 * e), 1.2 * e);
    float dStud = sdBox(vec2(mod(bp.x, unit) - unit * .5, bp.y - sh * .6), vec2(unit * .28, sh * .55), .9 * e);
    float dd = min(dBody, dStud);
    vec3 pl = vLego.rgb * 1.06 + .01;
    float gy = (bp.y - sh) / (bs.y - sh);
    pl *= mix(1.1, .84, clamp(gy, 0., 1.));
    pl += .26 * smoothstep(1.6 * e, .3 * e, abs(dBody + 1.3 * e)) * step(bp.y, bs.y * .5) * step(dBody, 0.);
    pl *= 1. - .3 * smoothstep(1.8 * e, .0, -dBody) * step(bs.y * .6, bp.y);
    if (dStud < dBody) pl = vLego.rgb * (1.16 - .3 * smoothstep(-.2, 1., (bp.y - sh * .2) / sh)) + .05;
    float sweep = (bp.x + bp.y * .7) / (bs.x + bs.y * .7) - .5 - (uPtr.x - .5) * .8 + (vBrick.z - .5) * .6 + sin(uTime * .25) * .2;
    pl += .34 * exp(-sweep * sweep * 22.) * step(dBody, 0.);
    float bcov = clamp(.5 - dd / max(e, .6), 0., 1.);
    col = mix(col, pl, st);
    cov = mix(cov, bcov, st);
    alpha = mix(alpha, smoothstep(.3, .6, vLego.a), st);
  }
  col *= 1. + vW3.y * .5;

  // ---- as a free point of light
  if (wPoint > .001){
    float disc = smoothstep(1., .12, length(vP));
    vec3 pcol = (vivid(vReal.rgb) * .95 + vec3(.05, .07, .16)) * (.5 + .7 * lumC);
    pcol = mix(pcol, vivid(vReal.rgb) * .8, uLight);   // on the light page the points are ink, not light
    col = mix(col, pcol, wPoint);
    cov = mix(cov, disc, wPoint);
    alpha = mix(alpha, smoothstep(.3, .6, vReal.a) * vW3.z, wPoint);
  }

  // ---- as a window on a picture: the Lego build he was made into
  float a = alpha * cov;
  float edge = 1. - smoothstep(uBust - .075, uBust, uv.y);
  float edgeCell = step(vW3.x, 1. - smoothstep(uBust - .12, uBust, (floor(vCell.y * .5) * 2. + 1.) / uGrid.y));
  win *= 1. - wPoint;
  if (win > .001){
    vec4 lg = texP(uLego, uv, uLod);
    col = mix(col, lg.rgb, win);
    a = mix(a, lg.a, win);
  }
  // ---- the end: his real face shows through where the pixels have not taken over, and is pixels again under the pointer
  heroWin *= (1. - wPoint) * (1. - .92 * smoothstep(.075, .03, near + (vW3.x - .5) * .03));
  if (heroWin > .001){
    vec4 rl = texP(uReal, uv, uLod);
    col = mix(col, rl.rgb * (.96 + .04 * sq), heroWin);
    a = mix(a, rl.a, heroWin);
  }
  a *= mix(mix(edgeCell, 1., vW4.w), edge, max(win, heroWin));
  a *= smoothstep(0., .04, uv.x) * smoothstep(1., .96, uv.x) * vW4.z;
  o = vec4(col * a, a * (1. - wPoint * .55 * (1. - uLight)));
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
  o = vec4(mix(DEEP, BLUE, .35), 1.) * mix(.10, .05, uLight) * uGlow * exp(-dot(gq, gq) * 6.5);
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
    // a cube that lets go of the end of its column, tumbles and is gone
    float cyc = fract(uTime * (.05 + .03 * s) + aB.w);
    vec4 mc = meltCol(floor(c.x * uGrid.x));
    float y0 = BUST_END + mc.x + mc.y, fallT = clamp((cyc - .2) / .5, 0., 1.);
    c = vec2(c.x + (s - .5) * .05 * fallT, y0 + .3 * fallT * fallT);
    life = smoothstep(0., .08, cyc) * (1. - smoothstep(.45, .7, cyc)) * smoothstep(0., .5, uLiquid) * step(.1, texP(uReal, vec2(aA.x, BUST_END - .03), 4.).a);
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
  vec3 photo = mix(warm(texP(uReal, vec2(aA.x, BUST_END - .04), 4.).rgb), PEACH, .5);
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
  const w = 32, h = 64, ramp = GLYPHS + DIGITS, n = ramp.length;
  const draw = (spread) => {
    const c = document.createElement('canvas');
    c.width = w * n; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, h);
    x.fillStyle = '#fff'; x.font = '700 50px "Space Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [...ramp].forEach((ch, i) => {
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

// every cell that any version of him covers, each split into sub by sub movable pieces,
// plus the empty cells under his bust that the melt runs down into
function buildCells(images, cols, sub) {
  const rows = Math.round(cols / ASPECT), used = Math.ceil(rows * VMAX);
  const c = document.createElement('canvas');
  c.width = cols; c.height = used;
  const x = c.getContext('2d', { willReadFrequently: true });
  const any = new Uint8Array(cols * used);
  for (const img of images) {
    const half = img.naturalWidth / 2;
    x.clearRect(0, 0, cols, used);
    x.drawImage(img, half, 0, half, img.naturalHeight, 0, 0, cols, used);
    const d = x.getImageData(0, 0, cols, used).data;
    for (let i = 0; i < any.length; i++) if (d[i * 4] > 10) any[i] = 1;
  }
  const keep = [], bustRow = Math.floor(rows * BUST_END) - 2;
  for (let j = Math.floor(rows * DRIP_ROWS); j >= 0; j--) for (let i = 0; i < cols; i++) {
    let on = 0;
    if (j >= bustRow) on = any[bustRow * cols + i];
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
  return { cell, seed, count, rows };
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
  const cellProg = program(gl, CELL_VS, CELL_FS), backProg = program(gl, QUAD_VS, BACK_FS), floatProg = program(gl, FLOAT_VS, FLOAT_FS);
  const [real, lego, atlas] = await Promise.all([loadImage('assets/stage/real.jpg'), loadImage('assets/stage/lego.jpg'), glyphAtlas()]);
  texture(gl, 0, real, true); texture(gl, 1, lego, true); texture(gl, 2, atlas, false);

  const small = matchMedia('(max-width: 820px)').matches;
  const cols = small ? 72 : 104, sub = small ? 2 : 3;
  const grid = buildCells([real, lego], cols, sub);
  const cellVao = instanced(gl, [grid.cell, grid.seed]);

  const fa = new Float32Array(FLOATERS * 4), fb = new Float32Array(FLOATERS * 4);
  for (let i = 0; i < FLOATERS; i++) {
    const falling = i >= FLOATERS - 12, side = Math.random() < 0.5 ? -1 : 1;
    const u = falling ? 0.18 + 0.64 * Math.random() : 0.5 + side * (0.2 + 0.3 * Math.random());
    fa.set([u, Math.random(), 0.35 + 0.65 * Math.random(), Math.random()], i * 4);
    fb.set([falling ? 0.0075 + 0.004 * Math.random() : 0.008 + 0.014 * Math.random(), Math.random(), falling ? 1 : 0, Math.random()], i * 4);
  }
  const floatVao = instanced(gl, [fa, fb]);

  const view = {
    cx: 0.7, cy: 0.61, scale: 1.3, bust: 0.8, glow: 1,
    melt: 0.3, liquid: 1, disperse: 1, free: 0, gather: 0, snap: 0, glyph: 0, ramp: 0, solid: 0, stud: 0, build: 0, scatter: 0, regather: 0, dust: 0, photo: 0, end: 0,
    floaters: 1, big: 0,
  };
  const FAR = [-1e5, -1e5, -1e5, -1e5];
  const boxes = { keepA: FAR, keepB: FAR, keepC: FAR, felt: [0, 0, 1, 1] };   // CSS pixels; see keepOut() and feltBox()
  const ptr = { x: 0.1, y: -0.35, tx: 0.1, ty: -0.35 }; // parked off the figure until the pointer moves
  let dpr = 1, frozenTime = null, running = true, light = 0;
  const t0 = performance.now();

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
    for (const k of ['melt', 'liquid', 'disperse', 'free', 'gather', 'snap', 'glyph', 'ramp', 'solid', 'stud', 'build', 'scatter', 'regather', 'dust', 'photo', 'end']) {
      gl.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], view[k]);
    }
    gl.uniform1f(u.uLight, light);
    gl.uniform4f(u.uKeepA, ...boxes.keepA.map((v) => v * dpr)); gl.uniform4f(u.uKeepB, ...boxes.keepB.map((v) => v * dpr)); gl.uniform4f(u.uKeepC, ...boxes.keepC.map((v) => v * dpr));
    gl.uniform4f(u.uFeltBox, ...boxes.felt.map((v) => v * dpr)); gl.uniform1f(u.uKeepM, 90 * dpr);
    gl.uniform1i(u.uReal, 0); gl.uniform1i(u.uLego, 1); gl.uniform1i(u.uAtlas, 2);
  }

  function frame(now) {
    if (!running) return;
    resize();
    ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
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

    if (view.floaters > 0.003) {
      gl.useProgram(floatProg.p);
      shared(floatProg.u, time, W, H, cx, cy, scale);
      gl.uniform1f(floatProg.u.uFloat, view.floaters); gl.uniform1f(floatProg.u.uBrick, view.big);
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

  const box = (r) => (r ? [r.left, r.top, r.right, r.bottom] : FAR);
  const api = {
    view, small,
    // where a point of the portrait frame sits on screen, in CSS pixels
    place(u, v) { const s = view.scale * innerHeight; return [view.cx * innerWidth + (u - 0.5) * s * ASPECT, view.cy * innerHeight + (v - 0.5) * s]; },
    // the rectangles of words the summary's dust stays out of, as DOMRects (or null)
    keepOut(a, b, c) { boxes.keepA = box(a); boxes.keepB = box(b); boxes.keepC = box(c); },
    // where the summary's character stands: centre x, top, width, height
    feltBox(r) { boxes.felt = [r.left + r.width / 2, r.top, r.width, r.height]; },
    setRunning(on) { if (on && !running) { running = true; requestAnimationFrame(frame); } else if (!on) running = false; },
    setMotion(on) { frozenTime = on ? null : 12.5; },
    setLight(on) { light = on ? 1 : 0; },
  };
  document.addEventListener('visibilitychange', () => api.setRunning(!document.hidden));
  requestAnimationFrame(frame);
  return api;
}

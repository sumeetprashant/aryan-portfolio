// The portrait stage. One fixed WebGL2 canvas, one set of cells. Every cell has a home
// on the registered portrait (scripts/prep_stage.py) and scroll decides what it is right
// now: a pixel, part of a character, a lit cube, part of a block, a photo texel. Nothing
// swaps; between versions the cells flip to characters and the characters resolve again.

const ASPECT = 2 / 3;
const VMAX = 0.78125;
const FLOOR = 0.69;
const GLYPHS = ' .,:;~-=+*xo#%@';
const DIGITS = ' .,:;1732459608';   // the same ramp in numbers, for the forecasting chapter
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
uniform float uTime, uScale, uSub, uLod, uCellLod, uCellPx, uGlyphN, uBust, uSmall, uBlk;
uniform float uMelt, uLiquid, uDrain, uDisperse, uGlyph, uRamp, uSolid, uFlip, uLeave, uReturn, uPhoto, uLight;
uniform sampler2D uReal, uAtlas;

float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y);
}

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
// the ragged line the melt has eaten up to, moving on twos like everything else in the melt
float cutLine(float u){
  float t = floor(uTime * 6.) / 6.;
  float w = sin(u * 21. + 1.3) * .5 + sin(u * 47. + t * .11) * .3 + sin(u * 9. - .7) * .6;
  return .648 - .078 * uMelt + w * (.009 + .009 * uMelt);
}
`;

const CELL_VS = COMMON + `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aCell;
layout(location = 2) in vec4 aSeed;
out vec2 vQ;
flat out vec2 vCell;
flat out vec4 vReal, vBlk, vPair, vW1, vW2, vW3;

float loc(float U, float th, float w){ float a = th * (1. - w); return smoothstep(a, a + w, U); }

void main(){
  vec2 cell = aCell.xy, sub = aCell.zw, cs = 1. / uGrid;
  vec2 cuv = (cell + .5) * cs;
  float hc = h21(cell + .37);
  float pairRow = floor(cell.y * .5);
  vec2 pairUv = vec2(cell.x + .5, pairRow * 2. + 1.) * cs;
  float hp = h21(vec2(cell.x, pairRow) + 3.1);

  vec4 real = texP(uReal, cuv, uCellLod);
  vec4 pr = texP(uReal, pairUv, uCellLod + .5);

  // which block this cell belongs to: uBlk cells a side, coloured from the same photograph
  vec2 bI = floor(cell / uBlk);
  vec2 bC = (bI + .5) * uBlk * cs;
  float bh = h21(bI + 11.);
  vec4 blk = texP(uReal, bC, uCellLod + log2(uBlk));

  // local progress of every change, staggered so each one ripples through the figure.
  // Every change of form passes through characters: a cell flips to a glyph, the glyph resolves as the next form.
  float gone = step(cutLine(cuv.x), cuv.y) * uLiquid;
  float kg = loc(uGlyph, hp * .4 + cuv.y * .8, .3);
  float back = gone * loc(uDrain, hp * .6 + .3, .4);   // as the melt drains, what it took comes back as characters
  float centre = length((cuv - vec2(.5, .33)) * vec2(1., 1.15));
  float x3 = loc(uSolid, hp * .4 + centre * 1.1, .4);
  float fill = smoothstep(0., .6, x3), cube = smoothstep(.45, 1., x3);
  float x4 = loc(uFlip, bh * .45 + clamp(1. - bC.y / .75, 0., 1.) * .55, .3);   // blocks resolve from the base up
  float x5 = loc(uLeave, hp * .5 + cuv.y * .5, .4);
  float x6 = loc(uReturn, hp * .45 + centre * .55, .4);
  float ph = step(.5, uPhoto);
  float st = smoothstep(.45, .55, x4) * (1. - ph);
  float solidDone = step(.999, x3);
  float G = max(max(kg, back) * (1. - solidDone), max(smoothstep(0., .4, x4) * (1. - smoothstep(.6, 1., x4)), smoothstep(0., .35, x5) * (1. - smoothstep(.6, 1., x6))));
  float seen = max(1. - smoothstep(.5, 1., x5), smoothstep(0., .3, x6));   // in the summary the figure on the stage steps aside

  // the end: mostly photograph, but his edges, one shoulder and a patch or two never finish resolving
  float faceD = length((cuv - vec2(.5, .33)) * vec2(1.25, 1.));
  float edgeP = (1. - smoothstep(.5, .97, texP(uReal, cuv, uCellLod + 2.5).a)) * .6 * smoothstep(.0, .12, cuv.x);
  float shP = smoothstep(.66, .86, cuv.x) * smoothstep(.5, .6, cuv.y) * (.3 + .7 * vnoise(cell * .35));
  float patchP = smoothstep(.7, .84, vnoise(cell * .16 + 5.)) * smoothstep(.15, .24, faceD) * .85;
  float roll = h21(cell + 5.3 + floor(uTime * .7) * step(.85, h21(cell + 1.7)));   // a few of them keep changing their mind
  float keep = step(roll, max(edgeP, max(shP, patchP)));
  float win = ph * smoothstep(.6, 1., x6) * (1. - keep);

  vec2 home = (cell + (sub + .5) / uSub) * cs;
  vec2 pos = home;

  // hero and melt: the top of the head lets go of a few pixels
  float dsp = uDisperse * step(.45, hc) * smoothstep(.2, .75, (cuv.x - .5) * 1.7 + (.3 - cuv.y) * 2.3 + (hc - .45) * .5) * smoothstep(.13, .2, faceD);
  pos += dsp * vec2(.035 + .13 * h21(cell + 2.), -.03 - .15 * h21(cell + 7.)) * (.78 + .22 * sin(uTime * .35 + hc * 6.28));

  // what has melted is gone until its character arrives
  float size = max(1. - gone, step(.001, max(kg, back))) * (1. - .35 * dsp) * step(.001, seen);

  vec2 hf = cs / (2. * uSub);
  vec2 corner = (cell * uSub + sub + aCorner * .5 + .5) / (uGrid * uSub);   // shared bit for bit with its neighbours
  vec2 cr = aCorner * hf * (size - 1.);
  vec2 px = uCenter + (corner + (pos - home) + cr - .5) * vec2(uScale * ASPECT, uScale);
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);

  // characters: keep the hair and beard on the ramp, and sharpen the features against their surroundings
  float pl = dot(pr.rgb, LUMA);
  float detail = pl - dot(texP(uReal, pairUv, uCellLod + 2.6).rgb, LUMA);
  float gl = max(clamp(pl * 1.12 + detail * 1.3, 0., 1.), .15) * step(.4, pr.a);

  vQ = (sub + aCorner * .5 + .5) / uSub;
  vCell = cell;
  vReal = real; vBlk = blk;
  vPair = vec4(pr.rgb, gl);
  vW1 = vec4(seen, G, fill * (1. - solidDone), cube * (1. - ph));
  vW2 = vec4(st, win, step(h21(vec2(cell.x, pairRow) + 9.), uRamp), x4 * (1. - x4) * 4. * step(.5, x4) * (1. - ph));
  vW3 = vec4(mix(hp, bh, st), 0., 0., 0.);
}`;

const CELL_FS = COMMON + `
in vec2 vQ;
flat in vec2 vCell;
flat in vec4 vReal, vBlk, vPair, vW1, vW2, vW3;
out vec4 o;

void main(){
  vec2 q = vQ;
  vec2 uv = (vCell + q) / uGrid;
  float G = vW1.y, fill = vW1.z, cube = vW1.w;
  float st = vW2.x, win = vW2.y;

  // ---- the cell as a pixel: a flat warm tile, lit from the top left
  vec3 pixc = q9(warm(vReal.rgb));
  pixc *= 1. + .22 * max(step(q.x, .12), step(q.y, .12)) - .30 * max(step(.88, q.x), step(.88, q.y));
  pixc *= .93 + .14 * h21(vCell);

  // ---- as a lit cube
  vec3 cR = floor(vivid(vReal.rgb) * 9. + .5) / 9.;
  float lumC = dot(vReal.rgb, LUMA);
  float tl = max(step(q.x, .15), step(q.y, .15)), br = max(step(.85, q.x), step(.85, q.y));
  float hgt = h21(vCell + 21.) * .55 + lumC * .45;
  float hUp = h21(vCell + vec2(-1., -1.) + 21.) * .55;
  vec3 cubec = cR * (1.06 - .12 * h21(vCell));
  cubec *= 1. + (.22 * tl * (1. - br) - .30 * br) * 1.3;
  cubec *= 1. + (hgt - .45) * .5 - .28 * smoothstep(.0, .35, hUp - hgt * .55) * smoothstep(.5, .0, min(q.x, q.y));
  float face = 1. - (.12 + .14 * hgt);
  float sideR = step(face, q.x) * step(q.y - face, q.x - face), sideB = step(face, q.y) * (1. - sideR);
  cubec *= 1. - (sideR * .42 + sideB * .62);

  vec3 col = mix(pixc, cubec, cube);
  float near = length((uv - uPtr) * vec2(ASPECT, 1.));
  col *= 1. + smoothstep(.09, 0., near) * (1. - st) * .45;
  float cov = 1.;
  // cells drop out one by one where the picture runs out, so no state ends in a straight cut
  float alpha = step(vW3.x * .7 + .15, vReal.a);

  // ---- as part of a block: the voxels grown up. One flat colour a block, a 2 by 2 of texels in every cell, light from the top left
  if (st > .001){
    vec2 bq = (mod(vCell, uBlk) + q) / uBlk;
    float e = .5 / uBlk;
    float btl = max(step(bq.x, e), step(bq.y, e)), bbr = max(step(1. - e, bq.x), step(1. - e, bq.y));
    vec3 base = floor(vivid(vBlk.rgb) * 6. + .5) / 6.;
    float tn = h21(floor(vCell / uBlk) * 7.3 + floor(bq * uBlk * 2.));
    vec3 bc = floor(base * (.84 + .3 * tn) * 14. + .5) / 14.;
    bc *= 1. + .2 * btl * (1. - bbr) - .26 * bbr;
    col = mix(col, bc, st);
    alpha = mix(alpha, step(.5, vBlk.a), st);
  }
  col *= 1. + vW2.w * .5;

  // ---- as a character: two stacked cells share one. On the light page the ink runs the other way
  if (G > .001){
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
    col = mix(col, mix(gcol, col, smoothstep(.0, .42, fill)), G);
    cov = mix(cov, gc, G * (1. - smoothstep(.95, 1., fill)));
    alpha = mix(alpha, step(vW3.x * .7 + .15, vReal.a), G * (1. - fill));
  }

  // ---- as a window on the photograph
  float a = alpha * cov;
  float edge = 1. - smoothstep(uBust - .075, uBust, uv.y);
  float edgeCell = step(vW3.x, 1. - smoothstep(uBust - .12, uBust, (floor(vCell.y * .5) * 2. + 1.) / uGrid.y));
  if (win > .001){
    vec4 rl = texP(uReal, uv, uLod);
    // the finished photograph is still pixels under the pointer
    win *= 1. - .92 * smoothstep(.075, .03, near + (vW3.x - .5) * .03);
    col = mix(col, rl.rgb, win);
    a = mix(a, rl.a, win);
  }
  a *= mix(edgeCell, edge, win);
  a *= smoothstep(0., .04, uv.x) * smoothstep(1., .96, uv.x) * vW1.x;
  o = vec4(col * a, a);
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

// The melt, drawn on the same cell grid as he is: a skirt of stretched pixels under the cut,
// one-cell drips, a drop that falls as a single cell and lands with a two-frame splash,
// streams, and a puddle that spreads in stair-steps. Everything moves on twos.
const MELT_FS = COMMON + `
uniform float uPuddle;
out vec4 o;

float seed(float j, float k){ return h11(j * 1.31 + k * 17.7 + 2.); }

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (px - uCenter) / vec2(uScale * ASPECT, uScale) + .5;
  vec2 cell = floor(uv * uGrid);
  float rows = uGrid.y, floorRow = floor(FLOOR * rows), keep = 1. - uDrain;
  float T = floor(uTime * 12.) / 12.;
  vec3 col = vec3(0.); float hit = 0.;

  if (cell.x >= 0. && cell.x < uGrid.x && keep > .04){
    for (float d = -2.; d <= 2.; d += 1.){
      float j = cell.x + d;
      if (j < 0. || j >= uGrid.x) continue;
      float u = (j + .5) / uGrid.x;
      float root = floor(cutLine(u) * rows + .5);   // first row the melt has taken in this column
      vec4 above = texP(uReal, vec2(u, (root - 1.5) / rows), uCellLod);
      if (above.a < .5 || root > floorRow - 4.) continue;
      vec3 tone = warm(above.rgb);
      float ext = floor((.6 + uMelt * (1. + 3.5 * seed(j, 1.))) * keep);
      float top = root + ext, reach = floorRow - 1. - top;
      float r = cell.y;
      float shade = 0.;
      if (d == 0. && r >= root && r < top) shade = 1. - .08 * (r - root);   // the skirt
      bool drips = seed(j, 2.) < .2 + .26 * uMelt;
      if (drips && reach > 3.){
        float P = mix(3., 7., seed(j, 3.)), ph = fract(T / P + seed(j, 4.));
        float Lmax = min(2. + floor(seed(j, 5.) * 5. + uMelt * 7.), reach - 2.);
        bool stream = seed(j, 6.) < .3 && uMelt > .55 + .6 * seed(j, 7.);
        float len, drop = -1., splash = -1.;
        if (stream) len = reach + 1.;
        else if (ph < .62) len = floor(Lmax * pow(ph / .62, 1.4));
        else if (ph < .7) len = Lmax;
        else {
          len = floor(Lmax * .4);
          float tau = (ph - .7) * P, y = top + Lmax + floor(55. * tau * tau);
          if (y < floorRow - 1.) drop = y;
          else splash = floor((tau - sqrt(max(floorRow - 1. - top - Lmax, 0.) / 55.)) * 12.);
        }
        len = floor(len * keep);
        if (d == 0.){
          if (r >= top && r < top + len){
            shade = stream ? (mod(r - floor(T * 9.), 4.) < 2. ? 1.12 : .86) : (r == top + len - 1. ? 1.3 : .94);
          }
          if (r == drop) shade = 1.3;
        }
        if (abs(d) == 1. && len >= 3. && r == top) shade = .9;   // a drip is two cells wide where it leaves him
        if (splash == 0. && abs(d) == 1. && r == floorRow - 1.) shade = 1.35;
        if (splash == 1. && ((abs(d) == 2. && r == floorRow - 2.) || (d == 0. && r == floorRow - 1.))) shade = 1.2;
      }
      if (shade > 0.){ col = q9(tone * shade + vec3(.01, .015, .04)); hit = 1.; }
    }
  }

  // the puddle: a flat stair-stepped ellipse, all of him stirred together
  float halfW = floor((.07 + .36 * uPuddle) * uGrid.x), tall = 1. + floor(3.2 * uPuddle);
  float k = cell.y - floorRow, mid = floor(uGrid.x * .5);
  if (uPuddle > .004 && k >= 0. && k < tall){
    float prof = sqrt(max(1. - pow((k + .5) / tall * 2. - 1., 2.), 0.));
    float w = floor(halfW * (.55 + .45 * prof)) - floor(3. * h11(k * 7. + sign(cell.x - mid)));
    if (abs(cell.x - mid) <= w){
      float pu = .5 + (cell.x - mid) / uGrid.x * .55;
      vec3 pool = warm(texP(uReal, vec2(pu, .625), uCellLod + 1.5).rgb) * (.5 + .16 * k / tall);
      float glint = step(.86, h21(vec2(cell.x + floor(T * 1.5), k))) * step(k, .5);
      col = q9(pool + glint * .4 + vec3(.0, .01, .04)); hit = 1.;
    }
  }
  // the floor: one dim dotted row, brightest under him
  if (hit < .5 && cell.y == floorRow + tall && mod(cell.x, 2.) < 1.){
    float f = exp(-pow((uv.x - .5) / .36, 2.));
    col = mix(DEEP * .22, DEEP * 1.6, uLight) * f; hit = step(.25, f);
  }
  o = vec4(col, 1.) * hit * uLiquid;
}`;

// loose cubes: small while he is pixels, block sized in the Kiwi chapter. Ray-traced boxes.
const FLOAT_VS = COMMON + `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aA;   // home u, home v, depth, seed
layout(location = 2) in vec4 aB;   // size, colour pick, fall flag, phase
uniform float uFloat, uBig;
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
  float size = aB.x * (.6 + .4 * depth) * mix(1., 1.8, uBig * step(aB.z, .5)) * uFloat * life;
  vec2 px = uCenter + (c - .5) * vec2(uScale * ASPECT, uScale) + aCorner * size * uScale;
  gl_Position = vec4(px.x / uRes.x * 2. - 1., 1. - px.y / uRes.y * 2., 0., 1.);
  vP = aCorner; vA = aA; vB = aB; vLife = life * (.5 + .5 * depth);
  vec3 photo = warm(texP(uReal, vec2(aA.x, cutLine(aA.x) - .04), 4.).rgb);
  vec3 pick = aB.y < .5 ? DEEP * 1.25 : aB.y < .78 ? vec3(.80, .62, .42) : BONE;
  vCol = aB.z > .5 ? photo : pick;
}`;

const FLOAT_FS = COMMON + `
in vec2 vP; flat in vec4 vA; flat in vec4 vB; flat in vec3 vCol; flat in float vLife;
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
  vec3 ro = Rm * vec3(vP * 1.05, 3.), rd = Rm * vec3(0., 0., -1.);
  vec3 n; vec2 t = boxHit(ro, rd, vec3(.5), n);
  if (t.x >= t.y || t.y <= 0.){ o = vec4(0.); return; }
  vec3 nw = transpose(Rm) * n;
  vec3 L = normalize(vec3(-.5, .7, .62));
  float diff = max(dot(nw, L), 0.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(nw, H), 0.), 18.) * .25;
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

// every cell that any version of him covers, each split into sub by sub movable pieces
function buildCells(images, cols, sub, grow) {
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
  const keep = [];
  for (let j = used - 1; j >= 0; j--) for (let i = 0; i < cols; i++) {
    let on = 0;
    for (let dj = -grow; dj <= grow && !on; dj++) for (let di = -grow; di <= grow && !on; di++) {
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
  const cellProg = program(gl, CELL_VS, CELL_FS), backProg = program(gl, QUAD_VS, BACK_FS);
  const meltProg = program(gl, QUAD_VS, MELT_FS), floatProg = program(gl, FLOAT_VS, FLOAT_FS);
  const [real, atlas] = await Promise.all([loadImage('assets/stage/real.jpg'), glyphAtlas()]);
  texture(gl, 0, real, true); texture(gl, 1, atlas, false);

  const small = matchMedia('(max-width: 820px)').matches;
  const cols = small ? 72 : 104, sub = small ? 2 : 3, blk = small ? 2 : 3;
  const grid = buildCells([real], cols, sub, blk);
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
    melt: 0.28, liquid: 1, drain: 0, disperse: 1, glyph: 0, ramp: 0, solid: 0, flip: 0, leave: 0, return: 0, photo: 0,
    floaters: 1, big: 0, puddle: 0.3,
  };
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
    gl.uniform1f(u.uGlyphN, GLYPHS.length); gl.uniform1f(u.uBust, view.bust); gl.uniform1f(u.uSmall, small ? 1 : 0); gl.uniform1f(u.uBlk, blk);
    for (const k of ['melt', 'liquid', 'drain', 'disperse', 'glyph', 'ramp', 'solid', 'flip', 'leave', 'return', 'photo']) {
      gl.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], view[k]);
    }
    gl.uniform1f(u.uLight, light);
    gl.uniform1i(u.uReal, 0); gl.uniform1i(u.uAtlas, 1);
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

    if (view.liquid > 0.003) {
      gl.useProgram(meltProg.p);
      shared(meltProg.u, time, W, H, cx, cy, scale);
      gl.uniform1f(meltProg.u.uPuddle, view.puddle);
      // only the band of the frame that can hold the melt or the floor
      const top = Math.max(0, Math.round(H - (cy + (FLOOR + 0.12 - 0.5) * scale))), bottom = Math.min(H, Math.round(H - (cy + (0.36 - 0.5) * scale)));
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, top, W, Math.max(1, bottom - top));
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }

    if (view.floaters > 0.003) {
      gl.useProgram(floatProg.p);
      shared(floatProg.u, time, W, H, cx, cy, scale);
      gl.uniform1f(floatProg.u.uFloat, view.floaters); gl.uniform1f(floatProg.u.uBig, view.big);
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
    setRunning(on) { if (on && !running) { running = true; requestAnimationFrame(frame); } else if (!on) running = false; },
    setMotion(on) { frozenTime = on ? null : 12.5; },
    setLight(on) { light = on ? 1 : 0; },
  };
  document.addEventListener('visibilitychange', () => api.setRunning(!document.hidden));
  requestAnimationFrame(frame);
  return api;
}

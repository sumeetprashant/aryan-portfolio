// The portrait stage. One fixed WebGL2 canvas, one set of cells. Every cell has a home
// on the registered portrait (scripts/prep_stage.py) and scroll decides what it is right
// now: an 8-bit pixel, a free point, part of a character, a lit cube, part of a block, a
// photo texel. Nothing swaps; between versions the cells break into points and re-gather.

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
uniform float uMelt, uLiquid, uDrain, uDisperse, uFree, uGather, uSnap, uGlyph, uRamp, uSolid, uBlock, uBuild, uScatter, uRegather, uPhoto;
uniform sampler2D uReal, uMc, uAtlas;

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
// 8-bit colour: five levels a channel, ordered dither on the cell grid
float bayer2(vec2 c){ vec2 m = mod(c, 2.); return 2. * m.x + 3. * m.y - 4. * m.x * m.y; }
float bayer4(vec2 c){ return (4. * bayer2(c) + bayer2(floor(c * .5)) + .5) / 16.; }
vec3 pal(vec3 c, vec2 cell){
  vec3 g = sqrt(clamp(c, 0., 1.));   // steps even to the eye, so skin and hair keep their shape
  g = floor(g * 5. + .2 + bayer4(cell) * .6) / 5.;
  return g * g;
}
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
out vec2 vQ; out vec2 vP;
flat out vec2 vCell;
flat out vec4 vReal, vMc, vPair, vW1, vW2, vW3;

float loc(float U, float th, float w){ float a = th * (1. - w); return smoothstep(a, a + w, U); }

void main(){
  vec2 cell = aCell.xy, sub = aCell.zw, cs = 1. / uGrid;
  vec2 cuv = (cell + .5) * cs;
  float hc = h21(cell + .37), hs = aSeed.x;
  float pairRow = floor(cell.y * .5);
  vec2 pairUv = vec2(cell.x + .5, pairRow * 2. + 1.) * cs;
  float hp = h21(vec2(cell.x, pairRow) + 3.1);

  vec4 real = texP(uReal, cuv, uCellLod);
  vec4 pr = texP(uReal, pairUv, uCellLod + .5);

  // which Minecraft block this cell belongs to: uBlk cells a side
  vec2 bI = floor(cell / uBlk);
  vec2 bC = (bI + .5) * uBlk * cs;
  float bh = h21(bI + 11.), bh2 = h21(bI + 3.);
  vec4 mc = texP(uMc, bC, uCellLod + log2(uBlk));

  // local progress of every change, staggered so each one ripples through the figure
  float rise = 1. - clamp(cuv.y / FLOOR, 0., 1.);
  float cut = cutLine(cuv.x);
  float gone = step(cut, cuv.y) * uLiquid;
  float free = loc(uFree, rise * .55 + hs * .45, .4);
  float gat = loc(uGather, hs * .45 + rise * .35 + hc * .2, .45);
  float snap = loc(uSnap, hc * .5 + cuv.y * .7, .35);
  float kg = loc(uGlyph, hp * .5 + cuv.y * .7, .3);
  float centre = length((cuv - vec2(.5, .33)) * vec2(1., 1.15));
  float x3 = loc(uSolid, hp * .4 + centre * 1.1, .4);
  float fill = smoothstep(0., .6, x3), cube = smoothstep(.45, 1., x3);
  float st = loc(uBlock, bh * .6 + rise * .4, .35) * (1. - step(.5, uPhoto));   // under the photograph he is plain cubes again
  float land = loc(uBuild, clamp(1. - bC.y / .75, 0., 1.) * .86 + bh * .14, .1);
  float x5 = loc(uScatter, hs * .5 + cuv.y * .6, .45);
  float x6 = loc(uRegather, hs * .45 + centre * .55, .45);

  vec2 home = (cell + (sub + .5) / uSub) * cs;
  vec2 pos = home;

  // hero and melt: the top of the head lets go of a few pixels
  float faceD = length((cuv - vec2(.5, .33)) * vec2(1.25, 1.));
  float dsp = uDisperse * step(.45, hc) * smoothstep(.2, .75, (cuv.x - .5) * 1.7 + (.3 - cuv.y) * 2.3 + (hc - .45) * .5) * smoothstep(.13, .2, faceD);
  pos += dsp * vec2(.035 + .13 * h21(cell + 2.), -.03 - .15 * h21(cell + 7.)) * (.78 + .22 * sin(uTime * .35 + hc * 6.28));

  // melt to characters: what melted lifts off the puddle, what was still standing loosens in place
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

  // characters to cubes: each cell jumps out as a point and lands as a solid
  float p3 = smoothstep(0., .3, x3) * (1. - smoothstep(.55, .95, x3));
  pos += (aSeed.yz - .5) * vec2(.2, .13) * sin(3.14159 * x3) * (.4 + .6 * aSeed.w);

  // blocks: each one loosens into its cells and hovers, then drops home from the base up
  float back = land - 1.;
  float seat = 1. + 2.2 * back * back * back + 1.2 * back * back;   // overshoots, then seats
  float hov = st * (1. - seat);
  float bump = land * (1. - land) * 4.;
  vec2 off = vec2((bh - .5) * .012, -(max(.75 - bC.y, 0.) * .1 + .0035 * bh2)) * hov;   // an exploded view: every course lifts clear of the one below
  off += hov * .005 * vec2(sin(uTime * .8 + bh * 20.), cos(uTime * .6 + bh * 14.));
  vec2 bp = (bC + off - uPtr) * vec2(ASPECT, 1.);
  off += normalize(bp + 1e-5) / vec2(ASPECT, 1.) * .03 * exp(-dot(bp, bp) / .006) * hov;
  float p4 = hov * step(.84, hs);
  pos += (home - bC) * .16 * hov + off + p4 * (aSeed.yz - .5) * vec2(.09, .07);

  // the summary: everything lets go and circles the room; then it comes home as the photograph
  float e5 = x5 * x5 * (3. - 2. * x5), e6 = x6 * x6 * (3. - 2. * x6);
  float out5 = e5 * (1. - e6);
  float th = hs * 6.2832 + uTime * .025 * (.4 + aSeed.w);
  float rr = .2 + .4 * pow(aSeed.y, .7);
  vec2 halo = vec2(.5, .36) + vec2(cos(th) * rr * uRes.x / (uScale * ASPECT), sin(th) * rr * .9 * uRes.y / uScale);
  pos = mix(pos, halo, out5);
  pos.y -= sin(3.14159 * out5) * .06 * aSeed.z;
  float p5 = smoothstep(0., .3, x5) * (1. - smoothstep(.6, 1., x6));

  float lum = dot(real.rgb, LUMA);
  float wPoint = max(max(free * (1. - kg), p3), max(p4, p5));
  float size = mix(1., (.75 + .9 * lum + .7 * aSeed.w) * (1.1 + uSmall * .5), wPoint);
  size *= mix(1. - gone, 1., free) * (1. - .35 * dsp);
  size *= mix(1., step(.9, aSeed.w) * 1.25, out5);   // most of him waits out of sight; the rest is the dust in the room

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
  vP = aCorner;
  vCell = cell;
  vReal = real; vMc = mc;
  vPair = vec4(pr.rgb, gl);
  vW1 = vec4(wPoint, kg * free, fill, cube);
  vW2 = vec4(st, smoothstep(.72, 1., land), step(h21(vec2(cell.x, pairRow) + 9.), uRamp), step(.5, uPhoto));
  vW3 = vec4(hp, bump * st, mix(.3 + .7 * gat, 1., step(.001, uSolid)) * (1. - .45 * out5), p5);
}`;

const CELL_FS = COMMON + `
in vec2 vQ; in vec2 vP;
flat in vec2 vCell;
flat in vec4 vReal, vMc, vPair, vW1, vW2, vW3;
out vec4 o;

void main(){
  vec2 q = vQ;
  vec2 uv = (vCell + q) / uGrid;
  float wPoint = vW1.x, kg = vW1.y, fill = vW1.z, cube = vW1.w;
  float st = vW2.x, win = vW2.y, ph = vW2.w;

  // ---- the cell as an 8-bit pixel, then as a lit cube
  vec3 cR = mix(pal(vivid(vReal.rgb), vCell), floor(vivid(vReal.rgb) * 9. + .5) / 9., cube);
  float lumC = dot(vReal.rgb, LUMA);
  float tl = max(step(q.x, .15), step(q.y, .15)), br = max(step(.85, q.x), step(.85, q.y));
  float hgt = h21(vCell + 21.) * .55 + lumC * .45;
  float hUp = h21(vCell + vec2(-1., -1.) + 21.) * .55;
  vec3 col = cR * (1. + cube * (.12 * h21(vCell) - .06));
  col *= 1. + (.22 * tl * (1. - br) - .30 * br) * 1.3 * cube;
  col *= 1. + cube * ((hgt - .45) * .5 - .28 * smoothstep(.0, .35, hUp - hgt * .55) * smoothstep(.5, .0, min(q.x, q.y)));
  float face = 1. - cube * (.12 + .14 * hgt);
  float sideR = step(face, q.x) * step(q.y - face, q.x - face), sideB = step(face, q.y) * (1. - sideR);
  col *= 1. - cube * (sideR * .42 + sideB * .62);
  float near = length((uv - uPtr) * vec2(ASPECT, 1.));
  col *= 1. + smoothstep(.09, 0., near) * (1. - st) * .45;
  float cov = 1.;
  // cells drop out one by one where the picture runs out, so no state ends in a straight cut
  float alpha = step(vW3.x * .7 + .15, vReal.a);

  // ---- as a character: two stacked cells share one
  if (kg > .001){
    float l = vPair.a;
    float idx = floor(l * (uGlyphN - 1.) + .5);
    vec2 pc = vec2(vCell.x, floor(vCell.y * .5));
    if (h21(pc + floor(uTime * 7.)) > .99) idx = floor(h21(pc + uTime) * uGlyphN);
    idx += uGlyphN * (1. - vW2.z);   // numbers first, then symbols
    vec2 gq = vec2(clamp(q.x, 0., 1.), (clamp(q.y, 0., 1.) + mod(vCell.y, 2.)) * .5);
    vec2 at = texture(uAtlas, vec2((idx + gq.x * .94 + .03) / (uGlyphN * 2.), gq.y)).rg;
    float swell = smoothstep(.5 - fill * .7, .58 - fill * .7, at.g);
    float gc = max(mix(at.r, swell, smoothstep(0., .2, fill)), smoothstep(.5, 1., fill));
    gc *= mix(step(.03, l), 1., fill);
    vec3 gcol = mix(BONE, vivid(vPair.rgb) * 2.1, .5) * (.7 + .66 * l);
    float scan = (uv.y - fract(uTime * .06) * .7) * 26.;
    gcol *= 1. + .9 * exp(-scan * scan) * (1. - fill);
    col = mix(col, mix(gcol, col, smoothstep(.0, .42, fill)), kg);
    cov = mix(cov, gc, kg * (1. - smoothstep(.95, 1., fill)));
  }

  // ---- as part of a Minecraft block: the cells are its texels
  if (st > .001){
    vec2 bq = (mod(vCell, uBlk) + q) / uBlk;
    float e = .34 / uBlk;
    float btl = max(step(bq.x, e), step(bq.y, e)), bbr = max(step(1. - e, bq.x), step(1. - e, bq.y));
    vec3 bc = vMc.rgb * (.93 + .14 * h21(vCell + 40.)) * (.95 + .1 * h21(floor(vCell / uBlk) + 11.));
    bc *= 1. + .2 * btl * (1. - bbr) - .26 * bbr;
    col = mix(col, bc, st);
    alpha = mix(alpha, step(.5, vMc.a), st);
  }
  col *= 1. + vW3.y * .5;

  // ---- as a free point of light
  if (wPoint > .001){
    float disc = smoothstep(1., .12, length(vP));
    vec3 pcol = (vivid(vReal.rgb) * .95 + vec3(.05, .07, .16)) * (.5 + .7 * lumC);
    col = mix(col, pcol, wPoint);
    cov = mix(cov, disc, wPoint);
    alpha = mix(alpha, smoothstep(.3, .6, vReal.a) * vW3.z, wPoint);
  }

  // ---- as a window on a picture: the Minecraft build, then the photograph
  float a = alpha * cov;
  float edge = 1. - smoothstep(uBust - .075, uBust, uv.y);
  float edgeCell = step(vW3.x, 1. - smoothstep(uBust - .12, uBust, (floor(vCell.y * .5) * 2. + 1.) / uGrid.y));
  win *= 1. - wPoint;
  if (win > .001){
    vec4 m = texP(uMc, uv, uLod);
    vec3 wc = m.rgb;
    float wa = m.a;
    if (ph > .5){
      vec4 rl = texP(uReal, uv, uLod);
      wc = rl.rgb; wa = rl.a;
      // the finished photograph is still pixels under the pointer
      win *= 1. - .92 * smoothstep(.075, .03, near + (vW3.x - .5) * .03);
    }
    col = mix(col, wc, win);
    a = mix(a, wa, win);
  }
  a *= mix(edgeCell, edge, win);
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
      vec3 tone = vivid(above.rgb);
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
      if (shade > 0.){ col = pal(tone * shade + vec3(.01, .015, .04), cell); hit = 1.; }
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
      vec3 pool = vivid(texP(uReal, vec2(pu, .625), uCellLod + 1.5).rgb) * (.5 + .16 * k / tall);
      float glint = step(.86, h21(vec2(cell.x + floor(T * 1.5), k))) * step(k, .5);
      col = pal(pool + glint * .4 + vec3(.0, .01, .04), cell); hit = 1.;
    }
  }
  // the floor: one dim dithered row, brightest under him
  if (hit < .5 && cell.y == floorRow + tall && mod(cell.x, 2.) < 1.){
    float f = exp(-pow((uv.x - .5) / .36, 2.));
    col = DEEP * .22 * f; hit = step(.25, f);
  }
  o = vec4(col, 1.) * hit * uLiquid;
}`;

// loose cubes: small while he is pixels, block sized while he is Minecraft. Ray-traced boxes.
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
  vec3 photo = vivid(texP(uReal, vec2(aA.x, cutLine(aA.x) - .04), 4.).rgb);
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
  const [real, mc, atlas] = await Promise.all([loadImage('assets/stage/real.jpg'), loadImage('assets/stage/mc.jpg'), glyphAtlas()]);
  texture(gl, 0, real, true); texture(gl, 1, mc, true); texture(gl, 2, atlas, false);

  const small = matchMedia('(max-width: 820px)').matches;
  const cols = small ? 72 : 104, sub = small ? 2 : 3, blk = small ? 2 : 3;
  const grid = buildCells([real, mc], cols, sub);
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
    melt: 0.28, liquid: 1, drain: 0, disperse: 1, free: 0, gather: 0, snap: 0, glyph: 0, ramp: 0, solid: 0, block: 0, build: 0, scatter: 0, regather: 0, photo: 0,
    floaters: 1, big: 0, puddle: 0.3,
  };
  const ptr = { x: 0.1, y: -0.35, tx: 0.1, ty: -0.35 }; // parked off the figure until the pointer moves
  let dpr = 1, frozenTime = null, running = true;
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
    for (const k of ['melt', 'liquid', 'drain', 'disperse', 'free', 'gather', 'snap', 'glyph', 'ramp', 'solid', 'block', 'build', 'scatter', 'regather', 'photo']) {
      gl.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], view[k]);
    }
    gl.uniform1i(u.uReal, 0); gl.uniform1i(u.uMc, 1); gl.uniform1i(u.uAtlas, 2);
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
  };
  document.addEventListener('visibilitychange', () => api.setRunning(!document.hidden));
  requestAnimationFrame(frame);
  return api;
}

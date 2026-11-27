precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float pace;
uniform float pyro;
uniform float haze;
uniform float tape;

// Kaiju Stomp: the running shot from a 90s tokusatsu episode. The camera
// tracks left to right along the street of a tabletop city: a hazy skyline,
// model blocks with too few windows, a pavement of lamp posts and toy cars,
// the road. Three suited heroes sprint on the spot in front of it. Behind
// them walks something whose foot is the size of a building: a slate
// reptile's foot, scaled, with ivory claws. Every
// 4 beats its shadow spreads on the road, the foot comes down on the beat
// (the camera jolts, the cars jump, dust and sparks go up), stays planted and
// slides away with the road, then lifts. On every other stomp the charges
// buried along the street go off behind the team in their colours. The tail
// sweeps over the rooftops. The scroll is locked to the beat clock, so a
// planted foot stays exactly where the road takes it.

const float SY = -0.2;                   // far kerb

// ---- tokusatsu kit: the same block lives in titanhand.frag and kaijustomp.frag ----
// Pixel art, all of it. The picture is worked out once per virtual pixel (about
// 216 lines, a whole number of screen pixels each) and everything the shader
// draws itself follows the rules the sprite sheets follow: hard edges, at most
// five flat tones per material on a ramp that shifts hue (shadows cool and
// lose saturation, highlights go warm), a one-pixel outline, light from the
// top left, and an ordered 2x2 dither only on the transitions that ask for it.
const float TAU = 6.2831853;
const vec3 INK = vec3(0.04, 0.03, 0.08);

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.62 * vn(p) + 0.38 * vn(p * 2.3 + 7.3); }

vec3 gCol;                      // the frame being painted
float gVP;                      // one virtual pixel, in scene units
float gPx;                      // one virtual pixel, in the units of the field being drawn
vec2 gQ;                        // this virtual pixel, counted from the middle of the set
float gD;                       // its threshold in the 2x2 Bayer cell `0 2 / 3 1`
vec3 gL;                        // key light, from the top left
vec3 cA, cB, cC;                // the three suit colours, from the palette
vec3 gSprLight;                 // the light of the set on the sprites (a pyro flash lifts it)

float sn(float x) { return floor(x / gVP + 0.5) * gVP; }      // a position, snapped to the grid
float nv(float x) { return floor(x / gVP + 0.5); }            // a length, in whole virtual pixels
vec2 snapv(vec2 o) { return floor(o / gVP + 0.5) * gVP; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
// v in n flat steps; w = how much of each step's edge is dithered (0 = hard)
float qz(float v, float n, float w) { return floor(v * n + 0.5 + (gD - 0.5) * w) / n; }

// the ramp of a material: tone 4 is its colour, 3..1 go darker, cooler and
// greyer towards a blue violet, 5 is a warm highlight. Never black, never white.
// lift raises the dark end (white cloth does not go as deep as a coloured suit)
vec3 ramp(vec3 b, float lv, float lift) {
  if (lv > 4.5) return mix(b, vec3(1.0, 0.95, 0.7), 0.5);
  if (lv > 3.5) return b;
  float k = mix(lv > 2.5 ? 0.74 : lv > 1.5 ? 0.5 : 0.3, 1.0, lift);
  float cool = lv > 2.5 ? 0.12 : lv > 1.5 ? 0.26 : 0.44;
  float l = dot(b, vec3(0.299, 0.587, 0.114));
  return mix(mix(b, vec3(l), cool * 0.6) * k, vec3(0.6, 0.5, 1.45) * l * k + vec3(0.02, 0.015, 0.05), cool);
}
vec3 shade(vec3 c) { return c * vec3(0.5, 0.48, 0.64); }       // a cast shadow: one flat step down, towards blue

// distance fields that also return their gradient in .yz
vec3 gCirc(vec2 p, float r) { float l = length(p); return vec3(l - r, p / max(l, 1e-5)); }
vec3 gSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 q = pa - ba * h;
  float l = length(q);
  return vec3(l - mix(ra, rb, h), q / max(l, 1e-5));
}
vec3 gEll(vec2 p, vec2 r) {
  float k0 = length(p / r);
  vec2 g = p / (r * r);
  float k1 = length(g);
  return vec3(k0 * (k0 - 1.0) / max(k1, 1e-5), g / max(k1, 1e-5));
}
vec3 gBox(vec2 p, vec2 b, float r) {
  vec2 w = abs(p) - b + r;
  float g = max(w.x, w.y);
  vec2 q = max(w, 0.0);
  float l = length(q);
  vec2 n = g > 0.0 ? q / max(l, 1e-5) : (w.x > w.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3((g > 0.0 ? l : g) - r, sign(p) * n);
}
vec3 smin3(vec3 a, vec3 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// a field as a rounded solid, the way a sprite would draw it. Returns the tone:
// 0 outside, -1 the outline on the shadow side (ink), -2 the outline on the lit
// side (the material's darkest tone), 1..5 inside. The tone follows the light,
// not the distance from the edge. rad = how far in the surface keeps curving;
// gloss > 0.3 earns a highlight; jit moves the band edges, one value per cluster
float litLv(vec3 dg, float rad, float gloss, float jit) {
  float d = dg.x;
  if (d > 0.0) return 0.0;
  if (d > -gPx) return dot(dg.yz, gL.xy) > 0.25 ? -2.0 : -1.0;
  float t = clamp(-d / rad, 0.0, 1.0);
  vec3 n = normalize(vec3(dg.yz * (1.0 - t), sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)) + 0.06));
  float dif = dot(n, gL) + jit;
  if (gloss > 0.3 && dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))) > mix(0.99, 0.955, gloss)) return 5.0;
  return dif < 0.08 ? 1.0 : dif < 0.45 ? 2.0 : dif < 0.78 ? 3.0 : 4.0;
}
void lit(vec3 dg, float rad, vec3 alb, float gloss, float jit) {
  float lv = litLv(dg, rad, gloss, jit);
  if (lv != 0.0) gCol = lv < -1.5 ? ramp(alb, 1.0, 0.0) : lv < 0.0 ? INK : ramp(alb, lv, 0.0);
}

// ---- sprites ----
// Heroes, hand and foot are pixel art, drawn frame by frame by
// scripts/toku/*.py (yarn gen:sprites): one texel is one virtual pixel and
// their positions snap to the grid, so every pixel on screen is the same size.
uniform sampler2D uAtlasHero0;
uniform sampler2D uAtlasHero1;
uniform sampler2D uAtlasHero2;

// frames on a hero's sheet (16 x 8 cells of 144 px, a hero about 100 px tall)
const float F_STANCE = 0.0, F_WALK = 8.0, F_RUN = 16.0, F_LOOK = 28.0, F_FLIP = 40.0, F_SKID = 52.0, F_KNOCK = 58.0, F_GETUP = 66.0,
            F_POSE = 76.0, F_PUNCH = 88.0, F_KICK = 96.0, F_FKICK = 104.0, F_BLAST = 112.0, F_TURN = 122.0, F_BOLT = 124.0;

// one frame of hero v's sheet, feet at o. The sheet is indexed: R = material,
// G = tone 1..5; the ramp of each material is built here from the suit colour
void heroSprite(vec2 p, vec2 o, float dir, float idx, vec3 suit, float v) {
  vec2 c = (p - snapv(o)) / gVP;
  c = vec2(c.x * dir + 72.0, c.y + 12.0);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= 144.0 || c.y >= 144.0) return;
  vec2 px = vec2(mod(idx, 16.0) * 144.0 + floor(c.x), floor(idx / 16.0) * 144.0 + 143.0 - floor(c.y));
  vec2 uv = vec2((px.x + 0.5) / 2304.0, 1.0 - (px.y + 0.5) / 1152.0);
  vec4 t = v < 0.5 ? texture2D(uAtlasHero0, uv) : v < 1.5 ? texture2D(uAtlasHero1, uv) : texture2D(uAtlasHero2, uv);
  if (t.a < 0.5) return;
  float mat = floor(t.r * 255.0 / 40.0 + 0.5), lv = floor(t.g * 255.0 / 50.0 + 0.5);
  if (mat > 5.5) gCol = lv > 4.5 ? vec3(1.0, 0.98, 0.9) : lv > 2.5 ? mix(suit, vec3(1.0, 0.96, 0.8), 0.6) : suit * 1.2;   // energy, swooshes
  else if (mat > 4.5) gCol = INK;
  else {
    // gloves and boots are white past the tone curve (1.4 comes out near 0.88), their shading two clear greys
    vec3 base = mat < 1.5 ? suit : mat < 2.5 ? vec3(1.4, 1.4, 1.36) : mat < 3.5 ? vec3(0.13, 0.16, 0.3) : vec3(1.1, 0.8, 0.08);
    vec3 col = ramp(base, lv, 0.0);
    if (mat < 1.5 && lv > 1.5 && lv < 2.5) col *= 0.8;                                    // the suit's core shadow sits at 0.4
    if (mat > 2.5 && mat < 3.5 && lv > 3.5) col = vec3(0.8, 0.88, 1.0);                     // the glint on the visor
    gCol = col * gSprLight;
  }
}

// smoke as an FX sprite: nothing, a checker fringe, tone a, tone b
void puff(float dens, vec3 a, vec3 b) {
  if (dens > 0.62) gCol = b;
  else if (dens > 0.38 || (dens > 0.32 && gD > 0.5)) gCol = a;
}

// a pyro charge, drawn on twos: a warm white core, the fire in three tones of
// its colour, then two tones of smoke that rise and break up. q from the
// charge, R its size, age in seconds-ish (0 = ignition)
void addBoom(vec2 q, float age, float R, vec3 hue, float seed) {
  if (age <= 0.0 || age > 1.6 || abs(q.x) > R * 2.2 || abs(q.y) > R * 3.2) return;
  age = floor(age * 15.0) / 15.0 + 0.03;
  float grow = 1.0 - exp(-age * 8.0);
  q.y -= R * 0.55 * age;
  // the noise moves the edge by 0.45 at most: further out than that there is no charge, and no noise to work out
  float d0 = length(q * vec2(1.0, 0.8)) / (R * (0.2 + 0.8 * grow)) + 0.9 * smoothstep(0.9, 1.6, age);
  if (d0 > 1.51) return;
  float n = fbm(q * 5.0 / R + vec2(seed * 9.0, -age * 2.5));
  float d = d0 + (n - 0.5) * 0.9;
  if (d > 1.05 || (d > 0.99 && gD < 0.5)) return;
  float fire = clamp(1.0 - age * 1.9, 0.0, 1.0) * (1.25 - d);
  vec3 sm = mix(hue, vec3(0.5, 0.48, 0.47), 0.6);
  gCol = fire > 0.8 ? vec3(1.0, 0.97, 0.8) : fire > 0.56 ? ramp(hue, 5.0, 0.0) : fire > 0.34 ? hue : fire > 0.16 ? ramp(hue, 3.0, 0.0)
       : ramp(sm, n + 0.5 * (q.y - q.x) / R > 0.56 ? 3.0 : 2.0, 0.0);
}

// a shower of sparks thrown up from q = 0, falling under gravity: one pixel
// wide streaks, white at the head and orange behind, and a hard star at the start
void addSparks(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 9.0) return;
  // every streak lies inside a half disc that grows with age and falls under gravity: outside it there is nothing to look for
  vec2 cc = q + vec2(0.0, 2.2 * R * age * age);
  float rm = R * (2.91 * age + 0.19) + 2.0 * gVP;
  int ni = dot(cc, cc) < rm * rm && cc.y > -0.18 * R - 2.0 * gVP ? 10 : 0;
  for (int i = 0; i < ni; i++) {
    float fi = float(i);
    if (age > 0.45 + 0.55 * h11(fi + seed * 3.0)) continue;                    // each one burns out in its own time
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    if (sdSeg(q, pos, pos - vel * 0.07) < 0.55 * gVP)
      gCol = length(q - pos) < 1.6 * gVP ? vec3(1.0, 0.97, 0.8) : age < 0.5 ? vec3(1.0, 0.72, 0.26) : vec3(0.86, 0.36, 0.2);
  }
  vec2 a = abs(q) / R;
  float star = max(a.x, a.y) + 5.0 * min(a.x, a.y);
  float sz = 0.55 * (1.0 - age * 7.0);
  if (star < sz) gCol = star < sz * 0.45 ? vec3(1.0, 0.97, 0.8) : vec3(1.0, 0.8, 0.36);
}

// what a consumer deck did to the picture. Up to half way the pixels stay
// clean: the deck only pushes the colour and lifts the blacks. Past that (hi)
// the tape itself shows: colour smeared sideways with the red lagging the blue
// (cl is the frame two pixels to the left: the one extra render it costs),
// interlace, noise, the head-switching band
vec3 tapeLook(vec3 c0, vec3 cl, vec2 fc, float amt, float hi) {
  vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 av = (c0 + cl) * 0.5;
  vec3 chroma = vec3(cl.r - dot(cl, W), av.g - dot(av, W), c0.b - dot(c0, W));
  vec3 c = mix(c0, vec3(dot(c0, W) * 0.85 + dot(av, W) * 0.15) + chroma * 1.25, hi);
  float line = floor(fc.y / uResolution.y * 486.0);
  c *= 1.0 - 0.1 * hi * mod(line + floor(uTime * 30.0), 2.0);                   // interlace
  c += (h21(fc + fract(uTime) * 91.0) - 0.5) * 0.07 * hi;                     // tape noise
  float sw = step(fc.y / uResolution.y, 0.02) * hi;                            // head-switching band
  c = mix(c, vec3(h21(vec2(floor(fc.x / 5.0), floor(uTime * 60.0) + line))) * 0.8, 0.6 * sw * step(0.35, h11(line + floor(uTime * 60.0))));
  c = mix(vec3(dot(c, W)), c, 1.0 + 0.25 * amt);                              // tape oversaturates
  c = c * (1.0 - 0.04 * amt) + 0.022 * amt;                                    // lifted blacks
  return c;
}
// ---- end of the tokusatsu kit ----

float gFit, gKick, gSc, gU, gM, gImpAge, gHaze, gPy;
vec2 gShake;
vec3 gSkin;
vec4 gS0, gS1, gS2;                      // per hero: x, y, lane, frame on the sheet
uniform sampler2D uAtlasFoot;
vec4 gBolt;                              // the energy bolt: x, y, on, which way its hero faces

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float land(float m) { return -1.3 + 0.1 * h11(m * 3.3 + 0.7); } // heel of stomp m, on screen at impact: the claws (1.08 on) end just short of the team
// where stomp m's heel is now: it rides the road, and the road scrolls in whole pixels
float heel(float m) { return sn(land(m) + m * 0.8 * clamp(pace, 0.3, 3.0)) - sn(gSc); }

// chunks of road thrown up by the toes
void rubble(vec2 q, float age, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > 0.6) return;
  // the chunks fly up and out inside a half ring that grows with age and falls: outside it there is none to draw
  vec2 cc = q + vec2(0.0, 0.75 * age * age);
  float rm = 0.9 * age + 0.05 + 2.0 * gVP;
  int ni = dot(cc, cc) < rm * rm && cc.y > -0.05 - 2.0 * gVP ? 5 : 0;
  for (int i = 0; i < ni; i++) {
    float fi = float(i);
    float an = mix(0.35, 2.6, h11(fi * 1.9 + seed));
    vec2 v = vec2(cos(an), sin(an)) * (0.35 + 0.55 * h11(fi * 2.7 + seed + 3.0));
    vec2 e = q - v * age - vec2(0.0, -0.75 * age * age);
    float ra = floor(age * (5.0 + 9.0 * h11(fi + seed)) * 2.5) / 2.5;          // it tumbles in held steps
    e = vec2(e.x * cos(ra) - e.y * sin(ra), e.x * sin(ra) + e.y * cos(ra));
    float sz = 0.014 + 0.022 * h11(fi * 4.1 + seed);
    lit(gBox(e, vec2(sz, sz * 0.7), 0.003), sz * 0.5, vec3(0.34, 0.34, 0.37), 0.0, 0.0);
  }
}

// the foot: one frame of the 4 x 2 sheet (384 x 352 cells, scripts/toku/ingest_giants.py),
// heel end of the sole at o. Above the top of the cell the leg just goes on. The sheet
// holds half the colour: ivory is brighter than a sheet value of 1 comes out of the tone curve
void footSprite(vec2 p, vec2 o, float f) {
  vec2 c = (p - snapv(o)) / gVP + vec2(128.0, 8.0);
  if (c.x < 0.0 || c.x >= 384.0 || c.y < 0.0) return;
  c.y = min(c.y, 351.0);
  vec2 px = vec2(mod(f, 4.0) * 384.0 + floor(c.x), floor(f / 4.0) * 352.0 + 351.0 - floor(c.y));
  vec4 t = texture2D(uAtlasFoot, vec2((px.x + 0.5) / 1536.0, 1.0 - (px.y + 0.5) / 704.0));
  if (t.a > 0.5) gCol = t.rgb * 2.0 * gSprLight;
}

// iq = the virtual pixel, counted from the middle of the screen
vec3 render(vec2 iq) {
  vec2 p = (iq + 0.5) * gVP + gShake;
  gQ = floor(p / gVP);
  gD = bayer2(gQ) + 0.125;
  gPx = gVP;
  float pc = clamp(pace, 0.3, 3.0);
  float S1 = nv(gSc);                                  // the street has scrolled this many pixels
  float X = p.x + S1 * gVP;
  float r0 = floor((p.y - sn(SY)) / gVP);              // rows up from the far kerb
  float PAV = nv(0.04);
  float fx = heel(gM);
  vec3 hazeC = mix(vec3(0.72, 0.7, 0.68), uColor3, 0.12);
  vec3 col;
  // nothing above the kerb is worked out for a pixel of road, and the other way round
  if (r0 >= PAV) {
    // ---- model blocks along the street, in whole pixels: where one stands, nothing behind it is worked out ----
    float y = r0 - PAV;
    float wd = nv(0.3), Xi = gQ.x + nv(gSc * 0.55);
    float id = floor(Xi / wd), lx = Xi - id * wd;
    float hh = nv(0.2 + 0.34 * h11(id * 1.7 + 1.0));
    if (lx >= 2.0 && lx < wd - 2.0 && y < hh) {
      vec3 bc = mix(vec3(0.62, 0.6, 0.57), mix(uColor2, uColor1, 0.5), 0.3 * h11(id + 3.0) + 0.05) * (0.78 + 0.4 * h11(id * 5.1 + 1.0));
      float sd = floor(wd * 0.84);                     // the side of the box, turned away from the key
      float lv = lx >= sd ? 2.0 : 3.0;
      if (y >= hh - 1.0) lv = 5.0; else if (y >= hh - 3.0) lv += 1.0;          // the parapet catches the light
      col = ramp(bc, lv, 0.0);
      float wx = mod(lx - 5.0, 7.0), wy = mod(y - 4.0, 10.0);
      if (lx >= 5.0 && y >= 4.0 && wx < 4.0 && wy < 6.0 && lx - wx + 4.0 < sd - 2.0 && y - wy + 6.0 < hh - 5.0)
        col = h21(vec2(floor((lx - 5.0) / 7.0), floor((y - 4.0) / 10.0)) + id * 7.0) > 0.8 ? (wy >= 4.0 ? vec3(1.0, 0.92, 0.66) : vec3(0.97, 0.76, 0.4))
                                                                                           : (wy >= 4.0 ? vec3(0.32, 0.4, 0.5) : vec3(0.09, 0.11, 0.2));
      col = mix(col, hazeC, 0.22);
    } else {
      // ---- sky in flat bands, clouds lit from the top left ----
      col = mix(hazeC, mix(vec3(0.35, 0.47, 0.66), uColor3, 0.25), qz(smoothstep(-0.1, 0.55, p.y), 5.0, 0.3));
      vec2 cp = vec2((gQ.x + nv(gSc * 0.033)) * gVP * 1.5, p.y * 4.0);
      if (fbm(cp) > 0.6) col = fbm(cp + vec2(-0.05, 0.14)) > 0.6 ? vec3(0.96, 0.94, 0.88) : vec3(0.74, 0.76, 0.86);
      // ---- the far skyline, sunk in haze: two tones and a few dark windows ----
      float wf = nv(0.19), Xf = gQ.x + nv(gSc * 0.18) + 1500.0;
      float fi = floor(Xf / wf), fl = Xf - fi * wf;
      float fh = nv(0.22 + 0.36 * h11(fi * 1.7 + 3.0));
      if (fl >= 1.0 && fl < wf - 1.0 && y < fh) {
        float fv = fl >= floor(wf * 0.8) ? 2.0 : y >= fh - 1.0 ? 4.0 : 3.0;
        vec2 wq = vec2(mod(fl, 5.0), mod(y, 6.0));
        if (fv == 3.0 && wq.x >= 2.0 && wq.x < 4.0 && wq.y >= 2.0 && wq.y < 4.0 && y < fh - 4.0 && fl > 1.5) fv = 2.0;
        col = mix(ramp(mix(vec3(0.56, 0.54, 0.52), uColor3, 0.3 * h11(fi + 9.0) + 0.05) * (0.8 + 0.4 * h11(fi * 5.1 + 3.0)), fv, 0.0), hazeC, 0.62);
      }
      // ---- the tail, over the rooftops ----
      gCol = col;
      if (p.x < 0.3 && p.y > 0.05) {
        float sway = sin(uBeatClock * TAU / 8.0);
        vec2 t0 = vec2(-1.1, 0.5), t1 = vec2(-0.55 + 0.1 * sway, 0.5 + 0.06 * sway), t2 = vec2(-0.2 + 0.22 * sway, 0.24 - 0.05 * sway);
        vec3 tg = vec3(1e3, 0.0, 0.0);
        vec2 pa = t0;
        for (int i = 1; i <= 6; i++) {
          float t = float(i) / 6.0;
          vec2 pb = mix(mix(t0, t1, t), mix(t1, t2, t), t);
          vec2 nrm = normalize(vec2(-(pb.y - pa.y), pb.x - pa.x));
          // back plates of our own: round paddles, big and small in turn
          float pr = (0.065 - 0.04 * t) * (mod(float(i), 2.0) < 0.5 ? 1.0 : 0.65);
          lit(gEll(p - pb - nrm * (0.1 - 0.075 * t + pr * 0.55), vec2(pr * 0.85, pr * 1.2)), pr, mix(gSkin * 1.5, uColor2, 0.25), 0.5, 0.0);
          tg = smin3(tg, gSeg(p, pa, pb, 0.1 - 0.075 * (t - 1.0 / 6.0), 0.1 - 0.075 * t), 0.02);
          pa = pb;
        }
        lit(tg, 0.08, gSkin, 0.0, 0.0);
      }
      col = mix(gCol, hazeC, 0.3);
    }
  } else if (r0 >= 0.0) {
    // ---- pavement: slabs, a lit kerb stone, the kerb's face in shade ----
    col = ramp(vec3(0.6, 0.59, 0.56), r0 >= PAV - 1.0 || r0 < 2.0 ? 2.0 : r0 < 3.0 ? 5.0 : mod(gQ.x + S1, nv(0.06)) < 1.0 ? 3.0 : 4.0, 0.0);
  } else {
    // ---- the road: every row scrolls by its own whole number of pixels ----
    float rr = -r0 - 1.0, f = (rr + 0.5) * gVP, k = 1.0 + f * 1.4;
    float Xr = (p.x + sn(gSc * k)) / k;
    vec3 rb = mix(vec3(0.36, 0.36, 0.39), uColor3, 0.05);
    float lv = rr < 2.0 ? 1.0 : rr < 3.0 ? 2.0 : 3.0;
    // what the last stomp left: a dent and cracks, carried off by the road
    vec2 cq = vec2(p.x / k - fx - 0.6, f - 0.1) * 0.45;
    float cr = length(cq * vec2(1.0, 3.0));
    if (cr < 0.13) lv = 2.0;
    if (cr < 0.42 && abs(fract(atan(cq.y * 3.0, cq.x) / TAU * 7.0 + 0.3 * sin(cr * 20.0)) - 0.5) * cr < 0.004) lv = 1.0;
    col = ramp(rb, lv, 0.0);
    float dl = rr - nv(0.085) + 1.0;
    if (dl >= 0.0 && dl < 3.0 && fract(Xr / 0.22) > 0.45) col = dl < 2.0 ? vec3(0.85, 0.83, 0.75) : vec3(0.58, 0.57, 0.6);
  }
  gCol = col;

  // ---- pavement furniture: lamp posts and toy cars ----
  {
    float P = nv(0.7);
    float li = mod(gQ.x + S1 + nv(0.2), P) - floor(P * 0.5);
    float ry = r0 - nv(0.02), top = nv(0.2), arm = nv(0.04);
    vec3 pole = vec3(0.3, 0.32, 0.38);
    if (ry >= 0.0 && ry < top) {
      if (li >= 0.0 && li < 2.0) gCol = ramp(pole, li < 1.0 ? 3.0 : 1.0, 0.0);
      if (ry >= top - 2.0 && li >= 0.0 && li < arm) gCol = ramp(pole, ry >= top - 1.0 ? 3.0 : 1.0, 0.0);
      if (ry >= top - 5.0 && ry < top - 2.0 && li >= arm - 4.0 && li < arm) gCol = ry >= top - 4.0 ? vec3(1.0, 0.95, 0.72) : vec3(0.98, 0.78, 0.42);
    }
    float ci = floor(X / 0.9);
    // the nearer the toes, the further the car is thrown, and it turns over in the air
    float carx = (ci + 0.5) * 0.9 - S1 * gVP;
    float near = exp(-pow((carx - fx - 1.0) / 0.45, 2.0));
    float jp = clamp(gImpAge * 2.2 - 0.2 * h11(ci), 0.0, 1.0);
    float jump = sn(sin(jp * 3.14159) * (0.04 + 0.22 * near));
    vec2 c = (vec2(mod(X, 0.9) - 0.45, p.y - sn(SY) - sn(0.012) - jump)) / 0.085 - vec2(0.0, 0.35);
    float spin = floor(jp * (1.0 - jp) * 4.0 * near * 1.4 * 5.0 + 0.5) / 5.0 * (h11(ci + 3.0) > 0.5 ? 1.0 : -1.0);
    c = vec2(c.x * cos(spin) - c.y * sin(spin), c.x * sin(spin) + c.y * cos(spin)) + vec2(0.0, 0.35);
    if (abs(c.x) < 1.4 && c.y > -0.5 - jump / 0.085 && c.y < 1.3) {
      gPx = gVP / 0.085;
      float hc = h11(ci * 3.7);
      vec3 paint = hc < 0.3 ? cA : hc < 0.55 ? cB : hc < 0.8 ? vec3(0.85) : cC;
      if (length(vec2(c.x, (c.y + jump / 0.085) * 5.0)) < 1.0) gCol = shade(gCol);
      lit(gCirc(c - vec2(-0.55, 0.13), 0.17), 0.1, vec3(0.16, 0.16, 0.2), 0.0, 0.0);
      lit(gCirc(c - vec2(0.55, 0.13), 0.17), 0.1, vec3(0.16, 0.16, 0.2), 0.0, 0.0);
      vec3 cb = smin3(gBox(c - vec2(0.0, 0.3), vec2(0.92, 0.19), 0.12), gBox(c - vec2(-0.06, 0.6), vec2(0.5, 0.2), 0.15), 0.08);
      float gl = max(abs(abs(c.x + 0.06) - 0.22) - 0.17, abs(c.y - 0.62) - 0.1);
      lit(cb, 0.14, gl < 0.0 ? vec3(0.2, 0.27, 0.4) : paint, 0.95, 0.0);
      gPx = gVP;
    }
  }

  // ---- shadow of the foot that is on its way: a checker while it is high, solid as it comes down ----
  float nxt = heel(gM + 1.0);
  float sh = smoothstep(0.4, 1.0, gU);
  vec2 sq = (p - vec2(nxt + 0.4, -0.31)) / vec2(0.35 + 0.45 * sh, 0.04 + 0.085 * sh);
  float ss = dot(sq, sq);
  if (sh > 0.45 ? ss < 1.0 : (sh > 0.08 && ss < 0.8 && gD > 0.5)) gCol = shade(gCol);

  // ---- charges along the street, behind the team ----
  float boomAge = mod(gM, 2.0) < 0.5 ? gImpAge : -1.0;
  if (gPy > 0.0) {
    addBoom(p - vec2(-0.01 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.05, 0.25 * gPy, cA, gM + 1.0);
    addBoom(p - vec2(0.33 - boomAge * 0.2 * pc * 2.1, -0.17), boomAge - 0.16, 0.3 * gPy, cB, gM + 2.0);
    addBoom(p - vec2(0.7 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.27, 0.25 * gPy, cC, gM + 3.0);
  }

  // ---- impact: dust thrown up behind the foot, at the heel and out past the claws: the toes stay in the clear ----
  float dR = (0.08 + 0.12 * smoothstep(0.0, 0.5, gImpAge)) * (0.5 + 0.5 * gHaze);
  addBoom(p - vec2(fx - 0.38, -0.3), gImpAge * 0.9 + 0.55, dR, vec3(0.62, 0.58, 0.52), 11.0);
  addBoom(p - vec2(fx + 0.5, -0.2), gImpAge * 0.9 + 0.55, dR * 1.2, vec3(0.62, 0.58, 0.52), 12.0);

  // ---- smoke machine: wisps along the road, thicker after a stomp, behind the feet and the team ----
  // the noise is worked out only on the rows where the bank's profile alone clears the lowest threshold of puff()
  // (a loop of none or one, like the cull in addSparks: the loop that is not entered was measured to cost nothing)
  float hy = (p.y + 0.27) / 0.14;
  int nh = gHaze * exp(-hy * hy) > 0.31 ? 1 : 0;
  for (int i = 0; i < nh; i++) {
    float hz = fbm(vec2((gQ.x + nv(gSc * 1.2)) * gVP * 2.2 - uTime * 0.05, p.y * 13.0));
    puff(gHaze * (0.5 + 0.5 * exp(-gImpAge * 2.0)) * exp(-pow((p.y + 0.27) / 0.14, 2.0)) * hz * hz, hazeC, mix(hazeC, vec3(0.95, 0.94, 0.9), 0.5));
  }

  // ---- the feet ----
  float up = ease((gU - 0.5) / 0.22);
  footSprite(p, vec2(fx + 0.5 * up * up, -0.3 + 1.3 * up * up), up > 0.35 ? 6.0 : up > 0.02 ? 5.0 : gImpAge < 0.07 ? 2.0 : gImpAge < 0.2 ? 3.0 : 4.0);
  float dwn = clamp((gU - 0.8) / 0.2, 0.0, 1.0);
  if (gU > 0.78) footSprite(p, vec2(nxt, -0.3 + 1.3 * (1.0 - dwn * dwn)), dwn > 0.5 ? 1.0 : 0.0);

  // ---- the team ----
  // the first, the second, the second one's bolt, the third: one copy of the sprite code, run for each
  for (int j = 0; j < 4; j++) {
    if (j == 2 && gBolt.z < 0.5) continue;
    vec4 hs = j == 0 ? gS0 : j == 1 ? gS1 : j == 3 ? gS2 : vec4(gBolt.xy - vec2(0.0, 60.0 * gVP), 0.0, F_BOLT + mod(floor(uTime * 12.0), 4.0));
    vec2 s2 = (p - vec2(hs.x, hs.z)) / vec2(0.075, 0.013);
    if (j != 2 && dot(s2, s2) < 1.0) gCol = shade(gCol);
    heroSprite(p, hs.xy, j == 1 ? gBolt.w : j == 2 ? -1.0 : 1.0, hs.w, j == 0 ? cA : j == 3 ? cC : cB, j == 0 ? 0.0 : j == 3 ? 2.0 : 1.0);
  }
  addSparks(p - vec2(fx + 1.05, -0.27), (gU * 4.0 * 0.47 - 0.95) * 2.0 * step(0.5, mod(gM, 2.0)), 0.14, gM + 9.0);   // where the bolt lands
  addSparks(p - vec2(fx + 1.2, -0.33), gImpAge * 1.2, 0.2 * (0.3 + 0.7 * gPy), gM);
  rubble(p - vec2(fx + 1.22, -0.33), gImpAge * 1.1, gM);

  // ---- a post right in front of the lens: a dark cut-out with one lit edge ----
  float po = mod(gQ.x + nv(gSc * 2.4) + nv(1.2), nv(6.24)) - nv(1.2);
  if (abs(po) < nv(0.04)) gCol = po < 3.0 - nv(0.04) ? vec3(0.2, 0.2, 0.27) : vec3(0.07, 0.07, 0.12);
  return gCol;
}

// the team: three strides out of step, a look back as the shadow comes over,
// and the last in line dives clear and rolls back onto his feet
// (a function called three times with k written out, not a loop: straight-line code that depends on
// nothing but uniforms is worked out once a frame, a loop of it once a pixel)
vec4 hero(int k) {
  float fk = float(k);
  float x = 0.07 + 0.31 * fk + 0.02 * sin(uBeatClock * (0.7 + 0.23 * fk) + fk * 2.0);
  float ly = k == 1 ? -0.44 : -0.36;                  // the one in the middle runs a lane nearer the lens: they are wider than the gaps
  float hop = 0.045 * sin(clamp(gImpAge * 2.6 - 0.12 * fk, 0.0, 1.0) * 3.14159);
  float dv = k == 0 ? clamp((gU > 0.5 ? gU - 0.92 : gU + 0.08) / 0.24, 0.0, 1.0) : 0.0;
  float wT = smoothstep(0.0, 0.08, dv) * (1.0 - smoothstep(0.9, 1.0, dv));
  hop = mix(hop, 0.12 * sin(dv * 3.14159), wT);
  x += 0.06 * sin(dv * 3.14159);
  float lb = k == 2 ? 0.0 : smoothstep(0.5 + 0.06 * fk, 0.6 + 0.06 * fk, gU) * (1.0 - smoothstep(0.84, 0.92, gU));
  float fr = (lb > 0.5 ? F_LOOK : F_RUN) + floor(fract(uBeatClock * 1.5 + fk * 0.37) * 12.0);
  if (wT > 0.5) fr = F_FLIP + floor(dv * 11.99);
  if (k == 1) {
    // on the stomps with no charges, the second one turns and puts a bolt into the toes
    float on = mod(gM, 2.0) > 0.5 ? 1.0 : 0.0;
    float bp = clamp((gU - 0.1) / 0.24, 0.0, 1.0) * on;
    float act = step(0.001, bp) * step(bp, 0.999);
    if (act > 0.5) fr = bp < 0.08 ? F_TURN : bp > 0.92 ? F_TURN + 1.0 : F_BLAST + floor(clamp((bp - 0.08) / 0.84, 0.0, 1.0) * 9.99);
    float fl = clamp((bp - 0.52) / 0.4, 0.0, 1.0);
    float toe = land(gM) - gU * 4.0 * 0.2 * clamp(pace, 0.3, 3.0) + 1.0;
    gBolt = vec4(mix(x - 0.2, toe, fl), mix(-0.22, -0.24, fl), step(0.001, fl) * step(fl, 0.999) * on, act > 0.5 ? -1.0 : 1.0);
  }
  return vec4(x, ly + hop, ly, fr);
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  // one grid of virtual pixels for everything: about 216 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 216.0 + 0.5));
  gVP = scl * gFit / uResolution.y;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);
  gSkin = vec3(0.34, 0.4, 0.49);                                         // the tail: the hide of the foot's sheet

  gSc = uBeatClock * 0.2 * clamp(pace, 0.3, 3.0);
  float sb = uBeatClock / 4.0;
  gM = floor(sb);
  gU = fract(sb);
  gImpAge = gU * 4.0 * 0.47;

  gS0 = hero(0);
  gS1 = hero(1);
  gS2 = hero(2);

  float hit = exp(-gImpAge * 5.0) + 0.1 * gKick;
  gShake = snapv(hit * vec2(0.03 * sin(uTime * 57.0), 0.05 * cos(uTime * 43.0)) + vec2(0.0, -0.03 * exp(-gImpAge * 11.0)));
  float flash = (mod(gM, 2.0) < 0.5 ? exp(-max(gImpAge - 0.1, 0.0) * 5.0) : 0.0) * gPy;
  gL = normalize(vec3(-0.55, 0.5, 0.67));
  gSprLight = vec3(1.0, 0.98, 0.95) * (1.0 + 0.35 * flash);

  // the frame is worked out once per virtual pixel. The middle of the screen sits on a
  // pixel boundary at any resolution, so sprite texels never straddle two of them
  vec2 vq = floor(gl_FragCoord.xy / scl);
  float hi = smoothstep(0.5, 1.0, tp);
  // tracking error, only at the high end of the tape: a row slips sideways by a whole pixel
  vq.x += floor(hi * 1.6 * (h11(vq.y + floor(uTime * 30.0) * 3.1) - 0.5) + 0.5);
  vq -= floor(0.5 * uResolution / scl);
  // the smear's second render is a second pass through the same code, not a second copy of it:
  // a copy behind `if (hi > 0.0)` cost every pixel as much as the first, tape or no tape
  vec3 c0, cl;
  int nr = hi > 0.0 ? 2 : 1;
  for (int i = 0; i < nr; i++) {
    cl = render(vq - vec2(i == 0 ? 0.0 : 2.0, 0.0));
    if (i == 0) c0 = cl;
  }
  gl_FragColor = vec4(max(tapeLook(c0, cl, gl_FragCoord.xy, tp, hi), 0.0), 1.0);
}

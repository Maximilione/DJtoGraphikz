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
// them walks something whose foot is the size of a building: a suit actor's
// boot of wet green latex, scales and sagging ankle folds, ivory claws. Every
// 4 beats its shadow spreads on the road, the foot comes down on the beat
// (the camera jolts, the cars jump, dust and sparks go up), stays planted and
// slides away with the road, then lifts. On every other stomp the charges
// buried along the street go off behind the team in their colours. The tail
// sweeps over the rooftops. The scroll is locked to the beat clock, so a
// planted foot stays exactly where the road takes it.

const float SY = -0.2;                   // far kerb

// ---- tokusatsu kit: the same block lives in titanhand.frag and kaijustomp.frag ----
// Everything here is drawn as a lit object, not as a flat shape: each 2D
// distance field carries its gradient, the inside is given a round profile,
// and that normal is lit by a key light, a coloured back light and a wet
// specular. That is what makes latex read as latex.
const float TAU = 6.2831853;

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
float gPx;                      // edge softness: one pixel in focus, many out of it
float gAlpha;                   // 1 for solids, less for the smear behind a fast limb
vec3 gL, gKey, gAmb, gRim;      // key direction and colour, ambient, back light
vec3 cA, cB, cC;                // the three suit colours, from the palette

float aa(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }

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

// light a field as a rounded solid. rad = how far in the surface keeps
// curving; gloss 0 cloth .. 1 wet latex; bn = extra normal tilt (texture)
void lit(vec3 dg, float rad, vec3 alb, float gloss, vec2 bn) {
  float d = dg.x;
  if (d > 0.03) return;
  gCol *= 1.0 - 0.4 * gAlpha * (1.0 - smoothstep(0.0, 0.03, d)) * step(0.0, d);     // it shades what is behind it
  float t = clamp(-d / rad, 0.0, 1.0);
  float z = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  vec3 n = normalize(vec3(dg.yz * (1.0 - t) + bn, z + 0.06));
  float dif = max(dot(n, gL) * 0.8 + 0.2, 0.0);
  float sp = pow(max(dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))), 0.0), mix(10.0, 110.0, gloss)) * gloss * (0.35 + 2.2 * gloss);
  float rim = pow(1.0 - n.z, 2.2) * max(dot(n.xy, -normalize(gL.xy)) * 0.6 + 0.6, 0.0);
  vec3 c = alb * (gAmb + gKey * dif) + gKey * sp + gRim * rim * (0.2 + 0.6 * alb + 0.3 * gloss);
  c *= 0.5 + 0.5 * smoothstep(0.0, 0.3, t);
  gCol = mix(gCol, c, aa(d) * gAlpha);
}

// ---- sprites ----
// Heroes, hand and foot are pixel art, drawn frame by frame by
// scripts/gen-toku-sprites.py. The whole picture lives on one grid of
// virtual pixels (about 270 lines): sprites are drawn 1:1 on it and their
// positions snap to it, so every pixel on screen is the same size.
uniform sampler2D uAtlasHero;
float gVP;                      // one virtual pixel, in scene units
vec3 gSprLight;                 // the light of the set on the sprites
vec2 snapv(vec2 o) { return floor(o / gVP + 0.5) * gVP; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

// one frame of the hero sheet (18 x 8 cells of 112 px), feet at o. The sheet is
// indexed: R = material, G = tone; each hero's ramp is built from his colour
void heroSprite(vec2 p, vec2 o, float dir, float idx, vec3 suit) {
  vec2 c = (p - snapv(o)) / gVP;
  c = vec2(c.x * dir + 56.0, c.y + 12.0);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= 112.0 || c.y >= 112.0) return;
  vec2 px = vec2(mod(idx, 18.0) * 112.0 + floor(c.x), floor(idx / 18.0) * 112.0 + 111.0 - floor(c.y));
  vec4 t = texture2D(uAtlasHero, vec2((px.x + 0.5) / 2016.0, 1.0 - (px.y + 0.5) / 896.0));
  if (t.a < 0.5) return;
  float mat = floor(t.r * 255.0 / 40.0 + 0.5), lv = floor(t.g * 255.0 / 50.0 + 0.5);
  vec3 base = mat < 1.5 ? suit : mat < 2.5 ? vec3(0.96, 0.96, 0.93) : mat < 3.5 ? vec3(0.12, 0.14, 0.24) : vec3(1.0, 0.8, 0.25);
  float lo = mat > 1.5 && mat < 2.5 ? 0.58 : 0.4;
  // the ramp: shadows go cool, the highlight goes warm, the way a palette is picked by hand
  vec3 col = lv < 1.5 ? mix(base * lo, vec3(0.12, 0.08, 0.3), 0.25) : lv < 2.5 ? base * mix(lo, 1.0, 0.55)
           : lv < 3.5 ? base : mix(base, vec3(1.0, 1.0, 0.9), 0.55);
  gCol = mat > 4.5 ? vec3(0.04, 0.03, 0.08) : col * gSprLight;
}

// a pyro charge: white-hot core, coloured fire, then smoke that rises. q from the
// charge, R its size, age in seconds-ish (0 = ignition). rgb premultiplied, a = cover
vec4 boom(vec2 q, float age, float R, vec3 hue, float seed) {
  if (age <= 0.0 || age > 1.6 || abs(q.x) > R * 2.2) return vec4(0.0);
  float grow = 1.0 - exp(-age * 8.0);
  q.y -= R * 0.55 * age;
  float n = fbm(q * 5.0 / R + vec2(seed * 9.0, -age * 2.5));
  float d = length(q * vec2(1.0, 0.8)) / (R * (0.2 + 0.8 * grow)) + (n - 0.5) * 0.9;
  float heat = clamp(1.0 - age * 1.9, 0.0, 1.0);
  float core = 1.0 - smoothstep(0.05, 0.75, d);
  vec3 fire = mix(hue * 1.3, vec3(1.0, 0.96, 0.78), core * core) * (1.0 + 2.2 * core);
  vec3 smoke = mix(hue * 0.4, vec3(0.16, 0.15, 0.15), 0.45) * (0.5 + 0.9 * n);
  float a = (1.0 - smoothstep(0.7, 1.08, d)) * (1.0 - smoothstep(0.9, 1.6, age));
  vec3 c = mix(smoke, fire, heat * (0.3 + 0.7 * core));
  // the bloom the tube adds around anything this bright
  float halo = heat * heat * exp(-dot(q, q) / (R * R * 1.4));
  return vec4(c * a + hue * halo * 0.55 * (1.0 - a), a);
}
void addBoom(vec2 q, float age, float R, vec3 hue, float seed) {
  vec4 b = boom(q, age, R, hue, seed);
  gCol = gCol * (1.0 - b.a) + b.rgb;
}

// a shower of sparks thrown up from q = 0, falling under gravity
vec3 sparks(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 9.0) return vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    float d = sdSeg(q, pos, pos - vel * 0.07);
    acc += exp(-d * d / (R * R * 0.0004)) * (0.4 + 0.6 * h11(fi + seed * 3.0));
  }
  return vec3(1.0, 0.72, 0.3) * acc * 2.8 * (1.0 - age) + vec3(1.0, 0.85, 0.6) * exp(-dot(q, q) / (R * R * 0.08)) * max(1.0 - age * 6.0, 0.0);
}

// what a consumer deck did to the picture. c0 is the frame, cl the same frame a
// few pixels to the left: the second render is what the colour smear costs
vec3 tapeLook(vec3 c0, vec3 cl, vec2 fc, float amt) {
  vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 av = (c0 + cl) * 0.5;
  // luma stays sharp, colour is smeared sideways and the red lags the blue
  vec3 chroma = vec3(cl.r - dot(cl, W), av.g - dot(av, W), c0.b - dot(c0, W));
  vec3 c = mix(c0, vec3(dot(c0, W) * 0.85 + dot(av, W) * 0.15) + chroma * 1.25, amt);
  float line = floor(fc.y / uResolution.y * 486.0);
  c *= 1.0 - 0.1 * amt * mod(line + floor(uTime * 30.0), 2.0);                  // interlace
  c += (h21(fc + fract(uTime) * 91.0) - 0.5) * 0.07 * amt;                    // tape noise
  float sw = step(fc.y / uResolution.y, 0.02) * amt;                           // head-switching band
  c = mix(c, vec3(h21(vec2(floor(fc.x / 5.0), floor(uTime * 60.0) + line))) * 0.8, 0.6 * sw * step(0.35, h11(line + floor(uTime * 60.0))));
  c = mix(vec3(dot(c, W)), c, 1.0 + 0.25 * amt);                              // tape oversaturates
  c = c * (1.0 - 0.04 * amt) + 0.022 * amt;                                    // lifted blacks
  return c;
}
// ---- end of the tokusatsu kit ----

float gPix, gFit, gKick, gSc, gU, gM, gImpAge, gHaze, gPy;
vec2 gShake;
vec3 gSkin;
vec4 gS0, gS1, gS2;                      // per hero: x, y, lane, frame on the sheet
uniform sampler2D uAtlasFoot;

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float land(float m) { return -0.72 + 0.1 * h11(m * 3.3 + 0.7); }  // heel of stomp m, on screen at impact: the toes end just short of the team

// chunks of road thrown up by the toes
void rubble(vec2 q, float age, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > 0.6) return;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float an = mix(0.35, 2.6, h11(fi * 1.9 + seed));
    vec2 v = vec2(cos(an), sin(an)) * (0.35 + 0.55 * h11(fi * 2.7 + seed + 3.0));
    vec2 e = q - v * age - vec2(0.0, -0.75 * age * age);
    float ra = age * (5.0 + 9.0 * h11(fi + seed));
    e = vec2(e.x * cos(ra) - e.y * sin(ra), e.x * sin(ra) + e.y * cos(ra));
    float sz = 0.012 + 0.022 * h11(fi * 4.1 + seed);
    lit(gBox(e, vec2(sz, sz * 0.7), 0.003), sz * 0.5, vec3(0.2, 0.2, 0.21), 0.15, vec2(0.0));
  }
}

// the foot: one frame of the 4 x 2 sheet (448 x 400 cells), heel end of the sole
// at o. Above the top of the cell the leg just goes on
void footSprite(vec2 p, vec2 o, float f) {
  vec2 c = (p - snapv(o)) / gVP + vec2(150.0, 8.0);
  if (c.x < 0.0 || c.x >= 448.0 || c.y < 0.0) return;
  c.y = min(c.y, 399.0);
  vec2 px = vec2(mod(f, 4.0) * 448.0 + floor(c.x), floor(f / 4.0) * 400.0 + 399.0 - floor(c.y));
  vec4 t = texture2D(uAtlasFoot, vec2((px.x + 0.5) / 1792.0, 1.0 - (px.y + 0.5) / 800.0));
  if (t.a > 0.5) gCol = t.rgb * gSprLight;
}

// far tower blocks, mid blocks: one function, different scale and blur
vec3 blocks(vec2 p, float X, float base, float wd, float hmin, float hvar, float seed, vec3 tintc, out float cover) {
  float id = floor(X / wd);
  float lx = fract(X / wd);
  float hh = hmin + hvar * h11(id * 1.7 + seed);
  float y = p.y - base;
  float gapx = min(lx, 1.0 - lx) * wd - 0.006;
  float d = max(y - hh, -gapx);
  cover = aa(d);
  vec3 c = mix(vec3(0.5, 0.48, 0.46), tintc, 0.3 * h11(id + seed * 3.0) + 0.05) * (0.7 + 0.5 * h11(id * 5.1 + seed));
  // the side of the box, turned away from the key
  c *= lx > 0.84 ? 0.55 : 1.0;
  vec2 wc = vec2(lx * wd / 0.032, y / 0.045);
  vec2 wf = fract(wc) - 0.5;
  float wdw = max(abs(wf.x) - 0.28, abs(wf.y) - 0.3);
  vec3 glass = mix(vec3(0.05, 0.07, 0.1), vec3(0.3, 0.38, 0.45), wf.y + 0.5);
  glass = mix(glass, vec3(1.0, 0.82, 0.45), 0.7 * step(0.8, h21(floor(wc) + id * 7.0)));
  c = mix(c, glass, (1.0 - smoothstep(-0.06, 0.06, wdw)) * step(lx, 0.82) * step(0.04, lx) * step(y, hh - 0.03) * step(0.04, y));
  c *= 0.75 + 0.35 * fbm(vec2(X * 20.0, y * 6.0));
  c *= 1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.01, abs(y - hh + 0.008)));     // roof edge catches the light
  return c;
}

vec3 render(vec2 fc) {
  vec2 p = (fc - 0.5 * uResolution) / uResolution.y * gFit + gShake;
  float X = p.x + gSc;
  vec3 hazeC = mix(vec3(0.72, 0.7, 0.68), uColor3, 0.12);
  // ---- sky and the far skyline: out of focus, sunk in haze ----
  vec3 col = mix(hazeC, mix(vec3(0.35, 0.47, 0.66), uColor3, 0.25), smoothstep(-0.1, 0.55, p.y));
  col = mix(col, vec3(0.95, 0.93, 0.9), 0.35 * smoothstep(0.45, 0.8, fbm(vec2(p.x * 1.5 + gSc * 0.05, p.y * 4.0))));
  float cov;
  gPx = gPix * 9.0;
  vec3 far = blocks(p, p.x + gSc * 0.18 + 7.0, SY + 0.02, 0.19, 0.22, 0.36, 3.0, uColor3, cov);
  col = mix(col, mix(far, hazeC, 0.62), cov);

  // ---- the tail, over the rooftops ----
  gPx = gPix * 3.0;
  gCol = col;
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
    lit(gEll(p - pb - nrm * (0.1 - 0.075 * t + pr * 0.55), vec2(pr * 0.85, pr * 1.2)), pr, mix(gSkin * 2.2, uColor2 * 0.5, 0.25), 0.5, vec2(0.0));
    tg = smin3(tg, gSeg(p, pa, pb, 0.1 - 0.075 * (t - 1.0 / 6.0), 0.1 - 0.075 * t), 0.02);
    pa = pb;
  }
  lit(tg, 0.08, gSkin * (0.6 + 0.8 * fbm(p * 40.0)), 0.45, (vec2(vn(p * 60.0), vn(p * 60.0 + 7.0)) - 0.5) * 0.9);
  col = mix(gCol, hazeC, 0.3);

  // ---- model blocks along the street ----
  gPx = gPix * 2.0;
  vec3 mid = blocks(p, p.x + gSc * 0.55, SY + 0.03, 0.3, 0.2, 0.34, 1.0, mix(uColor2, uColor1, 0.5), cov);
  col = mix(col, mix(mid, hazeC, 0.22), cov);

  // ---- pavement, road ----
  gPx = gPix;
  if (p.y < SY + 0.04) {
    float f = SY - p.y;
    vec3 pav = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * fbm(vec2(X * 30.0, p.y * 80.0)));
    pav *= 1.0 - 0.3 * step(fract(X / 0.06), 0.06);
    col = mix(col, pav, step(p.y, SY + 0.04));
    if (f > 0.0) {
      float Xr = p.x / (1.0 + f * 1.4) + gSc;
      vec3 road = mix(vec3(0.25, 0.25, 0.27), uColor3, 0.05) * (0.75 + 0.5 * fbm(vec2(Xr * 18.0, f * 60.0)));
      road = mix(road, vec3(0.85, 0.83, 0.75), 0.75 * step(abs(f - 0.085), 0.006 + 0.01 * f) * step(0.45, fract(Xr / 0.22)));
      road *= 0.6 + 0.4 * smoothstep(0.0, 0.03, f);
      // what the last stomp left: a dent and cracks, carried off by the road
      vec2 cq = vec2(p.x / (1.0 + f * 1.4) - (land(gM) + 0.6 - gU * 4.0 * 0.2 * clamp(pace, 0.3, 3.0)), f - 0.1) * 0.45;
      float cr = length(cq * vec2(1.0, 3.0));
      float crack = 1.0 - smoothstep(0.0, 0.012, abs(fract(atan(cq.y * 3.0, cq.x) / TAU * 7.0 + 0.3 * sin(cr * 20.0)) - 0.5) * cr);
      road *= 1.0 - 0.5 * crack * smoothstep(0.42, 0.1, cr) - 0.25 * smoothstep(0.3, 0.0, cr);
      col = road;
    }
  }
  gCol = col;

  // ---- pavement furniture: lamp posts and toy cars ----
  {
    float lxp = mod(X + 0.2, 0.7) - 0.35;
    vec2 lq = vec2(lxp, p.y - SY - 0.02);
    float pole = max(abs(lq.x) - 0.004, max(-lq.y, lq.y - 0.2));
    pole = min(pole, max(abs(lq.y - 0.2) - 0.003, max(-lq.x, lq.x - 0.04)));
    gCol = mix(gCol, vec3(0.1, 0.11, 0.12), aa(pole));
    gCol += vec3(1.0, 0.9, 0.6) * (0.9 * aa(length(lq - vec2(0.04, 0.193)) - 0.008) + 0.25 * exp(-dot(lq - vec2(0.04, 0.19), lq - vec2(0.04, 0.19)) * 900.0));
    float ci = floor(X / 0.9);
    // the nearer the toes, the further the car is thrown, and it turns over in the air
    float carx = (ci + 0.5) * 0.9 - gSc;
    float near = exp(-pow((carx - (land(gM) + 0.9 - gU * 4.0 * 0.2 * clamp(pace, 0.3, 3.0))) / 0.45, 2.0));
    float jp = clamp(gImpAge * 2.2 - 0.2 * h11(ci), 0.0, 1.0);
    float jump = sin(jp * 3.14159) * (0.04 + 0.22 * near);
    vec2 c = (vec2(mod(X, 0.9) - 0.45, p.y - SY - 0.012 - jump)) / 0.085 - vec2(0.0, 0.35);
    float spin = jp * (1.0 - jp) * 4.0 * near * 1.4 * (h11(ci + 3.0) > 0.5 ? 1.0 : -1.0);
    c = vec2(c.x * cos(spin) - c.y * sin(spin), c.x * sin(spin) + c.y * cos(spin)) + vec2(0.0, 0.35);
    if (abs(c.x) < 1.4 && c.y > -0.5 && c.y < 1.3) {
      float keep = gPx;
      gPx /= 0.085;
      float hc = h11(ci * 3.7);
      vec3 paint = hc < 0.3 ? cA : hc < 0.55 ? cB : hc < 0.8 ? vec3(0.85) : cC;
      gCol *= 1.0 - 0.45 * (1.0 - smoothstep(0.5, 1.0, length(vec2(c.x, (c.y + jump * 10.0) * 5.0))));
      lit(gCirc(c - vec2(-0.55, 0.13), 0.17), 0.1, vec3(0.03), 0.4, vec2(0.0));
      lit(gCirc(c - vec2(0.55, 0.13), 0.17), 0.1, vec3(0.03), 0.4, vec2(0.0));
      vec3 cb = smin3(gBox(c - vec2(0.0, 0.3), vec2(0.92, 0.19), 0.12), gBox(c - vec2(-0.06, 0.6), vec2(0.5, 0.2), 0.15), 0.08);
      vec3 al = paint * 0.9;
      float gl = max(abs(abs(c.x + 0.06) - 0.22) - 0.17, abs(c.y - 0.62) - 0.1);
      al = mix(al, vec3(0.04, 0.06, 0.09), 1.0 - smoothstep(-0.02, 0.02, gl));
      lit(cb, 0.14, al, 0.95, vec2(0.0));
      gPx = keep;
    }
  }

  // ---- shadow of the foot that is on its way ----
  float pc = clamp(pace, 0.3, 3.0);
  float nxt = land(gM + 1.0) + (1.0 - gU) * 4.0 * 0.2 * pc;
  float sh = smoothstep(0.4, 1.0, gU);
  vec2 sq = (p - vec2(nxt + 0.4, -0.31)) / vec2(0.35 + 0.45 * sh, 0.04 + 0.085 * sh);
  gCol *= 1.0 - 0.72 * sh * (1.0 - smoothstep(0.3, 1.0, dot(sq, sq)));

  // ---- charges along the street, behind the team ----
  float boomAge = mod(gM, 2.0) < 0.5 ? gImpAge : -1.0;
  if (gPy > 0.0) {
    addBoom(p - vec2(0.3 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.05, 0.25 * gPy, cA, gM + 1.0);
    addBoom(p - vec2(0.55 - boomAge * 0.2 * pc * 2.1, -0.17), boomAge - 0.16, 0.3 * gPy, cB, gM + 2.0);
    addBoom(p - vec2(0.8 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.27, 0.25 * gPy, cC, gM + 3.0);
  }

  // ---- the feet ----
  float drift = gU * 4.0 * 0.2 * pc;
  float up = ease((gU - 0.5) / 0.22);
  footSprite(p, vec2(land(gM) - drift + 0.5 * up * up, -0.3 + 1.3 * up * up), up > 0.35 ? 6.0 : up > 0.02 ? 5.0 : gImpAge < 0.07 ? 2.0 : gImpAge < 0.2 ? 3.0 : 4.0);
  float dwn = clamp((gU - 0.8) / 0.2, 0.0, 1.0);
  if (gU > 0.78) footSprite(p, vec2(nxt, -0.3 + 1.3 * (1.0 - dwn * dwn)), dwn > 0.5 ? 1.0 : 0.0);

  // ---- impact: dust thrown out both ways along the road, sparks ----
  float fx = land(gM) - drift;
  addBoom(p - vec2(fx + 0.95, -0.35), gImpAge * 0.9 + 0.55, (0.07 + 0.11 * smoothstep(0.0, 0.5, gImpAge)) * (0.5 + 0.5 * gHaze), vec3(0.62, 0.58, 0.52), 11.0);
  addBoom(p - vec2(fx + 0.55, -0.37), gImpAge * 0.9 + 0.55, (0.06 + 0.1 * smoothstep(0.0, 0.5, gImpAge)) * (0.5 + 0.5 * gHaze), vec3(0.62, 0.58, 0.52), 12.0);

  // ---- the team ----
  for (int k = 0; k < 3; k++) {
    vec4 hs = k == 0 ? gS0 : k == 1 ? gS1 : gS2;
    vec2 s2 = (p - vec2(hs.x, hs.z)) / vec2(0.075, 0.013);
    gCol *= 1.0 - 0.5 * (1.0 - smoothstep(0.4, 1.0, dot(s2, s2)));
    heroSprite(p, hs.xy, 1.0, hs.w, k == 0 ? cA : k == 1 ? cB : cC);
  }
  gCol += sparks(p - vec2(fx + 0.9, -0.31), gImpAge * 1.2, 0.26 * (0.3 + 0.7 * gPy), gM);
  rubble(p - vec2(fx + 0.85, -0.31), gImpAge * 1.1, gM);

  // ---- smoke machine, then whatever is too close to the lens to focus on ----
  float hz = fbm(vec2(p.x * 2.2 + gSc * 1.2 - uTime * 0.05, p.y * 6.0));
  gCol = mix(gCol, hazeC, clamp(gHaze * (0.2 + 0.25 * exp(-gImpAge * 2.0) * step(0.0, gImpAge)) * exp(-pow((p.y + 0.27) / 0.16, 2.0)) * (0.3 + hz), 0.0, 0.85));
  float nx = (mod(p.x / 2.4 + gSc, 2.6) - 0.5) * 2.4;
  float post = smoothstep(0.06, 0.0, abs(nx) - 0.012);
  gCol = mix(gCol, vec3(0.04, 0.05, 0.05) + hazeC * 0.08, 0.8 * post);
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gAlpha = 1.0;
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  // one grid of virtual pixels for everything: about 270 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 270.0));
  gVP = scl * gFit / uResolution.y;
  gPix = 0.6 * gVP;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);
  gSkin = vec3(0.2, 0.22, 0.2);                                         // the tail: the same charcoal as the foot's palette

  gSc = uBeatClock * 0.2 * clamp(pace, 0.3, 3.0);
  float sb = uBeatClock / 4.0;
  gM = floor(sb);
  gU = fract(sb);
  gImpAge = gU * 4.0 * 0.47;

  // the team: three strides out of step, a look back as the shadow comes over,
  // and the last in line dives clear and rolls back onto his feet
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = 0.42 + 0.18 * fk + 0.02 * sin(uBeatClock * (0.7 + 0.23 * fk) + fk * 2.0);
    float ly = k == 1 ? -0.4 : -0.37;
    float hop = 0.045 * sin(clamp(gImpAge * 2.6 - 0.12 * fk, 0.0, 1.0) * 3.14159);
    float dv = k == 0 ? clamp((gU > 0.5 ? gU - 0.92 : gU + 0.08) / 0.24, 0.0, 1.0) : 0.0;
    float wT = smoothstep(0.0, 0.08, dv) * (1.0 - smoothstep(0.9, 1.0, dv));
    hop = mix(hop, 0.12 * sin(dv * 3.14159), wT);
    x += 0.06 * sin(dv * 3.14159);
    float lb = k == 2 ? 0.0 : smoothstep(0.5 + 0.06 * fk, 0.6 + 0.06 * fk, gU) * (1.0 - smoothstep(0.84, 0.92, gU));
    float fr = (lb > 0.5 ? 16.0 : 0.0) + floor(fract(uBeatClock * 1.5 + fk * 0.37) * 16.0);
    if (wT > 0.5) fr = 32.0 + floor(dv * 15.99);
    vec4 hs = vec4(x, ly + hop, ly, fr);
    if (k == 0) gS0 = hs; else if (k == 1) gS1 = hs; else gS2 = hs;
  }

  float hit = exp(-gImpAge * 5.0) + 0.1 * gKick;
  gShake = snapv(hit * vec2(0.03 * sin(uTime * 57.0), 0.05 * cos(uTime * 43.0)) + vec2(0.0, -0.03 * exp(-gImpAge * 11.0)));
  float flash = (mod(gM, 2.0) < 0.5 ? exp(-max(gImpAge - 0.1, 0.0) * 5.0) : 0.0) * gPy;
  gL = normalize(vec3(-0.55, 0.5, 0.67));
  gKey = vec3(1.0, 0.94, 0.84) * (1.0 + 0.4 * flash);
  gAmb = vec3(0.3, 0.33, 0.4);
  gRim = mix(uColor2, vec3(1.0, 0.7, 0.4), 0.5) * (0.5 + 0.4 * gKick) + vec3(1.0, 0.75, 0.45) * flash;
  gSprLight = vec3(1.0, 0.98, 0.95) * (1.0 + 0.35 * flash);

  vec2 fc = gl_FragCoord.xy;
  float line = floor(fc.y / uResolution.y * 243.0);
  fc.x += tp * uResolution.y * 0.0012 * (h11(line + floor(uTime * 30.0) * 3.1) - 0.5);
  // the frame is computed at the centre of its virtual pixel and held to a
  // 16-bit console's colour depth with an ordered dither; the tape comes after
  vec2 vq = floor(fc / scl);
  vec2 fv = (vq + 0.5) * scl;
  float dth = bayer4(vq);
  vec3 c0 = floor(render(fv) * 15.0 + dth) / 15.0;
  vec3 col = tp > 0.01 ? tapeLook(c0, floor(render(fv - vec2(2.0 * scl, 0.0)) * 15.0 + dth) / 15.0, gl_FragCoord.xy, tp) : c0;
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.25 - dot(vp, vp) * 0.8, 0.4, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

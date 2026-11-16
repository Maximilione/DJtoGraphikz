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
const float HS = 0.25;                   // height of a hero on screen
const float FS = 0.42;                   // one unit of the foot on screen

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
  gCol *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.03, d)) * step(0.0, d);     // it shades what is behind it
  float t = clamp(-d / rad, 0.0, 1.0);
  float z = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  vec3 n = normalize(vec3(dg.yz * (1.0 - t) + bn, z + 0.06));
  float dif = max(dot(n, gL) * 0.8 + 0.2, 0.0);
  float sp = pow(max(dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))), 0.0), mix(10.0, 110.0, gloss)) * gloss * (0.35 + 2.2 * gloss);
  float rim = pow(1.0 - n.z, 2.2) * max(dot(n.xy, -normalize(gL.xy)) * 0.6 + 0.6, 0.0);
  vec3 c = alb * (gAmb + gKey * dif) + gKey * sp + gRim * rim * (0.2 + 0.6 * alb + 0.3 * gloss);
  c *= 0.5 + 0.5 * smoothstep(0.0, 0.3, t);
  gCol = mix(gCol, c, aa(d));
}

// two-bone limb from a to c, each bone l long, s picks the side the joint bends to
void limb(vec2 q, vec2 a, vec2 c, float l, float s, float r, vec3 c1, vec3 c2, float gloss) {
  vec2 dl = c - a;
  float ln = max(length(dl), 1e-4);
  vec2 dir = dl / ln;
  ln = min(ln, 2.0 * l - 1e-3);
  c = a + dir * ln;
  vec2 j = a + dir * ln * 0.5 + vec2(-dir.y, dir.x) * s * sqrt(max(l * l - ln * ln * 0.25, 0.0));
  lit(gSeg(q, a, j, r, r * 0.88), r, c1, gloss, vec2(0.0));
  lit(gSeg(q, j, c, r * 0.9, r * 0.8), r, c2, gloss, vec2(0.0));
  lit(gCirc(q - c, r * 0.95), r, c2, gloss, vec2(0.0));
}

// one of the suited team, feet at o, s = height on screen, facing dir.
// mode 0 guard stance, 1 run, 2 tumble through the air, 3 the roll-call pose.
// v 0..2 picks the colour, the visor and the pose
void hero(vec2 p, vec2 o, float s, float dir, float mode, float ph, float v) {
  vec2 q = (p - o) / s;
  q.x *= dir;
  if (q.x < -0.6 || q.x > 0.6 || q.y < -0.25 || q.y > 1.3) return;
  float keep = gPx;
  gPx /= s;
  float run = step(0.5, mode) * step(mode, 1.5), tum = step(1.5, mode) * step(mode, 2.5), pose = step(2.5, mode);
  float guard = 1.0 - run - tum - pose;
  if (tum > 0.5) {
    float ra = -ph;
    vec2 c = q - vec2(0.0, 0.5);
    q = vec2(c.x * cos(ra) - c.y * sin(ra), c.x * sin(ra) + c.y * cos(ra)) + vec2(0.0, 0.5);
  }
  vec3 suit = v < 0.5 ? cA : v < 1.5 ? cB : cC;
  vec3 white = vec3(0.92, 0.92, 0.9);
  float bob = 0.012 * sin(uBeatClock * TAU + v);
  vec2 hip = vec2(0.0, 0.5 - 0.05 * guard - 0.02 * run + bob * guard + 0.03 * abs(sin(ph)) * run);
  float lean = 0.26 * run + 0.08 * guard + 0.2 * tum;
  vec2 chest = hip + vec2(lean * 0.3, 0.29 - 0.05 * tum);
  float a0 = ph, a1 = ph + 3.14159;
  vec2 fA = guard * vec2(-0.17, 0.02) + run * vec2(0.21 * cos(a1) - 0.03, 0.02 + 0.13 * max(sin(a1), 0.0)) + tum * (hip + vec2(0.1, -0.2)) + pose * vec2(-0.13, 0.02);
  vec2 fB = guard * vec2(0.15, 0.02) + run * vec2(0.21 * cos(a0) - 0.03, 0.02 + 0.13 * max(sin(a0), 0.0)) + tum * (hip + vec2(0.17, -0.12)) + pose * vec2(0.14, 0.02);
  vec2 hA, hB;
  if (pose > 0.5) {
    hA = v < 0.5 ? vec2(-0.25, 1.0) : v < 1.5 ? vec2(-0.2, 0.6) : vec2(-0.14, 0.5);
    hB = v < 0.5 ? vec2(0.26, 1.0) : v < 1.5 ? vec2(0.3, 0.93) : vec2(0.07, 1.1);
  } else {
    hA = chest + guard * vec2(0.16, -0.03) + run * vec2(0.17 * cos(a0), -0.16 + 0.1 * cos(a0)) + tum * vec2(0.14, -0.18);
    hB = chest + guard * vec2(0.22, -0.13) + run * vec2(0.17 * cos(a1), -0.16 + 0.1 * cos(a1)) + tum * vec2(0.2, -0.1);
  }
  float es = pose > 0.5 ? 1.0 : -1.0;
  limb(q, chest + vec2(-0.05, -0.025), hA, 0.165, -es, 0.047, suit * 0.8, white * 0.8, 0.45);
  limb(q, hip + vec2(-0.035, 0.0), fA, 0.25, 1.0, 0.062, suit * 0.8, white * 0.8, 0.45);
  lit(gEll(q - fA - vec2(0.04, -0.002), vec2(0.075, 0.038)), 0.04, white * 0.8, 0.5, vec2(0.0));
  // torso: spandex with a white chevron and a belt
  vec3 tg = gSeg(q, hip + vec2(0.0, 0.02), chest, 0.085, 0.118);
  vec2 tq = q - chest;
  vec3 ta = suit;
  ta = mix(ta, white, 1.0 - smoothstep(0.0, 0.012, abs(tq.y + 0.07 + abs(tq.x - lean * 0.02) * 0.9 - 0.02) - 0.022));
  ta = mix(ta, white, step(abs(q.y - hip.y - 0.035), 0.02));
  ta = mix(ta, vec3(1.0, 0.8, 0.25), step(length((q - hip - vec2(0.03, 0.035)) * vec2(1.0, 1.3)), 0.027));
  lit(tg, 0.1, ta, 0.45, vec2(0.0));
  limb(q, hip + vec2(0.035, 0.0), fB, 0.25, 1.0, 0.062, suit, white, 0.45);
  lit(gEll(q - fB - vec2(0.04, -0.002), vec2(0.075, 0.038)), 0.04, white, 0.5, vec2(0.0));
  // helmet: one glossy shell, a black visor and a silver mouthpiece of our own
  vec2 hc = chest + vec2(0.02 + lean * 0.06, 0.15);
  vec2 e = q - hc;
  float vis = v < 0.5 ? max(max(abs(e.x - 0.04) - 0.055, abs(e.y - 0.014) - 0.03), 0.016 - (e.y + 0.016) - abs(e.x - 0.04) * 0.9)
            : v < 1.5 ? length((e - vec2(0.04, 0.014)) * vec2(0.62, 1.0)) - 0.034
            : max(abs(e.x - 0.04) - 0.055, abs(e.y - 0.014 - (e.x - 0.04) * 0.4) - 0.02);
  vec3 ha = suit;
  ha = mix(ha, white, step(abs(e.x + 0.005), 0.011) * step(0.02, e.y) * step(v, 0.5));
  ha = mix(ha, white, step(abs(e.y - 0.062), 0.008) * step(1.5, v));
  ha = mix(ha, vec3(0.75, 0.77, 0.8), 1.0 - smoothstep(-0.004, 0.004, length((e - vec2(0.045, -0.047)) * vec2(0.6, 1.0)) - 0.022));
  ha = mix(ha, vec3(0.015), 1.0 - smoothstep(-0.004, 0.004, vis));
  lit(gCirc(e, 0.1), 0.1, ha, 0.95, vec2(0.0));
  limb(q, chest + vec2(0.055, -0.025), hB, 0.165, -es, 0.047, suit, white, 0.45);
  gPx = keep;
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
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    float d = sdSeg(q, pos, pos - vel * 0.07);
    acc += exp(-d * d / (R * R * 0.0004)) * (0.4 + 0.6 * h11(fi + seed * 3.0));
  }
  return vec3(1.0, 0.72, 0.3) * acc * 2.2 * (1.0 - age) + vec3(1.0, 0.85, 0.6) * exp(-dot(q, q) / (R * R * 0.08)) * max(1.0 - age * 6.0, 0.0);
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

float gPix, gFit, gKick, gSc, gU, gM, gPunch, gImpAge, gHaze, gPy;
vec2 gShake;
vec3 gSkin;

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float land(float m) { return -0.46 + 0.3 * h11(m * 3.3 + 0.7); }   // where stomp m comes down, on screen at impact

// the boot of the suit: shin, ankle, foot, three toes, claws
void foot(vec2 p, vec2 o, float squash) {
  vec2 q = (p - o) / FS;
  if (q.x < -1.1 || q.x > 1.5 || q.y < -0.15) return;
  float keep = gPx;
  gPx /= FS;
  q.y /= 1.0 - squash;
  q.x /= 1.0 + 0.6 * squash;
  // claws first: they sit under the toes
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 tip = vec2(1.0 - 0.17 * fk, 0.13 - 0.015 * fk);
    lit(gSeg(q, tip - vec2(0.05, 0.0), tip + vec2(0.24, -0.075), 0.085, 0.012), 0.07, vec3(0.78, 0.72, 0.56), 0.9, vec2(0.0));
  }
  lit(gSeg(q, vec2(-0.5, 0.26), vec2(-0.8, 0.1), 0.1, 0.012), 0.08, vec3(0.78, 0.72, 0.56), 0.9, vec2(0.0));
  vec3 g = gSeg(q, vec2(-0.14, 0.55), vec2(-0.3, 3.0), 0.33, 0.42);
  g = smin3(g, gCirc(q - vec2(-0.2, 0.33), 0.34), 0.12);
  g = smin3(g, gEll(q - vec2(0.25, 0.22), vec2(0.56, 0.23)), 0.1);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    g = smin3(g, gSeg(q, vec2(0.5, 0.17), vec2(1.0 - 0.17 * fk, 0.14 - 0.015 * fk), 0.15, 0.13), 0.035);
  }
  // latex texture: cast scales, folds where the ankle bends, a belly of plates
  float f = 24.0;
  vec2 sq2 = q + 0.05 * vec2(fbm(q * 5.0), fbm(q * 5.0 + 4.0));
  vec2 bn = 0.4 * vec2(cos(sq2.x * f) * sin(sq2.y * f + sq2.x * 9.0), sin(sq2.x * f) * cos(sq2.y * f + sq2.x * 9.0)) * (0.5 + fbm(q * 3.0));
  float fold = smoothstep(0.3, 0.45, q.y) * (1.0 - smoothstep(0.75, 1.0, q.y));
  bn.y += 0.75 * fold * sin(q.y * 34.0 + 2.5 * sin(q.x * 5.0));
  float axis = q.x + 0.14 + (q.y - 0.55) * 0.065;                  // across the shin
  float belly = smoothstep(0.08, 0.14, axis) * smoothstep(0.55, 0.7, q.y);
  bn = mix(bn, vec2(0.0, 0.8 * sin(q.y * 24.0)), belly);
  vec3 alb = gSkin * (0.75 + 0.5 * fbm(q * 7.0));
  alb = mix(alb, mix(gSkin, vec3(0.75, 0.68, 0.42), 0.6), belly);
  alb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.25, abs(sin(q.y * 24.0)))) * belly;
  lit(g, 0.3, alb, 0.7, bn);
  // the seam up the back of the leg, and the grime from the last take
  gCol *= 1.0 - 0.45 * aa(g.x + 0.02) * (1.0 - smoothstep(0.0, 0.014, abs(axis + 0.2 + 0.01 * sin(q.y * 40.0)))) * step(0.5, q.y);
  gCol = mix(gCol, gCol * vec3(0.6, 0.55, 0.5), 0.5 * aa(g.x) * (1.0 - smoothstep(0.0, 0.3, q.y)) * fbm(q * 12.0));
  gPx = keep;
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
  vec2 p = ((fc - 0.5 * uResolution) / uResolution.y * gFit) * gPunch + gShake;
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
    lit(gEll(p - pb - nrm * (0.1 - 0.075 * t + pr * 0.55), vec2(pr * 0.85, pr * 1.2)), pr, mix(uColor2, vec3(0.8, 0.5, 0.3), 0.4) * 0.8, 0.6, vec2(0.0));
    tg = smin3(tg, gSeg(p, pa, pb, 0.1 - 0.075 * (t - 1.0 / 6.0), 0.1 - 0.075 * t), 0.02);
    pa = pb;
  }
  lit(tg, 0.08, gSkin * (0.75 + 0.5 * fbm(p * 14.0)), 0.6, 0.4 * vec2(cos(p.x * 60.0) * sin(p.y * 60.0), sin(p.x * 60.0) * cos(p.y * 60.0)));
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
      vec2 cq = vec2(p.x / (1.0 + f * 1.4) - (land(gM) + 0.1 - gU * 4.0 * 0.2 * clamp(pace, 0.3, 3.0)), f - 0.07);
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
    float jump = max(0.0, sin(clamp(gImpAge * 3.0 - 0.3 * h11(ci), 0.0, 1.0) * 3.14159)) * 0.05 * step(0.0, gImpAge);
    vec2 c = (vec2(mod(X, 0.9) - 0.45, p.y - SY - 0.012 - jump)) / 0.085;
    c = vec2(c.x + c.y * 0.3 * jump * 8.0, c.y);
    if (abs(c.x) < 1.3 && c.y > -0.2 && c.y < 1.1) {
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
  vec2 sq = (p - vec2(nxt + 0.12, -0.3)) / vec2(0.2 + 0.25 * sh, 0.03 + 0.045 * sh);
  gCol *= 1.0 - 0.62 * sh * (1.0 - smoothstep(0.35, 1.0, dot(sq, sq)));

  // ---- charges along the street, behind the team ----
  float boomAge = mod(gM, 2.0) < 0.5 ? gImpAge : -1.0;
  if (gPy > 0.0) {
    addBoom(p - vec2(0.12 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.05, 0.25 * gPy, cA, gM + 1.0);
    addBoom(p - vec2(0.42 - boomAge * 0.2 * pc * 2.1, -0.17), boomAge - 0.16, 0.3 * gPy, cB, gM + 2.0);
    addBoom(p - vec2(0.72 - boomAge * 0.2 * pc * 2.1, -0.2), boomAge - 0.27, 0.25 * gPy, cC, gM + 3.0);
  }

  // ---- the feet ----
  float drift = gU * 4.0 * 0.2 * pc;
  float up = ease((gU - 0.5) / 0.22);
  float sqz = 0.14 * exp(-gImpAge * 9.0);
  foot(p, vec2(land(gM) - drift + 0.5 * up * up, -0.29 + 1.1 * up * up), sqz);
  float dn = clamp((gU - 0.8) / 0.2, 0.0, 1.0);
  if (gU > 0.78) foot(p, vec2(nxt, -0.29 + 1.1 * (1.0 - dn * dn)), -0.06 * (1.0 - dn));

  // ---- impact: dust thrown out both ways along the road, sparks ----
  float fx = land(gM) - drift;
  addBoom(p - vec2(fx + 0.45, -0.3), gImpAge * 0.9 + 0.3, 0.2 * (0.5 + 0.5 * gHaze), vec3(0.62, 0.58, 0.52), 11.0);
  addBoom(p - vec2(fx - 0.3, -0.3), gImpAge * 0.9 + 0.3, 0.17 * (0.5 + 0.5 * gHaze), vec3(0.62, 0.58, 0.52), 12.0);

  // ---- the team ----
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = 0.2 + 0.21 * fk + 0.015 * sin(uBeatClock * 0.9 + fk * 2.0);
    float ly = k == 1 ? -0.4 : -0.37;
    float hopA = gImpAge > 0.0 ? sin(clamp(gImpAge * 2.6 - 0.12 * fk, 0.0, 1.0) * 3.14159) : 0.0;
    float mode = 1.0, ph = uBeatClock * TAU * 1.5 + fk * 2.1, hop = 0.05 * hopA;
    // the last one in line throws himself clear as it lands
    float dv = k == 0 ? clamp((gU > 0.5 ? gU - 0.93 : gU + 0.07) / 0.2, 0.0, 1.0) : 0.0;
    if (dv > 0.001 && dv < 0.999) { mode = 2.0; ph = dv * TAU; hop = 0.11 * sin(dv * 3.14159); x += 0.05 * sin(dv * 3.14159); }
    vec2 s2 = (p - vec2(x, ly)) / vec2(0.075, 0.013);
    gCol *= 1.0 - 0.5 * (1.0 - smoothstep(0.4, 1.0, dot(s2, s2)));
    hero(p, vec2(x, ly + hop), HS, 1.0, mode, ph, fk);
  }
  gCol += sparks(p - vec2(fx + 0.4, -0.3), gImpAge * 1.2, 0.2 * (0.3 + 0.7 * gPy), gM);
  gCol += sparks(p - vec2(fx - 0.2, -0.3), gImpAge * 1.2 - 0.05, 0.15 * gPy, gM + 5.0);

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
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  gPix = 1.0 * gFit / uResolution.y;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);
  gSkin = mix(vec3(0.14, 0.27, 0.17), uColor1 * 0.45, 0.4);

  gSc = uBeatClock * 0.2 * clamp(pace, 0.3, 3.0);
  float sb = uBeatClock / 4.0;
  gM = floor(sb);
  gU = fract(sb);
  gImpAge = gU * 4.0 * 0.47;

  float hit = exp(-gImpAge * 5.0) + 0.1 * gKick;
  gShake = hit * 0.028 * vec2(sin(uTime * 57.0), cos(uTime * 43.0)) + vec2(0.0, 0.004 * sin(uBeatClock * TAU * 1.5));
  gPunch = 1.0 - 0.06 * exp(-gImpAge * 4.0);
  float flash = (mod(gM, 2.0) < 0.5 ? exp(-max(gImpAge - 0.1, 0.0) * 5.0) : 0.0) * gPy;
  gL = normalize(vec3(-0.55, 0.5, 0.67));
  gKey = vec3(1.0, 0.94, 0.84) * (1.0 + 0.4 * flash);
  gAmb = vec3(0.3, 0.33, 0.4);
  gRim = mix(uColor2, vec3(1.0, 0.7, 0.4), 0.5) * (0.5 + 0.4 * gKick) + vec3(1.0, 0.75, 0.45) * flash;

  vec2 fc = gl_FragCoord.xy;
  float line = floor(fc.y / uResolution.y * 243.0);
  fc.x += tp * uResolution.y * 0.0012 * (h11(line + floor(uTime * 30.0) * 3.1) - 0.5);
  float bl = uResolution.y * 0.006;
  vec3 c0 = render(fc);
  vec3 col = tp > 0.01 ? tapeLook(c0, render(fc - vec2(bl, 0.0)), gl_FragCoord.xy, tp) : c0;
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.25 - dot(vp, vp) * 0.8, 0.4, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

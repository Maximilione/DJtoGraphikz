precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float ranks;
uniform float bite;
uniform float swing;
uniform float giant;

// Dentiere: an army of wind-up chattering-teeth toys on a glossy black floor,
// rank behind rank to the horizon. A toy is two plastic gums on a hinge, block
// teeth, two big feet and a butterfly key on its back. On every beat a rank
// clacks shut and hops, the next rank a little later. For 8 beats they march
// at the audience, then turn about in the air and march 8 beats away, showing
// the keys. While their backs are turned a building-size one rises behind the
// horizon, gapes, and clacks on the downbeat of the 16: an impact frame, its
// teeth fly over the ranks, the army spins round and comes at us again.
// Energy is how wound-up they are: run down they sleep and yawn, half wound
// the jaws roll in 16ths, fully wound they march.
// Everything is flat paint: two tones, a pen line and a rim per surface, each
// from three copies of one shape (itself, pushed at the key light, pushed away
// from the rim light). A rank is one toy repeated along x; a pixel only paints
// the ranks whose band it falls in, and a point under a rank's ground line
// paints that rank mirrored: the reflection costs nothing.

const float PI = 3.14159265;
const float TAU = 6.2831853;
const vec3 INK = vec3(0.025, 0.02, 0.055);
const float YH = 0.2;            // the horizon, in screen heights from the centre
const float CAM = 0.6;           // a rank at depth z stands on YH - CAM / z
const float UNIT = 0.4;          // one toy unit at depth 1, in screen heights
const float PERIOD = 1.55;       // toy to toy along a rank, in toy units
const float YM = 0.52;           // the bite line of a standing toy
const float HOLD = 0.07;         // the clack is held this long: 2 frames at 128 bpm
const vec2 KEYL = vec2(-0.53, 0.85);
const vec2 RIML = vec2(0.82, 0.57);

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.62 * vn(p) + 0.38 * vn(p * 2.3 + 7.3); }
float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

vec3 gCol;                       // the frame being painted
float gPx;                       // one screen pixel, in the units of what is painted next
float gInk;                      // the pen line, same units
float gA;                        // 1 = solid paint, less for a reflection
float gFog;                      // how far into the haze the next shape is
float gSil;                      // 1 = an impact frame: every shape is ink
float gRim;
vec3 gFogCol, gRimCol;
vec3 cGum, cGumSh, cGumHi, cMet, cMetSh, cMouth;
float gMarch, gRoll, gYawn, gBite, gSwing, gHi, gMid;
// the giant: scale, ground point, jaw, how far it is up, teeth still in
float gGU, gGLift, gGUp, gGTeeth;
vec2 gGPos;
float gImp;                      // 1 during the impact frame

const vec3 IVORY = vec3(0.97, 0.94, 0.83);
const vec3 IVORY_SH = vec3(0.64, 0.6, 0.72);

float cut(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }
vec3 tone(vec3 c) { return mix(mix(c, gFogCol, gFog), INK, gSil); }
void fill(float d, vec3 c) { gCol = mix(gCol, tone(c), cut(d) * gA); }
void inked(float d, vec3 c) { fill(d - gInk, INK); fill(d, c); }
void cel(float d, float dKey, float dRim, vec3 lit, vec3 shade) {
  vec3 c = mix(shade, lit, cut(dKey));
  c = mix(c, gRimCol, (1.0 - cut(dRim)) * gRim);
  fill(d - gInk, INK);
  fill(d, c);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdBox(vec2 p, vec2 b) { vec2 w = abs(p) - b; return max(w.x, w.y); }
float sdRBox(vec2 v, vec2 b, float r) {
  vec2 w = abs(v) - b + r;
  return length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - r;
}
float sdEll(vec2 v, vec2 r) { return (length(v / r) - 1.0) * min(r.x, r.y); }

// the parts of a toy. Gums are measured from the middle of their bite edge
float sdFoot(vec2 v) { return max(sdEll(v, vec2(0.21, 0.18)), -v.y); }
float sdGumLo(vec2 v) { return max(sdRBox(v, vec2(0.46, 0.27), 0.2), v.y); }
float sdGumUp(vec2 v) { return max(sdRBox(v, vec2(0.45, 0.31), 0.25), -v.y); }
float sdKey(vec2 v, vec2 dir) {
  float al = dot(v, dir), ac = dot(v, vec2(-dir.y, dir.x));
  float ring = abs(length(vec2(abs(al) - 0.2, ac)) - 0.1) - 0.038;
  float bar = max(abs(al) - 0.11, abs(ac) - 0.034);
  return min(min(ring, bar), length(v) - 0.07);
}

// six block teeth on an arch seen from the front: even steps of angle, so they
// narrow towards the corners. v.y runs from the root into the tooth, root is how far
// the tooth goes back past it
float sdTeeth(vec2 v, float hgt, float buck, float root, out float shade) {
  float a = asin(clamp(v.x / 0.45, -0.999, 0.999));
  float t = a / 0.385;
  float dx = max(max(abs(fract(t) - 0.5) - 0.44, abs(t) - 2.94) * cos(a) * 0.173, abs(v.x) - 0.42);
  float dy = max(-v.y - root, v.y - hgt * (1.0 + buck * step(abs(t), 1.0)));
  shade = step(0.7, fract(t));
  vec2 w = vec2(dx, dy) + 0.018;
  return length(max(w, 0.0)) + min(max(w.x, w.y), 0.0) - 0.018;
}

void keyPaint(vec2 v, float ang) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float d = sdKey(v, dir);
  fill(d - gInk, INK);
  fill(d, mix(cMetSh, cMet, cut(sdKey(v - KEYL * 0.03, dir))));
  // the glint stays on the side of each loop that faces the light while the key turns
  vec2 rv = v - dir * 0.2 * sign(dot(v, dir));
  float gl = cut(abs(length(rv) - 0.1) - 0.015) * smoothstep(0.7, 0.9, dot(rv / max(length(rv), 1e-4), KEYL));
  gCol = mix(gCol, tone(vec3(1.0)), gl * (0.3 + 0.7 * gMid) * gA);
}

// the spring between the jaws: it stretches with them
float sdSpring(vec2 b, float lb) {
  float yy = (b.y - YM) / max(lb, 1e-3);
  float zig = abs(fract(yy * 3.0 + 0.25) - 0.5) * 4.0 - 1.0;
  return max(abs(b.x - 0.07 * zig) - 0.016, abs(yy - 0.5) * lb - 0.5 * lb);
}

// the jaw through one beat of the march, 0 at the kick: shut and held, thrown open past
// its rest, wide on the "and", a last gape, shut in one frame
float jawMarch(float f) {
  if (f < HOLD) return 0.0;
  if (f < 0.45) { float t = (f - HOLD) / (0.45 - HOLD) - 1.0; return 1.0 + 2.70158 * t * t * t + 1.70158 * t * t; }
  if (f < 0.9) return 1.0;
  if (f < 0.964) return 1.0 + 0.18 * ease((f - 0.9) / 0.064);
  return 1.18 * (1.0 - (f - 0.964) / 0.036);
}

// one toy. q in toy units from the point of the floor it stands on
void toy(vec2 q, float hop, float sy, float rock, float lift, float back, float ka,
         vec2 fl, vec2 fr, float flash, float seed, float fxT) {
  vec2 b = q - vec2(0.0, hop);
  b = vec2(b.x / (1.0 + 0.8 * (1.0 - sy)), b.y / sy);
  b = rot(b - vec2(0.0, 0.25), rock) + vec2(0.0, 0.25);
  float lb = back > 0.5 ? lift * 0.4 : lift;
  vec2 vl = b - vec2(0.0, YM);
  vec2 vu = b - vec2(0.0, YM + lb);

  if (back < 0.5) {
    keyPaint(b - vec2(0.0, YM + lb + 0.34), ka);
    if (lb > 0.004) {
      inked(sdBox(b - vec2(0.0, YM + lb * 0.5), vec2(0.4, lb * 0.5 + 0.02)), cMouth);
      fill(sdSpring(b, lb), mix(cMet, vec3(1.0), 0.35));
    }
  }
  // legs stretch when the body leaves the feet behind
  vec2 hipL = vec2(-0.2, hop + 0.28 * sy), hipR = vec2(0.2, hop + 0.28 * sy);
  inked(min(sdSeg(q, fl + vec2(0.0, 0.12), hipL), sdSeg(q, fr + vec2(0.0, 0.12), hipR)) - 0.04, cMetSh);
  cel(sdGumLo(vl), sdGumLo(vl - KEYL * 0.07), sdGumLo(vl + RIML * 0.035), cGum, cGumSh);
  cel(sdGumUp(vu), sdGumUp(vu - KEYL * 0.07), sdGumUp(vu + RIML * 0.035), cGum, cGumSh);
  if (back < 0.5) {
    float sh;
    float d = sdTeeth(vec2(b.x, -vl.y), 0.12, 0.0, 0.0, sh);
    inked(d, mix(mix(IVORY, IVORY_SH, sh), vec3(1.0), flash));
    d = sdTeeth(vu, 0.13, 0.3, 0.0, sh);
    inked(d, mix(mix(IVORY, IVORY_SH, sh), vec3(1.0), flash));
    // the gloss of moulded plastic
    fill(sdSeg(vu, vec2(-0.27, 0.22), vec2(-0.1, 0.255)) - 0.022, cGumHi);
    // a star on one tooth
    float tk = floor(uTime * 5.0);
    float on = step(0.45, h11(seed * 31.0 + tk)) * gHi;
    vec2 sp = abs(b - vec2((floor(h11(seed * 7.0 + tk * 1.3) * 6.0) - 2.5) * 0.115, YM + lb + 0.07));
    float star = min(sp.x * 5.0 + sp.y, sp.x + sp.y * 5.0) - 0.1 * on;
    gCol = mix(gCol, tone(vec3(1.0)), cut(star * 0.3) * step(0.01, on) * gA);
  } else {
    // from behind: the hinge barrel and the key
    inked(sdSeg(b, vec2(-0.3, YM + lb * 0.5), vec2(0.3, YM + lb * 0.5)) - 0.04, cMetSh);
    fill(sdSeg(b, vec2(-0.27, YM + lb * 0.5 + 0.012), vec2(0.22, YM + lb * 0.5 + 0.012)) - 0.01, cMet);
    fill(sdSeg(vu, vec2(-0.27, 0.22), vec2(-0.1, 0.255)) - 0.022, cGumHi);
    keyPaint(b - vec2(0.0, YM + lb + 0.2), -ka);
  }
  cel(sdFoot(q - fl), sdFoot(q - fl - KEYL * 0.05), sdFoot(q - fl + RIML * 0.03), cMet, cMetSh);
  cel(sdFoot(q - fr), sdFoot(q - fr - KEYL * 0.05), sdFoot(q - fr + RIML * 0.03), cMet, cMetSh);

  // the clack: three strokes out of each corner of the mouth, and sparks with the highs
  if (fxT < 1.0) {
    vec2 m = vec2(abs(b.x) - 0.5, b.y - YM);
    float r0 = 0.05 + 0.2 * fxT, r1 = r0 + 0.16 * (1.0 - fxT);
    float d = 1e3;
    for (int k = 0; k < 3; k++) {
      float an = (float(k) - 1.0) * 0.62;
      vec2 dr = vec2(cos(an), sin(an));
      d = min(d, sdSeg(m, dr * r0, dr * r1) - 0.02 * (1.0 - fxT));
      vec2 sp = m - dr * (0.1 + 0.5 * fxT) * (0.7 + 0.6 * h11(seed + float(k))) + vec2(0.0, 0.35 * fxT * fxT);
      fill(abs(sp.x) + abs(sp.y) - 0.035 * gHi * (1.0 - fxT), vec3(1.0, 0.9, 0.55));
    }
    inked(d, vec3(1.0));
  }
}

// one rank: the toy under this pixel, or its reflection
void rank(vec2 p, float i, float R, float g, float px) {
  float bl = uBeatClock - i * 0.125 * gSwing;
  float n = floor(bl), f = bl - n;
  float m16 = mod(bl, 16.0);
  // 8 steps at the audience, 8 steps back, one step a beat taken in the air
  float stp = floor(m16) + smoothstep(HOLD, 1.0, fract(m16));
  float adv = (m16 < 8.0 ? stp : 16.0 - stp) / 8.0 * (1.0 - gYawn);
  float z = pow(g, i) * mix(1.08, 0.86, adv);
  float s = UNIT * (R < 1.5 ? 1.5 : 1.0) / z;
  vec2 q = vec2(p.x, p.y - (YH - CAM / z)) / s;
  if (q.y > 1.9 || q.y < -1.0) return;
  float per = R < 1.5 ? 1e3 : PERIOD;
  float off = 0.5 * mod(i, 2.0);
  float id = floor(q.x / per + 0.5 - off);
  q.x -= (id + off) * per;
  float h = h21(vec2(id, i) + 3.7);
  bool refl = q.y < 0.0;
  if (refl && gSil > 0.5) return;
  q.y = abs(q.y);

  gPx = px / s;
  gInk = max(0.02, 1.1 * gPx);
  gFog = 0.95 * (1.0 - pow(max(z, 1.0), -1.1));
  gRim = 0.9;
  gA = refl ? 0.27 * (1.0 - smoothstep(0.0, 1.0, q.y)) : 1.0;

  // the about-turn, in the air of the first beat of each 8
  float turning = (m16 < 1.0 || (m16 >= 8.0 && m16 < 9.0)) ? 1.0 : 0.0;
  float th = (m16 < 8.0 ? PI : 0.0) + PI * mix(1.0, ease((f - 0.12) / 0.6), turning);
  float cs = cos(th);
  q.x /= max(abs(cs), 0.16);
  q /= 0.95 + 0.1 * h;

  float hT = clamp((f - HOLD) / (1.0 - HOLD), 0.0, 1.0);
  float arc = 4.0 * hT * (1.0 - hT);
  float hop = arc * (0.2 * gMarch * (0.85 + 0.3 * h) + 0.1 * turning * (1.0 - gYawn) * (1.0 - gMarch));
  float sq = gMarch * (f < HOLD ? 1.0 : exp(-(f - HOLD) * 16.0));
  float sy = (1.0 - 0.13 * sq) * (1.0 - 0.04 * gYawn + 0.012 * sin(uTime * 1.3 + h * TAU));

  float roll = abs(sin(PI * (bl * 4.0 + id * 0.25)));
  float yp = fract(uTime * 0.085 + h * 7.0);
  float yawn = smoothstep(0.0, 0.12, yp) * (1.0 - smoothstep(0.22, 0.3, yp));
  float lift = 0.26 * gBite * (gMarch * jawMarch(f) * (0.6 + 0.4 * uBass)
             + gRoll * roll * (0.75 + 0.5 * uBass) + gYawn * max(yawn, 0.5 * uBass));

  float even = mod(n, 2.0);
  float stepA = 0.09 * gMarch * sin(PI * hT);
  float tap = 0.08 * gMid * (1.0 - gYawn) * abs(sin(TAU * 2.0 * f)) * smoothstep(0.42, 0.5, f) * (1.0 - smoothstep(0.88, 0.95, f));
  vec2 fl = vec2(-0.25 - 0.03 * (1.0 - even) * sin(PI * hT) * gMarch, hop * 0.7 + (even < 0.5 ? stepA : tap));
  vec2 fr = vec2(0.25 + 0.03 * even * sin(PI * hT) * gMarch, hop * 0.7 + (even < 0.5 ? tap : stepA));

  float rock = 0.075 * gMarch * sin(PI * bl) + 0.02 * gRoll * sin(TAU * 4.0 * bl + id) + 0.07 * gYawn * (h - 0.5) * (1.0 + yawn);
  float ka = uBassTime * 4.0 + i * 0.6 + step(0.5, h) * PI * 0.5;
  float clk = gMarch * step(0.01, bite);
  float flash = clk * step(f, HOLD) * min(bite, 1.0);
  float fxT = (refl || clk < 0.05) ? 2.0 : f / 0.16;
  toy(q, hop, sy, rock, lift, step(cs, 0.0), ka, fl, fr, flash, h + i * 0.37, fxT);
}

// the giant, a black shape with the light of the sky along its top edges. Its open
// mouth is a hole: the sky shows between the jaws, the teeth stand against it
void giantPaint(vec2 pp, float px) {
  vec2 b = (pp - gGPos) / gGU;
  if (abs(b.x) > 0.8 || b.y > 1.9 || b.y < 0.0) return;
  gPx = px / gGU;
  gInk = 0.0;
  gA = 1.0;
  gFog = 0.0;
  vec3 body = INK + uColor3 * 0.035;
  vec2 vl = b - vec2(0.0, YM), vu = b - vec2(0.0, YM + gGLift);
  float rw = 0.022;
  gSil = 0.0;
  float ang = uBeatClock * 0.7854;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 kv = b - vec2(0.0, YM + gGLift + 0.34);
  float d = sdKey(kv, dir);
  fill(d, mix(gRimCol, body, cut(sdKey(kv + vec2(0.0, rw), dir))));
  if (gGLift > 0.01) {
    fill(sdBox(b - vec2(0.0, YM + gGLift * 0.5), vec2(0.41, gGLift * 0.5 + 0.01)), INK + uColor3 * 0.09);
    fill(sdSpring(b, gGLift), body);
    if (gGTeeth > 0.5) {
      float sh;
      float hg = min(0.13, gGLift * 0.4);
      float d = sdTeeth(vl, hg, 0.0, 0.03, sh);
      fill(d - 0.012, body);
      fill(d, gRimCol * (0.9 - 0.3 * sh));
      d = sdTeeth(vec2(b.x, -vu.y), hg, 0.25, 0.03, sh);
      fill(d - 0.012, body);
      fill(d, gRimCol * (0.9 - 0.3 * sh));
    }
  }
  fill(sdGumLo(vl), mix(gRimCol, body, cut(sdGumLo(vl + vec2(0.0, rw)))));
  fill(sdGumUp(vu), mix(gRimCol, body, cut(sdGumUp(vu + vec2(0.0, rw)))));
  // shut on the impact frame: the bite is the one white line in a black shape
  fill(max(abs(b.y - YM) - 0.014, abs(b.x) - 0.43) + 1.0 - gImp, vec3(1.0));
}

// an impact frame: the plate goes to one hot colour and ink lines fly out of the hit
vec3 impactFrame(vec2 q, vec3 hot, float seed) {
  float a = atan(q.y, q.x) / TAU, r = length(q);
  float k = floor(a * 70.0);
  float f = abs(fract(a * 70.0) - 0.5);
  float wdt = 0.5 * h11(k + seed) * smoothstep(0.05, 0.9, r);
  float ln = step(0.45, h11(k * 3.1 + seed)) * step(0.12 + 0.4 * h11(k * 7.3 + seed), r) * step(f, wdt);
  return mix(mix(vec3(1.0, 0.97, 0.9), hot, smoothstep(0.1, 0.75, r)), INK, ln);
}

// what stands behind the horizon: flat bands of haze, a disc of light, the giant.
// Called with the pixel, or with its mirror image for the floor
vec3 backdrop(vec2 pp, float px, float mood) {
  float hgt = pp.y - YH;
  float pump = 0.82 + 0.14 * uBass + 0.08 * uBassHit;
  float wav = 0.012 * sin(pp.x * 5.0 + uTime * 0.3) + 0.008 * sin(pp.x * 11.0 - uTime * 0.2);
  // the sky lights up behind the giant so that its black shape stands off it
  gPx = px; gA = 1.0; gFog = 0.0;
  gCol = INK + uColor3 * (0.05 + 0.2 * gGUp);
  fill(hgt - 0.2 - wav * 1.5, INK + uColor3 * (0.13 + 0.25 * gGUp));
  // the disc: whole, cut into bars like a setting sun, or two small ones
  vec2 dv = vec2(pp.x, hgt + 0.03);
  float dd = mood < 1.5 ? length(dv) - 0.3 - 0.22 * gGUp * gGU : min(length(dv - vec2(0.42, 0.0)), length(dv + vec2(0.5, -0.02)) + 0.06) - 0.19;
  if (mood > 0.5 && mood < 1.5) dd = max(dd, 0.016 - abs(fract(hgt * 14.0 + 0.5) - 0.5) / 14.0 * (0.4 + hgt * 5.0));
  fill(dd - 0.05, INK + uColor3 * 0.3 * pump);
  fill(dd, mix(uColor3, vec3(1.0), 0.18) * 0.85 * pump);
  fill(dd + 0.07, mix(uColor3, vec3(1.0), 0.42) * 0.9 * pump);
  fill(hgt - 0.045 - wav, mix(gCol, uColor3 * 0.75 * pump, 0.6));
  if (gImp > 0.5) gCol = impactFrame(pp - vec2(0.0, YH + 0.1), mix(uColor3, vec3(1.0), 0.25), floor(uBeatClock / 16.0));
  if (gGUp > 0.002) giantPaint(pp, px);
  gSil = gImp;
  return gCol;
}

// the glossy black floor: it mirrors the backdrop, most at a grazing angle, and its
// tiles (squares, boards or diamonds) differ only in how much they mirror
vec3 floorPaint(vec2 p, float px, float mood) {
  float dz = max(YH - p.y, 1e-4);
  vec3 sky = backdrop(vec2(p.x, 2.0 * YH - p.y), px, mood);
  if (gImp > 0.5) return mix(sky, INK, 0.25);
  float z = CAM / dz;
  vec2 w = vec2(p.x * z, z) * 2.2;
  if (mood > 1.5) w = vec2(w.x + w.y, w.x - w.y) * 0.5;
  if (mood > 0.5 && mood < 1.5) w.y = 0.25;
  float fw = px * z * z / CAM * 2.2 * PI;
  float chk = clamp(0.5 + 0.5 * sin(PI * w.x) * sin(PI * w.y) / max(fw, 1e-4), 0.0, 1.0);
  chk = mix(chk, 0.5, smoothstep(0.25, 1.2, fw));
  float gloss = 0.1 + 0.6 * exp(-dz * 4.0);
  vec3 c = vec3(0.012, 0.012, 0.022) + uColor3 * (0.01 + 0.035 * chk);
  return c + sky * gloss * mix(0.55, 1.0, chk);
}

// the print: screen-tone dots in the dark tones, a little grain in the paper
vec3 printLook(vec3 c, vec2 fc, float amt) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * fc / (uResolution.y / 190.0);
  float dot_ = length(fract(g) - 0.5);
  float tn = smoothstep(0.42, 0.06, lum);
  c *= 1.0 - 0.3 * amt * tn * (1.0 - smoothstep(0.3 * tn, 0.3 * tn + 0.1, dot_));
  c *= 1.0 + 0.05 * amt * (fbm(fc / (uResolution.y / 300.0)) - 0.5);
  return c;
}

void main() {
  float px = 1.0 / uResolution.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float R = floor(clamp(ranks, 1.0, 8.0) + 0.5);
  float bt = clamp(bite, 0.0, 2.0);
  float gi = clamp(giant, 0.0, 1.0);
  float E = clamp(uEnergy, 0.0, 1.0);
  gSwing = clamp(swing, 0.0, 1.0);
  gBite = 0.25 + 0.75 * bt;
  gMarch = smoothstep(0.3, 0.6, E);
  gRoll = smoothstep(0.08, 0.25, E) * (1.0 - gMarch);
  gYawn = 1.0 - smoothstep(0.05, 0.2, E);
  gHi = clamp(uHigh, 0.0, 1.0);
  gMid = clamp(uMid, 0.0, 1.0);

  vec3 c1 = mix(uColor1, vec3(1.0), 0.06), c2 = mix(uColor2, vec3(1.0), 0.06);
  cGum = c1;
  cGumSh = c1 * vec3(0.42, 0.36, 0.56) + INK;
  cGumHi = mix(c1, vec3(1.0), 0.65);
  cMet = c2;
  cMetSh = c2 * vec3(0.44, 0.37, 0.58) + INK;
  cMouth = mix(INK, c1 * 0.3, 0.45);
  gFogCol = INK + uColor3 * 0.3;
  gRimCol = mix(uColor3, vec3(1.0), 0.45);

  // ---- the 16-beat gag ----
  float ph = mod(uBeatClock, 16.0);
  float gOn = step(0.01, gi);
  gGU = mix(0.3, 0.8, gi);
  gGUp = gOn * (ph >= 11.0 ? ease((ph - 11.0) / 3.0) : 1.0 - ease((ph - 1.2) / 1.8));
  // it gapes over the last two beats, shuts in one frame, hangs open again without its teeth
  float jaw = ph >= 14.0 ? (ph < 15.96 ? ease((ph - 14.0) / 1.4) * (1.0 + 0.04 * sin(ph * 40.0)) : (16.0 - ph) / 0.04)
                         : 0.4 * ease((ph - 0.5) / 0.8);
  gGLift = 0.38 * jaw * (0.4 + 0.6 * min(gBite, 1.0));
  gGTeeth = step(3.3, ph);
  gImp = gOn * step(ph, 0.16);
  gSil = gImp;
  float hit = gOn * exp(-ph * 5.0);
  float rumble = gOn * gGUp * step(4.5, ph) * 0.004;
  gGPos = vec2(rumble * sin(uTime * 53.0), YH + gGU * (0.1 - YM - 0.9 * (1.0 - gGUp) - 0.04 * hit));

  // camera: a jolt on the kick, a slam and a punch-in when the giant shuts
  float shk = bt * (0.005 * clamp(uBassHit, 0.0, 1.0) + 0.028 * hit) + rumble;
  p += shk * vec2(sin(uTime * 61.0), cos(uTime * 47.0));
  p.y += 0.13 * gGUp - 0.03 * hit * bt;      // it tilts up to take the giant in
  p = vec2(p.x, p.y - YH) * (1.0 - 0.05 * hit) + vec2(0.0, YH);

  float mood = mod(floor(uBeatClock / 32.0), 3.0);
  vec3 col = p.y > YH ? backdrop(p, px, mood) : floorPaint(p, px, mood);
  // the seam of floor and sky, lost in the haze
  col = mix(col, uColor3 * 0.6, (1.0 - gImp) * 0.5 * (1.0 - smoothstep(0.0, 0.012, abs(p.y - YH))));
  gCol = col;

  // the ranks, back to front; behind the last one three more fade into the haze
  float g = 1.0 + 1.6 / pow(R, 0.85);
  float last = R < 1.5 ? 0.0 : R + 2.0;
  for (int k = 0; k < 11; k++) {
    float i = 10.0 - float(k);
    if (i > last + 0.5) continue;
    rank(p, i, R, g, px);
  }

  // the giant's teeth, knocked out over the ranks and tumbling at the camera
  if (gOn > 0.5 && ph < 3.3) {
    gPx = px; gA = 1.0; gFog = 0.0;
    float seed = floor(uBeatClock / 16.0);
    for (int k = 0; k < 8; k++) {
      float fk = float(k);
      float hh = h11(fk * 3.3 + seed * 1.7);
      vec2 v0 = vec2((fk - 3.5) * 0.2 + (hh - 0.5) * 0.14, 0.3 + 0.22 * h11(fk * 7.1 + seed));
      vec2 pos = vec2((fk - 3.5) * 0.11 * gGU, YH + 0.1 * gGU) + v0 * ph - vec2(0.0, 0.3 * ph * ph);
      float sz = gGU * 0.075 * (1.0 + 0.9 * ph);
      vec2 v = rot(p - pos, (hh - 0.5) * 7.0 * ph + hh * 6.0);
      float d = sdRBox(v, sz * vec2(0.5, 0.72), sz * 0.16);
      fill(d - 0.004 - 0.02 * sz, INK);
      fill(d, mix(IVORY_SH, IVORY, cut(sdRBox(v - KEYL * sz * 0.13, sz * vec2(0.5, 0.72), sz * 0.16))));
    }
  }
  col = gCol;

  col = printLook(col, gl_FragCoord.xy, 0.6);
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.2 - dot(vp, vp) * 0.7, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

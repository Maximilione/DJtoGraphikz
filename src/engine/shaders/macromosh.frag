precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uHighHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float block;
uniform float drift;
uniform float bleed;
uniform float scene;

// Macroblock Mosh: a datamosh without a video input. A flat graphic scene
// (colour bars, a brutalist cross, rings) is rendered through the grammar of a
// broken codec: per-block motion vectors that accumulate since the last
// I-frame (closed form, summed over the last 4 half-beat epochs), blocks stuck
// on a stale frame, subsampled chroma on a coarser grid, posterisation, DCT
// basis blocks. No state, no feedback: everything comes from the beat clock.
// The kick is the I-frame: the picture snaps clean, then rots until the next
// bar. Written from the maths, palette and parameters are ours.

const float PERIOD = 4.0;
const float EPOCH = 0.5;
const float PI = 3.14159265;

float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec3 pick(float i, float seed) {
  float k = floor(hash12(vec2(i, seed)) * 6.0);
  if (k < 0.5) return uColor1;
  if (k < 1.5) return uColor2;
  if (k < 2.5) return uColor3;
  if (k < 3.5) return vec3(0.95);
  if (k < 4.5) return vec3(0.03);
  return mix(uColor1, uColor2, 0.5) * 0.55;
}

// base scene: big flat fields so the eye sees where blocks travel
vec3 src(vec2 p, float t, float look, float seed, float asp) {
  vec3 c;
  if (look == 0.0) {
    float i = floor((p.x + t * 0.15) * 7.0);
    c = pick(i, seed);
    vec2 dc = p - vec2(sin(t * 0.9) * 0.3, 0.02);
    float r = length(dc);
    if (r < 0.28) c = (r > 0.25) ? uColor3 : vec3(0.95);
    if (p.y < -0.3) {
      float g = floor(clamp((p.x / asp + 0.5), 0.0, 0.999) * 12.0) / 11.0;
      c = vec3(g * 0.9 + 0.05);
    }
  } else if (look == 1.0) {
    c = uColor2 * 0.35;
    float ca = cos(t * 0.2), sa = sin(t * 0.2);
    vec2 q = mat2(ca, -sa, sa, ca) * p;
    float cr = min(sdBox(q, vec2(0.09, 0.42)), sdBox(q, vec2(0.42, 0.09)));
    if (p.x > 0.0 && p.y > 0.0 && fract((p.x + p.y) * 8.0 + t) > 0.5) c = uColor1;
    vec2 o = vec2(cos(t * 1.1), sin(t * 1.3)) * 0.33;
    if (sdBox(p - o, vec2(0.07)) < 0.0) c = uColor3;
    if (cr < 0.0) c = vec3(0.95);
  } else {
    vec2 ce = vec2(sin(t * 0.5) * 0.15, cos(t * 0.4) * 0.1);
    float ring = step(0.5, fract(length(p - ce) * 6.0 - t * 0.8));
    c = mix(uColor1, uColor3, ring);
    float b1 = smoothstep(0.3, 0.1, length(p - vec2(-0.3 * asp * 0.8, 0.15 * sin(t))));
    float b2 = smoothstep(0.26, 0.08, length(p - vec2(0.3 * asp * 0.8, -0.12 * cos(t * 1.2))));
    c = mix(c, uColor2, max(b1, b2) * 0.85);
  }
  return max(c, vec3(0.05));
}

vec2 flow(vec2 q, float e) {
  return vec2(sin(q.y * 2.1 + e) + cos(q.x * 1.3), cos(q.x * 1.7 - e) - sin(q.y * 0.9)) * 0.5;
}

vec2 mv(vec2 bid, vec2 ctr, float e) {
  float em = mod(e, 997.0);
  return mix(flow(ctr * 1.5 + em * 0.37, mod(e, 62.8318)), hash22(bid + em * 17.13) * 2.0 - 1.0, 0.4);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float asp = uResolution.x / uResolution.y;
  vec2 half_ = vec2(0.5 * uResolution.x, 0.5 * uResolution.y);

  // time, all from the beat clock
  float bc = uBeatClock;
  float keyBeat = floor(bc / PERIOD) * PERIOD;
  float ageB = bc - keyBeat;
  float clean = smoothstep(0.55, 0.95, uBassHit);
  float age = ageB * (1.0 - clean);
  float seedBar = mod(floor(bc / 32.0), 64.0);
  float sT = bc * 0.125 + uTime * 0.02;
  // the stale frame is the scene as it was at the last I-frame: step back by
  // the beats elapsed since keyBeat, keeping the uTime term so the two clocks
  // never drift apart (keyBeat*0.125 alone would lag sT by uTime*0.02, which
  // after an hour is a completely different picture, not a stale one)
  float tFrozen = sT - ageB * 0.125;
  float eNow = floor(bc / EPOCH);
  float look = clamp(floor(scene + 0.5), 0.0, 2.0);

  // blocks
  float bs = block * (1.0 + 0.35 * uBass);
  bs = max(floor(bs / 4.0) * 4.0, 4.0);
  vec2 bid = floor(px / bs);
  vec2 ctr = (bid + 0.5) * bs;
  vec2 ctrN = ctr / uResolution.y;

  // closed-form cumulative drift over the last 4 epochs
  vec2 D = vec2(0.0);
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float w = clamp(age - fk * EPOCH, 0.0, EPOCH) / EPOCH;
    D += mv(bid, ctrN, eNow - fk) * w;
  }
  D *= drift * (0.6 + 0.8 * uBass) * bs * 1.2;

  // still blocks keep their own position but show a stale frame
  bool still = hash12(bid + seedBar * 3.1) < 0.3;
  if (still) D = vec2(0.0);

  // tear bands
  float eM = mod(eNow, 997.0);
  float band = floor(px.y / (bs * 2.0));
  float hb = hash12(vec2(band, eM));
  if (hb < 0.06 + 0.12 * uHighHit) {
    D = vec2((hash12(vec2(band + 5.3, eM)) - 0.5) * uResolution.x * 0.25 * min(age, 1.0), 0.0);
  }

  // stale-frame time
  float corrupt = clamp(0.1 + age * 0.12 + uBass * 0.25, 0.0, 0.6);
  float tS = sT;
  if (still || hash12(bid + eM * 0.71) < corrupt) tS = tFrozen;

  // luma sample, chroma on a coarser lagging grid
  vec2 p0 = (px - D - half_) / uResolution.y;
  vec3 s1 = src(p0, tS, look, seedBar, asp);
  float Y = lum(s1);

  float cb2 = bs * 2.0;
  vec2 pcPx = (floor((px - D * (1.0 + 0.6 * bleed)) / cb2) + 0.5) * cb2;
  vec2 pc = (pcPx - half_) / uResolution.y;
  vec3 s2 = src(pc, tS, look, seedBar, asp);
  vec3 s3 = src(pc - D * 0.5 * bleed / uResolution.y, tS, look, seedBar, asp);
  vec3 cm = 0.5 * (s2 + s3);
  float Yc = lum(cm);
  float Cb = (cm.b - Yc) * 0.564;
  float Cr = (cm.r - Yc) * 0.713;
  // chroma noise on highs
  Cb += (hash12(ctr + eM) - 0.5) * 0.08 * uHigh;
  Cr += (hash12(ctr + eM + 7.0) - 0.5) * 0.08 * uHigh;

  // posterise: fewer levels as the picture ages. Chroma sits in [-0.5, 0.5],
  // so it needs twice the luma's levels or every mid-saturation colour snaps
  // to grey (at 4-6 levels the whole cross scene came out monochrome)
  float n = mix(14.0, 6.0, clamp(age / PERIOD, 0.0, 1.0) * bleed);
  float nc = mix(12.0, 6.0, clamp(age / PERIOD, 0.0, 1.0));
  Y = floor(Y * n + 0.5) / n;
  Cb = floor(Cb * nc + 0.5) / nc;
  Cr = floor(Cr * nc + 0.5) / nc;

  vec3 rgb = vec3(Y + 1.402 * Cr, Y - 0.344 * Cb - 0.714 * Cr, Y + 1.772 * Cb);

  // blocks locked on a DCT basis
  float pdct = 0.02 + 0.10 * uHighHit + 0.04 * age / PERIOD;
  if (hash12(bid * 1.7 + eM) < pdct) {
    vec3 flat_ = src((ctr - half_) / uResolution.y, tS, look, seedBar, asp);
    vec2 local = floor(mod(px, bs) / bs * 8.0) / 8.0;   // 8x8 coefficient cells
    vec2 fr = floor(hash22(bid + 3.7 + eM) * 4.0);
    float dct = cos(PI * (local.x * 8.0 + 0.5) * fr.x / 8.0) * cos(PI * (local.y * 8.0 + 0.5) * fr.y / 8.0);
    rgb = flat_ * (0.75 + 0.25 * dct);
  }

  // ghost block grid, fades at the I-frame
  vec2 gm = mod(px, bs);
  if (gm.x < 1.0 || gm.y < 1.0) rgb += 0.06 * min(age, 1.0);

  // I-frame
  if (clean > 0.001) {
    vec3 cs = (D.x == 0.0 && D.y == 0.0 && tS == sT) ? s1 : src((px - half_) / uResolution.y, sT, look, seedBar, asp);
    rgb = mix(rgb, cs, clean) + 0.15 * clean;
  }

  rgb = max(rgb, vec3(0.04));
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}

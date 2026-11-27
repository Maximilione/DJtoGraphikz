precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float reels;
uniform float luck;
uniform float tease;
uniform float payout;

// Jackpot: the front of a slot machine of our own design, played by the beat
// clock. A round is 16 beats and everything in it is a closed form of the
// clock: the outcome is hash(round) against `luck`, each reel's position is
// "target cell minus the distance still to travel", and that distance is a
// piecewise polynomial of the time left before the reel's stop beat, with a
// damped spring after it. Nothing is stored, so both windows spin the same
// reels. The strip repeats every 8 cells and every spin is a whole number of
// strips plus the difference between two targets, so only the position modulo
// 8 is ever needed and the clock can grow without losing precision.

const float PI = 3.14159265;
const float TAU = 6.2831853;

// layout, in units of the frame height (the machine is fitted to 16:9)
const vec2 CHASE = vec2(0.835, 0.452);    // centre line of the bulb track
const vec2 BEZ_O = vec2(0.803, 0.414);
const vec2 BEZ_I = vec2(0.715, 0.326);
const vec2 WIN = vec2(0.600, 0.302);
const float RR = 0.3283;                  // reel radius: the window shows asin(0.92) each way
const float ARC = 0.7668;                 // strip length visible in the window

// spring left in the reel when it reaches its stop: VR is the speed it still
// has (cells per beat), which the spring then spends as overshoot
const float VR = 2.8;
const float SW = 13.0;
const float SK = 4.5;

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rh(float n, float k) { return hash11(mod(n, 997.0) + k * 31.0); }

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec3 nrm(vec3 c) { return c / max(max(c.r, max(c.g, c.b)), 0.05); }

float sdRBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// teardrop: circle r1 at the origin tapering to r2 at height h
float sdDrop(vec2 p, float r1, float r2, float h) {
  p.x = abs(p.x);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(p, vec2(-b, a));
  if (k < 0.0) return length(p) - r1;
  if (k > a * h) return length(p - vec2(0.0, h)) - r2;
  return dot(p, vec2(a, b)) - r1;
}

float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994, -0.587785252);
  const vec2 k2 = vec2(-0.809016994, -0.587785252);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

const vec2 BOLT[7] = vec2[7](
  vec2(-0.02, 0.96), vec2(0.56, 0.96), vec2(0.14, 0.17), vec2(0.62, 0.17),
  vec2(-0.34, -0.98), vec2(-0.04, -0.13), vec2(-0.58, -0.13)
);

float sdBolt(vec2 p) {
  float d = dot(p - BOLT[0], p - BOLT[0]);
  float s = 1.0;
  for (int i = 0, j = 6; i < 7; j = i, i++) {
    vec2 e = BOLT[j] - BOLT[i];
    vec2 w = p - BOLT[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= BOLT[i].y, p.y < BOLT[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}

// The eight symbols, each a solid silhouette in [-1,1]^2 with detail cut out
// of it at one line weight (about 0.09), so they carry the same ink.
// 0 bolt, 1 skull, 2 speaker, 3 flame, 4 eye, 5 diamond, 6 star, 7 record
float icon(float id, vec2 q) {
  float r = length(q);
  if (id < 0.5) {
    return sdBolt(q) - 0.02;
  } else if (id < 1.5) {
    float d = min(length(q - vec2(0.0, 0.2)) - 0.74, sdRBox(q - vec2(0.0, -0.52), vec2(0.44, 0.40), 0.13));
    // sockets: circles sliced by a brow that slopes down to the nose
    vec2 e = vec2(abs(q.x) - 0.31, q.y - 0.12);
    float eye = max(length(e) - 0.25, dot(e, normalize(vec2(-0.5, 1.0))) - 0.11);
    float nose = max(abs(q.x) * 1.9 + q.y + 0.2, -q.y - 0.42) * 0.47;
    float teeth = max(min(abs(q.x), abs(abs(q.x) - 0.25)) - 0.04, q.y + 0.56);
    return max(d, -min(min(eye, nose), teeth));
  } else if (id < 2.5) {
    float d = sdRBox(q, vec2(0.93), 0.22);
    float cut = min(abs(r - 0.66) - 0.075, abs(r - 0.25) - 0.05);
    cut = min(cut, length(abs(q) - 0.73) - 0.085);
    return max(d, -cut);
  } else if (id < 3.5) {
    vec2 f = q;
    f.x -= 0.2 * sin(q.y * 1.9 + 0.5) * smoothstep(-0.4, 0.9, q.y);
    float d = sdDrop(f - vec2(0.04, -0.44), 0.5, 0.02, 1.36);
    d = min(d, sdDrop(rot(q - vec2(-0.36, -0.36), -0.42), 0.3, 0.02, 0.98));
    d = min(d, sdDrop(rot(q - vec2(0.42, -0.46), 0.4), 0.24, 0.02, 0.72));
    float cut = sdDrop(f - vec2(0.03, -0.5), 0.25, 0.02, 0.62);
    return max(d, -cut);
  } else if (id < 4.5) {
    float lens = max(length(q - vec2(0.0, -0.49)) - 1.09, length(q - vec2(0.0, 0.49)) - 1.09);
    float cut = max(abs(r - 0.43) - 0.065, lens + 0.09);
    cut = min(cut, length(q - vec2(0.09, 0.09)) - 0.085);
    return max(lens, -cut);
  } else if (id < 5.5) {
    vec2 a = vec2(abs(q.x), q.y);
    float d = max(q.y - 0.8, dot(a - vec2(0.96, 0.28), normalize(vec2(0.52, 0.44))));
    d = max(d, dot(a - vec2(0.96, 0.28), normalize(vec2(1.23, -0.96))));
    float cut = abs(q.y - 0.28);
    cut = min(cut, sdSeg(a, vec2(0.54, 0.8), vec2(0.32, 0.28)));
    cut = min(cut, sdSeg(a, vec2(0.0, 0.8), vec2(0.32, 0.28)));
    cut = min(cut, sdSeg(a, vec2(0.32, 0.28), vec2(0.0, -0.95)));
    return max(d, -(cut - 0.042));
  } else if (id < 6.5) {
    float d = sdStar5(q - vec2(0.0, -0.06), 1.04, 0.47);
    return max(d, -(abs(d + 0.25) - 0.045));
  }
  float d = r - 0.95;
  float cut = min(abs(r - 0.79) - 0.028, abs(r - 0.63) - 0.028);
  cut = min(cut, abs(r - 0.4) - 0.06);
  cut = min(cut, r - 0.085);
  // the sheen: two wedges across the grooves
  cut = min(cut, max(abs(dot(q, vec2(-0.7071, 0.7071))) - 0.13 * r, abs(r - 0.71) - 0.17));
  return max(d, -cut);
}

// arc length along a rounded-rectangle track (half size b, corner radius r)
// and signed distance to it; .z is the length of the whole lap
vec3 lap(vec2 p, vec2 b, float r) {
  vec2 q = abs(p);
  float a = b.y - r, c = b.x - r, arc = r * 1.5707963;
  float Lq = a + arc + c;
  vec2 d = q - vec2(c, a);
  float s1, dist;
  if (d.x > 0.0 && d.y > 0.0) { s1 = a + r * atan(d.y, d.x); dist = length(d) - r; }
  else if (d.y <= 0.0 && d.x > d.y) { s1 = q.y; dist = q.x - b.x; }
  else { s1 = a + arc + c - q.x; dist = q.y - b.y; }
  float s = p.y >= 0.0 ? (p.x >= 0.0 ? s1 : 2.0 * Lq - s1)
                       : (p.x < 0.0 ? 2.0 * Lq + s1 : 4.0 * Lq - s1);
  return vec3(s, dist, 4.0 * Lq);
}

// per-frame state, filled in main()
float gN, gK, gLuck;

// The strip: which of 8 slots sits in cell c of reel i. The step is odd, so it
// is a permutation, and 1, 3, 5 and 7 are their own inverses modulo 8, which
// is what lets cellFor() find the cell that shows a given slot. Neighbouring
// reels take different steps, so a matching line does not come with matching
// rows above and below it.
float stripStep(float i, float era) {
  float k = mod(i + era, 4.0);
  return k < 0.5 ? 3.0 : k < 1.5 ? 7.0 : k < 2.5 ? 5.0 : 1.0;
}
float slotOf(float c, float i, float era) { return mod(c * stripStep(i, era) + i * 3.0 + era * 5.0, 8.0); }
float cellFor(float slot, float i, float era) { return mod((slot - i * 3.0 - era * 5.0) * stripStep(i, era), 8.0); }

// every other era plays half the symbols, each twice on the strip
float symOf(float slot, float era) {
  float m = mod(era, 4.0);
  if (m < 0.5 || (m > 1.5 && m < 2.5)) return slot;
  return mod(slot, 4.0) + (m > 2.5 ? 4.0 : 0.0);
}

float roundWin(float n) { return rh(n, 1.0) < gLuck ? 1.0 : 0.0; }
// 0 near miss, 1 no line at all
float roundDud(float n) { return rh(n, 3.0) < 0.8 ? 0.0 : 1.0; }

// the cell reel i shows on the payline at the end of round n
float targetCell(float n, float i) {
  float era = floor(n / 4.0);
  float W = floor(rh(n, 2.0) * 8.0);
  float jW = cellFor(W, i, era);
  if (roundWin(n) > 0.5) return jW;
  if (roundDud(n) < 0.5) {
    if (i < gN - 1.5) return jW;
    // the last reel ends one cell past the line (the cruel one: the symbol
    // hangs on the line for a beat, then slips) or one cell short of it
    return mod(jW + (rh(n, 4.0) < 0.6 ? 1.0 : -1.0), 8.0);
  }
  // an odd step keeps neighbouring reels on different symbols in every era
  return cellFor(mod(W + i * (rh(n, 5.0) < 0.5 ? 1.0 : 3.0), 8.0), i, era);
}

float stopBeat(float i) { return i > gN - 1.5 ? 15.0 : min(8.0 + 2.0 * i, 13.0); }

float springOf(float s) { return VR / SW * exp(-SK * s) * sin(SW * s); }

// Cells still to travel at round time t for a reel that starts at Ts, has D
// cells to cover and stops at beat S. K0 is the number of one-cell tease steps
// the last reel takes, one per beat, before it lands.
float remAt(float t, float S, float Ts, float D, float K0) {
  float u = S - t;
  if (u <= 0.0) return -springOf(-u);
  if (u < K0) {
    // one tease step: hang, then drop a cell in the last quarter of the beat
    // and arrive at speed VR, so every arrival rings the same spring
    float k = floor(u), w = 1.0 - (u - k);
    float x = clamp((w - 0.72) / 0.28, 0.0, 1.0);
    float g = 0.28 * VR;
    float r = k + 1.0 - ((3.0 - g) * x * x + (g - 2.0) * x * x * x) - springOf(w);
    if (k < 0.5) {
      // the fake: a lurch toward the line and back before the real drop
      float f = sin(PI * clamp((w - 0.3) / 0.34, 0.0, 1.0));
      r -= 0.3 * clamp(tease, 0.0, 1.0) * f * f;
    }
    return r;
  }
  float uu = u - K0, span = S - K0 - Ts;
  float v = (D - K0 - 0.5 * VR) / (span - 1.0);
  float a = t - Ts;
  if (a <= 0.0) return D;
  if (a < 1.0) return D - 0.5 * v * a * a;
  if (uu < 1.0) return K0 + VR * uu + 0.5 * (v - VR) * uu * uu;
  return K0 + v * uu - 0.5 * (v - VR);
}

// a plain token: a disc seen tumbling, so its face is an ellipse
vec4 token(vec2 e, float size, float hk, float hv, float s, float px, vec3 c3) {
  float ph = hv * TAU + s * (3.0 + 5.0 * hk);
  float sq = max(abs(cos(ph)), 0.14);
  vec2 el = rot(e, -(hk * TAU + s * (hv - 0.5) * 3.0));
  el.y /= sq;
  float rr = length(el) / size;
  float cov = smoothstep(px, -px, (rr - 1.0) * size * sq);
  float rim = smoothstep(0.07, 0.03, abs(rr - 0.74));
  vec3 col = c3 * (0.5 + 0.5 * sq) * (1.0 - 0.55 * rim) * mix(0.75, 1.0, smoothstep(1.0, 0.8, rr));
  // edge-on, the disc catches the light
  col += vec3(1.0, 0.97, 0.9) * pow(1.0 - sq, 3.0) * (0.35 + 0.65 * uHigh);
  return vec4(col, cov);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  float fit = min(1.0, aspect / 1.7778);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y / fit;
  float px = 1.0 / (uResolution.y * fit);

  vec3 c1 = nrm(uColor1), c2 = nrm(uColor2), c3 = nrm(uColor3);

  gN = clamp(floor(reels + 0.5), 3.0, 5.0);
  gK = floor(clamp(tease, 0.0, 1.0) * 3.0 + 0.5);
  gLuck = clamp(luck, 0.0, 1.0);
  float pay = clamp(payout, 0.0, 2.0);

  float bc = max(uBeatClock, 0.0);
  float n = floor(bc / 16.0), t = bc - 16.0 * n;
  float winN = roundWin(n), winP = roundWin(n - 1.0);
  // the strip changes symbols at beat 6.5 of every fourth round, when every
  // reel is at full speed and the swap is inside the blur
  float era = floor((bc - 6.5) / 64.0);
  float scheme = mod(era, 3.0);

  // payout clock: beats since the winning reel landed, for 8 beats
  float tp = -1.0;
  if (winN > 0.5 && t >= 15.0) tp = t - 15.0;
  else if (winP > 0.5) tp = t + 1.0;
  float paying = tp >= 0.0 ? 1.0 - smoothstep(7.0, 8.0, tp) : 0.0;
  // one bright-dark cycle every two beats: under 3 reversals a second up to 180 bpm
  float pulse = 0.5 + 0.5 * cos(PI * max(tp, 0.0));
  float hot = (winN > 0.5 && t >= 15.0) ? 1.0 : (winP > 0.5 ? 1.0 - smoothstep(4.7, 5.1, t) : 0.0);
  // a losing line sags for the beat after the last reel lands
  float sag = (winN < 0.5 && t >= 15.0) ? sin(PI * (t - 15.0)) : 0.0;
  // the first reels agree and the last is still to come
  float lined = roundDud(n) < 0.5 ? 1.0 : 0.0;

  // thunk: every stop kicks the whole cabinet down and lets it ring
  float shake = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    if (fi > gN - 0.5) break;
    float s = t - stopBeat(fi);
    if (s > 0.0 && s < 1.0) shake += (fi > gN - 1.5 ? 1.7 : 1.0) * exp(-7.0 * s) * cos(21.0 * s);
  }
  float sStep = fract(t);
  if (t > 15.0 - gK && t < 15.0) shake += 0.45 * exp(-7.0 * sStep) * cos(21.0 * sStep);
  vec2 p = p0 + vec2(0.0, 0.0065) * shake * (0.7 + 0.6 * uBassHit);

  // ---- cabinet --------------------------------------------------------
  float dO = sdRBox(p, BEZ_O, 0.07);
  float dI = sdRBox(p, BEZ_I, 0.035);
  float neonI = 0.5 + 0.5 * uBass + 0.9 * paying * pay * pulse;
  vec3 neonC = mix(c1, vec3(1.0), 0.25 + 0.5 * paying * min(pay, 1.0) * pulse);

  vec3 col = vec3(0.016, 0.017, 0.024) * (1.0 - 0.5 * smoothstep(0.0, 0.5, abs(p.y)))
           * (0.9 + 0.2 * hash21(vec2(floor(gl_FragCoord.y * 0.5), 3.0)));
  col += c1 * 0.05 * neonI * exp(-max(dO, 0.0) * 14.0);

  // ---- chase bulbs ----------------------------------------------------
  if (dO > 0.0) {
    vec3 lp = lap(p, CHASE, 0.09);
    float cnt = 4.0 * floor(lp.z / 0.062 / 4.0 + 0.5);
    float sp = lp.z / cnt;
    float idx = floor(lp.x / sp);
    float along = lp.x - (idx + 0.5) * sp;
    float d = length(vec2(along, lp.y));
    // the kick steps the chase; while the last reel teases it runs double time
    float stepI = t > 15.0 - gK && t < 15.0 ? floor(bc * 2.0) : floor(bc);
    float ph = mod(idx - stepI, 4.0);
    float lit = ph < 0.5 ? 1.0
              : ph < 1.5 ? smoothstep(0.22, 0.42, uEnergy)
              : ph < 2.5 ? smoothstep(0.58, 0.78, uEnergy) : 0.0;
    lit *= 0.75 + 0.45 * uBassHit;
    if (paying > 0.0) lit = mix(lit, mod(idx + floor(tp * 2.0), 2.0) * 1.2, paying * min(pay, 1.0));
    float rb = 0.0135;
    float body = smoothstep(rb + px, rb - px, d);
    vec3 glass = vec3(0.035) + c3 * 0.05 + vec3(0.10) * smoothstep(0.007, 0.002, length(vec2(along + 0.004, lp.y - 0.005)));
    vec3 on = mix(c3, vec3(1.0), 0.55 * smoothstep(rb, 0.0, d));
    col = mix(col, mix(glass, on, min(lit, 1.0)), body);
    col += c3 * lit * 0.32 * exp(-d * d / (rb * rb * 5.0)) * smoothstep(0.5 * sp, 0.25 * sp, d);
  }

  // ---- chrome bezel with the neon tube in its groove --------------------
  if (dO < 0.0 && dI > 0.0) {
    float tb = dI / (dI - dO);
    vec3 ch;
    if (tb < 0.3) {
      // black channel between glass and chrome, with the tube in it
      float dn = abs(tb - 0.15) * (dI - dO);
      ch = vec3(0.012) + c1 * 0.10 * neonI;
      ch += neonC * neonI * (smoothstep(0.0048, 0.0028, dn) * 0.95 + 0.3 * exp(-dn * 160.0));
    } else {
      float u = (tb - 0.3) / 0.7;
      vec2 g = normalize(vec2(sdRBox(p + vec2(0.002, 0.0), BEZ_O, 0.07) - dO,
                              sdRBox(p + vec2(0.0, 0.002), BEZ_O, 0.07) - dO) + 1e-6);
      // half-round profile reflecting a room: the outer half looks up at a
      // bright ceiling strip, the inner half down at the floor, the same all
      // the way round (a matcap), so no seam shows at the corners
      float sl = (u - 0.5) * 1.9;
      float e = 2.0 * sl * sqrt(1.0 - sl * sl);
      ch = e > 0.0 ? mix(vec3(0.9, 0.92, 0.96), vec3(0.12, 0.14, 0.22), smoothstep(0.0, 0.85, e))
                   : mix(vec3(0.01), vec3(0.17, 0.18, 0.22), smoothstep(0.0, -0.95, e));
      ch += vec3(0.5) * exp(-pow((sl + 0.45) / 0.07, 2.0));
      ch *= 0.72 + 0.28 * g.y;
      ch += c1 * 0.2 * neonI * exp(-u * 5.0);
      // highs: glints that hop along the bezel
      vec3 bl = lap(p, mix(BEZ_I, BEZ_O, 0.72), 0.06);
      float cell = floor(bl.x / 0.12);
      float tick = floor(uTime * 7.0);
      float hg = hash11(mod(cell * 7.3 + tick * 13.7, 997.0));
      vec2 gp = vec2(bl.x - (cell + 0.3 + 0.4 * hash11(cell + tick)) * 0.12, bl.y);
      float glint = 0.00004 / (dot(gp, gp) + 0.00003)
                  + 0.0006 / (abs(gp.x * gp.y) * 60.0 + 0.004) * exp(-dot(gp, gp) * 900.0);
      ch += vec3(1.0) * glint * step(0.8, hg) * uHigh * 0.9;
      ch *= smoothstep(0.0, 0.06, u);
    }
    col = mix(col, ch, smoothstep(0.0, 0.004, min(-dO, dI)));
  }

  // ---- inside the bezel -------------------------------------------------
  if (dI <= 0.0) {
    col = vec3(0.022, 0.023, 0.03) * smoothstep(0.0, -0.03, dI);
    vec2 a = abs(p);

    // side lamps, a stack each side that fills with the mids
    vec2 lq = vec2(a.x - 0.658, p.y);
    if (abs(lq.x) < 0.04 && a.y < 0.288) {
      float k = floor((p.y + 0.288) / 0.096);
      float ly = p.y + 0.288 - (k + 0.5) * 0.096;
      float d = sdRBox(vec2(lq.x, ly), vec2(0.026, 0.038), 0.012);
      float lvl = smoothstep(k / 6.0, (k + 1.0) / 6.0, 0.14 + 0.92 * uMid);
      // while the last reel is out, one lamp climbs the stack in half beats
      float run = lined * step(stopBeat(gN - 2.0), t) * step(t, 15.0);
      lvl = max(lvl, run * step(abs(k - mod(floor(bc * 2.0), 6.0)), 0.5));
      lvl = max(lvl, paying * min(pay, 1.0) * pulse);
      vec3 lc = mix(c3, c1, k / 5.0);
      vec3 lamp = lc * (0.07 + 0.83 * lvl) * (1.0 - 0.45 * smoothstep(-0.03, 0.0, d))
                + vec3(0.12) * smoothstep(0.006, 0.0, abs(ly - 0.022)) * step(abs(lq.x), 0.018);
      col = mix(col, lamp, smoothstep(px, -px, d));
      col += lc * lvl * 0.10 * exp(-max(d, 0.0) * 60.0);
    }

    // payline pointers
    vec2 tq = vec2(a.x - 0.612, a.y);
    float tri = max(tq.y * 0.9 - (tq.x + 0.012) * 0.9, tq.x - 0.014);
    float ptr = smoothstep(px, -px, tri);
    col = mix(col, c1 * (0.6 + 0.4 * uBass + paying * pulse), ptr * step(0.6, a.x));

    // ---- reels ----------------------------------------------------------
    if (a.x < WIN.x && a.y < WIN.y) {
      float colW = 2.0 * WIN.x / gN;
      float i = min(floor((p.x + WIN.x) / colW), gN - 1.0);
      float lx = p.x + WIN.x - (i + 0.5) * colW;
      float half_ = 0.5 * colW - 0.008;
      float cellH = min(colW * 0.92, ARC / 2.05);
      float iconR = 0.41 * cellH;

      float sT = p.y / RR;
      float th = asin(sT);
      float cosT = sqrt(1.0 - sT * sT);
      float ys = RR * th / cellH;

      float S = stopBeat(i);
      float K0 = i > gN - 1.5 ? gK : 0.0;
      float jn = targetCell(n, i), jp = targetCell(n - 1.0, i);
      // after a win the line is held for five beats before the reels go again
      float Ts = (winP > 0.5 ? 5.0 : 0.0) + 0.2 * i;
      float D = 8.0 * max(floor((S - K0 - Ts) * 0.75), 1.0) + mod(jn - jp, 8.0);
      float rem = remAt(t, S, Ts, D, K0);
      float vel = abs(remAt(t - 0.04, S, Ts, D, K0) - rem) / 0.04;
      float blur = clamp(vel * 0.05 * (0.6 + 0.8 * uEnergy) - 0.03, 0.0, 0.95);
      float pos = jn - rem;
      float stopped = step(S, t);
      float thunk = t > S ? exp(-(t - S) * 5.0) : 0.0;
      // the cell that is (or was, during the hold) the result
      float jHot = t >= 15.0 ? jn : jp;
      float eraS = era;

      vec3 back = scheme > 0.5 && scheme < 1.5
                ? c2 * (0.2 + 0.2 * uBass)
                : vec3(0.028) + c2 * (0.05 + 0.15 * uBass);
      back *= 0.7 + 0.3 * stopped + 0.5 * thunk;
      back *= 1.0 - 0.45 * hot * (scheme > 0.5 && scheme < 1.5 ? 1.0 : 0.0);
      back = min(back, vec3(0.5));

      float aa = 1.5 * px / iconR / max(cosT, 0.25);
      float soft = aa + 0.05 * blur * cellH / iconR;
      float dith = hash21(gl_FragCoord.xy + fract(uTime) * 61.0);
      vec3 acc = vec3(0.0);
      float dHot = 9.0;
      for (int k = 0; k < 4; k++) {
        float sc = pos + ys + ((float(k) + dith) / 4.0 - 0.5) * blur;
        float c = floor(sc + 0.5);
        float ly = sc - c;
        float slot = slotOf(mod(c, 8.0), i, eraS);
        float id = symOf(slot, eraS);
        float d = icon(id, vec2(lx, ly * cellH) / iconR);
        float cov = smoothstep(soft, -soft, d) * step(abs(lx), half_);
        float isHot = step(abs(mod(c - jHot + 4.0, 8.0) - 4.0), 0.5);
        vec3 sym = scheme > 1.5 && mod(slot, 2.0) > 0.5 ? c3 : c2;
        if (scheme > 0.5 && scheme < 1.5) sym = vec3(0.012);
        // stopped reels that agree glow while the last one is still out
        float onLine = step(abs(mod(c - jn + 4.0, 8.0) - 4.0), 0.5);
        float wait = lined * stopped * onLine * step(t, 15.0) * (0.5 + 0.5 * cos(TAU * t));
        sym *= 0.9 + 0.25 * wait;
        sym = mix(sym * (1.0 - 0.55 * hot), vec3(1.25) * (0.8 + 0.2 * pulse), hot * isHot);
        sym *= 1.0 - 0.45 * sag * stopped;
        // a little top light inside each symbol
        sym *= 0.86 + 0.22 * ly * cellH / iconR;
        acc += mix(back, sym, cov);
        if (isHot > 0.5) dHot = min(dHot, d);
      }
      vec3 rc = acc / 4.0;
      rc += vec3(1.0) * hot * pulse * 0.22 * exp(-max(dHot, 0.0) * 5.0) * step(abs(lx), half_);
      // the cylinder: falls off toward the top and bottom, one soft band of light above centre
      rc *= 0.12 + 0.88 * pow(cosT, 1.4);
      rc += vec3(0.75, 0.8, 0.9) * 0.07 * exp(-pow((th - 0.62) / 0.13, 2.0)) * step(abs(lx), half_);
      rc *= 0.75 + 0.25 * smoothstep(half_, half_ - 0.03, abs(lx));
      // dividers between the reels
      float dv = smoothstep(half_ - px, half_ + px, abs(lx));
      vec3 post = vec3(0.05, 0.052, 0.06) + vec3(0.25) * exp(-pow((abs(lx) - 0.5 * colW) / 0.0025, 2.0)) * (0.4 + 0.6 * cosT);
      rc = mix(rc, post, dv);

      // glass: payline, a diagonal reflection, shadow under the frame
      float line = smoothstep(0.0035 + px, 0.0035 - px, a.y);
      rc = mix(rc, c1 * (0.45 + 0.35 * uBass), line * 0.4);
      rc += mix(c1, vec3(1.0), 0.5) * paying * pay * pulse * (0.9 * line + 0.3 * exp(-pow(p.y / 0.035, 2.0)));
      rc += vec3(0.6, 0.7, 0.9) * 0.022 * smoothstep(0.1, 0.0, abs(p.x * 0.6 + p.y - 0.12));
      rc *= 0.45 + 0.55 * smoothstep(WIN.y, WIN.y - 0.03, a.y);
      col = rc;
    }
  }

  // ---- payout fountain --------------------------------------------------
  // One burst per beat for 8 beats. All tokens of a burst share its age, so in
  // the frame that falls with gravity they sit on straight rays from the
  // origin: only the pixel's angular sector and its two neighbours are tested.
  if (tp >= 0.0 && pay > 0.0) {
    // the sector count is fixed: `payout` and energy only choose how many of
    // the tokens show, so mapping them on audio never reshuffles the fountain
    const float Np = 30.0;
    float fade = smoothstep(0.0, 0.2, pay);
    for (int j = 0; j < 3; j++) {
      float idx = floor(tp) - float(j);
      if (idx < 0.0 || idx > 7.5) continue;
      float s = tp - idx;
      float seed = mod(floor(bc) - float(j), 997.0);
      float ox = (floor(hash11(seed * 1.3 + 2.0) * 3.0) - 1.0) * 0.5;
      vec2 c = vec2(ox, -0.56);
      float a0 = 1.5707963 + ox * 0.6 - 0.75;
      float G = 0.7 * s * s;
      vec2 w = p0 - c + vec2(0.0, G);
      float sec = floor((atan(w.y, w.x) - a0) / 1.5 * Np);
      // tokens are born small: capped so one never reaches past the sectors tested
      float cap = 1.5 * s / Np;
      float kick = j == 0 ? uBassHit * (1.0 - smoothstep(0.2, 0.5, s)) : 0.0;
      float life = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(2.3, 2.8, s)) * fade;
      for (int dk = -1; dk <= 1; dk++) {
        float k = sec + float(dk);
        if (k < 0.0 || k > Np - 0.5) continue;
        for (int m = 0; m < 2; m++) {
          float hk = hash11(mod(k * 7.1 + seed * 3.3 + float(m) * 51.0, 997.0));
          float hv = hash11(hk * 91.0 + float(m) + 0.5);
          float ak = a0 + (k + 0.5 + 0.35 * (hk - 0.5)) / Np * 1.5;
          vec2 e = p0 - (c + vec2(cos(ak), sin(ak)) * 1.75 * (0.55 + 0.45 * hv) * s - vec2(0.0, G));
          float isSym = step(0.72, fract(hk * 13.0));
          float size = min(0.021 * (0.8 + 0.5 * hv) * (1.0 + 0.5 * isSym) * (0.85 + 0.15 * pay) * (1.0 + 0.25 * kick), cap);
          if (dot(e, e) > size * size * 1.2) continue;
          // which tokens show first never changes, only how far down the list we go
          float vis = smoothstep(0.0, 0.1, (0.3 + 0.35 * pay) * (0.55 + 0.45 * uEnergy) - fract(hk * 29.0)) * life;
          vec4 tk;
          if (isSym > 0.5) {
            float d = icon(floor(fract(hk * 57.0) * 8.0), rot(e, s * (hv - 0.5) * 2.5) / size);
            tk = vec4(mix(c2, vec3(1.0), 0.65), smoothstep(px / size, -px / size, d));
          } else {
            tk = token(e, size, hk, hv, s, px, c3);
          }
          col = mix(col, tk.rgb * (1.0 + 0.35 * kick), tk.a * vis);
        }
      }
    }
  }

  // the landing of a winning line: one swell of light, not a strobe
  if (tp >= 0.0) col += mix(c1, vec3(1.0), 0.6) * 0.16 * min(pay, 1.5) * exp(-tp * 2.5) * exp(-dot(p0, p0) * 2.0);

  col *= 1.0 - 0.25 * dot(p0 * vec2(0.55, 1.0), p0 * vec2(0.55, 1.0));
  gl_FragColor = vec4(clamp(col, 0.0, 4.0), 1.0);
}

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

uniform float plate;
uniform float grain;
uniform float drive;
uniform float honest;

// Phantom: four still plates that move only in the viewer's head, built from
// the perceptual principles and laid out by us.
//  1 peripheral drift: rings of black / dark / white / light wedges; the eye
//    reads a rotation from black toward dark. Each beat swaps dark and light,
//    so the read direction reverses.
//  2 Pinna-Brelstaff: log-polar rings of tilted rhombi with a light and a dark
//    half outline. The zoom is real, the counter-rotation of the rings is not.
//  3 four-stroke: A, A shifted, -A, -A shifted. Every step reads as a move the
//    same way, the bars never leave their two positions.
//  4 scintillating grid: white discs on grey lines over black, dark ghosts in
//    the discs away from the fixation point; the highs light real ones.
//
// Photosensitivity: every plate works in display space on a fixed luminance
// ramp and is run through the inverse of the app's tone curve at the end, so
// the steps below are the steps on the projector. Polarity flips swap two
// equal areas (mean luminance constant) once a beat; the contrast-reversing
// bars of plate 3 stay under 0.19 apart and reverse once a beat; the sparkles
// of plate 4 are single discs.

const float TAU = 6.2831853;
const float PI = 3.14159265;

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Display colour of luma L carrying the hue of p: the zero-luma chroma of p is
// added to grey L, as much as the gamut allows, so L is exact for any palette.
vec3 tint(vec3 p, float L, float sat) {
  vec3 d = p - luma(p);
  vec3 room = mix(vec3(L), vec3(0.98 - L), step(0.0, d)) / max(abs(d), 1e-4);
  return L + d * sat * min(min(room.x, room.y), min(room.z, 1.2));
}

// Inverse of the app's tone curve (c * 1.1, then the ACES fit), per channel.
vec3 untone(vec3 y) {
  y = clamp(y, 0.0, 0.98);
  vec3 a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y;
  return (-b + sqrt(b * b + 0.56 * y * a)) / (2.0 * a) / 1.1;
}

// irregular bars with exactly as many light as dark: each pair of cells holds
// one of each, in a hashed order
float bar(float i, float row) {
  float pair = floor(i * 0.5);
  float fl = step(0.5, hash21(vec2(mod(pair, 1024.0), row)));
  return 1.0 - 2.0 * abs(mod(i, 2.0) - fl);
}
float barAA(float x, float px, float row) {
  x += 0.5 * px;
  float i = floor(x);
  return mix(bar(i - 1.0, row), bar(i, row), clamp(fract(x) / px, 0.0, 1.0));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float px = 1.0 / uResolution.y;
  float g = clamp(grain, 4.0, 40.0);
  float dr = clamp(drive, 0.0, 2.0);

  // Phrase of 16 beats; on the last one the clock holds and the audio is
  // gated, so the whole plate stands still for a beat.
  float ph = mod(uBeatClock, 16.0);
  float frozen = step(15.0, ph);
  float bc = uBeatClock - frozen * (ph - 15.0);
  float live = 1.0 - frozen;
  float bass = uBass * live, mid = uMid * live, high = uHigh * live;
  float hit = uBassHit * live;

  // 0 = auto: every 32 beats the next plate, and on a coin toss the second
  // half of the 32 goes to another one. A cut never lands on the same plate.
  float s32 = floor(bc / 32.0);
  float split = step(0.5, hash11(mod(s32, 997.0))) * step(16.0, mod(bc, 32.0));
  float pl = plate < 0.5 ? mod(3.0 * s32 + 2.0 * split, 4.0) : clamp(floor(plate + 0.5), 1.0, 4.0) - 1.0;
  float phrase = mod(floor(bc / 16.0), 997.0);

  // palette sorted by luma: a darkest, c brightest
  vec3 ca = uColor1, cb = uColor2, cc = uColor3, sw;
  if (luma(ca) > luma(cb)) { sw = ca; ca = cb; cb = sw; }
  if (luma(cb) > luma(cc)) { sw = cb; cb = cc; cc = sw; }
  if (luma(ca) > luma(cb)) { sw = ca; ca = cb; cb = sw; }

  // the four steps, in display luma; contrast closes toward the pivot
  float k = clamp(mix(0.55, 0.88, min(dr, 1.0)) + 0.12 * max(dr - 1.0, 0.0) + 0.12 * uEnergy * dr, 0.0, 1.0);
  vec3 lev[4];
  lev[0] = tint(ca, 0.45 - 0.45 * k, 0.25);
  lev[1] = tint(ca, 0.45 - 0.10 * k, 0.9);
  lev[2] = tint(cc, 0.45 + 0.40 * k, 0.35);
  lev[3] = tint(cb, 0.45 + 0.15 * k, 0.8);

  // polarity: one state per beat, crossfaded at the start of the beat
  float flipW = mix(0.3, 0.03, dr * 0.5);
  float e = smoothstep(0.0, flipW, fract(bc));
  float pol = mod(floor(bc), 2.0) > 0.5 ? e : 1.0 - e;

  // kick zoom punch and a little bass breath on every plate
  uv *= 1.0 - (0.05 * hit + 0.02 * bass) * min(dr, 1.5);
  float r = length(uv);
  float th = atan(uv.y, uv.x);

  vec3 col;

  if (pl < 0.5) {
    // ---- 1: peripheral drift discs on a hex lattice ----
    float s = 4.0 / g;
    vec2 gs = vec2(s, s * 0.8660254);
    float j0 = floor(uv.y / gs.y);
    vec2 best = vec2(0.0);
    float bd = 1e9, par = 0.0;
    for (int n = 0; n < 2; n++) {
      float j = j0 + float(n);
      float off = 0.5 * mod(j, 2.0);
      float i = floor(uv.x / gs.x - off + 0.5);
      vec2 c = vec2((i + off) * gs.x, j * gs.y);
      float d = length(uv - c);
      if (d < bd) { bd = d; best = c; par = mod(i + j, 2.0); }
    }
    vec2 q = uv - best;
    float R = 0.48 * s;
    float rho = max(bd / R, 1e-4);
    float dir = 1.0 - 2.0 * par;

    // dark and light trade places on the flip: equal areas, mean unchanged
    vec3 l1 = mix(lev[1], lev[3], pol), l3 = mix(lev[3], lev[1], pol);

    const float NW = 32.0;               // wedges per ring, 8 periods of 4
    float kr = TAU / NW;                 // log ring step: wedges come out square
    // honest: the discs really turn the way they seem to, and back on the flip
    float turn = honest * 2.0 * (1.0 - abs(fract(bc * 0.5) * 2.0 - 1.0));
    float w = atan(q.y, q.x) / TAU * NW * dir - turn;
    float pw = px / (bd * kr), pv = px / (bd * kr);
    float v = -log(rho) / kr + 0.5 * pv;
    float m = floor(v);
    vec3 ring[2];
    for (int n = 0; n < 2; n++) {
      float ww = w + 2.0 * (m - float(n)) + 0.5 * pw;
      float qi = mod(floor(ww), 4.0);
      float t = clamp(fract(ww) / pw, 0.0, 1.0);
      vec3 cur = qi < 0.5 ? lev[0] : qi < 1.5 ? l1 : qi < 2.5 ? lev[2] : l3;
      vec3 prv = qi < 0.5 ? l3 : qi < 1.5 ? lev[0] : qi < 2.5 ? l1 : lev[2];
      ring[n] = mix(prv, cur, t);
    }
    col = mix(ring[1], ring[0], clamp(fract(v) / pv, 0.0, 1.0));

    // energy opens more rings toward the centre; the hub is a black pupil
    float rin = mix(0.42, 0.12, uEnergy);
    float pr = px / R;
    col = mix(lev[0], col, smoothstep(rin - pr, rin + pr, rho));
    col = mix(lev[2], col, smoothstep(-pr, pr, rho - 0.3 * rin));
    col = mix(col, tint(ca, 0.07, 1.0), smoothstep(-pr, pr, rho - 1.0));
  } else if (pl < 1.5) {
    // ---- 2: Pinna-Brelstaff rings, log-polar so the zoom is self-similar ----
    float N = max(floor(g * 1.5 + 0.5), 8.0);
    float kc = TAU / N;
    // real zoom: bass breath and kick, plus a slow swell so silence still moves
    float zl = dr * (0.16 * bass + 0.10 * hit + 0.05 * sin(bc * TAU / 8.0));
    float v = (log(max(r, 1e-4)) - zl) / kc;
    float m = floor(v);
    float sgn = 1.0 - 2.0 * mod(m, 2.0);
    // honest: the rings really counter-rotate with the zoom
    float a = (th / TAU - sgn * honest * 0.5 * zl / TAU) * N + 0.5 * mod(m, 2.0);
    vec2 p = vec2(fract(a) - 0.5, fract(v) - 0.5);
    float tl = sgn * (0.45 + 0.4 * mid);
    float cs = cos(tl), sn = sin(tl);
    p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
    float pc = px / (max(r, 1e-4) * kc);
    // rhombus 0.40 x 0.25, distance in cell units
    float d = (abs(p.x) / 0.40 + abs(p.y) / 0.25 - 1.0) * 0.212;
    float edge = 1.0 - smoothstep(0.055 - pc, 0.055 + pc, abs(d + 0.03));
    float up = smoothstep(-pc, pc, p.y);
    vec3 lightSide = mix(lev[2], lev[0], pol), darkSide = mix(lev[0], lev[2], pol);
    // ground: the dark step, held back in chroma so the outlines carry the plate
    col = mix(tint(ca, 0.45 - 0.10 * k, 0.5), lev[3], (1.0 - smoothstep(-pc, pc, d + 0.03)) * 0.35);
    col = mix(col, mix(darkSide, lightSide, up), edge);
    // rings too small to draw end in a hub; energy moves it inward
    float rin = mix(0.13, 0.05, uEnergy);
    col = mix(lev[0], col, smoothstep(rin - px, rin + px, r));
    col = mix(lev[2], col, smoothstep(-px, px, r - 0.3 * rin));
  } else if (pl < 2.5) {
    // ---- 3: four-stroke bands ----
    float nb = max(floor(g * 0.25 + 0.5), 1.0);
    float y = (uv.y + 0.5) * nb;
    float j = floor(y), fy = fract(y);
    float dir = 1.0 - 2.0 * mod(j, 2.0);
    float bw = 1.0 / (g * 1.2);
    float x = uv.x / bw * dir;
    float pxx = px / bw;
    // stepped on eighths: shift on every step, contrast reversal on every
    // other one (once a beat)
    float n = floor(bc * 2.0);
    float st = mod(n, 4.0);
    float val = barAA(x - 0.3 * mod(st, 2.0), pxx, j) * (st < 1.5 ? 1.0 : -1.0);
    // honest: the same bars really stepping along, no reversal
    if (honest > 0.001) val = mix(val, barAA(x - 0.3 * mod(n, 4096.0), pxx, j), honest);
    float jm = mod(j, 3.0);
    vec3 hue = jm < 0.5 ? cb : jm < 1.5 ? cc : ca;
    // 0.49 +- 0.09 at most: the only part of the plate that reverses
    col = tint(hue, 0.49 + 0.09 * k * val, 0.85);
    // static sprocket strip between bands: the still frame the bars slide in
    float py = px * nb;
    float strip = smoothstep(0.38 - py, 0.38 + py, abs(fy - 0.5));
    float tk = abs(fract(uv.x / bw * 0.25) - 0.5);
    float tick = (1.0 - smoothstep(0.2 - 0.25 * pxx, 0.2 + 0.25 * pxx, tk))
               * (1.0 - smoothstep(0.035 - py, 0.035 + py, abs(abs(fy - 0.5) - 0.44)));
    col = mix(col, mix(lev[0], lev[2], tick), strip);
  } else {
    // ---- 4: scintillating grid, square or on the diagonal by phrase ----
    float ang = step(0.5, hash11(phrase + 13.0)) * PI * 0.25;
    float ca2 = cos(ang), sa2 = sin(ang);
    float cell = 1.0 / (g * 0.6);
    vec2 p = vec2(ca2 * uv.x - sa2 * uv.y, sa2 * uv.x + ca2 * uv.y) / cell;
    vec2 id = floor(p + 0.5);
    vec2 q = p - id;
    float pc = px / cell;
    float rq = length(q);
    float n8 = mod(floor(bc * 2.0), 512.0);
    float env = sin(PI * fract(bc * 2.0));
    vec2 hid = mod(id, 256.0) + n8 * vec2(3.1, 7.7);

    // real sparkles: a few intersections picked every eighth, as many as the
    // highs and the energy allow; each is one disc
    float sp = step(hash21(hid), 0.01 + 0.10 * high + 0.03 * uEnergy * live) * env * smoothstep(0.0, 0.35, high);
    float lineD = min(abs(q.x), abs(q.y));
    vec3 lineCol = tint(cb, 0.45 - 0.07 * k, 0.45);
    lineCol = mix(lineCol, tint(cc, 0.80, 1.0), sp * exp(-rq * 7.0));
    col = mix(lev[0], lineCol, 1.0 - smoothstep(0.08 - pc, 0.08 + pc, lineD));
    float rd = 0.115 * (1.0 + 0.7 * sp);
    vec3 disc = mix(lev[2], vec3(0.96), sp);
    // honest: some of the ghosts are painted in
    float ghost = honest * step(hash21(hid + 91.0), 0.3) * env;
    disc = mix(disc, tint(ca, 0.25, 0.6), ghost * (1.0 - smoothstep(0.06 - pc, 0.06 + pc, rq)));
    col = mix(col, disc, 1.0 - smoothstep(rd - pc, rd + pc, rq));
  }

  gl_FragColor = vec4(untone(col), 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uHighHit;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float cells;
uniform float bulge;
uniform float lenses;
uniform float mode;

// Vega Bulge: a hard 1-bit op-art plate (checker, concentric squares or
// Riley-style stripes) pushed out by up to three invisible spheres, so the
// grid swells toward the crowd. Each lens remaps the plane with the spherical
// cap profile (sample radius = R * asin(r/R) / (pi/2), which is smaller than
// r near the centre: cells magnify, and the rim stays put), blended with a
// smooth falloff so lenses add without seams. The same sphere gives a normal
// for a soft light and a tight specular. Written from the maths, palette ours.
// Kick punches the main lens, bass swings the satellites, highs flicker the
// accent cells/stripe. Strictly two-tone: no bloom wanted on this one.

const float PI = 3.14159265;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// ease helper: 0..1 over the first 'len' beats of a block
float blockEase(float beat, float blockLen, float len) {
  return smoothstep(0.0, 1.0, clamp(fract(beat / blockLen) * blockLen / len, 0.0, 1.0));
}

float cellMult(float idx) {
  float m = mod(idx, 3.0);
  return m < 0.5 ? 1.0 : (m < 1.5 ? 1.5 : 2.0);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float beat = mod(uBeatClock, 512.0);

  // rotation locked to tempo: a quarter turn every 8 beats, periodic every 32
  float ang = mod(beat, 32.0) * (1.5707963 / 8.0) + 0.12;
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);
  vec2 pr = rot * p;

  // ---- lenses
  vec2 disp = vec2(0.0);
  vec3 nacc = vec3(0.0);
  float hgt = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float on = step(fi + 0.5, lenses);
    vec2 c = vec2(0.0);
    float R = 0.42 * (1.0 + 0.4 * uBassHit);
    float k = bulge * (1.0 + 0.6 * uBassHit);
    if (i > 0) {
      c = 0.45 * vec2(sin(uBassTime * 0.31 + fi * 2.1) * 1.4, cos(uBassTime * 0.23 + fi * 1.3)) * (0.6 + 0.6 * uBass);
      R = 0.25;
      k = bulge * 0.7 * (0.5 + uBass);
    }
    k = min(k * 0.8, 1.0);
    vec2 d = pr - c;
    float r = length(d);
    float u = clamp(r / R, 0.0, 0.999);
    float s = asin(u) / 1.5707963;
    float z = sqrt(1.0 - u * u);
    float wgt = (1.0 - smoothstep(0.7 * R, R, r)) * on;
    // sample closer to the centre than we are: the cells grow
    disp += d / max(r, 1e-4) * (r - R * s) * k * wgt;
    // blend from flat (0,0,1) toward the true sphere normal (d/R, z)
    nacc += vec3(d / R, z - 1.0) * wgt * k;
    hgt += z * wgt * k;
  }
  vec2 q = pr - disp;

  // ---- pattern parameters
  float N = clamp(cells, 4.0, 40.0);
  bool autoMode = mode < 0.5;
  if (autoMode) {
    float b32 = floor(beat / 32.0);
    // previous block wraps on the 512-beat cycle (16 blocks) so there is no jump
    N *= mix(cellMult(mod(b32 + 15.0, 16.0)), cellMult(b32), blockEase(beat, 32.0, 1.0));
  }
  N = min(N, 44.0);

  // A) checker
  float sA = sin(q.x * N * PI) * sin(q.y * N * PI);
  float aaA = max(fwidth(sA), 1e-3) * 1.2;
  float vA = smoothstep(-aaA, aaA, sA);

  // B) concentric Chebyshev squares
  float m = max(abs(q.x), abs(q.y));
  float sB = sin(m * N * PI * 2.0 - uBassTime * 2.0);
  float aaB = max(fwidth(sB), 1e-3) * 1.2;
  float vB = smoothstep(-aaB, aaB, sB);

  // C) Riley currents
  float w = 0.08 * (0.5 + uBass) * sin(q.x * 3.1 + uTime * 0.7) * cos(q.x * 1.7 - uTime * 0.45);
  float phase = (q.y + w) * N * PI * 1.2 * (1.0 + 0.25 * uBassHit);
  float sC = sin(phase);
  float aaC = max(fwidth(sC), 1e-3) * 1.2;
  float vC = smoothstep(-aaC, aaC, sC - 0.3 * uHigh);

  // mode weights
  float wA = 0.0, wB = 0.0, wC = 0.0;
  if (autoMode) {
    float blk = floor(beat / 16.0);
    float xf = blockEase(beat, 16.0, 1.0);
    float cur = mod(blk, 3.0);
    float prv = mod(mod(blk + 31.0, 32.0), 3.0); // wraps with the 512-beat cycle
    wA = (cur < 0.5 ? xf : 0.0) + (prv < 0.5 ? 1.0 - xf : 0.0);
    wB = (abs(cur - 1.0) < 0.5 ? xf : 0.0) + (abs(prv - 1.0) < 0.5 ? 1.0 - xf : 0.0);
    wC = (cur > 1.5 ? xf : 0.0) + (prv > 1.5 ? 1.0 - xf : 0.0);
  } else {
    float mi = floor(mode + 0.5);
    wA = step(mi, 1.5);
    wB = step(1.5, mi) * step(mi, 2.5);
    wC = step(2.5, mi);
  }
  float v = wA * vA + wB * vB + wC * vC;

  // polarity flip every 16 beats, eased over a quarter beat
  float flip = mod(floor(beat / 16.0), 2.0);
  float te = fract(beat / 16.0) * 16.0;
  float fe = mix(1.0 - flip, flip, smoothstep(0.0, 0.25, te));
  v = mix(v, 1.0 - v, fe);

  // ---- colour: strictly two-tone
  vec3 ink = uColor1 * 0.03;
  vec3 paper = mix(vec3(1.0), uColor2, 0.25);
  vec3 col = mix(ink, paper, v);

  // accents on the highs
  float stripeIdx = floor(phase / PI);
  float accS = step(abs(mod(stripeIdx, 9.0)), 0.5) * wC;
  vec3 accCol = uColor3 * (0.6 + 0.8 * uHigh);
  col = mix(col, accCol, accS * v * 0.85);
  float hc = hash21(floor(q * N));
  // squares: flicker whole rings (index follows the outward flow), not grid tiles
  float ringIdx = floor(2.0 * m * N - uBassTime * 2.0 / PI);
  float hr = hash21(vec2(ringIdx, 7.0));
  float accC = (step(0.97, hc) * wA + step(0.88, hr) * wB) * uHighHit;
  col = mix(col, uColor3 * 1.2, accC * 0.9);

  // ---- volume shading from the sphere normal
  vec2 nxy = nacc.xy * rot; // back to screen orientation
  vec3 nrm = normalize(vec3(nxy, max(nacc.z + 1.0, 0.05))); // overlapping lenses can push z below 0
  vec3 light = normalize(vec3(-0.4, 0.5, 0.75));
  float sh = clamp(dot(nrm, light), 0.0, 1.0);
  float hg = clamp(hgt, 0.0, 1.0);
  col *= mix(1.0, 0.45 + 0.75 * sh, hg);
  col += uColor3 * pow(sh, 24.0) * hg * (0.3 + 0.7 * uBassHit);

  col *= 1.0 + 0.2 * uBassHit;
  col *= 1.0 / (1.0 + 0.25 * dot(p, p));
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

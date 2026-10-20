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

uniform float filaments;
uniform float chaos;
uniform float globe;
uniform float discharge;

// Plasma Globe: a glass sphere with a white-hot core. Filaments are polar
// curves theta_k(r) = theta0_k + A(r) * fbm1D(r), whose distance is the angular
// gap turned into arc length and divided by the slope. Glow is w/(d+eps) plus
// a soft exp halo. On the kick the filaments gather toward 4 attractor angles
// and bolts leave the glass up to the screen edge. Scritto dalla matematica,
// nessun codice di terzi.

const float PI = 3.14159265;
const float TAU = 6.28318531;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
// value noise, centred on -0.5..0.5
float vn(float x) {
  float i = floor(x);
  float f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f) - 0.5;
}
float fbm3(float x) {
  return 0.55 * vn(x) + 0.28 * vn(2.1 * x + 1.7) + 0.14 * vn(4.3 * x + 3.1);
}
float wrap(float x) { return mod(x + PI, TAU) - PI; }

// amplitude of the wiggle at normalised radius rn
float ampl(float rn) {
  return chaos * (0.15 + 0.85 * rn) * (0.5 + 0.4 * uBass) * smoothstep(0.0, 0.25, rn);
}

// centre line angle of a filament at normalised radius rn
float centre(float rn, float th0, float seed, float tq, float A) {
  return th0 + A * fbm3(rn * 2.6 + seed + tq) + 0.6 * A * rn * vn(rn * 7.0 - tq * 3.0 + seed);
}

float glow(float d, float w) {
  return w / (d + w * 0.6) * 0.35 + exp(-d * 90.0) * 0.25;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float dis = kick * discharge;
  float R = globe * (1.0 + 0.04 * uBass + 0.03 * kick);
  float r = length(p);
  float a = atan(p.y, p.x);
  float rn = r / R;

  float T = mod(uTime, 1000.0);
  // crackle: smooth drift plus a bounded quantised jump (~14 Hz). The jump is
  // a hashed offset, not floor(T*rate)*k: that grows with T and turns every
  // tiny uHigh change into a huge phase leap (frame-to-frame flicker).
  float qs = floor(T * 14.0);
  float tq = T * 0.35 + (hash(mod(qs, 251.0) + 0.37) - 0.5) * 0.3 * (0.3 + uHigh);
  float bc = mod(uBeatClock, 1000.0);
  // discharge seed latched per beat (kicks land on the beat), so attractors and
  // bolt shapes never jump in the middle of a kick. (uBassTime rolls over
  // on its own clock, independent of the kick.)
  float bk = mod(floor(bc + 0.15), 97.0);

  float N = clamp(floor(filaments), 1.0, 14.0);
  int nf = int(N);
  float rot = TAU / N * (floor(bc) + smoothstep(0.0, 0.25, fract(bc))) * 0.25;
  float attOff = 0.4 * hash(bk);

  float I = 0.0;
  float hot = 0.0;

  float haloFade = 1.0 - smoothstep(R + 0.05, R + 0.12, r);
  if (r < R + 0.12) {
    for (int i = 0; i < 14; i++) {
      if (i >= nf) break;
      float fi = float(i);
      float seed = fi * 7.31;
      float th0 = fi * TAU / N + 0.35 * sin(T * 0.11 + fi * 1.9) + rot;
      float att = floor(th0 / (TAU * 0.25) + 0.5) * (TAU * 0.25) + attOff;
      th0 = mix(th0, att, clamp(0.75 * dis, 0.0, 0.95));
      float life = 0.6 + 0.4 * (vn(T * 0.7 + seed) + 0.5);

      // contact point on the glass
      float A1 = ampl(1.0);
      float thc = centre(1.0, th0, seed, tq, A1);
      vec2 cpos = R * vec2(cos(thc), sin(thc));
      float dc = length(p - cpos);
      hot += (exp(-dc * 60.0) * (0.6 + 0.8 * kick) * (1.0 + 1.5 * uHigh) + exp(-dc * 14.0) * 0.15 * haloFade) * life;

      if (rn > 0.08 && rn < 1.0) {
        float A = ampl(rn);
        float thk = centre(rn, th0, seed, tq, A);
        float k = A * 2.6 * rn;
        float da = abs(wrap(a - thk)) * r / sqrt(1.0 + k * k);
        float w = 0.0018 * (1.0 + 2.0 * dis) * (1.2 - 0.6 * rn);
        float fade = smoothstep(0.08, 0.16, rn);
        I += glow(da, w) * life * fade;

        // branch
        float rf = 0.45 + 0.3 * hash(seed + floor(T * 0.5));
        if (rn > rf) {
          float sg = hash(seed + 3.0) > 0.5 ? 1.0 : -1.0;
          float thb = thk + sg * (rn - rf) * (0.8 + chaos) + 0.5 * A * vn(rn * 11.0 + seed * 2.0 + tq * 2.0);
          float db = abs(wrap(a - thb)) * r / sqrt(1.0 + k * k);
          I += glow(db, w * 0.6) * 0.6 * (0.5 + uHigh) * smoothstep(rf, rf + 0.08, rn) * life;
        }
      }
    }
  }

  // glass
  float inside = 1.0 - step(1.0, rn);
  float rim = (pow(smoothstep(0.75, 1.0, rn), 3.0) * 0.35 * inside + exp(-abs(rn - 1.0) * 120.0) * 0.5) * (1.0 + 2.0 * kick);
  vec2 q = p / R;
  float moon = 1.0 - smoothstep(0.0, 0.08, length(q - vec2(-0.38, 0.42)) - 0.12);
  float moonCut = 1.0 - smoothstep(0.0, 0.08, length(q - vec2(-0.32, 0.36)) - 0.12);
  float spec = clamp(moon - moonCut, 0.0, 1.0) * 0.12 * (1.0 - smoothstep(0.85, 0.95, rn)) * inside;
  float haze = 0.06 * (1.0 - min(rn, 1.0)) * inside;

  float core = (exp(-rn * 9.0) * (0.9 + 0.8 * uBass + 1.5 * kick) + 0.25 * exp(-rn * 3.0)) * (1.0 - 0.5 * step(1.0, rn));
  core *= exp(-max(rn - 1.0, 0.0) * 6.0);

  // discharge bolts out of the glass
  float bolts = 0.0;
  if (dis > 0.02 && rn > 0.95) {
    float s = r - R;
    float vis = (0.25 + 0.9 * discharge) * sqrt(kick);
    if (s < vis) {
      for (int j = 0; j < 4; j++) {
        float fj = float(j);
        float sb = bk * 3.7 + fj * 11.0;
        float aj = fj * PI * 0.5 + attOff;
        float sc = max(s, 0.0);
        float thj = aj + 0.18 * (vn(sc * 9.0 + sb) * 0.6 + vn(sc * 25.0 + sb * 1.7) * 0.3 + vn(sc * 60.0 + sb * 2.3 + T * 20.0) * 0.1) / max(r, 0.05);
        float d = abs(wrap(a - thj)) * r;
        float b = 0.003 / (d + 0.002) + exp(-d * 60.0) * 0.3;
        // branch from half length
        float sm = vis * 0.5;
        if (s > sm) {
          float tb = thj + (hash(sb) > 0.5 ? 1.0 : -1.0) * (s - sm) * 0.9 / max(r, 0.05)
                   + 0.05 * vn(sc * 30.0 + sb * 3.1) / max(r, 0.05);
          float db = abs(wrap(a - tb)) * r;
          b += (0.0018 / (db + 0.002) + exp(-db * 60.0) * 0.15) * 0.6;
        }
        bolts += b * (1.0 - smoothstep(vis * 0.7, vis, s));
      }
      bolts *= dis;
    }
  }

  float body = I * 0.5;
  vec3 col = uColor1 * I * 0.6 + uColor1 * body * 0.3
           + uColor2 * (rim + spec + haze + hot * 0.25)
           + mix(uColor3, vec3(1.0), 0.6) * (core + hot + bolts * 0.7);
  col += vec3(1.0) * smoothstep(1.2, 3.0, I) * 0.6;
  col = mix(col, col.gbr * 0.9 + col * 0.1, 0.15 * sin(PI * fract(bc / 16.0)));

  vec3 bg = vec3(0.01, 0.008, 0.02) + exp(-max(rn - 1.0, 0.0) * 3.0) * 0.05 * uColor2 * (1.0 + uEnergy);
  col += bg;
  col += uColor2 * 0.06 * dis;

  col = 1.0 - exp(-max(col, 0.0) * 1.3);
  gl_FragColor = vec4(col, 1.0);
}

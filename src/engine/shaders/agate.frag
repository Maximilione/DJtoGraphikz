precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float bands;
uniform float warp;
uniform float gloss;
uniform float flow;

// Agate: the polished section of an agate geode. A doubly domain-warped fbm
// plus a radial term gives jagged concentric isolines; the field is cut into
// hard bands (one tint per band, not a gradient), band edges become thin
// iridescent veins (thin-film cosine palette), and the surface is lit like
// polished stone using the gradient of the field as a normal. Druse crystals
// glitter in the innermost band. Maths written from scratch; the value noise
// is the project's own (same as inkflow).

// The engine only injects LOOK for the mesh scene: on GLSL ES 3.00 an
// undefined macro inside #if is a compile error, so default it here.
#ifndef LOOK
#define LOOK 0
#endif

float hash1(float n) { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(17.3, 41.9))); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 R = rot(0.64) * 2.03;
  for (int i = 0; i < 4; i++) { v += noise(p) * a; p = R * p; a *= 0.5; }
  return v * 1.07;
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 R = rot(0.64) * 2.03;
  for (int i = 0; i < 3; i++) { v += noise(p) * a; p = R * p; a *= 0.5; }
  return v * 1.14;
}
// fbm4 that also returns its 3-octave partial sum (.y, same scale as fbm3),
// so the relief taps can reuse it instead of a separate fbm3 at the centre.
vec2 fbm4p(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 R = rot(0.64) * 2.03;
  float v3 = 0.0;
  for (int i = 0; i < 4; i++) { v += noise(p) * a; if (i == 2) v3 = v; p = R * p; a *= 0.5; }
  return vec2(v * 1.07, v3 * 1.14);
}

vec3 ramp(float x) {
  return x < 0.5 ? mix(uColor3 * 0.25, uColor1, x * 2.0) : mix(uColor1, uColor2, x * 2.0 - 1.0);
}
vec3 bandCol(float i, float sh) {
  float x = hash1(i + sh * 17.0);
  vec3 c = ramp(fract(x * 1.7));
  return x > 0.8 ? uColor3 * 0.05 : c;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float nb = clamp(bands, 4.0, 18.0);
  float wp = clamp(warp, 0.0, 2.0);
  float gl = clamp(gloss, 0.0, 2.0);
  float fl = clamp(flow, 0.0, 2.0);
  float radW = 0.85;
#if LOOK == 1
  radW = 0.0;
#elif LOOK == 2
  nb = 18.0;
#endif

  float t = mod(uTime, 1000.0) * 0.05 * fl + uBassTime * 0.02;
  float bc = mod(uBeatClock, 4096.0);
  float B = bc / 8.0;
  vec2 c = 0.25 * vec2(sin(B * 0.11), cos(B * 0.07));

  vec2 s = p * 1.6;
  // q at 3 octaves (iGPU budget): it only steers the warp, detail comes later
  vec2 q = vec2(fbm3(s + vec2(0.0, t)), fbm3(s + vec2(5.2, 1.3) - t * 0.7));
  float k = (1.2 + 0.8 * uBass) * wp;
  vec2 sk = s + k * q;
  vec2 r = vec2(fbm4(sk + vec2(1.7, 9.2)), fbm4(sk + vec2(8.3, 2.8)));
  vec2 sr = s + k * r;
  float rad = length(p - c);
  vec2 f03 = fbm4p(sr);
  float f0 = f03.x;
  float h = f0 * 0.9 + rad * radW;

  // kick wave: bands slide outward along an expanding ring
  float ringR = (1.0 - exp(-uBeatPhase * 3.0)) * 1.2;
  float dr = (rad - ringR) * 4.0;
  h -= uBassHit * 0.35 * exp(-dr * dr);

  float ph = bc * 0.004 * fl;
  float hb = (h - ph) * nb;
  float idx = floor(hb);
  float fr = fract(hb);
  float aa = fwidth(hb) * 1.2;
  float edge = min(fr, 1.0 - fr);

  // colour per band, minerals change every 8 beats with a 1-beat crossfade
  // shift kept small (mod 61) so hash1's sin() stays precise on iGPUs
  float shiftRaw = floor(bc / 8.0);
  float shift = mod(shiftRaw, 61.0);
  float shiftN = mod(shiftRaw + 1.0, 61.0);
  float xf = smoothstep(7.0, 8.0, mod(bc, 8.0));
  vec3 col = mix(bandCol(idx, shift), bandCol(idx, shiftN), xf);
  col *= 0.85 + 0.3 * fr;

  // relief: gradient of a smooth 3-octave copy of the field (2 extra taps)
  float e = 0.004;
  float g0 = f03.y;
  float gx = fbm3(sr + vec2(e, 0.0));
  float gy = fbm3(sr + vec2(0.0, e));
  vec2 dg = vec2(gx - g0, gy - g0) / e * 0.9 * 1.6;
  vec2 dc = (p - c) / max(rad, 0.02) * radW;
  vec2 g = (dg + dc) * 0.12 * gl * (1.0 + 0.6 * uBass);
  // slight bevel per band: surface leans toward the band edge
  g += (fr - 0.5) * 0.08 * gl * normalize(dg + dc + vec2(1e-4, 0.0));
  vec3 n = normalize(vec3(-g * 1.5, 1.0));
  vec3 L = normalize(vec3(cos(t * 2.0), sin(t * 2.0), 1.2));
  float diff = 0.55 + 0.45 * max(dot(n, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 60.0) * gl * (0.6 + 1.4 * uBassHit);

  // veins at band edges, thin-film iridescence
  float veinW = 0.04;
#if LOOK == 2
  veinW = 0.12;
#endif
  float vein = 1.0 - smoothstep(0.0, aa + veinW, edge);
  // phase drifts with time (0.03*1000 = 30 whole cycles: seamless wrap); highs
  // shift it as an offset, never as a multiplier of uTime (that strobes)
  float tw = mod(uTime, 1000.0);
  float thick = h * 3.0 + n.z * 0.5 + tw * 0.03 + 0.35 * uHigh + 0.15 * uMid;
  vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (thick + vec3(0.0, 0.33, 0.67)));
  vec3 veinCol = mix(irid, vec3(1.0, 0.85, 0.6), 0.35) * (0.8 + 0.8 * uBassHit + 0.5 * uHigh);
#if LOOK == 2
  col = mix(col, irid * dot(col, vec3(0.5)) * 1.6 + col * 0.3, 0.7);
#endif

  // druse crystals: innermost band and a few lucky ones
  float inner = max(step(rad, 0.18), step(0.9, hash1(idx + shift * 3.0)));
  vec2 g2 = p * 60.0;
  vec2 id = floor(g2);
  float dd = length(fract(g2) - 0.5 - (hash2(id) - 0.5) * 0.5);
  float hid = hash(id);
  float sparkle = step(0.75, hid) * exp(-dd * dd * 160.0) * (0.4 + 1.6 * (uHigh + 0.5 * uHighHit))
                * (0.5 + 0.5 * sin(tw * 8.0 + hid * 50.0)) * inner;

  col = col * diff + veinCol * vein * 0.9 + vec3(1.0) * spec * 0.6
      + mix(uColor2, vec3(1.0), 0.6) * sparkle;
  col *= (1.0 + 0.12 * uBeat) * (0.9 + 0.2 * uEnergy);
  col *= 1.0 / (1.0 + 0.7 * dot(p, p));
  col = clamp(col, 0.0, 2.0);
  gl_FragColor = vec4(col, 1.0);
}

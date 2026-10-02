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

uniform float arms;
uniform float twist;
uniform float pulse;

// Hypno tunnel, layered. Back to front: a field of rings rushing outward on
// the beat clock, a counter-rotating thin spiral, the main arms (palette
// gradient along the depth, bright rim, fine inner stripes), dots riding the
// arms, a coloured halo. The wall wobbles with the mids, the arm width pumps
// on the kick, and every 4 bars the rotation swaps layer speeds. Everything
// periodic runs on folded clocks, so an hour in is identical to second three.

#define TAU 6.28318530718

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  float lr = log(r);
  float n = max(1.0, floor(arms));
  float hit = clamp(uBassHit, 0.0, 1.0);
  float pxu = 1.0 / uResolution.y;

  float bc = mod(uBeatClock, 64.0);
  float bar4 = mod(floor(uBeatClock / 16.0), 4.0);   // which 4-bar block
  float flip = mod(bar4, 2.0) * 2.0 - 1.0;           // +-1 on alternate blocks

  // kick-driven kink in the wall + slow breathing wave
  float wob = (0.10 + 0.25 * uMid) * sin(lr * 3.0 - TAU * mod(bc, 4.0) / 4.0)
            + 0.12 * hit * sin(lr * 6.0);
  float aw = a + wob;

  float spin = 3.6 * cos(TAU * mod(uBeatClock, 8.0) / 8.0);
  float depthFade = smoothstep(0.0, 0.5, r);
  float hole = smoothstep(0.02, 0.05, r);

  // palette along the depth, drifting with the bar
  float g = fract(lr * 0.35 + mod(bc, 16.0) / 16.0);
  vec3 grad = g < 0.5 ? mix(uColor1, uColor2, g * 2.0) : mix(uColor2, uColor3, g * 2.0 - 1.0);

  vec3 col = vec3(0.0);

  // 1. rings rushing outward
  float ru = lr * 2.2 - mod(bc, 4.0) / 4.0;
  float rd = abs(fract(ru) - 0.5);
  float raa = 2.2 * pxu / r;
  float ring = 1.0 - smoothstep(0.03 - raa, 0.03 + raa + 0.02 * hit, rd);
  col += uColor3 * ring * (0.25 + 0.5 * hit) * depthFade;

  // 2. counter-rotating thin spiral, twice the arms
  float n2 = n * 2.0;
  float tw2 = twist * 0.6;
  float u2 = (n2 * aw - tw2 * lr - spin * 1.7 * flip) / TAU;
  float d2 = abs(fract(u2) - 0.5);
  float aa2 = length(vec2(n2, tw2)) / r * pxu / TAU;
  float w2 = 0.035 + 0.03 * uHigh;
  float s2 = 1.0 - smoothstep(w2 - aa2, w2 + aa2, d2);
  col += uColor2 * s2 * (0.55 + 0.4 * uHigh) * depthFade;
  col += uColor2 * exp(-max(d2 - w2, 0.0) * 14.0) * 0.12;

  // 3. main arms
  float u = (n * aw + twist * lr + spin * flip) / TAU;
  float d = abs(fract(u) - 0.5);
  float aa = length(vec2(n, twist)) / r * pxu / TAU;
  float w = 0.09 + 0.14 * pulse * hit;
  float arm = 1.0 - smoothstep(w - aa, w + aa, d);
  // inside the arm: dark core, bright rim, fine stripes across the length
  float rim = smoothstep(w * 0.45, w, d) * arm;
  float stripe = 0.5 + 0.5 * sin((lr * 38.0 + mod(bc, 4.0) * TAU / 4.0));
  vec3 armCol = grad * (0.35 + 0.35 * stripe) + mix(vec3(1.0), grad, 0.35) * rim * (0.9 + 0.6 * hit);
  col = mix(col, armCol * (0.8 + 0.4 * uBeat), arm);
  float halo = exp(-max(d - w, 0.0) * 12.0);
  col += grad * halo * (1.0 - arm) * (0.28 + 0.4 * uBass + 0.5 * hit);

  // 4. dots riding the arms, outward on the beat clock
  float du = fract(lr * 4.0 - mod(bc, 4.0) / 4.0);
  float cell = floor(lr * 4.0 - mod(bc, 4.0) / 4.0);
  float ci = mod(floor(u), n) + cell * 7.0;
  float on = step(0.5, hash(mod(ci, 97.0) + 1.0));
  float dd = length(vec2((du - 0.5) * 0.25, (fract(u) - 0.5) * TAU / length(vec2(n, twist))));
  float dot_ = (1.0 - smoothstep(0.05, 0.085, dd)) * on;
  col += mix(vec3(1.0), uColor3, 0.3) * dot_ * (0.6 + 0.8 * uHigh) * depthFade;

  // tunnel ends in a hole, with a thin ring of light around it
  float lip = exp(-abs(r - 0.05) * 90.0) * (0.3 + 0.7 * hit);
  col = col * hole + uColor1 * lip * 0.6;
  col *= depthFade * 0.6 + 0.4;
  gl_FragColor = vec4(col, 1.0);
}

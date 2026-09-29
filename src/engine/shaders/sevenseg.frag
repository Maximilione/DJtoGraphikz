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
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float digits;
uniform float ghost;
uniform float jitter;

// A seven-segment counter of the bars played, wall-sized. Unlit segments stay
// as a ghost so the display reads as hardware, the hats knock the digits
// sideways, and the beat blinks the dot.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float bit(float m, float i) { return mod(floor(m / exp2(i)), 2.0); }

float mask(float d) {
  // gfedcba
  if (d < 0.5) return 63.0;
  if (d < 1.5) return 6.0;
  if (d < 2.5) return 91.0;
  if (d < 3.5) return 79.0;
  if (d < 4.5) return 102.0;
  if (d < 5.5) return 109.0;
  if (d < 6.5) return 125.0;
  if (d < 7.5) return 7.0;
  if (d < 8.5) return 127.0;
  return 111.0;
}

// p in digit space: x -0.5..0.5, y -1..1. Returns (lit, ghost) coverage.
vec2 digit(vec2 p, float d) {
  float m = mask(d);
  float w = 0.09, l = 0.36;
  float lit = 0.0, gh = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 c; vec2 b;
    if (i == 0)      { c = vec2(0.0, 0.9);   b = vec2(l, w); }   // a
    else if (i == 1) { c = vec2(0.42, 0.45); b = vec2(w, l); }   // b
    else if (i == 2) { c = vec2(0.42, -0.45); b = vec2(w, l); }  // c
    else if (i == 3) { c = vec2(0.0, -0.9);  b = vec2(l, w); }   // d
    else if (i == 4) { c = vec2(-0.42, -0.45); b = vec2(w, l); } // e
    else if (i == 5) { c = vec2(-0.42, 0.45); b = vec2(w, l); }  // f
    else             { c = vec2(0.0, 0.0);   b = vec2(l, w); }   // g
    float sd = sdBox(p - c, b - 0.03) - 0.03;
    float cov = 1.0 - smoothstep(0.0, 0.02, sd);
    if (bit(m, float(i)) > 0.5) lit += cov; else gh += cov;
  }
  return vec2(lit, gh);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float nd = clamp(floor(digits), 1.0, 4.0);
  // italic slant, and the hat knock
  p.x -= p.y * 0.12;
  p.x += (hash(vec2(floor(uTime * 24.0), 1.0)) - 0.5) * 0.08 * uHighHit * jitter;

  float count = floor(uBeatClock / 4.0);
  float pitch = 0.75;
  float scale = 0.42 / (1.0 + 0.1 * uBass);
  vec2 q = p / scale;
  q.x += pitch * nd * 0.5 - pitch * 0.5;
  float idx = floor(q.x / pitch + 0.5);
  vec2 dp = vec2(q.x - idx * pitch, q.y);
  vec2 cov = vec2(0.0);
  if (idx >= 0.0 && idx < nd) {
    float place = nd - 1.0 - idx;
    float d = mod(floor(count / pow(10.0, place)), 10.0);
    cov = digit(dp, d);
  }
  // the beat dot after the last digit
  vec2 dotp = vec2(q.x - (nd - 0.5) * pitch - 0.05, q.y + 0.9);
  float dot_ = 1.0 - smoothstep(0.08, 0.1, length(dotp));
  float blink = step(uBeatPhase, 0.5);

  vec3 col = uColor1 * cov.x * (0.9 + 0.35 * uBeat);
  col += uColor1 * cov.y * ghost;
  col += mix(uColor1, vec3(1.0), 0.4) * dot_ * blink;
  col += vec3(1.0) * cov.x * uBassHit * 0.3;
  gl_FragColor = vec4(col, 1.0);
}

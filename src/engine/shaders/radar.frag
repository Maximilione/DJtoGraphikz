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

uniform float sweep;
uniform float blips;
uniform float fade;

// Radar. One sweep per bar around a dark scope; contacts light up as the beam
// passes and fade until the next pass. The contacts move every bar, and the
// mids make them larger — something is out there.

#define TAU 6.28318530718

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r = length(p);
  float a = atan(p.y, p.x);

  // the beam angle, one turn per bar at sweep 1
  float turn = uBeatClock * 0.25 * sweep;
  float beam = -turn * TAU;
  // how long ago the beam passed this angle, 0..1 of a turn
  float behind = fract((beam - a) / TAU);
  float trail = exp(-behind * fade * 6.0);

  vec3 col = vec3(0.0);
  float scope = 1.0 - smoothstep(0.44, 0.46, r);
  // rings and cross-hairs, dim; the scope glass itself has an idle floor so the
  // disc reads in silence instead of vanishing between passes
  float floorK = 1.0 - 0.7 * uEnergy;
  float rings = exp(-abs(fract(r * 8.0) - 0.5) * 30.0) * 0.14;
  float cross = (exp(-abs(p.x) * 300.0) + exp(-abs(p.y) * 300.0)) * 0.1;
  col += uColor1 * (0.05 + rings + cross) * floorK * scope;
  // the beam itself and its afterglow, plus a long faint tail
  col += uColor1 * (trail * 0.35 + exp(-behind * 2.0) * 0.08 * floorK) * scope;
  col += uColor1 * exp(-behind * 90.0) * scope;

  // contacts
  float bar = floor(turn);
  float n = clamp(floor(blips), 1.0, 24.0);
  for (int i = 0; i < 24; i++) {
    if (float(i) >= n) break;
    vec2 seed = vec2(float(i) * 1.7, bar);
    float br = 0.06 + 0.36 * hash(seed);
    float ba = hash(seed + 9.1) * TAU;
    vec2 bp = vec2(cos(ba), sin(ba)) * br;
    float bbehind = fract((beam - ba) / TAU);
    float lit = exp(-bbehind * fade * 3.0);
    float sz = 0.008 + 0.02 * uMid;
    float d = length(p - bp);
    float dot_ = exp(-d * d / (sz * sz));
    col += mix(uColor2, vec3(1.0), 0.5) * dot_ * lit * 1.4;
  }
  col *= 1.0 + 0.25 * uBeat;
  col += vec3(1.0) * uBassHit * 0.03 * scope;
  gl_FragColor = vec4(col, 1.0);
}

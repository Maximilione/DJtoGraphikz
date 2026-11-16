precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float inkscale;
uniform float flowspd;
uniform float inkcontrast;

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// octave step: rot(0.64) * 2.03, hoisted
const mat2 M = mat2(0.8021, -0.5972, 0.5972, 0.8021) * 2.03;
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = M * p; a *= 0.5; }
  return v;
}
// two decorrelated noises per lattice lookup (sin-free hash): one vec2 fbm
// replaces two scalar ones in the domain warps
vec2 hash2(vec2 p) {
  vec3 p3 = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec2 noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x),
             mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
// warps are low-pass by nature: 4 octaves
vec2 fbm2(vec2 p) {
  vec2 v = vec2(0.0); float a = 0.5;
  for (int i = 0; i < 4; i++) { v += noise2(p) * a; p = M * p; a *= 0.5; }
  return v;
}

// Ink flow: slow marbled ink for deep/minimal moments — double domain warp,
// the bass thickens the ink, the bar slowly turns the whole fluid.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * flowspd * 0.25 + uBassTime * 0.06;

  vec2 p = uv * inkscale * rot(uBarPhase * 0.1);
  vec2 q = fbm2(p + vec2(0.0, t));
  vec2 r2 = fbm2(p + q * 1.7 + vec2(1.7, 9.2));
  float f = fbm(p + r2 * 1.9 - vec2(t * 0.5, 0.0));

  // ink density curve
  float ink = pow(smoothstep(0.28, 0.72, f), inkcontrast + uBass * 0.6);

  vec3 deep = uColor3 * 0.15;
  vec3 color = mix(deep, uColor1, smoothstep(0.25, 0.7, ink));
  color = mix(color, uColor2, smoothstep(0.6, 0.95, ink) * 0.8);
  // bright veins where the warp is strongest
  float vein = smoothstep(0.62, 0.72, length(q));
  color += uColor2 * vein * 0.25 * (0.5 + uMid);
  // marbling: dark vein on the mid contour + wet sheen from the warp slope
  color *= 0.35 + 0.65 * smoothstep(0.0, 0.035, abs(f - 0.5));
  vec3 nn = normalize(vec3(r2 - q, 0.35));
  color += mix(uColor2, vec3(1.0), 0.5) * pow(max(dot(nn, normalize(vec3(0.5, 0.6, 0.6))), 0.0), 14.0) * (0.25 + 0.5 * uMid);
  // gentle beat bloom, never a strobe — this is the deep effect
  color *= 1.0 + uBeat * 0.12;

  // vignette in frame space: bounded on any aspect (on a 6:1 strip uv.x
  // reaches 3 and the old length(uv) left the outer thirds black)
  color *= smoothstep(1.5, 0.5, length((vUv - 0.5) * vec2(1.78, 1.0)));
  color = 1.0 - exp(-color * 1.3);
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}

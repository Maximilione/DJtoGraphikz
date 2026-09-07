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
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = rot(0.64) * p * 2.03; a *= 0.5; }
  return v;
}

// Ink flow: slow marbled ink for deep/minimal moments — double domain warp,
// the bass thickens the ink, the bar slowly turns the whole fluid.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * flowspd * 0.25 + uBassTime * 0.06;

  vec2 p = uv * inkscale * rot(uBarPhase * 0.1);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, t * 1.3)));
  vec2 r2 = vec2(fbm(p + q * 1.7 + vec2(1.7, 9.2)), fbm(p + q * 1.7 + vec2(8.3, 2.8)));
  float f = fbm(p + r2 * 1.9 - vec2(t * 0.5, 0.0));

  // ink density curve
  float ink = pow(clamp(f * 1.5, 0.0, 1.0), inkcontrast + uBass * 0.6);

  vec3 deep = uColor3 * 0.15;
  vec3 color = mix(deep, uColor1, smoothstep(0.25, 0.7, ink));
  color = mix(color, uColor2, smoothstep(0.6, 0.95, ink) * 0.8);
  // bright veins where the warp is strongest
  float vein = smoothstep(0.62, 0.72, length(q));
  color += uColor2 * vein * 0.25 * (0.5 + uMid);
  // gentle beat bloom, never a strobe — this is the deep effect
  color *= 1.0 + uBeat * 0.12;

  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(min(color, vec3(2.0)), 1.0);
}

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
uniform float arms;
uniform float twist;
uniform float pull;

// Hypnotic vortex: log-spiral arms flowing into the center, kick pulses
// travel down the spiral, bar phase slowly rotates the whole field.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  float r = length(uv) + 1e-4;
  float a = atan(uv.y, uv.x) + uBarPhase * TAU * 0.25;

  // log-spiral coordinate
  float spiral = a * arms / TAU + log(r) * (twist * 2.0 + uMid) - t * (0.6 + pull * 0.8 + uBass * 0.8);
  float band = fract(spiral);

  // arm shape with AA
  float armLine = smoothstep(0.5, 0.5 - max(0.12, fwidth(spiral)), abs(band - 0.5));

  // radial pulse riding the beat phase, travelling inward
  float pulse = smoothstep(0.08, 0.0, abs(fract(r * 2.5 + uBeatPhase) - 0.5) - 0.28) * uBeat;

  // depth shading: brighter toward center, dark rim
  float depth = smoothstep(1.1, 0.0, r);
  float core = 0.02 / (r * r + 0.02) * (0.5 + uBass);

  vec3 color = mix(uColor2, uColor1, armLine) * armLine * depth;
  color += uColor3 * pulse * 0.6 * depth;
  color += mix(uColor1, uColor3, 0.5) * core;
  // counter-rotating faint second field for parallax
  float spiral2 = -a * (arms * 0.5) / TAU + log(r) * twist - t * 0.3;
  color += uColor3 * smoothstep(0.5, 0.35, abs(fract(spiral2) - 0.5)) * 0.15 * depth;

  color *= 1.0 + uBassHit * 0.5;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

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
uniform float density;
uniform float moireoff;
uniform float rotspeed;

// Op-art moiré: interfering concentric fields — the interference pattern
// breathes with the bass and rotates with the bar. Pure hypnosis.
float field(vec2 p, float d) {
  return sin(length(p) * d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  float d = density * (1.0 + uBass * 0.12);
  float off = moireoff * (1.0 + sin(t * 0.4) * 0.3 + uMid * 0.4);

  vec2 c1 = vec2(-off, 0.0) * rot(t * rotspeed);
  vec2 c2 = vec2(off, 0.0) * rot(-t * rotspeed * 0.7 + uBarPhase * TAU * 0.05);
  vec2 c3 = vec2(0.0, off * 0.8) * rot(t * rotspeed * 0.4);

  float f1 = field(uv - c1, d);
  float f2 = field(uv - c2, d * (1.0 + 0.01 + uHigh * 0.02));
  float f3 = field(uv - c3, d * 0.985);

  // interference
  float m12 = f1 * f2;
  float m123 = m12 * f3;

  float lines = smoothstep(0.0, 0.5, m12) - smoothstep(0.5, 1.0, m12);
  vec3 color = uColor1 * smoothstep(0.2, 0.9, m12);
  color += uColor2 * smoothstep(0.4, 1.0, -m123) * 0.8;
  color += uColor3 * lines * 0.35;

  // beat inverts the field polarity briefly — the classic op-art flip
  color = mix(color, uColor2 * (1.0 - smoothstep(0.2, 0.9, m12)), uBassHit * 0.55);

  color *= smoothstep(1.35, 0.55, length(uv));
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

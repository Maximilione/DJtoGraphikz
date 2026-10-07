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

// Op-art moire: interfering concentric fields plus a linear grating. The
// interference breathes with the bass, rotates with the bar, and the kick
// pushes the centres apart, flips the polarity and sends a ring across.
float field(vec2 p, float d, float ph) {
  return sin(length(p) * d - ph);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  float r0 = length(uv);

  // Kick lens: the whole field bulges toward the camera
  uv *= 1.0 - 0.07 * uBassHit * (1.0 - smoothstep(0.0, 1.0, r0));

  float d = density * (1.0 + uBass * 0.12);
  float off = moireoff * (1.0 + sin(t * 0.4) * 0.3 + uMid * 0.4 + uBassHit * 0.6);
  float ph = uBassTime * 1.2;

  vec2 c1 = vec2(-off, 0.0) * rot(t * rotspeed);
  vec2 c2 = vec2(off, 0.0) * rot(-t * rotspeed * 0.7 + uBarPhase * TAU * 0.05);
  vec2 c3 = vec2(0.0, off * 0.8) * rot(t * rotspeed * 0.4);

  float f1 = field(uv - c1, d, ph);
  float f2 = field(uv - c2, d * (1.0 + 0.01 + uHigh * 0.02), -ph * 0.6);
  float f3 = field(uv - c3, d * 0.985, 0.0);
  // Fourth layer: straight grating that sweeps across the rings
  float f4 = sin(dot(uv, vec2(cos(t * rotspeed * 0.25), sin(t * rotspeed * 0.25))) * d * 0.8 + ph * 0.5);

  // interference
  float m12 = f1 * f2;
  float m123 = m12 * f3;

  float lines = smoothstep(0.0, 0.5, m12) - smoothstep(0.5, 1.0, m12);
  float iso = exp(-abs(m12 - 0.5) * 12.0);

  vec3 color = uColor1 * smoothstep(0.2, 0.9, m12);
  color += uColor2 * smoothstep(0.4, 1.0, -m123) * 0.8;
  color += uColor3 * (lines * 0.35 + iso * 0.3);
  color += uColor3 * smoothstep(0.7, 1.0, f1 * f4) * 0.25;

  // White-hot where all three fields align: bloom food, stronger on the kick
  float hot = smoothstep(0.86, 1.0, abs(m123));
  color += vec3(1.0) * hot * (0.25 + 0.7 * uBassHit);

  // beat inverts the field polarity briefly: the classic op-art flip
  color = mix(color, uColor2 * (1.0 - smoothstep(0.2, 0.9, m12)) + uColor3 * iso * 0.4, uBassHit * 0.5);

  // Kick shockwave ring
  float sw = (r0 - (0.05 + 0.9 * (1.0 - uBassHit))) * 14.0;
  color += mix(uColor3, vec3(1.0), 0.5) * exp(-sw * sw) * uBassHit * 0.9;

  // Faint palette haze: never black
  color += mix(uColor1, uColor3, r0) * 0.04;

  color *= 1.0 + 0.3 * uBeat;
  color *= smoothstep(1.35, 0.55, r0);
  color = vec3(1.0) - exp(-color * 1.4);
  gl_FragColor = vec4(color, 1.0);
}

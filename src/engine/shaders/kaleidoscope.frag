precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// FBM noise
float hash21(vec2 p) { return fract(sin(dot(p, vec2(41.1, 289.7))) * 45758.5); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.1 + vec2(1.3, 1.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Rotate with audio
  uv *= rot(uTime * 0.2 + uBass * 0.8);

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Kaleidoscope fold — segments react to bass
  float segs = floor(4.0 + uBass * 8.0 + uMid * 4.0);
  float segAngle = TAU / segs;
  a = mod(a + PI, segAngle) - segAngle * 0.5;
  a = abs(a);

  // Back to cartesian in folded space
  vec2 kuv = vec2(cos(a), sin(a)) * r;

  // Zoom pulses with beat
  float zoom = 3.0 + sin(uTime * 0.5) * 0.5 + uBeat * 1.5;
  kuv *= zoom;

  // Animated FBM pattern
  float t = uTime * 0.3;
  float n1 = fbm(kuv + vec2(t, -t * 0.7));
  float n2 = fbm(kuv * 1.5 + vec2(-t * 0.5, t * 0.3) + n1 * 2.0);
  float n3 = fbm(kuv * 0.8 + n2 * 1.5 + vec2(t * 0.2));

  // Warped domain coloring
  float pattern = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;
  pattern = pow(pattern, 0.8 + uMid * 0.5);

  // Neon edge lines
  float edge1 = abs(sin(n2 * 8.0 + uTime));
  edge1 = smoothstep(0.95, 1.0, edge1) * 2.0;

  float edge2 = abs(sin(n3 * 12.0 - uTime * 1.5));
  edge2 = smoothstep(0.93, 1.0, edge2) * 1.5;

  // Color
  vec3 color = vec3(0.0);
  color += uColor1 * pattern * 1.2;
  color += uColor2 * edge1;
  color += uColor3 * edge2;
  color += (uColor1 + uColor2) * 0.3 * exp(-r * 3.0) * (1.0 + uBeat * 3.0);

  // Audio energy bloom
  color *= 0.8 + uEnergy * 0.6;
  color *= 1.0 + uBeat * 0.8;

  // Vignette
  color *= smoothstep(2.0, 0.3, r);

  gl_FragColor = vec4(color, 1.0);
}

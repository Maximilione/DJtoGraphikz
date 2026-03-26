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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Audio-reactive warp
  float warp = uBass * 0.3 + uBeat * 0.15;
  uv *= rot(uTime * 0.15 + uMid * 0.5);
  uv += vec2(sin(uTime * 0.3) * warp, cos(uTime * 0.4) * warp);

  // Polar coordinates
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Infinite tunnel with depth
  float speed = 2.0 + uBass * 4.0 + uBeat * 3.0;
  float depth = 1.0 / (r + 0.05) + uTime * speed;

  // Segmented rotation
  float segments = 6.0 + uMid * 6.0;
  float segAngle = floor(a / TAU * segments) / segments * TAU;

  // Multi-layer pattern
  float p1 = sin(depth * 4.0 + a * segments) * 0.5 + 0.5;
  float p2 = sin(depth * 8.0 - uTime * 3.0) * 0.5 + 0.5;
  float p3 = sin(a * segments * 2.0 + depth * 2.0 + uTime) * 0.5 + 0.5;

  // Hexagonal rings
  float rings = abs(sin(depth * 12.0));
  rings = smoothstep(0.85, 0.95, rings);

  // Segment lines (neon grid)
  float segs = abs(sin(a * segments));
  segs = smoothstep(0.92, 0.98, segs);

  // Combine patterns
  float pattern = p1 * p2 * 0.6 + rings * 0.8 + segs * 0.5 + p3 * 0.3;

  // Depth fog
  float fog = exp(-r * 1.5);

  // Pulsing glow on beat
  float pulse = 1.0 + uBeat * 1.5;
  float centerGlow = exp(-r * 4.0) * (0.5 + uBeat * 2.0);

  // Color cycling — 3 colors that shift with audio
  float colorShift = depth * 0.1 + uTime * 0.2 + uHigh * 2.0;
  vec3 c1 = uColor1 * (sin(colorShift) * 0.5 + 0.5);
  vec3 c2 = uColor2 * (sin(colorShift + TAU/3.0) * 0.5 + 0.5);
  vec3 c3 = uColor3 * (sin(colorShift + TAU*2.0/3.0) * 0.5 + 0.5);

  vec3 color = vec3(0.0);
  color += c1 * rings * 1.5;
  color += c2 * segs * 1.2;
  color += c3 * p1 * p2 * 0.8;
  color += (c1 + c2) * 0.5 * centerGlow;

  // Scanlines
  float scan = sin(gl_FragCoord.y * 1.5) * 0.04;
  color -= scan;

  // Final
  color *= fog * pulse;
  color = pow(color, vec3(0.9)); // slight gamma

  gl_FragColor = vec4(color, 1.0);
}

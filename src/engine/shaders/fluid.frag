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

// Smooth noise
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute3(vec3 x) { return mod289v3(((x*34.0)+1.0)*x); }

float snoise2(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 3; i++) {
    val += snoise2(p * freq) * amp;
    freq *= 2.0;
    amp *= 0.5;
    p += vec2(1.7, 9.2);
  }
  return val;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.4;

  // Multi-layer fluid advection
  vec2 p = uv * 2.0;

  // Advection — noise warps the sampling position
  float warpStrength = 1.0 + uBass * 1.5 + uBeat * 0.5;
  vec2 warp1 = vec2(
    fbm(p + vec2(t * 0.3, t * 0.1)),
    fbm(p + vec2(t * 0.1, t * 0.4) + 5.0)
  ) * warpStrength;

  vec2 warp2 = vec2(
    fbm(p + warp1 + vec2(t * 0.2, 0.0) + 1.7),
    fbm(p + warp1 + vec2(0.0, t * 0.3) + 9.2)
  ) * warpStrength * 0.8;

  // Sample the warped field
  float f1 = fbm(p + warp2);
  float f2 = fbm(p + warp2 * 0.7 + vec2(3.0, 7.0));
  float f3 = fbm(p * 1.5 + warp1 * 0.5 + vec2(5.0, 2.0));

  // Color mixing based on field values
  float v1 = f1 * 0.5 + 0.5;
  float v2 = f2 * 0.5 + 0.5;
  float v3 = f3 * 0.5 + 0.5;

  vec3 color = vec3(0.0);
  color += uColor1 * pow(v1, 1.5);
  color += uColor2 * pow(v2, 1.5);
  color += uColor3 * pow(v3, 2.0) * 0.5;

  // Highlights at field extremes
  float highlight = smoothstep(0.7, 1.0, v1 * v2);
  color += (uColor1 + uColor2) * highlight * 0.5;

  // Beat brightness
  color *= 0.6 + uEnergy * 0.4 + uBeat * 0.5;

  // Vignette
  float vig = 1.0 - length(uv) * 0.5;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}

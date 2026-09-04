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
uniform float uBassHit;
uniform float falloff;
uniform float turbulence;
uniform float sparks;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// rotate between octaves: kills the axis-aligned banding of naive fbm
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    val += noise(p) * amp;
    p = ROT * p * 2.02;
    amp *= 0.5;
  }
  return val;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;                          // 0..1, flame anchored to the bottom
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);

  float t = uTime;
  float rise = t * (1.4 + uBass * 1.1);

  // Domain warping: fbm displaced by fbm displaced by fbm — this is what makes
  // the tongues lick and curl instead of scrolling static noise upward
  float warp = 0.6 + turbulence * 1.4 + uMid * 0.4;
  vec2 q = vec2(
    fbm(p * 3.0 + vec2(0.0, -rise)),
    fbm(p * 3.0 + vec2(5.2, -rise * 1.31)));
  vec2 r = vec2(
    fbm(p * 3.0 + q * warp + vec2(1.7, -rise * 1.1)),
    fbm(p * 3.0 + q * warp + vec2(8.3, -rise * 0.87)));
  float f = fbm(p * vec2(2.6, 3.4) + r * 1.8 + vec2(0.0, -rise));

  // Flame envelope: roaring at the bottom, dying with height.
  // Bass feeds the vigor, a kick makes the whole flame leap.
  float vigor = 1.0 + uBass * 0.8 + uBassHit * 1.1 + uBeat * 0.25;
  float env = 1.0 - uv.y / max(vigor * (1.9 - falloff), 0.15);
  env = clamp(env, 0.0, 1.0);
  env *= 0.72 + 0.38 * (1.0 - min(abs(p.x) * 0.6, 1.0)); // hotter in the middle

  float intensity = pow(max(f * env * 1.9, 0.0), 1.75 + (1.0 - env) * 0.9);
  float i2 = min(intensity, 2.0);

  // Temperature ramp, tinted by the palette: glow → body → hot → white core
  vec3 col = vec3(0.0);
  col += uColor3 * smoothstep(0.02, 0.28, i2) * 0.5;
  col += uColor2 * smoothstep(0.18, 0.75, i2);
  col += uColor1 * smoothstep(0.55, 1.15, i2) * 1.35;
  col += vec3(1.0) * smoothstep(0.95, 1.6, i2);

  // Ember bed glowing at the bottom
  float bed = smoothstep(0.15, 0.0, uv.y) * (0.5 + 0.5 * noise(vec2(p.x * 9.0 + t, t * 2.3)));
  col += (uColor2 * 0.7 + uColor1 * 0.4) * bed * (0.6 + uBass * 0.7);

  // Sparks: embers rising with wobble and flicker, brighter when hats hit
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    if (fi >= sparks) break;
    float h1 = hash(vec2(fi, 1.0));
    float h2 = hash(vec2(fi, 2.0));
    float sy = fract(h2 + t * (0.2 + h1 * 0.3));
    float sx = (h1 - 0.5) * aspect * 0.85
             + sin(t * (1.5 + h1 * 3.0) + fi * 7.0) * 0.05 * (1.0 + sy * 2.0);
    float d = length(p - vec2(sx, sy));
    float flick = 0.7 + 0.3 * sin(t * (8.0 + h2 * 12.0) + fi);
    float glow = 0.0016 / (d * d + 0.001) * flick;
    col += mix(uColor1, uColor2, h2) * min(glow, 2.5) * (1.0 - sy) * (0.4 + uHigh * 0.6) * 0.35;
  }

  col *= smoothstep(-0.08, 0.05, uv.y);
  col = pow(max(col, vec3(0.0)), vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}

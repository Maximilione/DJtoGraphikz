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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  vec2 origUv = uv;

  float t = uTime * 0.4;

  // Domain warping — multiple layers
  float bass = uBass;
  float mid = uMid;

  // Layer 1: slow large warp
  vec2 q = vec2(
    noise(uv * 2.0 + vec2(t * 0.3, 0.0)),
    noise(uv * 2.0 + vec2(0.0, t * 0.4))
  );

  // Layer 2: medium warp driven by audio
  vec2 r2 = vec2(
    noise(uv * 3.0 + q * 4.0 * (1.0 + bass * 2.0) + vec2(t * 0.7, t * 0.3)),
    noise(uv * 3.0 + q * 4.0 * (1.0 + bass * 2.0) + vec2(t * 0.5, -t * 0.6))
  );

  // Layer 3: fine detail
  float n = noise(uv * 4.0 + r2 * 3.0 * (1.0 + mid) + t * 0.2);

  // Fractal accumulation
  float f = 0.0;
  f += 0.5000 * noise(uv * 1.0 + r2 * 2.0 + t * 0.1);
  f += 0.2500 * noise(uv * 2.0 + q * 3.0 - t * 0.2);
  f += 0.1250 * noise(uv * 4.0 + r2 * 1.5 + t * 0.3);
  f += 0.0625 * noise(uv * 8.0 + n * 2.0 - t * 0.15);

  // Flow lines
  float lines = sin(f * 20.0 + uTime * 2.0 + bass * 10.0);
  lines = pow(abs(lines), 0.3) * sign(lines) * 0.5 + 0.5;

  // Color mapping
  float cr = f * 3.0 + uTime * 0.1;
  vec3 c1 = uColor1 * (sin(cr) * 0.5 + 0.5);
  vec3 c2 = uColor2 * (sin(cr + 2.094) * 0.5 + 0.5);
  vec3 c3 = uColor3 * (sin(cr + 4.189) * 0.5 + 0.5);

  vec3 color = c1 * f + c2 * (1.0 - f) * lines + c3 * n * 0.5;
  color *= 1.5;

  // Hot spots
  float hot = pow(n, 3.0) * 3.0;
  color += (uColor1 + uColor3) * hot * 0.5;

  // Beat flash
  color *= 1.0 + uBeat * 1.2;

  // Subtle vignette
  float vig = 1.0 - dot(origUv, origUv) * 0.8;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}

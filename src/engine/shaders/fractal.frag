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

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Julia set with audio-reactive constant
  float t = uTime * 0.15;
  vec2 c = vec2(
    -0.7 + sin(t) * 0.15 + uBass * 0.1,
    0.27015 + cos(t * 0.7) * 0.1 + uMid * 0.05
  );

  float zoom = 1.5 - uBeat * 0.3;
  vec2 z = uv * zoom;
  z *= rot(t * 0.2);

  float iter = 0.0;
  float maxIter = 40.0;
  float escape = 4.0;

  for (float i = 0.0; i < 40.0; i++) {
    if (dot(z, z) > escape) break;
    // z = z^2 + c
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter = i;
  }

  // Smooth iteration count
  float smoothIter = iter - log2(log2(dot(z, z))) + 4.0;
  float f = smoothIter / maxIter;

  // Color mapping with palette
  float phase = f * 4.0 + uTime * 0.5 + uHigh * 2.0;
  vec3 color = vec3(0.0);
  color += uColor1 * (sin(phase) * 0.5 + 0.5);
  color += uColor2 * (sin(phase + 2.094) * 0.5 + 0.5);
  color += uColor3 * (sin(phase + 4.189) * 0.5 + 0.5);
  color *= 0.6;

  // Interior glow
  if (dot(z, z) <= escape) {
    color = uColor1 * 0.1 * (1.0 + uBeat);
  }

  // Beat pulse brightness
  color *= 1.0 + uBeat * 0.8;

  // Edge glow
  float edge = fract(smoothIter * 0.1);
  color += uColor2 * smoothstep(0.9, 1.0, edge) * 0.5;

  gl_FragColor = vec4(color, 1.0);
}

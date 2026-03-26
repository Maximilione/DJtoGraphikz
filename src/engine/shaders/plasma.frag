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

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Multiple sine plasma layers
  float bass = uBass;
  float mid = uMid;
  float beat = uBeat;

  float v1 = sin(uv.x * 10.0 + t * 2.0 + bass * 8.0);
  float v2 = sin(uv.y * 8.0 - t * 1.5 + mid * 6.0);
  float v3 = sin((uv.x + uv.y) * 6.0 + t * 1.2);
  float v4 = sin(length(uv * 8.0 - vec2(sin(t*0.7)*3.0, cos(t*0.5)*3.0)) - t * 3.0);
  float v5 = sin(length(uv * 6.0 + vec2(cos(t*0.3)*2.0, sin(t*0.8)*2.0)) + t * 2.0);

  // Interference
  float v = v1 + v2 + v3 + v4 * (1.0 + bass * 2.0) + v5 * (1.0 + mid);
  v *= 0.2;

  // Moiré rings
  float rings = sin(length(uv) * 30.0 - t * 4.0 - bass * 15.0);
  rings = rings * 0.5 + 0.5;
  rings = pow(rings, 2.0 + mid * 3.0);

  // Color from plasma value
  float hue = v * 3.0 + t * 0.3;
  vec3 c1 = uColor1 * (sin(hue) * 0.5 + 0.5);
  vec3 c2 = uColor2 * (sin(hue + 2.094) * 0.5 + 0.5);
  vec3 c3 = uColor3 * (cos(hue + 1.047) * 0.5 + 0.5);

  vec3 color = c1 + c2 * rings + c3 * (v * 0.5 + 0.5);
  color *= 0.7;

  // Energy-reactive brightness
  color *= 0.6 + uEnergy * 0.8;

  // Beat strobe
  color *= 1.0 + beat * 1.5;

  // Pulsing center
  float glow = exp(-length(uv) * 2.5) * (0.3 + beat * 1.0);
  color += (uColor1 + uColor2) * glow;

  gl_FragColor = vec4(color, 1.0);
}

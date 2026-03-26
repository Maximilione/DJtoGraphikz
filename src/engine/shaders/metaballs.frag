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

float hash1(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  float field = 0.0;
  vec3 colorWeight = vec3(0.0);
  float totalWeight = 0.0;

  // 8 metaballs with audio-reactive movement
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float speed = 0.5 + hash1(fi * 7.0) * 0.5;
    float phase = hash1(fi * 13.0) * PI * 2.0;

    // Orbit with audio influence
    float orbitR = 0.2 + hash1(fi * 17.0) * 0.4 + uBass * 0.2;
    float angle = t * speed + phase + uMid * sin(t + fi);

    vec2 pos = vec2(
      cos(angle) * orbitR + sin(t * 0.3 + fi) * 0.1,
      sin(angle * 1.3 + phase) * orbitR + cos(t * 0.4 + fi) * 0.1
    );

    // Beat: balls expand outward
    pos *= 1.0 + uBeat * 0.3;

    // Ball radius varies with audio
    float radius = 0.06 + hash1(fi * 23.0) * 0.04 + uEnergy * 0.03;

    float d = length(uv - pos);
    float contribution = radius * radius / (d * d + 0.001);
    field += contribution;

    // Track which color each ball contributes
    vec3 ballColor;
    int ci = int(mod(fi, 3.0));
    if (ci == 0) ballColor = uColor1;
    else if (ci == 1) ballColor = uColor2;
    else ballColor = uColor3;

    colorWeight += ballColor * contribution;
    totalWeight += contribution;
  }

  // Threshold for metaball surface
  float threshold = 1.0;
  vec3 color = vec3(0.0);

  if (totalWeight > 0.0) {
    vec3 baseColor = colorWeight / totalWeight;

    // Sharp metaball edge
    float edge = smoothstep(threshold - 0.1, threshold + 0.1, field);

    // Neon glow around the edge
    float glow = exp(-abs(field - threshold) * 5.0);

    // Interior pattern
    float interior = sin(field * 10.0 - t * 2.0) * 0.5 + 0.5;

    color = baseColor * edge * (0.5 + interior * 0.5);
    color += baseColor * glow * 1.5;

    // Extra brightness on beat
    color *= 1.0 + uBeat * 0.6;
  }

  // Background glow
  color += mix(uColor1, uColor3, 0.5) * 0.02 * uEnergy;

  color = pow(color, vec3(0.9));
  gl_FragColor = vec4(color, 1.0);
}

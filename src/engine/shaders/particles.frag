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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  vec3 color = vec3(0.0);
  float t = uTime;

  // Multiple particle layers
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float speed = 1.0 + fl * 0.5 + uBass * 2.0;
    float size = 0.008 + fl * 0.004 - uBeat * 0.003;

    for (int i = 0; i < 20; i++) {
      float fi = float(i) + fl * 40.0;
      float seed = fi * 0.1 + fl * 100.0;

      // Particle position — spiral outward from center
      float angle = hash1(seed) * PI * 2.0 + t * (0.5 + hash1(seed + 1.0)) * speed;
      float radius = hash1(seed + 2.0) * 0.8 + t * hash1(seed + 3.0) * 0.3;
      radius = fract(radius) * (0.6 + uEnergy * 0.4);

      // Add explosion on beat
      float beatOffset = uBeat * hash1(seed + 4.0) * 0.5;
      radius += beatOffset;

      vec2 pos = vec2(cos(angle), sin(angle)) * radius;

      // Particle glow
      float d = length(uv - pos);
      float glow = size / (d + 0.001);
      glow = pow(glow, 1.5);
      glow = min(glow, 2.0);

      // Color based on layer and position
      vec3 pColor;
      if (layer == 0) pColor = uColor1;
      else if (layer == 1) pColor = uColor2;
      else pColor = uColor3;

      // Twinkle
      float twinkle = sin(t * 3.0 + fi * 2.0 + uHigh * 5.0) * 0.5 + 0.5;
      glow *= 0.5 + twinkle * 0.5;

      // Fade with distance from center
      float fade = 1.0 - smoothstep(0.3, 0.9, radius);

      color += pColor * glow * fade * 0.15;
    }
  }

  // Central glow
  float centerDist = length(uv);
  color += mix(uColor1, uColor2, 0.5) * exp(-centerDist * 5.0) * (0.2 + uBeat * 0.8);

  // Subtle radial streaks
  float angle = atan(uv.y, uv.x);
  float streaks = abs(sin(angle * 8.0 + t));
  streaks = pow(streaks, 8.0);
  color += uColor3 * streaks * exp(-centerDist * 3.0) * uEnergy * 0.3;

  color = min(color, vec3(1.5));
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}

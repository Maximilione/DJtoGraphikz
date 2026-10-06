precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float count;
uniform float size;
uniform float spread;

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
  float t = uTime;
  // deep backdrop: palette-tinted radial haze, alive in silence
  float r0 = length(uv * vec2(1.0 / max(1.0, uResolution.x / uResolution.y * 0.56), 1.0));
  vec3 color = mix(uColor3, uColor1, 0.4) * (0.035 + 0.05 * exp(-r0 * 2.2) + 0.05 * uEnergy * exp(-r0 * 1.5));
  // a LED strip is six times wider than tall: stretch the particle field
  // sideways so it is not a small cluster in the middle (the glow stays round)
  float stretch = max(1.0, uResolution.x / uResolution.y * 0.56);

  // Multiple particle layers
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float speed = 1.0 + fl * 0.5;
    // Guard: beat shrink must not push small sizes negative (pow(neg) = NaN)
    float pSize = max(size + fl * 0.004 - uBeat * 0.003, 0.001);

    for (int i = 0; i < 40; i++) {
      if (float(i) >= count) break;
      float fi = float(i) + fl * 40.0;
      float seed = fi * 0.1 + fl * 100.0;

      // Particle position — spiral outward from center
      // bass through the gated clock, never as a multiplier of t: at minute
      // thirty, t * uBass makes every particle teleport on each bass change
      float angle = hash1(seed) * PI * 2.0 + (t * speed + uBassTime * 2.0) * (0.5 + hash1(seed + 1.0));
      float radius = hash1(seed + 2.0) * 0.8 + t * hash1(seed + 3.0) * 0.3;
      radius = fract(radius) * (spread + uEnergy * 0.4);

      // Add explosion on beat
      float beatOffset = uBeat * hash1(seed + 4.0) * 0.5;
      radius += beatOffset;

      vec2 pos = vec2(cos(angle) * stretch, sin(angle)) * radius;

      // Particle glow
      float d = length(uv - pos);
      float glow = pSize / (d + 0.001);
      glow = pow(glow, 1.5);
      glow = min(glow, 2.0);
      // soft halo around every spark, swells on the kick
      glow += exp(-d * d / (pSize * pSize * 60.0 + 0.0004)) * (0.35 + 0.5 * uBeat);

      // Color based on layer and position
      vec3 pColor;
      if (layer == 0) pColor = mix(uColor1, uColor3, step(0.6, hash1(seed + 7.0)));
      else pColor = mix(uColor2, uColor3, step(0.7, hash1(seed + 7.0)));
      // hot white-ish core on the brightest sparks, kept for the bloom
      pColor = mix(pColor, vec3(1.0), clamp(glow - 1.0, 0.0, 1.0) * 0.35);

      // Twinkle
      float twinkle = sin(t * 3.0 + fi * 2.0 + uHigh * 5.0) * 0.5 + 0.5;
      glow *= 0.5 + twinkle * 0.5;

      // Fade with distance from center
      float fade = 1.0 - smoothstep(0.3, 0.9, radius);

      color += pColor * glow * (0.35 + 0.65 * fade) * fade * 0.3 * (1.0 + uBeat * 0.8);
    }
  }

  float centerDist = length(uv);

  // shockwave ring: a physical event on every kick
  float ringR = (1.0 - uBeat) * 0.9;
  float ring = exp(-abs(length(uv / vec2(stretch, 1.0)) - ringR) * 14.0) * uBeat;
  color += mix(uColor2, uColor3, 0.5) * ring * 0.9;

  // Central glow
  color += mix(uColor1, uColor2, 0.5) * exp(-centerDist * 5.0) * (0.3 + uBeat * 0.9);

  // Subtle radial streaks — idle floor so the hub keeps turning in silence
  float angle = atan(uv.y, uv.x);
  float streaks = abs(sin(angle * 8.0 + t));
  streaks = pow(streaks, 8.0);
  color += uColor3 * streaks * exp(-centerDist * 4.0) * (0.4 + 0.6 * uEnergy) * 0.18;

  // soft shoulder: highlights stay clean for the bloom, never flat white
  color = vec3(1.0) - exp(-color * 1.4);

  gl_FragColor = vec4(color, 1.0);
}

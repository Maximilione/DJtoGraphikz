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

// sin-free (same form as reaction.sim.frag): this runs ~6 times per particle per pixel
float hash1(float n) {
  n = fract(n * 0.1031);
  n *= n + 33.33;
  n *= n + n;
  return fract(n);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  // a LED strip is six times wider than tall: stretch the particle field
  // sideways so it is not a small cluster in the middle (the glow stays round)
  float stretch = max(1.0, uResolution.x / uResolution.y * 0.56);
  // deep backdrop: palette-tinted radial haze, alive in silence
  float r0 = length(uv / vec2(stretch, 1.0));
  vec3 color = mix(uColor3, uColor1, 0.4) * (0.035 + 0.05 * exp(-r0 * 2.2) + 0.05 * uEnergy * exp(-r0 * 1.5));

  float haloA = 0.35 + 0.5 * uBeat;
  float beatMul = 0.3 * (1.0 + uBeat * 0.8);

  // Multiple particle layers
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    float speed = 1.0 + fl * 0.5;
    // Guard: beat shrink must not push small sizes negative (pow(neg) = NaN)
    // layer 1 is the near plane: larger, softer, a little dimmer
    float pSize = max(size + fl * 0.004 - uBeat * 0.003, 0.001) * (layer == 0 ? 1.0 : 1.6);
    float layerMul = beatMul * (layer == 0 ? 1.0 : 0.6);
    float haloK = 1.0 / (pSize * pSize * 60.0 + 0.0004);

    for (int i = 0; i < 40; i++) {
      if (float(i) >= count) break;
      float fi = float(i) + fl * 40.0;
      float seed = fi * 0.1 + fl * 100.0;

      // Particle position — spiral outward from center
      // bass through the gated clock, never as a multiplier of t: at minute
      // thirty, t * uBass makes every particle teleport on each bass change
      float life = fract(hash1(seed + 2.0) * 0.8 + t * hash1(seed + 3.0) * 0.3);
      float radius = life * (spread + uEnergy * 0.4);
      // Add explosion on beat
      radius += uBeat * hash1(seed + 4.0) * 0.5;

      // Fade with distance from center. radius depends on the particle alone
      // (uniform across pixels): a faded-out particle costs nobody anything
      float fade = 1.0 - smoothstep(0.3, 0.9, radius);
      // fade in at birth and out before fract() wraps: no popping
      fade *= smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.8, 1.0, life));
      if (fade <= 0.0) continue;

      float angle = hash1(seed) * PI * 2.0 + (t * speed + uBassTime * 2.0) * (0.5 + hash1(seed + 1.0));
      vec2 pos = vec2(cos(angle) * stretch, sin(angle)) * radius;

      // Particle glow
      vec2 dv = uv - pos;
      float d2 = dot(dv, dv);
      float d = sqrt(d2);
      float glow = pSize / (d + 0.001);
      glow *= sqrt(glow); // ^1.5
      glow = min(glow, 2.0);
      // soft halo around every spark, swells on the kick (exp(-9) ~ 0: skipped)
      if (d2 * haloK < 9.0) glow += exp(-d2 * haloK) * haloA;

      // Color based on layer and position
      float h7 = hash1(seed + 7.0);
      vec3 pColor;
      if (layer == 0) pColor = mix(uColor1, uColor3, step(0.6, h7));
      else pColor = mix(uColor2, uColor3, step(0.7, h7));
      // hot white-ish core on the brightest sparks, kept for the bloom
      pColor = mix(pColor, vec3(1.0), clamp(glow - 1.0, 0.0, 1.0) * 0.35);

      // Twinkle
      float twinkle = sin(t * 3.0 + fi * 2.0 + uHigh * 5.0) * 0.5 + 0.5;
      glow *= 0.5 + twinkle * 0.5;

      color += pColor * glow * (0.35 + 0.65 * fade) * fade * layerMul;
    }
  }

  float centerDist = length(uv);

  // shockwave ring: a physical event on every kick
  float ringR = (1.0 - uBeat) * 0.9;
  float ring = exp(-abs(r0 - ringR) * 14.0) * uBeat;
  color += mix(uColor2, uColor3, 0.5) * ring * 0.9;

  // Central glow
  color += mix(uColor1, uColor2, 0.5) * exp(-centerDist * 5.0) * (0.3 + uBeat * 0.9);

  // Subtle radial streaks — idle floor so the hub keeps turning in silence
  float angle = atan(uv.y, uv.x);
  float streaks = abs(sin(angle * 8.0 + t));
  float s2 = streaks * streaks; float s4 = s2 * s2; streaks = s4 * s4; // ^8
  color += uColor3 * streaks * exp(-centerDist * 4.0) * (0.4 + 0.6 * uEnergy) * 0.18;

  // soft shoulder: highlights stay clean for the bloom, never flat white
  color = vec3(1.0) - exp(-color * 1.4);
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // dither the dark radial haze

  gl_FragColor = vec4(color, 1.0);
}

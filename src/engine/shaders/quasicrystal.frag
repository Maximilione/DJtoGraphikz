precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float waves;
uniform float qfreq;
uniform float contrast;
uniform float uLineBoost;

#define PI 3.14159265359

// A quasicrystal: N plane waves at evenly spaced angles, summed. Five or more
// gives a pattern with rotational symmetry that never repeats — the interference
// is the image, there is no geometry to draw.
// Here the field is bent like a lens (frequency rises toward the edges, so the
// middle reads as a tunnel mouth), split in three phase-shifted channels for a
// chromatic fringe, and the kick is a physical lurch: zoom punch, twist and a
// flare at the centre.

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 q = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5);
  float r2 = dot(q, q);

  // lens: denser fringes toward the rim, pulled in by the kick
  vec2 p = q * qfreq * (1.0 + 0.9 * r2) * (1.0 - 0.10 * uBassHit);

  float n = clamp(floor(waves), 3.0, 12.0);
  float t = uTime * 0.25 + uBeatClock * 0.08;
  float twist = 0.18 * uBassHit;

  // the fringe offset: green is the true field, red and blue are the same
  // waves a phase step away (cos(d +/- s) from cos d and sin d, no extra trig)
  float s = 0.22 + 0.55 * uBassHit + 0.15 * uHigh;
  float cs = cos(s), sn = sin(s);

  float sumG = 0.0, sumR = 0.0, sumB = 0.0;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= n) break;
    float a = PI * float(i) / n + t * 0.07 + twist;
    vec2 dir = vec2(cos(a), sin(a));
    float d = dot(p, dir) + t * (1.0 + 0.12 * float(i)) + uBass * 2.0;
    float cd = cos(d), sd = sin(d);
    sumG += cd;
    sumR += cd * cs - sd * sn;
    sumB += cd * cs + sd * sn;
  }
  vec3 sum = vec3(sumR, sumG, sumB) / n;

  // The fringes are the image: wrapping the sum through a sine turns the smooth
  // interference into the fine banding a quasicrystal actually shows.
  vec3 w = sin(sum * (PI * 3.0) + uBeatClock * 0.3);
  float k = 1.0 + contrast * 9.0;
  float band = 0.5 + 0.5 * tanh(w.y * k);
  // the boost widens the lit part of each fringe (capped: never a flat field)
  vec3 edge = vec3(1.0) - smoothstep(vec3(0.0), vec3(min(0.55 * (1.0 + 1.5 * uLineBoost) / k, 0.5)), abs(w));

  vec3 c = mix(uColor3 * 0.07, uColor1, band);
  c = mix(c, uColor2, smoothstep(0.6, 1.0, band));
  float flare = 0.3 + 0.9 * uHigh + 0.9 * uBassHit + 0.5 * uBeat;
  c += uColor2 * edge.y * flare;
  // chromatic fringe: only the part of the red/blue edge the green one lacks
  c += (edge - vec3(edge.y)) * (0.12 + 0.55 * uBassHit) * mix(uColor1, uColor2, 0.5) * 2.0;
  c *= 0.75 + 0.5 * uEnergy;

  // depth: dark rim, glowing mouth in the middle that the kick opens
  float core = exp(-r2 * 9.0);
  c += mix(uColor1, uColor2, 0.5) * core * (0.05 + 0.30 * uBassHit + 0.10 * uEnergy);
  c *= mix(0.45, 1.0, smoothstep(0.55, 0.0, r2));

  c = max(c, 0.0);
  // soft shoulder so the flares peak near 0.9 and stay clean for the bloom
  c = 1.0 - exp(-c * 1.35);
  gl_FragColor = vec4(c, 1.0);
}

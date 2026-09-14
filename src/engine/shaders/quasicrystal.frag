precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float waves;
uniform float qfreq;
uniform float contrast;

#define PI 3.14159265359

// A quasicrystal: N plane waves at evenly spaced angles, summed. Five or more
// gives a pattern with rotational symmetry that never repeats — the interference
// is the image, there is no geometry to draw.

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5) * qfreq;

  float n = clamp(floor(waves), 3.0, 12.0);
  float t = uTime * 0.25 + uBeatClock * 0.08;
  float sum = 0.0;

  for (int i = 0; i < 12; i++) {
    if (float(i) >= n) break;
    float a = PI * float(i) / n + t * 0.07;
    vec2 dir = vec2(cos(a), sin(a));
    sum += cos(dot(p, dir) + t * (1.0 + 0.12 * float(i)) + uBass * 2.0);
  }
  sum /= n;

  // The fringes are the image: wrapping the sum through a sine turns the smooth
  // interference into the fine banding a quasicrystal actually shows. Without
  // this it is just a soft blob — the summed waves span barely two periods.
  float w = sin(sum * PI * 3.0 + uBeatClock * 0.3);
  float k = 1.0 + contrast * 9.0;
  float band = 0.5 + 0.5 * tanh(w * k);
  float edge = 1.0 - smoothstep(0.0, 0.55 / k, abs(w));

  vec3 c = mix(uColor3 * 0.07, uColor1, band);
  c = mix(c, uColor2, smoothstep(0.6, 1.0, band));
  c += uColor2 * edge * (0.3 + 0.9 * uHigh + 0.7 * uBeat);
  c *= 0.75 + 0.5 * uEnergy;

  gl_FragColor = vec4(c, 1.0);
}

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

uniform float blades;
uniform float spikes;
uniform float turn;

// A tribal sun, black and white: concentric bands of blades turning against
// each other, ratcheting one blade per beat like a rusty gear. The core is a
// black disc that goes white on the kick.

#define PI 3.14159265359

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r = length(p);
  float a = atan(p.y, p.x);
  float n = max(3.0, floor(blades));

  // band index; alternate bands turn opposite ways
  float band = floor(r * 5.5);
  float dir = mod(band, 2.0) * 2.0 - 1.0;
  // ratchet: snap one blade per beat with a short glide
  float step_ = 2.0 * PI / n;
  float beat = floor(uBeatClock);
  float glide = smoothstep(0.0, 0.25, uBeatClock - beat);
  float angle = (beat + glide) * step_ * dir * turn + uTime * 0.05 * dir;

  float s = cos(n * (a + angle) + band * 0.7);
  // sharpen into spikes; blades widen with the bass
  float sharp = pow(max(0.0, s), mix(6.0, 1.0, spikes));
  float thr = 0.35 - 0.25 * uBass;
  float aa = fwidth(sharp) * 1.5;
  float ink = smoothstep(thr - aa, thr + aa, sharp);
  // band gaps
  float fr = fract(r * 5.5);
  ink *= smoothstep(0.0, 0.05, fr) * smoothstep(0.95, 0.9, fr);
  // core and outer edge
  float core = 1.0 - smoothstep(0.05, 0.07, r);
  ink = mix(ink, uBassHit * uBassHit, core);
  ink *= 1.0 - smoothstep(0.6, 0.72, r);

  vec3 col = mix(vec3(1.0), uColor1, 0.2 + 0.3 * uHigh) * ink * (0.8 + 0.3 * uBeat);
  gl_FragColor = vec4(col, 1.0);
}

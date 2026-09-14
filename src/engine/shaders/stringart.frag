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

uniform float nodes;
uniform float multiplier;
uniform float linew;

#define TAU 6.28318530718

// Times-table string art: node i is joined to node (i * m) mod N. As m drifts
// the chords sweep through cardioid, nephroid and on — the envelope of the
// chords is the shape, no curve is ever drawn.

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  vec2 p = (uvp - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) * 1.95;

  float n = clamp(floor(nodes), 8.0, 120.0);
  float m = multiplier + uBeatClock * 0.035 + uBass * 0.6;
  float r = 0.85 + 0.08 * uBeat;

  float w = linew * 0.0016 * (1.0 + 1.5 * uBass);
  float acc = 0.0, near = 1e9;

  for (int i = 0; i < 120; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float a0 = TAU * fi / n;
    float a1 = TAU * fract(fi * m / n);
    vec2 A = vec2(cos(a0), sin(a0)) * r;
    vec2 B = vec2(cos(a1), sin(a1)) * r;
    float d = segDist(p, A, B);
    near = min(near, d);
    acc += w / (d + w * 1.4);      // every chord adds a little light
  }

  float line = 1.0 - smoothstep(w, w * 2.6, near);
  float hue = clamp(near * 3.0, 0.0, 1.0);
  vec3 tint = mix(uColor2, uColor1, hue);

  // line art is mostly black by construction, so the ink and the accumulated
  // chord glow both have to carry more than they would in a filled effect
  vec3 c = tint * line * (1.6 + 0.9 * uBeat);
  c += mix(uColor1, uColor3, 0.5) * acc * (0.03 + 0.06 * uEnergy);
  c += uColor3 * 0.02;

  gl_FragColor = vec4(c, 1.0);
}

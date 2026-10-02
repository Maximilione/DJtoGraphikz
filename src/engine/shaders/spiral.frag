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

uniform float arms;
uniform float twist;
uniform float pulse;

// Hypno tunnel. Thin white arms on a logarithmic spiral: they keep their
// width in angle, so on the wall they taper into the centre like a tunnel
// seen head-on, and vanish into a black hole. The spin rides a cosine on the
// bar, so it slows, reverses and picks up again without a jolt; the kick
// fattens the arms for one hit. White on black, the palette only in the halo.

#define TAU 6.28318530718

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  float n = max(1.0, floor(arms));

  // spin: one period is two bars, the velocity passes through zero on the
  // bar line. The clock is folded so an hour in the cosine is still exact.
  float phase = 3.6 * cos(TAU * mod(uBeatClock, 8.0) / 8.0) + uTime * 0.05;

  // arm coordinate: one unit per arm, zero on the arm's centre line
  float u = (n * a + twist * log(r) + phase) / TAU;
  float d = abs(fract(u) - 0.5);
  // pixel footprint of u, analytic: no seam where atan wraps
  float aa = length(vec2(n, twist)) / r / uResolution.y / TAU;
  // the white share of each arm: a seventh, plus the kick
  float w = 0.07 + 0.12 * pulse * clamp(uBassHit, 0.0, 1.0);
  float arm = 1.0 - smoothstep(w - aa, w + aa, d);
  float halo = exp(-max(d - w, 0.0) * 16.0) * 0.3;

  // the tunnel darkens toward the vanishing point and ends in a true hole
  float depth = smoothstep(0.0, 0.45, r) * smoothstep(0.025, 0.05, r);

  vec3 ink = mix(vec3(1.0), uColor1, 0.15 + 0.25 * uMid);
  vec3 col = ink * arm + uColor1 * halo * (0.6 + 0.4 * uBass);
  col *= depth * (0.8 + 0.3 * uBeat);
  gl_FragColor = vec4(col, 1.0);
}

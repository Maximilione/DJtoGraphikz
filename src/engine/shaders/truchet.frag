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

uniform float tiles;
uniform float thickness;
uniform float flip;

// Truchet tiles: each cell holds one of two quarter-arc pairs, and the choice
// flips on the beat. Continuous curves fall out of a per-cell coin toss, which
// is the whole trick — nothing here draws a path, the paths emerge.
// Two layers (a big dim one far away, the main one near) drift at different
// speeds for parallax. Each stroke has a white-hot core inside a coloured
// halo and a light that runs along the arcs; every kick sends a ring of
// brightness out from the centre and swells the strokes.

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// One layer of tiles. n = tiles per unit, seed decorrelates the layers.
vec3 tlayer(vec2 p, float n, float gen, float seed, float wk) {
  vec2 g = p * n;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;

  // the coin toss walks one generation per beat: the whole field re-routes
  float pick = hash(cell + gen * 7.31 + seed);
  if (pick < 0.5) f.x = -f.x;

  // two quarter arcs centred on opposite corners
  vec2 a = f - 0.5;
  vec2 b = f + 0.5;
  float da = abs(length(a) - 0.5);
  float db = abs(length(b) - 0.5);
  float d = min(da, db);
  vec2 v = da < db ? a : b;
  float ang = atan(v.y, v.x + 0.0001);

  float w = wk * thickness * (0.055 + 0.05 * uBass + 0.04 * uBassHit);
  float aa = 1.6 / (uResolution.y / n);
  float line = 1.0 - smoothstep(w, w + aa, d);
  float core = 1.0 - smoothstep(w * 0.30, w * 0.30 + aa, d);
  float glow = exp(-max(0.0, d - w) * 22.0 / wk);

  // a pulse of light running along the arc
  float run = 0.5 + 0.5 * sin(ang * 4.0 - uTime * 2.5 - uBeatClock * 3.14159
                              + hash(cell + seed) * 6.2832);

  // colour by cell so the field reads as regions, not one flat weave
  float region = hash(floor(cell / 3.0) + gen * 2.17 + seed);
  vec3 tint = mix(uColor1, uColor2, region);
  tint = mix(tint, uColor3, step(0.88, hash(cell + 4.2 + seed)));

  vec3 c = tint * (line * (0.55 + 0.55 * run) * (0.9 + 0.8 * uBeat)
                   + glow * (0.18 + 0.5 * uEnergy + 0.5 * uBassHit));
  c += mix(tint, vec3(1.0), 0.7) * core * (0.30 + 0.45 * uBeat + 0.55 * uBassHit) * (0.4 + 0.6 * run);
  return c;
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p0 = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5);
  float r = length(p0);

  // the kick punches the whole field in
  vec2 pk = p0 * (1.0 - 0.05 * uBassHit);

  float n = max(2.0, floor(tiles));
  float gen = floor(uBeatClock * flip);

  // far layer: half the density, thicker, slower, dim
  vec2 pf = pk + vec2(uTime * 0.012, uTime * 0.007) + 3.7;
  vec3 cFar = tlayer(pf, max(1.0, n * 0.5), gen, 17.0, 1.7) * 0.32;

  // near layer: slow drift so the pattern is never a still image
  vec2 pn = pk + vec2(uTime * 0.03, uTime * 0.017);
  vec3 cNear = tlayer(pn, n, gen, 0.0, 1.0);

  // ring of light leaving the centre on each kick
  float rd = (r - fract(uBeatClock)) / 0.09;
  float ring = exp(-rd * rd) * uBassHit;
  cNear *= 1.0 + ring * 2.2;

  // depth: the far weave sits under a dim colour haze that the kick lights
  vec3 haze = mix(uColor3, uColor1, 0.4) * (0.05 + 0.10 * uBassHit + 0.04 * uEnergy)
            * smoothstep(1.0, 0.0, r);
  vec3 c = cFar + cNear + haze + uColor3 * 0.02;
  c *= smoothstep(1.25, 0.25, r);

  // soft shoulder: the strokes peak near 0.9, clean for the bloom
  c = 1.0 - exp(-max(c, 0.0) * 1.6);
  gl_FragColor = vec4(c, 1.0);
}

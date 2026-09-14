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

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5);

  // slow drift so the pattern is never a still image
  p += vec2(uTime * 0.03, uTime * 0.017);

  float n = max(2.0, floor(tiles));
  vec2 g = p * n;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;

  // the coin toss walks one generation per beat: the whole field re-routes
  float gen = floor(uBeatClock * flip);
  float pick = hash(cell + gen * 7.31);
  if (pick < 0.5) f.x = -f.x;

  // two quarter arcs centred on opposite corners
  float d = min(abs(length(f - 0.5) - 0.5), abs(length(f + 0.5) - 0.5));

  float w = thickness * (0.055 + 0.05 * uBass) ;
  float aa = 1.6 / (uResolution.y / n);
  float line = 1.0 - smoothstep(w, w + aa, d);
  float glow = exp(-max(0.0, d - w) * 26.0) * (0.18 + 0.5 * uEnergy);

  // colour by cell so the field reads as regions, not one flat weave
  float region = hash(floor(cell / 3.0) + gen * 2.17);
  vec3 tint = mix(uColor1, uColor2, region);
  tint = mix(tint, uColor3, step(0.88, hash(cell + 4.2)));

  vec3 c = tint * (line * (0.9 + 0.8 * uBeat) + glow);
  c += uColor3 * 0.02;
  gl_FragColor = vec4(c, 1.0);
}

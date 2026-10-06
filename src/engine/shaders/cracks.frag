precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float cells;
uniform float width;
uniform float glow;

// Cracked concrete lit from below. A Voronoi edge network is the crack; the
// slabs are near black, and every beat sends a pulse of light out from the
// centre along the cracks. The slabs breathe slowly so the cracks creep.

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 g = p * max(2.0, cells);
  vec2 cell = floor(g);
  vec2 f = fract(g);

  // F1 / F2 with the second pass so the edge distance is exact
  float f1 = 8.0; vec2 n1 = vec2(0.0), r1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 nb = vec2(float(i), float(j));
    vec2 o = hash2(cell + nb);
    o = 0.5 + 0.4 * sin(uTime * 0.3 + 6.2831 * o);
    vec2 rr = nb + o - f;
    float d = dot(rr, rr);
    if (d < f1) { f1 = d; r1 = rr; n1 = nb; }
  }
  float edge = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 nb = n1 + vec2(float(i), float(j));
    vec2 o = hash2(cell + nb);
    o = 0.5 + 0.4 * sin(uTime * 0.3 + 6.2831 * o);
    vec2 rr = nb + o - f;
    if (dot(r1 - rr, r1 - rr) > 1e-5)
      edge = min(edge, dot(0.5 * (r1 + rr), normalize(rr - r1)));
  }

  float w = 0.02 * width;
  float crack = 1.0 - smoothstep(w, w + 0.02, edge);
  // the pulse travels outward along the cracks, one per beat
  float dist = length(p);
  float pulse = exp(-abs(dist - uBeatPhase * 0.9) * 6.0) * (0.5 + 0.8 * uBass);
  // idle travelling pulse so a silent room still has light running in the cracks
  float pulse2 = exp(-abs(dist - fract(uTime * 0.12) * 1.1) * 7.0) * 0.6;
  float lit = crack * (0.55 + (pulse * 1.4 + pulse2) * glow) * (1.0 + uBeat * 0.9);

  // slabs: near black, a little grain, slightly lighter toward the crack
  float slab = 0.03 + 0.05 * hash2(cell + n1).x + exp(-edge * 8.0) * 0.07;
  // slabs lit from below: the underglow rises from the bottom edge
  vec3 under = mix(uColor1, uColor3, uv.x) * (0.05 + 0.1 * pow(1.0 - uv.y, 2.0)) * (0.6 + 0.8 * uEnergy);
  vec3 col = vec3(slab) * (1.0 + 0.8 * uBassHit) + under * (0.5 + 0.9 * exp(-edge * 6.0));
  col += mix(uColor1, vec3(1.0), pulse * 0.5 + 0.15) * lit;
  // wide halo bleeding out of the crack, hot core on the kick
  col += mix(uColor2, uColor1, 0.5) * exp(-edge * 14.0) * (0.12 + 0.5 * uBassHit) * glow;
  col += uColor2 * crack * exp(-edge * 40.0) * 0.3;
  col = vec3(1.0) - exp(-col * 1.3);
  gl_FragColor = vec4(col, 1.0);
}

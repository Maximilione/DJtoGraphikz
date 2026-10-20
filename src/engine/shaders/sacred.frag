precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float zoom;
uniform float radius;
uniform float ringfreq;
uniform float uLineBoost;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// Crisp line plus a soft halo that the bloom can pick up
// Line half-width: the authored one widened by the boost, never under a few
// screen pixels (fwidth(d) is the pixel size in d units) so it survives smoke.
float lw(float w, float d) {
  return max(w * (1.0 + 2.5 * uLineBoost), fwidth(d) * (3.0 + 4.0 * uLineBoost));
}

float ring(vec2 p, float r, float w) {
  float d = abs(length(p) - r);
  float aw = lw(w, d);
  return smoothstep(aw, aw * 0.3, d) + 0.12 * exp(-d * 26.0 / (1.0 + uLineBoost));
}

float node(vec2 q) {
  return 0.0007 / (dot(q, q) + 0.0007);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  float t = uTime * 0.3 + uBassTime * 0.02;
  float scale = zoom + uBass * 1.5 - uBassHit * 0.35;
  uv *= scale;
  uv *= rot(t * 0.1 + uMid * 0.3);

  float L = length(uv);

  float pattern = 0.0;
  float nodes = 0.0;

  // Deep layer: slow parallax lattice of stars behind the geometry
  vec2 bg = uv * 1.6 * rot(-t * 0.2) + vec2(t * 0.4, 0.0);
  vec2 cell = fract(bg * 1.5) - 0.5;
  float stars = exp(-dot(cell, cell) * 500.0) * 0.35;
  stars += 0.12 * exp(-dot(cell, cell) * 60.0);
  stars *= smoothstep(0.0, 0.8, L);

  // Flower of Life: 7 overlapping circles, nodes at every centre
  // the six centres are 60 degrees apart: one sincos for the first, then a
  // constant rotation per step
  const float C60 = 0.5, S60 = 0.8660254;
  float r = radius + uBeat * 0.15 + uBassHit * 0.05;
  pattern += ring(uv, r, 0.015);
  nodes += node(uv);
  vec2 e1 = vec2(cos(t * 0.2), sin(t * 0.2)) * r;
  for (int i = 0; i < 6; i++) {
    vec2 q = uv - e1;
    pattern += ring(q, r, 0.015);
    nodes += node(q) * 0.8;
    e1 = vec2(C60 * e1.x - S60 * e1.y, S60 * e1.x + C60 * e1.y);
  }

  // Second layer: larger circles
  float r2 = r * 1.732;
  float a2 = PI / 6.0 + t * 0.15;
  vec2 e2 = vec2(cos(a2), sin(a2)) * r2;
  for (int i = 0; i < 6; i++) {
    vec2 q = uv - e2;
    pattern += ring(q, r, 0.01) * 0.5;
    nodes += node(q) * 0.5;
    e2 = vec2(C60 * e2.x - S60 * e2.y, S60 * e2.x + C60 * e2.y);
  }

  // Metatron's cube: lines through the centre. Lines i and i+6 are the same
  // line (direction flipped, |d| and |along| identical), so 6 lines at twice
  // the weight draw exactly what 12 did.
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 12.0 + t * 0.05;
    vec2 dir = vec2(cos(angle), sin(angle));
    float d = abs(dot(uv, vec2(-dir.y, dir.x)));
    float along = abs(dot(uv, dir));
    float mask = 1.0 - smoothstep(r2, r2 + r, along);
    float lwm = lw(0.02, d);
    pattern += (smoothstep(lwm, lwm * 0.25, d) + 0.1 * exp(-d * 30.0 / (1.0 + uLineBoost))) * mask * 0.6;
  }

  // Pulsing concentric rings
  float rings = sin(L * ringfreq - uTime * 2.0 - uBass * 8.0);
  pattern += smoothstep(0.8, 1.0, rings) * 0.4;

  // Rotating triangles with halo: one sincos, then +120 degrees per triangle
  float c3 = cos(t * 0.3), s3 = sin(t * 0.3);
  vec2 p = vec2(c3 * uv.x - s3 * uv.y, s3 * uv.x + c3 * uv.y);
  for (int k = 0; k < 3; k++) {
    float tri = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y);
    float triRing = abs(tri - (0.8 + float(k) * 0.3));
    float lwt = lw(0.03, triRing);
    pattern += smoothstep(lwt, lwt * 0.33, triRing) * 0.6 + 0.12 * exp(-triRing * 24.0 / (1.0 + uLineBoost));
    p = vec2(-0.5 * p.x - 0.8660254 * p.y, 0.8660254 * p.x - 0.5 * p.y);
  }

  // Kick shockwave through the geometry
  float sr = 0.2 + 2.6 * (1.0 - uBassHit);
  float sw = (L - sr) * 7.0;
  float shock = exp(-sw * sw) * uBassHit;

  // Colour: sin(theta + K) and sin(theta + K + 120deg) with theta the polar
  // angle — expanded on the unit vector of uv, no atan (and no undefined
  // atan(0, 0) on the centre pixel)
  float K = TAU * (t * 0.1 + uHigh + L * 0.05);
  float sK = sin(K), cK = cos(K);
  vec2 dn = uv / max(L, 1e-6);
  float sA = dn.y * cK + dn.x * sK;
  float cA = dn.x * cK - dn.y * sK;
  float sB = -0.5 * sA + 0.8660254 * cA;
  vec3 col = mix(uColor1, uColor2, sA * 0.5 + 0.5);
  col = mix(col, uColor3, sB * 0.5 + 0.5);

  vec3 color = col * pattern * (1.0 + 0.5 * uBassHit);
  color += mix(uColor3, vec3(1.0), 0.6) * nodes * (0.5 + 0.9 * uBassHit + 0.3 * uBeat);
  color += mix(uColor2, uColor1, 0.5) * stars;
  color += mix(col, vec3(1.0), 0.5) * shock * 1.1;

  // White-hot where the lines pile up
  color += vec3(1.0) * smoothstep(1.4, 2.6, pattern) * 0.25;

  // Centre glow
  color += col * exp(-L * 2.0) * (0.3 + uBeat * 1.0 + uBassHit * 0.6);

  // Faint palette haze so quiet passages are never black
  float Ls = L / scale;
  color += mix(uColor1, uColor3, 0.5) * 0.035 * (1.0 - 0.3 * Ls);

  // Vignette
  color *= 1.0 - abs(Ls) * 0.5;

  color = vec3(1.0) - exp(-color * 1.3);
  gl_FragColor = vec4(color, 1.0);
}

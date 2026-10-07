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
  float r = radius + uBeat * 0.15 + uBassHit * 0.05;
  pattern += ring(uv, r, 0.015);
  nodes += node(uv);
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + t * 0.2;
    vec2 offset = vec2(cos(angle), sin(angle)) * r;
    pattern += ring(uv - offset, r, 0.015);
    nodes += node(uv - offset) * 0.8;
  }

  // Second layer: larger circles
  float r2 = r * 1.732;
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + PI / 6.0 + t * 0.15;
    vec2 offset = vec2(cos(angle), sin(angle)) * r2;
    pattern += ring(uv - offset, r, 0.01) * 0.5;
    nodes += node(uv - offset) * 0.5;
  }

  // Metatron's cube: lines through the centre
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * TAU / 12.0 + t * 0.05;
    vec2 dir = vec2(cos(angle), sin(angle));
    float d = abs(dot(uv, vec2(-dir.y, dir.x)));
    float along = abs(dot(uv, dir));
    float mask = 1.0 - smoothstep(r2, r2 + r, along);
    float lwm = lw(0.02, d);
    pattern += (smoothstep(lwm, lwm * 0.25, d) + 0.1 * exp(-d * 30.0 / (1.0 + uLineBoost))) * mask * 0.3;
  }

  // Pulsing concentric rings
  float rings = sin(L * ringfreq - uTime * 2.0 - uBass * 8.0);
  pattern += smoothstep(0.8, 1.0, rings) * 0.4;

  // Rotating triangles with halo
  for (int k = 0; k < 3; k++) {
    vec2 p = uv * rot(t * 0.3 + float(k) * TAU / 3.0);
    float tri = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y);
    float triRing = abs(tri - (0.8 + float(k) * 0.3));
    float lwt = lw(0.03, triRing);
    pattern += smoothstep(lwt, lwt * 0.33, triRing) * 0.6 + 0.12 * exp(-triRing * 24.0 / (1.0 + uLineBoost));
  }

  // Kick shockwave through the geometry
  float sr = 0.2 + 2.6 * (1.0 - uBassHit);
  float sw = (L - sr) * 7.0;
  float shock = exp(-sw * sw) * uBassHit;

  // Colour
  float colorPhase = atan(uv.y, uv.x) / TAU + t * 0.1 + uHigh + L * 0.05;
  vec3 col = mix(uColor1, uColor2, sin(colorPhase * TAU) * 0.5 + 0.5);
  col = mix(col, uColor3, sin(colorPhase * TAU + TAU / 3.0) * 0.5 + 0.5);

  vec3 color = col * pattern * (1.0 + 0.5 * uBassHit);
  color += mix(uColor3, vec3(1.0), 0.6) * nodes * (0.5 + 0.9 * uBassHit + 0.3 * uBeat);
  color += mix(uColor2, uColor1, 0.5) * stars;
  color += mix(col, vec3(1.0), 0.5) * shock * 1.1;

  // White-hot where the lines pile up
  color += vec3(1.0) * smoothstep(1.4, 2.6, pattern) * 0.25;

  // Centre glow
  color += col * exp(-L * 2.0) * (0.3 + uBeat * 1.0 + uBassHit * 0.6);

  // Faint palette haze so quiet passages are never black
  color += mix(uColor1, uColor3, 0.5) * 0.035 * (1.0 - 0.3 * L / scale);

  // Vignette
  color *= 1.0 - length(uv / scale) * 0.5;

  color = vec3(1.0) - exp(-color * 1.3);
  gl_FragColor = vec4(color, 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// Flower of life pattern
float circle(vec2 p, float r) {
  return smoothstep(r + 0.01, r - 0.01, length(p));
}

float ring(vec2 p, float r, float w) {
  float d = abs(length(p) - r);
  return smoothstep(w, w * 0.3, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  float t = uTime * 0.3;
  float scale = 2.5 + uBass * 1.5;
  uv *= scale;
  uv *= rot(t * 0.1 + uMid * 0.3);

  float pattern = 0.0;

  // Flower of Life — 7 overlapping circles
  float r = 0.5 + uBeat * 0.15;
  pattern += ring(uv, r, 0.015);
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + t * 0.2;
    vec2 offset = vec2(cos(angle), sin(angle)) * r;
    pattern += ring(uv - offset, r, 0.015);
  }

  // Second layer — larger circles
  float r2 = r * 1.732; // sqrt(3)
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * TAU / 6.0 + PI / 6.0 + t * 0.15;
    vec2 offset = vec2(cos(angle), sin(angle)) * r2;
    pattern += ring(uv - offset, r, 0.01) * 0.5;
  }

  // Metatron's cube — connecting lines as thin rings
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * TAU / 12.0 + t * 0.05;
    vec2 dir = vec2(cos(angle), sin(angle));
    float d = abs(dot(uv, vec2(-dir.y, dir.x)));
    float lineDist = length(uv - dir * dot(uv, dir));
    pattern += smoothstep(0.02, 0.005, d) * smoothstep(r2 + r, 0.0, length(uv - dir * dot(uv, dir))) * 0.3;
  }

  // Pulsing concentric rings
  float rings = sin(length(uv) * 20.0 - uTime * 2.0 - uBass * 8.0);
  rings = smoothstep(0.8, 1.0, rings) * 0.4;
  pattern += rings;

  // Rotating triangles
  for (int k = 0; k < 3; k++) {
    vec2 p = uv * rot(t * 0.3 + float(k) * TAU / 3.0);
    float tri = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y);
    float triRing = abs(tri - (0.8 + float(k) * 0.3));
    pattern += smoothstep(0.03, 0.01, triRing) * 0.6;
  }

  // Color assignment
  float colorPhase = atan(uv.y, uv.x) / TAU + t * 0.1 + uHigh;
  vec3 col = mix(uColor1, uColor2, sin(colorPhase * TAU) * 0.5 + 0.5);
  col = mix(col, uColor3, sin(colorPhase * TAU + TAU / 3.0) * 0.5 + 0.5);

  vec3 color = col * pattern;

  // Center glow
  color += col * exp(-length(uv) * 2.0) * (0.3 + uBeat * 1.0);

  // Vignette
  float vig = 1.0 - length(uv / scale) * 0.5;
  color *= vig;

  color = pow(color, vec3(0.9));
  gl_FragColor = vec4(color, 1.0);
}

precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uEnergy;
uniform float uHigh;
uniform float uBassHit;

varying float vRad;
varying float vSeed;
varying float vGain;

// Additive round sprite. Hot core in colour 3, the arms in colour 1, the thin
// outer rim in colour 2; a few stars twinkle to white-ish with the highs.

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float fall = exp(-r2 * 12.0) - 0.02;

  vec3 col = mix(uColor3, uColor1, smoothstep(0.0, 0.35, vRad));
  col = mix(col, uColor2, smoothstep(0.45, 0.95, vRad));
  col = mix(col, vec3(dot(col, vec3(0.34))) + 0.35, step(0.985, vSeed) * (0.4 + uHigh));
  // ~590k sprites: the per-star gain is set in the vertex shader. The floor
  // keeps a silent room a visible galaxy
  col *= (1.0 + 0.2 * uEnergy + 0.5 * uBassHit) * vGain;
  gl_FragColor = vec4(col * fall, 1.0);
}

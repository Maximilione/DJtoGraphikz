precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uEnergy;
uniform float uHigh;

varying float vSpeed;
varying float vSeed;
varying float vGain;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

// Additive round sprite. Each particle takes its palette colour from its seed,
// shifted a little by its speed. Colour 1 → 2 by speed alone left most of the
// swarm, which is slow, in colour 1.

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float fall = exp(-r2 * 11.0) - 0.028;

  vec3 col = pal3(vSeed + clamp(vSpeed * 0.02, 0.0, 0.2));
  // 65k additive sprites: each one has to be faint or the frame clips to a
  // flat wash of the palette's brightest colour
  // a sprite covers a few pixels and its falloff averages about a quarter of
  // its peak, so the peak has to be well above 1 for the swarm to read on a
  // projector at all — the master stage tone maps whatever is too bright
  col *= (1.9 + 1.1 * uEnergy + 0.7 * uHigh * vSeed) * vGain;

  gl_FragColor = vec4(col * fall, 1.0);
}

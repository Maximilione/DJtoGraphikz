precision highp float;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uEnergy;
uniform float uHigh;

varying float vSpeed;
varying float vSeed;

// Additive round sprite. Colour runs from color1 to color2 with speed, with a
// minority of particles in color3 so the swarm does not read as one flat mass.

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float fall = exp(-r2 * 11.0) - 0.028;

  vec3 col = mix(uColor1, uColor2, clamp(vSpeed * 0.11, 0.0, 1.0));
  col = mix(col, uColor3, step(0.90, vSeed));
  // 65k additive sprites: each one has to be faint or the frame clips to a
  // flat wash of the palette's brightest colour
  // a sprite covers a few pixels and its falloff averages about a quarter of
  // its peak, so the peak has to be well above 1 for the swarm to read on a
  // projector at all — the master stage tone maps whatever is too bright
  col *= 1.9 + 1.1 * uEnergy + 0.7 * uHigh * vSeed;

  gl_FragColor = vec4(col * fall, 1.0);
}

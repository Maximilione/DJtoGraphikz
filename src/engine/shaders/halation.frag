precision highp float;

// Halation: warm red/orange halo around highlights, screened so it never clips.
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uWet;
uniform float uBeat;
uniform vec3 uColor1;
varying vec2 vUv;

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  float l = dot(texture2D(tBloom, vUv).rgb, vec3(0.333));
  vec3 warm = mix(vec3(1.0, 0.32, 0.08), uColor1 / (max(uColor1.r, max(uColor1.g, uColor1.b)) + 0.05), 0.2);
  vec3 halo = clamp(warm * l * 3.0 * (1.0 + uBeat * 0.4), 0.0, 1.0);
  vec3 wet = 1.0 - (1.0 - base) * (1.0 - halo);
  gl_FragColor = vec4(mix(base, wet, uWet), 1.0);
}

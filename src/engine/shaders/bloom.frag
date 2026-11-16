precision highp float;

// Final bloom composite: original image + blurred highlights.
// Prefilter and blur happen in separate half-res passes (see Engine.renderBloom).
uniform sampler2D tDiffuse;  // original
uniform sampler2D tBloom;    // blurred highlights
uniform float uStrength;
uniform float uEnergy;
uniform float uWet;          // 0..1 wet/dry
varying vec2 vUv;

// interleaved gradient noise, static per pixel
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec3 bloom = texture2D(tBloom, vUv).rgb;

  vec3 wet = base.rgb + bloom * uStrength * (1.0 + uEnergy * 0.5);
  vec3 c = mix(base.rgb, wet, uWet);
  // the halo is a dark smooth gradient written to an 8-bit target: dither it.
  // Under half a step: pixels with no bloom are written back unchanged.
  c += (ign(gl_FragCoord.xy) - 0.5) / 256.0;
  gl_FragColor = vec4(c, base.a);
}

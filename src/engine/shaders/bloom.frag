precision highp float;

// Final bloom composite: original image + blurred highlights.
// Prefilter and blur happen in separate half-res passes (see Engine.renderBloom).
uniform sampler2D tDiffuse;  // original
uniform sampler2D tBloom;    // blurred highlights
uniform float uStrength;
uniform float uEnergy;
uniform float uWet;          // 0..1 wet/dry
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec3 bloom = texture2D(tBloom, vUv).rgb;

  vec3 wet = base.rgb + bloom * uStrength * (1.0 + uEnergy * 0.5);
  gl_FragColor = vec4(mix(base.rgb, wet, uWet), base.a);
}

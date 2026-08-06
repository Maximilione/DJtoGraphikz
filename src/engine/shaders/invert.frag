precision highp float;
uniform sampler2D tDiffuse;
uniform float uWet;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(mix(color.rgb, 1.0 - color.rgb, uWet), 1.0);
}

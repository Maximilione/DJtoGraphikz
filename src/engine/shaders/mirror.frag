precision highp float;
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  // Mirror horizontally
  if (uv.x > 0.5) uv.x = 1.0 - uv.x;
  gl_FragColor = texture2D(tDiffuse, uv);
}

precision highp float;
uniform sampler2D tDiffuse;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  float pixelSize = mix(4.0, 16.0, uEnergy);
  vec2 pixels = uResolution / pixelSize;
  vec2 uv = floor(vUv * pixels) / pixels;
  gl_FragColor = texture2D(tDiffuse, uv);
}

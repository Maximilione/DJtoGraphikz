precision highp float;
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  float pixelSize = mix(4.0, 16.0, uEnergy);
  vec2 pixels = uResolution / pixelSize;
  vec2 uv = floor(vUv * pixels) / pixels;
  vec4 px = texture2D(tDiffuse, uv);
  // at full wet the dry sample would be thrown away: do not fetch it (uniform branch)
  if (uWet < 1.0) px = mix(texture2D(tDiffuse, vUv), px, uWet);
  gl_FragColor = px;
}

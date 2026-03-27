precision highp float;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float grain = rand(vUv * uResolution + vec2(uTime * 100.0)) * 0.12;
  grain *= 0.5 + uEnergy * 0.5;
  color.rgb += vec3(grain - 0.06);
  gl_FragColor = color;
}

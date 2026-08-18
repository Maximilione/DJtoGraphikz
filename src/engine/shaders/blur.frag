precision highp float;

// Separable gaussian — run once horizontally, once vertically.
uniform sampler2D tDiffuse;
uniform vec2 uDirection;   // (1,0) horizontal, (0,1) vertical
uniform vec2 uResolution;  // resolution of THIS pass
uniform float uRadius;
varying vec2 vUv;

void main() {
  vec2 texel = uDirection / uResolution * uRadius;

  // 9-tap gaussian, linear-sampled offsets
  vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
  sum += texture2D(tDiffuse, vUv + texel * 1.3846) * 0.3162162;
  sum += texture2D(tDiffuse, vUv - texel * 1.3846) * 0.3162162;
  sum += texture2D(tDiffuse, vUv + texel * 3.2308) * 0.0702703;
  sum += texture2D(tDiffuse, vUv - texel * 3.2308) * 0.0702703;

  gl_FragColor = sum;
}

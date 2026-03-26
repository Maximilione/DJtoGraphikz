precision highp float;

uniform sampler2D tDiffuse;
uniform float uStrength;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / uResolution;
  float strength = uStrength * (1.0 + uEnergy * 0.5);

  vec4 sum = vec4(0.0);
  // 9-tap gaussian blur
  float weights[5];
  weights[0] = 0.227027;
  weights[1] = 0.1945946;
  weights[2] = 0.1216216;
  weights[3] = 0.054054;
  weights[4] = 0.016216;

  vec4 center = texture2D(tDiffuse, vUv);
  sum += center * weights[0];

  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    vec2 off = texel * fi * strength * 3.0;
    sum += texture2D(tDiffuse, vUv + vec2(off.x, 0.0)) * weights[i];
    sum += texture2D(tDiffuse, vUv - vec2(off.x, 0.0)) * weights[i];
    sum += texture2D(tDiffuse, vUv + vec2(0.0, off.y)) * weights[i];
    sum += texture2D(tDiffuse, vUv - vec2(0.0, off.y)) * weights[i];
  }

  // Additive bloom
  gl_FragColor = center + sum * strength;
}

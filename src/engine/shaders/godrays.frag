precision highp float;

// God rays: radial march from a drifting light point through the half-res
// highlight buffer, screened over the image.
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uWet;
uniform float uTime;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
varying vec2 vUv;

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec2 light = vec2(0.5 + 0.18 * sin(uTime * 0.23), 0.68 + 0.08 * cos(uTime * 0.31));
  vec2 stp = (light - vUv) * (0.9 / 24.0);
  vec2 p = vUv;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  for (int i = 0; i < 24; i++) {
    p += stp;
    acc += texture2D(tBloom, p).rgb * w;
    w *= 0.93;
  }
  acc /= 24.0;
  vec3 tint = mix(vec3(1.0), uColor1 / (max(uColor1.r, max(uColor1.g, uColor1.b)) + 0.05), 0.35);
  vec3 rays = clamp(acc * tint * 2.6 * (1.0 + uEnergy * 0.4 + uBeat * 0.5), 0.0, 1.0);
  vec3 wet = 1.0 - (1.0 - base) * (1.0 - rays);
  gl_FragColor = vec4(mix(base, wet, uWet), 1.0);
}

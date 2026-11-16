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
  // 16 jittered taps integrate the same as 24 fixed ones (sum of weights / count = 0.49)
  // and the per-pixel start offset hides the stepped ghost copies of small sources
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec2 stp = (light - vUv) * (0.9 / 16.0);
  vec2 p = vUv + stp * j;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  for (int i = 0; i < 16; i++) {
    p += stp;
    acc += texture2D(tBloom, p).rgb * w;
    w *= 0.897;
  }
  acc /= 16.3;
  vec3 tint = mix(vec3(1.0), uColor1 / (max(uColor1.r, max(uColor1.g, uColor1.b)) + 0.05), 0.35);
  vec3 rays = clamp(acc * tint * 2.6 * (1.0 + uEnergy * 0.4 + uBeat * 0.5), 0.0, 1.0);
  // screen then mix with the dry image, folded: mix(b, 1-(1-b)(1-r), w) = b + w r (1-b)
  gl_FragColor = vec4(base + (uWet * rays) * (1.0 - base), 1.0);
}

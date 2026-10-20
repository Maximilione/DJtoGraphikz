precision highp float;
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uTime;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

// Hash without sin: the old fract(sin(dot)) one was fed the pixel coordinate
// plus uTime * 100 — the post clock since launch — and after an hour the sin
// argument sat near 1e7, where an iGPU's sin is the wrong kind of noise (flat).
float rand(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // the time wraps every 64 s: white noise repeating is invisible, a huge hash input is not
  float g = rand(gl_FragCoord.xy + vec2(mod(uTime, 64.0) * 100.0)) * 0.12 * (0.5 + 0.5 * uEnergy) - 0.06;
  // mix(c, c + g, w) = c + w g
  gl_FragColor = vec4(color.rgb + uWet * g, color.a);
}

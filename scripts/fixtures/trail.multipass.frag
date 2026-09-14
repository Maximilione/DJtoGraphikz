// Two-pass custom shader, used by the release gate to prove that a multi-pass
// custom shader really reaches the projector: buffer A accumulates and decays,
// the visible pass colours it. If the buffer were not persistent this would be
// a single moving dot instead of a trail.
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uEnergy;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform sampler2D tBufferA;

//!DJG_BUFFER A
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // long decay and fat blobs on purpose: the gate needs enough lit pixels to
  // tell a real trail from a single dot, which is what a non-persistent buffer
  // would leave behind
  float prev = texture2D(tBufferA, uv).r * 0.995;
  float acc = prev;
  for (int i = 0; i < 3; i++) {
    float k = float(i) * 2.094;
    vec2 p = 0.5 + 0.33 * vec2(sin(uTime * 0.9 + k), cos(uTime * 1.3 + k));
    vec2 d = (uv - p) * vec2(uResolution.x / uResolution.y, 1.0);
    acc = max(acc, exp(-dot(d, d) / 0.006));
  }
  gl_FragColor = vec4(acc, 0.0, 0.0, 1.0);
}

//!DJG_MAIN
void main() {
  float a = texture2D(tBufferA, vUv).r;
  vec3 col = mix(uColor1 * 0.15, uColor2, pow(a, 0.6));
  gl_FragColor = vec4(col * (0.7 + 0.5 * uEnergy), 1.0);
}

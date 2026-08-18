precision highp float;

// Temporal motion blur: accumulate the previous output into the current one.
uniform sampler2D tDiffuse;
uniform sampler2D tPrev;
uniform float uAmount;   // 0 = off, 1 = very long smear
varying vec2 vUv;

void main() {
  vec4 curr = texture2D(tDiffuse, vUv);
  vec4 prev = texture2D(tPrev, vUv);
  // uAmount maps to how much of the history survives each frame
  gl_FragColor = mix(curr, max(prev, curr), uAmount);
}

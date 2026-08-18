precision highp float;

// Crossfader between deck A and deck B with blend modes.
uniform sampler2D tDeckA;
uniform sampler2D tDeckB;
uniform float uMix;    // 0 = full A, 1 = full B
uniform int uBlend;    // 0 mix, 1 add, 2 screen, 3 multiply, 4 difference
varying vec2 vUv;

void main() {
  vec3 a = texture2D(tDeckA, vUv).rgb;
  vec3 b = texture2D(tDeckB, vUv).rgb;

  vec3 blended;
  if (uBlend == 1) {
    blended = a + b;
  } else if (uBlend == 2) {
    blended = 1.0 - (1.0 - a) * (1.0 - b);
  } else if (uBlend == 3) {
    blended = a * b;
  } else if (uBlend == 4) {
    blended = abs(a - b);
  } else {
    blended = b;
  }

  // Crossfader fades from A into the blended result
  gl_FragColor = vec4(mix(a, blended, uMix), 1.0);
}

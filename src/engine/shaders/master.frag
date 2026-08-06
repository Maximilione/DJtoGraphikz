precision highp float;

// Always-on final stage: colour grade + master brightness.
// This is the pass that makes the output look graded instead of raw.
uniform sampler2D tDiffuse;
uniform float uBrightness;   // master fader / blackout
uniform float uContrast;     // 1 = neutral
uniform float uSaturation;   // 1 = neutral
uniform float uVignette;     // 0 = off
uniform float uLift;         // shadow lift, 0 = neutral
varying vec2 vUv;

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;

  // Lift (shadows) then contrast around mid grey
  c += uLift * (1.0 - c);
  c = (c - 0.5) * uContrast + 0.5;

  // Saturation
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, uSaturation);

  // Vignette
  vec2 d = vUv - 0.5;
  float vig = 1.0 - dot(d, d) * uVignette * 2.0;
  c *= max(vig, 0.0);

  c *= uBrightness;

  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}

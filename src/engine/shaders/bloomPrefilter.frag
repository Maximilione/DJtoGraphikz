precision highp float;

// Keeps only the bright parts of the image, with a soft knee so the
// transition into bloom isn't a hard cutoff. Runs at half resolution.
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));

  // Soft knee curve around uThreshold
  float knee = max(uKnee, 0.0001);
  float soft = clamp(luma - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  float contribution = max(soft, luma - uThreshold) / max(luma, 0.0001);

  gl_FragColor = vec4(c * contribution, 1.0);
}

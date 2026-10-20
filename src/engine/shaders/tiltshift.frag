precision highp float;

// Fake depth of field: sharp horizontal band, golden-angle disc blur above and
// below with bright samples weighted up so highlights turn into bokeh.
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

// The 20 disc taps: r = sqrt((i + 0.5) / 20), angle (i + 0.5) * 2.39996. They
// depend on nothing per pixel, so a table, not 20 sqrt + cos + sin per pixel.
const vec2 TAPS[20] = vec2[20](
  vec2(0.05730, 0.14737), vec2(-0.24559, -0.12117), vec2(0.33946, -0.09882), vec2(-0.21718, 0.35753),
  vec2(-0.09226, -0.46528), vec2(0.42268, 0.31039), vec2(-0.56675, 0.06158), vec2(0.40422, -0.46001),
  vec2(0.01349, 0.65178), vec2(-0.47597, -0.49845), vec2(0.72295, 0.04839), vec2(-0.59210, 0.47373),
  vec2(0.12156, -0.78117), vec2(0.45523, 0.68394), vec2(-0.82668, -0.20397), vec2(0.77268, -0.42185),
  vec2(-0.29384, 0.85945), vec2(-0.37475, -0.85707), vec2(0.87937, 0.38950), vec2(-0.93583, 0.31498));

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float off = abs(vUv.y - 0.5);
  float coc = smoothstep(0.12, 0.5, off) * (0.016 + uEnergy * 0.004) * uWet;
  // the band in focus: k below would be ~3e-4, the 20 taps add nothing visible
  if (coc < 1e-4) { gl_FragColor = vec4(base.rgb, 1.0); return; }
  vec2 cocAsp = coc * vec2(uResolution.y / uResolution.x, 1.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 20; i++) {
    vec3 s = texture2D(tDiffuse, vUv + TAPS[i] * cocAsp).rgb;
    float l = dot(s, vec3(0.333));
    float w = 1.0 + 4.0 * l * l * l;
    acc += s * w;
    wsum += w;
  }
  vec3 blur = acc / wsum;
  float k = smoothstep(0.0, 0.01, coc);
  gl_FragColor = vec4(mix(base.rgb, blur, k), 1.0);
}

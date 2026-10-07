precision highp float;

// Fake depth of field: sharp horizontal band, golden-angle disc blur above and
// below with bright samples weighted up so highlights turn into bokeh.
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float off = abs(vUv.y - 0.5);
  float coc = smoothstep(0.12, 0.5, off) * (0.016 + uEnergy * 0.004) * uWet;
  vec2 asp = vec2(uResolution.y / uResolution.x, 1.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 20; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 20.0);
    float a = fi * 2.39996;
    vec3 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * coc * asp).rgb;
    float w = 1.0 + 4.0 * pow(dot(s, vec3(0.333)), 3.0);
    acc += s * w;
    wsum += w;
  }
  vec3 blur = acc / wsum;
  float k = smoothstep(0.0, 0.01, coc);
  gl_FragColor = vec4(mix(base.rgb, blur, k), 1.0);
}

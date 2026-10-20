precision highp float;
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uTime;
uniform float uEnergy;
uniform vec2 uResolution;
uniform float uLineBoost;
varying vec2 vUv;

void main() {
  vec4 src = texture2D(tDiffuse, vUv);
  // CRT scanlines
  // periodo originale ~3.1px; con uLineBoost cresce (riga scura ~1.5px -> ~5px)
  float period = max(3.14159 * (1.0 + 2.5 * uLineBoost), uLineBoost * 2.0 * (3.0 + 4.0 * uLineBoost));
  // sqrt al posto di pow(x, 0.5): niente log2/exp2, e il max toglie la base
  // negativa quando il sin approssimato scende un pelo sotto -1
  float scanline = sqrt(max(sin(gl_FragCoord.y * (6.28318 / period)) * 0.5 + 0.5, 0.0));
  float depth = 0.15 + 0.2 * uLineBoost;
  // Subtle vignette
  vec2 center = vUv - 0.5;
  float vig = 1.0 - dot(center, center) * 1.2;
  vec3 lit = src.rgb * (((1.0 - depth) + scanline * depth) * vig);
  gl_FragColor = vec4(mix(src.rgb, lit, uWet), src.a);
}

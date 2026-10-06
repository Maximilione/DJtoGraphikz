precision highp float;
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uTime;
uniform float uEnergy;
uniform vec2 uResolution;
uniform float uLineBoost;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // CRT scanlines
  // periodo originale ~3.1px; con uLineBoost cresce (riga scura ~1.5px -> ~5px)
  float period = max(3.14159 * (1.0 + 2.5 * uLineBoost), uLineBoost * 2.0 * (3.0 + 4.0 * uLineBoost));
  float scanline = sin(gl_FragCoord.y * 6.28318 / period) * 0.5 + 0.5;
  scanline = pow(scanline, 0.5);
  float depth = 0.15 + 0.2 * uLineBoost;
  color.rgb *= (1.0 - depth) + scanline * depth;
  // Subtle vignette
  vec2 center = vUv - 0.5;
  float vig = 1.0 - dot(center, center) * 1.2;
  color.rgb *= vig;
  gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, color.rgb, uWet), color.a);
}

precision highp float;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uEnergy;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // CRT scanlines
  float scanline = sin(gl_FragCoord.y * 2.0) * 0.5 + 0.5;
  scanline = pow(scanline, 0.5);
  color.rgb *= 0.85 + scanline * 0.15;
  // Subtle vignette
  vec2 center = vUv - 0.5;
  float vig = 1.0 - dot(center, center) * 1.2;
  color.rgb *= vig;
  gl_FragColor = color;
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float grain;
uniform float roll;
uniform float bands;

// Dead channel. Coarse TV snow kept dark — only the energy lets the bright
// grains through — with a vertical sync roll driven by the bass and rows that
// tear sideways on the hats.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float g = max(1.0, grain);
  // horizontal tear on the hats, per row
  float row = floor(gl_FragCoord.y / g);
  float tearAmt = (hash(vec2(row, mod(floor(uTime * 20.0), 1024.0))) - 0.5) * uHighHit * 0.12;
  vec2 c = floor((gl_FragCoord.xy + vec2(tearAmt * uResolution.x, 0.0)) / g);

  float n = hash(c + vec2(fract(uTime * 7.31) * 100.0, fract(uTime * 3.7) * 50.0));
  // dark snow: cube it so most of the frame stays black
  float snow = pow(n, 6.0) * (0.25 + 0.9 * uEnergy);

  // sync roll: a dark band with a bright edge that rolls with the bass
  float y = fract(uv.y - uBassTime * 0.25 * roll - uTime * 0.02);
  float dark = smoothstep(0.0, 0.08, y) * smoothstep(0.22, 0.14, y);
  float edgeLine = exp(-abs(y - 0.22) * 120.0);
  snow *= 1.0 - dark * bands * 0.9;
  snow += edgeLine * bands * (0.4 + 0.6 * uBass);

  // scanlines
  snow *= 0.8 + 0.2 * step(0.5, fract(gl_FragCoord.y * 0.5));

  vec3 col = mix(vec3(1.0), uColor1, 0.15) * snow;
  col += vec3(1.0) * uBassHit * 0.06;
  gl_FragColor = vec4(col, 1.0);
}

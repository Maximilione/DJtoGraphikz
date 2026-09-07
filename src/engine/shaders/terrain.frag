precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float ridges;
uniform float horizon;
uniform float glowamt;

float ridgeH(float x, float row, float t) {
  // layered sines pseudo-terrain, bass raises the peaks
  float h = sin(x * 2.1 + row * 4.7 + t) * 0.5
          + sin(x * 4.7 - row * 2.3 + t * 1.3) * 0.25
          + sin(x * 9.1 + row * 9.1 - t * 0.7) * 0.125;
  return h * (0.35 + uBass * 0.5);
}

// Synthwave terrain: neon ridge lines scrolling toward the viewer,
// sun-disc on the horizon pulsing with the kick.
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float x = (uv.x - 0.5) * aspect;
  float t = uTime;
  vec3 color = vec3(0.0);

  // sun on the horizon
  vec2 sun = vec2(0.0, horizon + 0.13);
  float sd = length(vec2(x, uv.y) - sun);
  float sunR = 0.11 + uBassHit * 0.05;
  float disc = smoothstep(sunR, sunR - 0.012, sd);
  // horizontal blinds cut into the sun
  disc *= 0.55 + 0.45 * smoothstep(0.3, 0.7, sin(uv.y * 90.0 + t * 2.0));
  color += mix(uColor1, uColor2, uv.y * 2.0) * disc;
  color += uColor2 * (0.02 / (sd + 0.05)) * (0.6 + uEnergy);

  // ridge rows: from horizon (far) to bottom (near), scrolling with the music
  if (uv.y < horizon) {
    float depth01 = (horizon - uv.y) / horizon;    // 0 = horizon, 1 = bottom
    float z = 1.0 / max(depth01, 0.03);            // perspective row density
    float scroll = t * (1.2 + uBass) + uBassTime * 0.4;
    float row = floor(z * ridges * 0.12 + scroll);
    float rowF = fract(z * ridges * 0.12 + scroll);
    float h = ridgeH(x * (0.6 + depth01 * 1.6), row, row * 0.618);
    // line where the fractional row crosses the ridge height baseline
    float lineD = abs(rowF - 0.5 - h * 0.35 * depth01);
    float w = max(0.03, fwidth(z) * ridges * 0.02);
    float line = smoothstep(w, 0.0, lineD);
    float fade = depth01;                          // nearer = brighter
    vec3 lc = mix(uColor2, uColor1, fract(row * 0.23));
    color += lc * line * fade * (0.7 + glowamt * 0.5);
    // glow under the lines
    color += lc * smoothstep(0.35, 0.0, lineD) * 0.12 * glowamt * fade;
    // grid verticals
    float vx = abs(fract(x * (2.0 + depth01 * 6.0) + sin(row) * 0.3) - 0.5);
    color += uColor3 * smoothstep(0.02, 0.0, vx) * 0.12 * fade;
  }

  color *= 1.0 + uBeat * 0.25;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

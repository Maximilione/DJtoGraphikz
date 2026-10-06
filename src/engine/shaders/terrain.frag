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
uniform float uLineBoost;

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

  // night sky above the horizon: palette gradient, drifting stars, a haze
  // band that hugs the horizon and swells on the kick
  if (uv.y >= horizon) {
    float sk = (uv.y - horizon) / max(1.0 - horizon, 0.05);
    color += mix(uColor2, uColor3, sk) * (0.05 + 0.1 * (1.0 - sk)) * (0.7 + 0.5 * uEnergy);
    vec2 sg = vec2(x, uv.y) * 70.0;
    vec2 sid = floor(sg);
    float sh = hash(sid);
    float star = step(0.985, sh) * smoothstep(0.4, 0.0, length(fract(sg) - 0.5));
    color += vec3(1.0) * star * (0.4 + 0.6 * sin(t * 2.0 + sh * 50.0)) * 0.6 * (0.6 + uHigh);
  }
  color += mix(uColor1, uColor2, 0.5) * exp(-abs(uv.y - horizon) * 14.0) * (0.22 + 0.3 * uBassHit + 0.2 * uEnergy);

  // sun on the horizon
  vec2 sun = vec2(0.0, horizon + 0.13);
  float sd = length(vec2(x, uv.y) - sun);
  float sunR = 0.11 + uBassHit * 0.05;
  float disc = smoothstep(sunR, sunR - 0.012, sd);
  // horizontal blinds cut into the sun
  disc *= 0.55 + 0.45 * smoothstep(0.3, 0.7, sin(uv.y * 90.0 + t * 2.0));
  color += mix(uColor1, uColor2, uv.y * 2.0) * disc;
  color += uColor2 * (0.035 / (sd + 0.05)) * (0.8 + uEnergy + uBassHit);
  color += mix(uColor1, vec3(1.0), 0.4) * exp(-max(sd - sunR, 0.0) * 9.0) * 0.25 * (1.0 + 1.5 * uBassHit);

  // ridge rows: from horizon (far) to bottom (near), scrolling with the music
  if (uv.y < horizon) {
    float depth01 = (horizon - uv.y) / horizon;    // 0 = horizon, 1 = bottom
    float z = 1.0 / max(depth01, 0.03);            // perspective row density
    // bass only through the gated clock: t * uBass teleports the rows on
    // every bass change once t is large
    float scroll = t * 1.2 + uBassTime * 1.4;
    // 0.3 rows per world unit: at 0.12 the lower half of the frame held one
    // line and everything else piled up at the horizon
    float row = floor(z * ridges * 0.3 + scroll);
    float rowF = fract(z * ridges * 0.3 + scroll);
    float h = ridgeH(x * (0.6 + depth01 * 1.6), row, row * 0.618);
    // line where the fractional row crosses the ridge height baseline
    float lineD = abs(rowF - 0.5 - h * 0.6 * depth01);
    // half-width in row units: authored one widened by the boost, floored at a
    // few screen pixels (rpx = rows per pixel), capped so rows never merge into
    // a slab; where rows are denser than ~4 px the lines thin out instead
    float rpx = fwidth(z * ridges * 0.3);
    float w = min(max(0.03 * (1.0 + 2.5 * uLineBoost), rpx * (3.0 + 4.0 * uLineBoost)), 0.22);
    float line = smoothstep(w, 0.0, lineD) * (1.0 - 0.65 * smoothstep(0.08, 0.25, rpx));
    float fade = 0.3 + 0.7 * depth01;              // nearer = brighter, far ridges still read
    vec3 lc = mix(uColor2, uColor1, fract(row * 0.23));
    color += lc * line * fade * (1.0 + glowamt * 0.6 + uBassHit * 1.2);
    // glow under the lines
    color += lc * smoothstep(0.4, 0.0, lineD) * 0.2 * glowamt * fade * (1.0 + uBass);
    // ground haze so a silent room is not black below the horizon
    color += uColor2 * 0.1 * depth01 * (0.5 + 0.5 * glowamt);
    // grid verticals
    float vx = abs(fract(x * (2.0 + depth01 * 6.0) + sin(row) * 0.3) - 0.5);
    color += uColor3 * smoothstep(min(max(0.02, fwidth(vx) * (3.0 + 4.0 * uLineBoost)), 0.2), 0.0, vx) * 0.2 * fade * (1.0 + uBassHit);
  }

  color *= 1.0 + uBeat * 0.4;
  color = vec3(1.0) - exp(-max(color, vec3(0.0)) * 1.25);
  gl_FragColor = vec4(color, 1.0);
}

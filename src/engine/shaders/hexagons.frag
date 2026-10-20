precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float zoom;
uniform float wavefreq;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Hexagonal distance
vec4 hexCoords(vec2 uv) {
  vec2 r = vec2(1.0, 1.732);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  vec2 id = uv - gv;
  return vec4(gv, id);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Zoom and rotate
  float zm = zoom + uBass * 2.0;
  float angle = t * 0.1 + uMid * 0.2;
  float c = cos(angle), s = sin(angle);
  vec2 p = mat2(c, -s, s, c) * uv * zm;

  vec4 hex = hexCoords(p);
  vec2 gv = hex.xy;  // local coords within hex
  vec2 id = hex.zw;  // hex cell ID

  float cellHash = hash(id);

  // Hex edge distance: 0.5 on every edge of the cell. The old coefficients
  // (0.577) did not match the lattice, so the outline showed as loose dashes.
  float hexDist = max(abs(gv.x), abs(gv.x) * 0.5 + abs(gv.y) * 0.866);

  // Animated fill — wave propagates outward
  float distFromCenter = length(id) / zm;
  float wave = sin(distFromCenter * wavefreq - t * 2.0 - uBass * 3.0);
  float fill = smoothstep(0.0, 0.3, wave);

  // Analytic anti-aliasing: in gv space one pixel is zm / uResolution.y, and
  // hexDist / dotDist have gradient norm 1 / 6 — the same footprint fwidth()
  // measured, without forcing uniform flow (so the dots can sit in a branch)
  float px = zm / uResolution.y;

  // Edge glow
  float hw = max(1.9 * px, 0.03);   // ~ fwidth(hexDist) * 1.5
  float edge = smoothstep(0.48 - hw, 0.48, hexDist);

  // Beat: random cells flash — a third of them at most, or it is a strobe
  float beatFlash = step(0.9 - uBeat * 0.25, cellHash) * uBeat;

  // Color per cell
  vec3 cellColor = cellHash < 0.3333333 ? uColor1 : (cellHash < 0.6666667 ? uColor2 : uColor3);

  // Shift color with wave
  cellColor = mix(cellColor, uColor2, wave * 0.3);

  // Fill with pattern — isolated round dots on a small sub-grid, drifting
  // slowly. The previous version thresholded sin(x)*sin(y): a product of
  // two waves has diagonal interference fringes baked into its math at any
  // sampling rate (not a resolution/aliasing problem, fwidth() couldn't
  // touch it) — a dot SDF can't produce that artifact by construction.
  // Dots and centre dot are weighted by fill, which is 0 on about half the
  // screen (wave <= 0) in coherent blocks: only computed where it is not.
  float innerPattern = 0.0;
  float centerDot = 0.0;
  if (fill > 0.0) {
    vec2 dotCell = fract(gv * 6.0 + vec2(0.12 * sin(t * 0.5), 0.12 * cos(t * 0.4))) - 0.5;
    float dotAA = max(7.6 * px, 0.02);   // ~ fwidth(dotDist)
    innerPattern = 1.0 - smoothstep(0.32 - dotAA, 0.32 + dotAA, length(dotCell));
    // Center dot per hex
    centerDot = 0.01 / (length(gv) + 0.01);
  }

  // one cellColor multiply: edges; inside the cell the idle floor (wave
  // tint), the faint tint every cell gets so the lattice never reads as
  // black on a wall, the dots and the beat flash; plus the centre dot
  float body = fill * 0.3 + (0.1 + 0.1 * wave) + fill * innerPattern * 0.3 + beatFlash;
  vec3 color = cellColor * (edge * (0.8 + uEnergy * 0.2) + (1.0 - edge) * body + centerDot * 0.1 * fill);

  // Vignette, relaxed along a LED strip
  float aspect = uResolution.x / uResolution.y;
  float vig = 1.0 - length(uv / vec2(max(aspect / 1.78, 1.0), 1.0)) * 0.7;
  color *= max(vig, 0.1);

  color *= 1.0 + uBeat * 0.2;
  gl_FragColor = vec4(color, 1.0);
}

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
  float zoom = 5.0 + uBass * 2.0;
  float angle = t * 0.1 + uMid * 0.2;
  float c = cos(angle), s = sin(angle);
  vec2 p = mat2(c, -s, s, c) * uv * zoom;

  vec4 hex = hexCoords(p);
  vec2 gv = hex.xy;  // local coords within hex
  vec2 id = hex.zw;  // hex cell ID

  float cellHash = hash(id);

  // Hex edge distance
  float hexDist = max(abs(gv.x), abs(gv.y * 0.577 + gv.x * 0.5));
  hexDist = max(hexDist, abs(gv.y * 0.577 - gv.x * 0.5));

  // Animated fill — wave propagates outward
  float distFromCenter = length(id) / zoom;
  float wave = sin(distFromCenter * 5.0 - t * 2.0 - uBass * 3.0);
  float fill = smoothstep(0.0, 0.3, wave);

  // Edge glow
  float edge = smoothstep(0.45, 0.48, hexDist);
  float innerEdge = smoothstep(0.35, 0.40, hexDist);

  // Beat: random cells flash
  float beatFlash = step(0.7 - uBeat * 0.5, cellHash) * uBeat;

  // Color per cell
  float colorIndex = mod(cellHash * 3.0, 3.0);
  vec3 cellColor;
  if (colorIndex < 1.0) cellColor = uColor1;
  else if (colorIndex < 2.0) cellColor = uColor2;
  else cellColor = uColor3;

  // Shift color with wave
  cellColor = mix(cellColor, uColor2, wave * 0.3);

  vec3 color = vec3(0.0);

  // Hex edges
  color += cellColor * edge * (0.6 + uEnergy * 0.4);

  // Fill with pattern
  float innerPattern = sin(gv.x * 20.0 + t * 3.0) * sin(gv.y * 20.0 - t * 2.0);
  innerPattern = smoothstep(0.5, 1.0, innerPattern);
  color += cellColor * fill * innerPattern * (1.0 - edge) * 0.3;

  // Beat flash
  color += cellColor * beatFlash * (1.0 - edge) * 1.5;

  // Center dot per hex
  float centerDot = 0.01 / (length(gv) + 0.01);
  color += cellColor * centerDot * 0.1 * fill;

  // Vignette
  float vig = 1.0 - length(uv) * 0.7;
  color *= max(vig, 0.1);

  color *= 1.0 + uBeat * 0.2;
  gl_FragColor = vec4(color, 1.0);
}

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
uniform float cells;
uniform float litratio;
uniform float chaos;

// LED-wall strobe: a grid of cells, a random subset fires on every kick and
// decays with the beat envelope. Hats sparkle single cells.
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 g = vec2(uv.x * aspect, uv.y) * cells;
  vec2 cell = floor(g);
  vec2 f = fract(g);

  // seed advances with the gated bass clock: pattern changes on musical activity
  float seed = floor(uBassTime * 2.0);
  float h = hash(cell + seed * 13.7);

  // kick: subset of cells at full white-hot, envelope from uBassHit
  float lit = step(1.0 - litratio, h);
  float kick = lit * uBassHit;

  // hats: sparse fast sparkles on their own clock
  float h2 = hash(cell * 1.7 + floor(uHighTime * 6.0) * 7.3);
  float spark = step(0.985 - chaos * 0.05, h2) * uHighHit;

  // idle glow so the grid never dies: slow breathing per cell
  float idle = 0.06 + 0.05 * sin(uTime * (0.5 + h * 1.5) + h * TAU) + uEnergy * 0.08;

  // cell shape with a gap and soft edge
  vec2 e = smoothstep(0.0, 0.06, f) * smoothstep(1.0, 0.94, f);
  float shape = e.x * e.y;

  vec3 c1 = mix(uColor1, uColor2, hash(cell + 4.2));
  vec3 color = c1 * (idle + kick * 1.8) * shape;
  color += uColor3 * spark * 2.2 * shape;
  // scan sweep line for motion between kicks
  float sweepPos = fract(uBarPhase);
  float sweepD = abs(uv.x - sweepPos);
  color += uColor2 * smoothstep(0.03, 0.0, sweepD) * 0.25 * shape;

  color = min(color, vec3(2.2));
  gl_FragColor = vec4(color, 1.0);
}

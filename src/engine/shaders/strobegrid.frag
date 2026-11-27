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

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// what one fixture emits. rgb = colour * level, a = how hard the kick drives it
vec4 emit(vec2 cell, float seed, vec2 gridSize) {
  float h = hash(cell + seed * 13.7);
  // idle floor: the lit subset stays visible dim, so the pattern reads in silence
  float lit = step(1.0 - litratio, h);
  // the kick also sends a ring of fixtures out from the centre of the wall:
  // a shape you can read from the back of the room, not only random noise
  float dc = length(cell + 0.5 - gridSize * 0.5) / gridSize.y;
  float ringD = (dc - (1.0 - uBassHit) * 0.9) * 11.0;
  float ring = exp(-ringD * ringD) * uBassHit;
  float drive = max(lit * uBassHit, ring * 0.8);

  // slow breathing per cell so the grid never dies
  float idle = 0.07 + 0.05 * sin(uTime * (0.5 + h * 1.5) + h * TAU) + uEnergy * 0.08;
  // chase: one column per bar runs across the wall with a short tail
  float tail = fract(uBarPhase - (cell.x + 0.5) / gridSize.x);
  float chase = exp(-tail * 14.0) * 0.35;

  // colours in drifting zones, each fixture one palette colour: a per-cell
  // random blend of two complementary colours came out grey
  float zone = vnoise(cell * 0.22 + vec2(seed * 0.37, uTime * 0.05));
  vec3 c = mix(uColor1, uColor2, smoothstep(0.42, 0.58, zone + (hash(cell + 4.2) - 0.5) * 0.25));

  vec3 e = c * (idle + lit * 0.28 + drive * 1.25 + chase);
  // hats: sparse fast sparkles on their own clock
  if (uHighHit > 0.0) { // uniform branch: no hash in frames without a hat
    float h2 = hash(cell * 1.7 + floor(uHighTime * 6.0) * 7.3);
    e += uColor3 * step(0.985 - chaos * 0.05, h2) * uHighHit * 1.6;
  }
  return vec4(e, drive);
}

// LED-wall strobe: a grid of fixtures, a random subset fires on every kick and
// decays with the beat envelope, a ring runs out from the centre, hats sparkle
// single cells. Every fixture spills light on its neighbours.
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 gridSize = vec2(aspect, 1.0) * cells;
  vec2 g = uv * gridSize;
  vec2 cell = floor(g);
  vec2 f = fract(g);

  // seed advances with the gated bass clock: pattern changes on musical activity
  // (plus a slow free-running drift so it does not freeze in silence)
  // wrapped: after half an hour seed*13.7 is ~3e4, sin() in hash() loses
  // precision and every cell went dark
  float seed = mod(floor(uBassTime * 2.0 + uTime * 0.2), 256.0);

  // cell shape with a gap and soft edge
  vec2 ed = smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f);
  float shape = ed.x * ed.y;
  float r2 = dot(f - 0.5, f - 0.5);

  vec3 color = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec4 e = emit(cell + o, seed, gridSize);
      vec2 dv = f - 0.5 - o;
      // spill: the glow of a fixture reaches into the cells around it
      color += e.rgb * exp(-dot(dv, dv) * 2.6) * 0.13;
      if (i == 0 && j == 0) {
        // lens falloff: each cell reads as a fixture, not a flat square;
        // white-hot only in the middle of a fired lens
        color += (e.rgb * (1.0 - 1.3 * r2) + vec3(1.0) * e.a * exp(-r2 * 14.0) * 0.5) * shape;
      }
    }
  }

  // hue-keeping rolloff: a per-channel clip turned every fired cell white
  float mx = max(max(color.r, color.g), max(color.b, 1.0));
  color = mix(color / mx, vec3(1.0), clamp((mx - 1.0) * 0.25, 0.0, 0.5));
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}

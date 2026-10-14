precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float speed;
uniform float density;
uniform float glow;

// Pipes: the classic "3D Pipes" screensaver, raymarched. Space is cut into a
// fixed lattice of cells (domain repeat, same trick as reactor's rings);
// each cell hashes to one of three axis-aligned tube directions with a
// rounded joint at its centre, so neighbouring cells read as a tangled maze
// of elbowed pipework with no per-pipe path to walk or store. `density` is
// the chance a cell is filled at all (empty cells are just void the camera
// flies through) rather than the lattice spacing itself — changing the
// spacing under audio/LFO would re-hash every cell's orientation at once
// and the whole maze would boil; flipping individual cells' fill in and out
// stays calm under continuous modulation.
//
// Each cell's SDF only has local knowledge — a point near a shared face can
// be closer to the NEIGHBOUR's geometry than to this cell's, so `map()`'s
// return value isn't always a trustworthy lower bound near boundaries. The
// standard fix (shrinking it to the cell's own face distance) was tried
// first and stalls the march to a crawl at every single cell crossing,
// empty or not. Instead, like truss/reactor, the *step* is capped to a
// small constant (MAX_STEP, comfortably above a joint's radius) so a bad
// bound can only ever be worth one short, safe hop.
//
// A travelling brightness band (like reactor's idle flow) runs along each
// tube's own axis and keeps the metal looking alive; one cell in ~14 hashes
// into a stubby valve body instead of a joint — the nod to the
// screensaver's teapots, without an actual teapot SDF (ponytail: three
// smin'd spheres, not Utah-teapot geometry — upgrade only if a real teapot
// is ever wanted).

const float CELL = 2.4;
const float TUBE_R = CELL * 0.09;
const float JOINT_R = TUBE_R * 1.2;
const float MAX_STEP = 0.3;

float gFlow;
float gKick;

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  vec3 ic = floor(p / CELL + 0.5);
  vec3 pl = p - ic * CELL;

  float fillH = hash31(ic + vec3(3.3, -7.1, 5.5));
  float fillChance = clamp(0.35 + 0.3 * clamp(density, 0.0, 2.0), 0.35, 0.95);
  if (fillH > fillChance) return MAX_STEP + 0.2;

  float h = hash31(ic);
  float axisF = floor(h * 3.0);
  float tube = axisF < 0.5 ? length(pl.yz) - TUBE_R
             : axisF < 1.5 ? length(pl.xz) - TUBE_R
             :               length(pl.xy) - TUBE_R;

  float valveH = hash31(ic + vec3(91.3, 17.7, 53.1));
  if (valveH > 0.93) {
    float body = length(pl) - JOINT_R * 1.5;
    vec3 sp = vec3(JOINT_R * 1.4, JOINT_R * 0.25, 0.0);
    float spout = length(pl - sp) - JOINT_R * 0.45;
    vec3 hd = vec3(-JOINT_R * 1.2, JOINT_R * 0.1, 0.0);
    float handle = length(pl - hd) - JOINT_R * 0.38;
    float valve = smin(smin(body, spout, 0.06), handle, 0.06);
    return min(tube, valve);
  }
  float joint = length(pl) - JOINT_R;
  return smin(tube, joint, 0.05);
}

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.003;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

float march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.1;
  for (int i = 0; i < 100; i++) {
    if (t > tmax) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    gFlow += clamp(d, 0.03, 0.5) * 0.06;
    if (d < 0.003) return t;
    t += clamp(d * 0.9, 0.02, MAX_STEP);
  }
  return -1.0;
}

vec3 shade(vec3 p, vec3 rd) {
  vec3 n = normalAt(p);
  vec3 ic = floor(p / CELL + 0.5);
  vec3 pl = p - ic * CELL;
  float h = hash31(ic);
  float axisF = floor(h * 3.0);
  float alongCoord = axisF < 0.5 ? pl.x : axisF < 1.5 ? pl.y : pl.z;
  float along = alongCoord / (CELL * 0.5);

  vec3 L = normalize(vec3(0.4, 1.0, -0.3));
  float diff = max(dot(n, L), 0.0);
  vec3 metal = mix(uColor2, vec3(0.65), 0.55) * 0.4;
  vec3 c = metal * (0.35 + 0.8 * diff);

  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  c += uColor1 * rim * 0.25;

  // flow band travels along the tube's own axis, pulsing on the beat
  float band = 0.5 + 0.5 * sin(along * 6.28 - uBeatClock * 6.28);
  c += mix(uColor2, uColor1, band) * (0.15 + 0.5 * glow) * (0.4 + gKick);

  float valveH = hash31(ic + vec3(91.3, 17.7, 53.1));
  if (valveH > 0.93) {
    c += uColor3 * 0.3 * (0.6 + 0.6 * diff);
  }
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFlow = 0.0;

  float spd = clamp(speed, 0.1, 3.0) * (0.7 + 0.5 * uEnergy);
  vec3 ro = vec3(0.6 * sin(uTime * 0.07), 0.5 * sin(uTime * 0.05 + 1.3), uTime * spd * 1.4);
  float drift = 0.1 * sin(uTime * 0.09);
  float cs = cos(drift), sn = sin(drift);
  vec3 rd = normalize(vec3(uv, 1.3));
  rd.xy = mat2(cs, -sn, sn, cs) * rd.xy;

  float t = march(ro, rd, 28.0);
  vec3 col;
  if (t > 0.0) {
    vec3 p = ro + rd * t;
    col = shade(p, rd);
    col = mix(uColor2 * 0.05, col, exp(-t * 0.05));
  } else {
    col = uColor2 * 0.04 + uColor1 * 0.02 * (0.5 - uv.y);
  }

  col += mix(uColor1, uColor3, 0.3) * gFlow * 0.025 * clamp(glow, 0.3, 2.0);
  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.85, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

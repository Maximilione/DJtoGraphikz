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

uniform float strobe;
uniform float fixtures;
uniform float spin;

// Truss: a triangular aluminium stage rig seen from below, raymarched, that
// recedes to a vanishing point overhead. Three continuous rails plus a
// triangular frame every period form the structure (an IQ-style box-frame
// would not fit a triangle, so the frame is three line segments extruded
// thin along z). PAR/moving-head fixtures hang from the bottom rails every
// frame; their cones are gathered into the fog exactly like monolith/
// cathedral gather their glow — once per march step, against the nearest
// two frames, closed-form distance to the cone axis, no extra marching.
// The kick fires the fixtures white/red: `strobe` also spreads a per-fixture
// hash delay across them, so higher values read as a chase instead of a
// single all-together flash. A few fixtures (picked by hash) pan slowly,
// scaled by `spin`, like real moving heads.

const float RAIL_Y = 0.55;
const float RAIL_R = 1.05;
const vec2 C0 = vec2(0.0, RAIL_Y + RAIL_R);
const vec2 C1 = vec2(-0.91, RAIL_Y - 0.55 * RAIL_R);
const vec2 C2 = vec2(0.91, RAIL_Y - 0.55 * RAIL_R);

float gP; // active frame period, set in main() from `fixtures`
float gInvP;
// camera z and fixture hashes wrap every ZWRAP frames: the geometry is
// periodic in gP so the wrap is invisible, and the hash arguments stay small
// (after two hours an unbounded z put ~2.5e5 into sin(), where this hash
// degrades: strobegrid documents the same failure)
const float ZWRAP = 64.0;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float sdSeg2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float rails(vec3 p) {
  float r = 0.07;
  float d0 = length(p.xy - C0) - r;
  float d1 = length(p.xy - C1) - r;
  float d2 = length(p.xy - C2) - r;
  return min(d0, min(d1, d2));
}

float map(vec3 p) {
  float dr = rails(p);
  // frame = max(e - 0.045, |zl| - 0.05) >= |zl| - 0.05: when the slab in z
  // is already further than the rails the three segments cannot win the
  // min, so skip them (exact; true on most steps, the frames are thin)
  float zl = p.z - floor(p.z * gInvP + 0.5) * gP;
  float dz = abs(zl) - 0.05;
  if (dz >= dr) return dr;
  float e = min(sdSeg2(p.xy, C0, C1), min(sdSeg2(p.xy, C1, C2), sdSeg2(p.xy, C2, C0)));
  return min(dr, max(e - 0.045, dz));
}

// tetrahedron normal: four map() calls instead of six
vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.02;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// One fixture: position, aim and colour depend on (frame, side) and the
// uniforms only, so they are built once per frame crossing in the march
// instead of 4x per step (the ray crosses ~14 frames, the march has 64 steps).
struct Fix { vec3 pos; vec3 aim; vec3 col; };

Fix mkFix(float zc, float side) {
  float zh = mod(zc, ZWRAP);
  float h = hash11(zh * 3.1 + side * 7.7);
  float h2 = hash11(zh * 1.7 + side * 2.3 + 11.0);
  Fix f;
  f.pos = vec3(side < 0.0 ? C1 : C2, zc * gP);
  float rot = h2 > 0.65 ? spin * (uTime * 0.6 + h * 6.28) : 0.0;
  f.aim = normalize(vec3(side * (0.25 + 0.3 * sin(rot)), -1.0, 0.35 + 0.3 * cos(rot) * step(0.65, h2)));
  float chase = clamp(uBassHit * (1.3 + 0.4 * strobe) - h * (0.3 + 0.7 * strobe), 0.0, 1.0);
  vec3 fc = h > 0.5 ? mix(uColor2, vec3(1.0), 0.6) : mix(uColor1, vec3(1.0), 0.6);
  f.col = fc * (0.22 + 1.4 * chase + 0.15 * uBass);
  return f;
}

// the fixture's volumetric cone, gathered into `glow` for the sample p
void coneAt(Fix f, vec3 p, float dt, inout vec3 glow) {
  vec3 toP = p - f.pos;
  float along = dot(toP, f.aim);
  if (along <= 0.0) return;
  // squared distance to the axis: |toP|^2 - along^2 (aim is unit), no sqrt;
  // the two exponentials merged into one
  float d2 = max(dot(toP, toP) - along * along, 0.0);
  float w = (0.06 + 0.1 * along) * (1.0 + 0.6 * uBassHit);
  float g = exp(-d2 / (w * w) - along * 0.07);
  glow += f.col * g * dt;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  gP = clamp(60.0 / max(fixtures, 1.0), 3.0, 16.0);
  gInvP = 1.0 / gP;

  vec3 ro = vec3(0.0, -1.9, mod(uTime * 0.9, gP * ZWRAP));
  vec3 rd = normalize(vec3(uv.x, uv.y * 1.05 + 0.32, 1.1));

  vec3 glow = vec3(0.0);
  float t = 0.1;
  bool hit = false;
  vec3 p = ro;
  float zcPrev = -1e4;
  Fix fA, fB, fC, fD;
  for (int i = 0; i < 64; i++) {
    p = ro + rd * t;
    float d = map(p);
    float dt = clamp(d, 0.05, 0.6);
    float zc = floor(p.z * gInvP + 0.5);
    if (zc != zcPrev) { // neighbouring pixels cross frames on the same steps
      zcPrev = zc;
      fA = mkFix(zc, -1.0);
      fB = mkFix(zc, 1.0);
      fC = mkFix(zc + 1.0, -1.0);
      fD = mkFix(zc + 1.0, 1.0);
    }
    coneAt(fA, p, dt, glow);
    coneAt(fB, p, dt, glow);
    coneAt(fC, p, dt, glow);
    coneAt(fD, p, dt, glow);
    if (d < 0.01) { hit = true; break; }
    t += dt;
    if (t > 42.0) break;
  }

  vec3 col = vec3(0.0);
  vec3 steel = mix(uColor2, vec3(0.6), 0.55) * 0.4;
  if (hit) {
    vec3 n = normalAt(p);
    vec3 L = normalize(vec3(0.3, 1.0, -0.2));
    float diff = max(dot(n, L), 0.0);
    float rf = 1.0 - max(dot(n, -rd), 0.0);
    float rim = rf * rf * rf;
    col = steel * (0.45 + 0.8 * diff);
    col += uColor1 * 0.08;
    col += uColor3 * rim * (0.15 + 0.5 * kick);
  } else {
    col = uColor2 * 0.03 + uColor1 * 0.02 * smoothstep(1.0, -0.4, uv.y);
    float rz = max(rd.z, 0.0);
    float r2 = rz * rz, r4 = r2 * r2, r8 = r4 * r4;
    col += uColor3 * 0.08 * (r8 * r8 * r8) * (0.5 + 0.6 * kick); // ^24
  }

  col += glow * 0.18;
  // floor of brightness: the rig must still read at bass=energy=beat=0
  col += mix(uColor1, uColor2, 0.4) * 0.05;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.7, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

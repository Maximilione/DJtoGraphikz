precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMid;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;

uniform float arms;
uniform float twist;
uniform float burst;

varying float vRad;
varying float vSeed;
varying float vGain;

// A galaxy of ~590k points, placed entirely here: no simulation buffer, no
// CPU work. Every point is a pure function of its index and the clock, so the
// whole cloud is the same on both windows and costs one hash per vertex.
// Spiral arms with differential rotation (the core turns faster than the rim),
// a thin disc seen from a tilted camera that slowly swings. The kick is a
// shockwave: a ring races outwards through the disc, shoving the stars it
// crosses, and the whole cloud breathes out and falls back.

// The index is split in two before it is scaled: fract(n * 0.1031) on a
// 590k float32 index quantises to a few hundred levels, so thousands of stars
// landed on the very same spot and the cloud was ~10k stars drawn 59 times.
vec3 hash3(float n) {
  float lo = mod(n, 1024.0);
  float hi = floor(n / 1024.0);
  vec3 p = fract(vec3(lo * 0.1031 + hi * 0.2371,
                      lo * 0.1030 + hi * 0.3917,
                      lo * 0.0973 + hi * 0.6193));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xxy + p.yzz) * p.zyx);
}

void main() {
  float id = float(gl_VertexID);
  vec3 h = hash3(id);
  vec3 g = hash3(id + 7919.0);

  float nArms = floor(clamp(arms, 1.0, 6.0) + 0.5);
  float kick = clamp(uBassHit, 0.0, 1.0);
  // bass-driven clock: a breakdown freezes the spin instead of coasting
  float clk = mod(uBassTime * 0.6 + uTime * 0.12, 6283.0);

  // ~2% of the points are big soft halos: the glow of the core and of the arms,
  // always there, spread over the disc by area (the stars crowd the core)
  float halo = step(0.98, fract(g.y * 37.0));
  // radius: dense core, long thin rim
  float r = mix(pow(h.x, 1.7) * 1.35, sqrt(h.x) * 1.3, halo) + 0.02;
  // shockwave ring: stars near the front are kicked outwards
  float front = fract(uBeatClock * 0.25) * 1.5;
  float wave = exp(-pow((r - front) * 6.0, 2.0)) * (1.0 - front / 1.5);
  float push = burst * (0.25 * kick * (0.4 + g.x) + 0.28 * wave);
  float rr = r * (1.0 + push) + burst * 0.1 * kick * g.y;

  float arm = floor(h.y * nArms);
  // differential rotation: angular speed falls with radius
  float spin = clk * 1.6 / (0.35 + r);
  float scatter = (g.z - 0.5) * 2.5 / (0.6 + 4.0 * r);
  float a = arm * 6.2831853 / nArms + r * twist * 2.4 + scatter + spin;

  float thick = 0.07 * exp(-r * 2.2) + 0.012;
  float y = (hash3(id + 31.0).x - 0.5) * 2.0 * thick * (1.0 + 2.0 * uMid * g.x);
  vec3 p = vec3(cos(a) * rr, y, sin(a) * rr);

  // camera: tilted, swinging with the bar so it never sits still
  float tilt = 0.95 + 0.22 * sin(mod(uBeatClock * 0.05, 6.2831853));
  float yaw = mod(uBeatClock * 0.02 + uTime * 0.02, 6.2831853);
  float cy = cos(yaw), sy = sin(yaw);
  p = vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
  float ct = cos(tilt), st = sin(tilt);
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);

  float dist = 2.6 - 0.25 * kick;
  float z = p.z + dist;
  float inv = 1.9 / max(z, 0.3);
  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(p.x * inv / aspect, p.y * inv, 0.0, 1.0);

  vRad = clamp(r / 1.35, 0.0, 1.0);
  vSeed = h.z;
  // nearer stars bigger and brighter; the core is dense so each star is dimmer
  float near = clamp(inv * 0.55, 0.5, 1.8);
  float size = mix(3.2 + 1.8 * g.y * g.y, 32.0, halo) * near * (1.0 + 0.35 * uBeat + 0.3 * wave);
  float ps = size * sqrt(uResolution.y / 1080.0);
  // the crowded core is dimmed per star (it piles up and burns out to a flat
  // white spot); the rim stars are sparse and carry the gain; halos light the
  // core and arms softly
  float starGain = 0.2 + 6.0 * vRad * vRad;
  float haloGain = 1.5 * (0.5 + 0.8 * exp(-vRad * 4.0));
  vGain = near * mix(starGain, haloGain, halo) * (1.0 + 0.5 * wave + 0.4 * kick);
  gl_PointSize = (ps > 0.0 && ps < 1e4) ? clamp(ps, 1.5, mix(8.0, 48.0, halo)) : 2.0;
}

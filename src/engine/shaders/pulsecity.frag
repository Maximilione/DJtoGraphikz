precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatClock;
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

#define TAU 6.28318530718
#define STEPS 40                       // lots the DDA may cross: 28 units of haze along a diagonal
#define REACH 28.0                     // past this the haze has swallowed everything
#define HMAX 16.0                      // no tower is taller: a ray climbing past it is in the void
#define FOGK 0.13

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float columns;
uniform float gapw;
uniform float punch;

// Megacity: a monumental brutalist city seen from the floor of its main
// avenue, gliding slowly towards a stepped megastructure split by a slit of
// light. Everything is backlit by that slit: the towers are dark masses with a
// burning edge, the canyon walls are chrome slabs that mirror the haze, the
// void above is black. Portals — two pylons and a deck — span the avenue.
// Real 3D: one grid DDA over the lots, two boxes per tower (a base and a
// setback), closed-form height haze.
//   kick  - a light pulse climbs the facades and the slit from the base, slabs
//           flash in sequence, the avenue strips fire away from the camera
//   bass  - pushes the glide forward (uBassTime), feeds the slit and the seams
//   mid   - a holographic scan sweeps down the avenue and leaves the cladding grid lit
//   highs - sparks drifting up the canyon
//   energy- more lasers across the cross streets, a brighter fan of beams
// columns = how much of the city is built (towers assemble in panels, in place),
// gapw = how slender the towers are (the streets widen), punch = the kick's light.

vec3 gRo, gRd, gInv;                   // camera ray
vec4 gCam;                             // cos/sin of its pitch and yaw
vec2 gRoll;
vec3 gHazeC;                           // the colour of the lit haze
float gKick, gLight, gDens, gHalf, gSeq, gScanZ, gScanI, gScanY;
float gPx;                             // one pixel at distance 1, in world units

const vec3 GATE = vec3(0.0, 0.1191, 0.9929);          // towards the slit, a little above the horizon

float lineAA(float d, float w, float aa) { return clamp((w - d) / aa + 0.5, 0.0, 1.0) * min(1.0, 2.0 * w / aa); }
float bandAA(float x, float lo, float hi, float aa) { return smoothstep(lo - aa, lo + aa, x) - smoothstep(hi - aa, hi + aa, x); }
bool portal(float cz) { return mod(cz, 12.0) == 6.0; }

// One lot, before assembly. x: its full height (0 = empty), y: its random,
// z: 1 megatower, 2 the deck of a portal (w: the deck's underside).
vec4 lot(vec2 c) {
  bool gate = portal(c.y);
  if (c.x == 0.0) return gate ? vec4(3.3, 0.37, 2.0, 2.6) : vec4(0.0);   // the avenue
  if (mod(c.y, 4.0) == 0.0) return vec4(0.0);                            // a cross street every 4 rows
  float r = hash(mod(c, 512.0));
  if (gate && abs(c.x) == 1.0) return vec4(11.0 + 4.0 * r, r, 1.0, 0.0);      // the pylons of a portal
  float mega = step(0.93, fract(r * 113.1));
  return vec4(mix((1.2 + 4.0 * r * r) * (1.0 + 0.22 * min(abs(c.x) - 1.0, 5.0)), 9.5 + 6.0 * r, mega), r, mega, 0.0);
}

// Assembly: `columns` moves a threshold over a per-lot rank, so a tower is built
// up or taken apart where it stands; a slow wave keeps some in progress. Turns
// a lot into x: top of what stands (0 = nothing yet), w: how high it is solid —
// between w and x only some panels are in place.
vec4 assemble(vec4 L) {
  if (L.z > 0.5) return vec4(L.xyz, L.z > 1.5 ? L.w : 99.0);
  float a = clamp((gDens - fract(L.y * 37.7 + 0.3)) * 4.0 + 0.5 + 0.35 * sin(uTime * 0.11 + L.y * TAU), 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a);
  float solid = L.x * a;
  return vec4(solid + (L.x - solid) * 0.6 * smoothstep(0.0, 0.3, a), L.y, 0.0, solid);
}

// massing of a tower: half footprint of the base, of the setback, height of the step
void massing(vec2 c, float r, float mega, out vec2 hw, out vec2 hu, out float hA) {
  hw = gHalf * vec2(0.72 + 0.28 * fract(r * 17.3), 0.72 + 0.28 * fract(r * 29.1));
  hu = hw * (0.55 + 0.25 * fract(r * 41.0));
  hA = mix(0.8 + 2.4 * fract(r * 7.7), 4.5 + 3.5 * fract(r * 7.7), mega);
  if (abs(c.x) == 1.0 && portal(c.y)) { hw = vec2(0.5, 0.4); hu = vec2(0.36, 0.3); hA = 7.5; }   // flush with the deck
}

// ray against an axis-aligned box: entry distance (or -1) and the face it enters by
float box(vec3 lo, vec3 hi, out vec3 n) {
  vec3 a = (lo - gRo) * gInv, b = (hi - gRo) * gInv;
  vec3 mn = min(a, b), mx = max(a, b);
  float tn = max(max(mn.x, mn.y), mn.z), tf = min(min(mx.x, mx.y), mx.z);
  n = vec3(0.0);
  if (tn > tf || tn < 0.0) return -1.0;
  n = mn.x > mn.y ? (mn.x > mn.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0))
                  : (mn.y > mn.z ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  n *= -sign(gRd);
  return tn;
}

// optical depth of the haze along the ray up to t: a thin uniform veil plus a
// layer that hugs the ground (exponential in height), integrated exactly
float fogInt(float t) {
  float a = 0.35 * gRd.y;
  float e = abs(a) > 1e-4 ? (1.0 - exp(-a * t)) / a : t;
  return FOGK * (0.3 * t + 0.7 * exp(-0.35 * gRo.y) * e);
}

// what the haze scatters towards the eye: bright along the ground and around
// the slit, black overhead
vec3 haze(vec3 rd) {
  float band = exp(-max(rd.y, 0.0) * 4.5);
  float g = max(dot(rd, GATE), 0.0);
  float g2 = g * g, g8 = g2 * g2 * g2 * g2;
  return gHazeC * gLight * (0.1 * band + 0.5 * g8 * g2 * (0.3 + 0.7 * band) + 0.2 * g2 * g * band);
}

// everything too far to march: the haze and the megastructure at the end of the
// avenue — a stepped mass, its two central slabs parted by a slit of light,
// a slow fan of beams behind it
vec3 backdrop(vec3 rd) {
  vec3 col = haze(rd);
  if (rd.z > 0.15 && rd.y > -0.03) {
    vec2 g = rd.xy / rd.z;
    float ax = abs(g.x);
    float fan = 0.5 + 0.5 * cos((atan(g.x, g.y + 0.1) - 0.3 * sin(uTime * 0.05)) * 9.0);
    fan *= fan; fan *= fan; fan *= fan;
    col += gHazeC * fan * fan * exp(-length(g) * 1.1) * gLight * (0.07 + 0.2 * uEnergy);
    float i = floor(ax / 0.09);
    float top = 1.3 * exp(-i * 0.5) * (0.82 + 0.36 * hash(vec2(i, step(0.0, g.x) + 3.0))) * step(i, 5.5);
    float inside = (1.0 - smoothstep(top - 0.003, top + 0.003, g.y)) * smoothstep(0.006, 0.010, ax);
    float lit = exp(-ax * 6.0);                                   // the inner faces catch the slit
    float decks = 0.8 + 0.2 * smoothstep(0.05, 0.3, abs(fract(g.y * 40.0) - 0.5));
    vec3 body = gHazeC * gLight * (0.01 + 0.4 * lit * lit) * decks;
    vec2 wi = floor(g * vec2(0.26, 0.19) / gPx);                  // its lights: cells a few pixels wide at any resolution
    float wl = step(0.86, hash(wi)) * smoothstep(0.6, 1.0, fract(g.y * 2.1 - gSeq * 0.5 + i * 0.3));
    body += mix(vec3(1.0), uColor1, 0.35) * wl * (0.05 + 0.25 * gKick);
    col = mix(col, body, inside * (0.5 + 0.4 * smoothstep(0.0, 0.5, g.y)));       // its feet are lost in the ground haze
    // the slit: a core, a halo, and above the slabs a pillar fading into the void
    float vert = (g.y < 1.1 ? 1.0 : exp(-(g.y - 1.1) * 1.6)) * smoothstep(-0.03, 0.03, g.y);
    float front = exp(-abs(g.y - (1.0 - uBassHit) * 1.1) * 12.0) * gKick;        // the kick climbs it from the base
    col += (vec3(1.6) * exp(-ax * ax * 28000.0) + mix(gHazeC, uColor2, 0.45) * 0.4 * exp(-ax * 14.0)) * vert * gLight
         + vec3(1.2) * front * exp(-ax * 40.0);
  }
  return col;
}

// lit windows at one scale of the facade grid: strips of light two bays long
float windows(vec2 g, vec2 aa, float seed, float more) {
  vec2 f = fract(g), i = floor(g);
  return step(0.9 - 0.45 * more, hash(vec2(floor(i.x * 0.5), i.y) + seed))
       * bandAA(f.x, 0.06, 0.94, aa.x) * bandAA(f.y, 0.36, 0.64, aa.y);
}

vec3 shadeTower(vec3 p, vec3 n, vec4 L, vec2 c, float t) {
  float r = L.y;
  bool deck = L.z > 1.5;
  float mega = min(L.z, 1.0);
  float px = gPx * t;
  if (n.y > 0.5) return gHazeC * 0.012 * gLight;                  // roofs: dark slabs
  if (n.y < -0.5) {                                               // under a deck: coffers and two runs of light
    vec2 q = abs(fract(p.xz * vec2(6.0, 10.0)) - 0.5);
    float lamp = lineAA(abs(abs(p.z - c.y - 0.5) - 0.16), 0.014, px * 3.0);
    return gHazeC * gLight * 0.03 * (1.0 - smoothstep(0.42, 0.5, max(q.x, q.y)))
         + mix(vec3(1.0), uColor1, 0.3) * lamp * (0.7 + 0.6 * uBass + 1.5 * gKick);
  }
  vec2 hw, hu; float hA;
  massing(c, r, mega, hw, hu, hA);
  bool xf = abs(n.x) > 0.5;                                       // a wall along the avenue, or one across it
  bool up = p.y > hA;
  float u = xf ? p.z : p.x;
  float uc = u - (xf ? c.y : c.x) - 0.5;                          // along the face, from the middle of the lot
  float hf = deck ? 0.6 : xf ? (up ? hu.y : hw.y) : (up ? hu.x : hw.x);
  float topB = up || deck ? L.x : min(hA, L.x);

  // cladding at two scales: slabs with a joint between them, and inside each
  // the fins and floors of an inhabited wall — small, so the wall reads as vast
  vec2 sg = vec2(u * 3.0, p.y * 2.0), sf = fract(sg), si = floor(sg);
  vec2 fg = vec2(u * 26.0, p.y * 34.0), ff = fract(fg);
  vec2 af = px * vec2(26.0, 34.0);
  vec2 lod = 1.0 - smoothstep(0.1, 0.45, af);                     // fins and floors thin out before they can shimmer
  float sh = hash(si + r * 91.0 + (xf ? 0.0 : 7.0));
  vec2 es = min(sf, 1.0 - sf), ef = min(ff, 1.0 - ff);
  float joint = max(lineAA(es.x, min(0.01, px * 4.0), px * 3.0), lineAA(es.y, min(0.007, px * 2.7), px * 2.0));
  float relief = (1.0 - 0.1 * lod.x * (1.0 - smoothstep(0.0, 0.2 + af.x, ef.x)))
               * (1.0 - 0.36 * lod.y * (1.0 - smoothstep(0.0, 0.14 + af.y, ef.y)));

  // each slab is tilted a hair: brushed metal that mirrors the haze and the
  // slit; the ground mist lights the foot of every wall and the void takes the top
  vec3 nf = normalize(n + (xf ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)) * (sh - 0.5) * 0.16
                        + vec3(0.0, 1.0, 0.0) * (fract(sh * 31.0) - 0.5) * 0.1);
  float fres = pow(1.0 - max(dot(-gRd, n), 0.0), 3.0);
  vec3 col = gHazeC * gLight * (xf ? 1.0 : 0.45) * (0.035 + 0.1 * exp(-p.y * 0.45))
           + backdrop(reflect(gRd, nf)) * (0.16 + 0.7 * fres);
  col *= (0.7 + 0.3 * sh) * relief * (1.0 - 0.7 * joint) * mix(0.3, 1.0, smoothstep(0.0, 1.2, p.y));   // and the street's occlusion

  // edge light: the corner turned to the slit burns, the others and the parapet catch a little
  float wl = min(0.006, px * 1.3);
  float rim = lineAA(hf - abs(uc), wl, px * 1.5) * (xf ? 0.1 + 0.9 * step(0.0, uc) : 0.2)
            + lineAA(topB - p.y, wl, px * 1.5) * 0.3
            + (xf ? 0.3 * exp(-(hf - uc) * 16.0) : 0.0);
  if (deck) rim += lineAA(p.y - L.w, 0.012, px * 1.5) * 1.6;      // the deck's lower lip is a light
  col += gHazeC * gLight * rim;

  // windows: a few lit on each floor, in bands that climb the facade; on a
  // kick whole slabs light up, a different set each beat
  float seq = step(0.8, hash(si + r * 13.0 + floor(uBeatClock) * 0.37)) * min(gKick, 1.0);
  // (far away the same grid is read an octave coarser at a time, so a window
  // never gets smaller than a few pixels and the city lights do not fizz)
  float lvl = max(log2(af.y / 0.18), 0.0), l0 = floor(lvl);
  float ws = exp2(-l0), seed = r * 57.0 + (xf ? 0.0 : 3.0) + l0 * 13.1;
  float win = mix(windows(fg * ws, af * ws, seed, seq), windows(fg * ws * 0.5, af * ws * 0.5, seed + 13.1, seq), lvl - l0);
  float chase = smoothstep(0.5, 1.0, fract(p.y * 0.24 - gSeq + r * 5.0));
  col += mix(vec3(1.0), uColor1, 0.3) * win * (0.12 + 0.88 * max(chase, seq)) * (0.9 + 0.65 * uBass + 1.5 * gKick);

  // kick: the base floods with light and a front of it climbs as the hit decays
  float front = (1.0 - uBassHit) * (4.0 + 5.0 * mega);
  col += mix(uColor1, vec3(1.0), 0.6) * relief
       * (exp(-p.y * 2.4) * (0.02 + 0.55 * gKick) + exp(-abs(p.y - front) * 3.5) * gKick * 0.4);

  // scan: a plane travelling down the avenue, the cladding grid lit in a band
  // behind it; and a slower horizontal line climbing every facade at once
  float dz = p.z - gScanZ;
  float grid = max(joint, 0.3 * lod.y * (1.0 - smoothstep(0.0, 0.1 + af.y, ef.y)));
  col += uColor3 * gScanI * (exp(-abs(dz) * 14.0) * (xf ? 0.8 : 0.3) + step(dz, 0.0) * exp(dz * 2.2) * grid * 0.9);
  col += mix(uColor3, vec3(1.0), 0.5) * exp(-abs(p.y - gScanY) * 50.0) * 0.55 * gScanI * (1.0 - smoothstep(7.0, 10.0, gScanY));

  // megatowers: a seam of light down the middle of every face, in a dark recess
  if (mega > 0.5 && !deck) {
    col *= 0.3 + 0.7 * smoothstep(0.015, 0.06, abs(uc));
    col += mix(uColor2, vec3(1.0), 0.5) * lineAA(abs(uc), 0.006, px * 1.5) * (0.45 + 1.0 * uBass + 0.8 * gKick);
  }
  // panels still being placed: holographic outlines
  if (!deck && p.y > L.w) col += uColor3 * (0.03 + 0.6 * joint);
  return col;
}

vec3 shadeGround(vec3 p, float t) {
  float px = gPx * t / max(-gRd.y, 0.04);                      // the footprint stretches at grazing angles
  float fres = pow(1.0 - max(-gRd.y, 0.0), 4.0);
  vec3 col = backdrop(vec3(gRd.x, -gRd.y, gRd.z)) * (0.08 + 0.6 * fres);          // polished slab: the slit lies on it as a streak
  vec2 g = abs(fract(p.xz + 0.5) - 0.5);
  col += uColor3 * max(lineAA(g.x, 0.006, px), lineAA(g.y, 0.006, px)) * 0.22 * exp(-t * 0.08);   // the survey grid of the lots
  // light strips along the avenue: on a kick a pulse runs down them, away from the camera
  float dzc = p.z - gRo.z;
  float pulse = exp(-abs(dzc - (1.0 - uBassHit) * 22.0) * 0.5) * gKick;
  col += mix(uColor1, vec3(1.0), 0.4) * lineAA(min(abs(p.x - 0.07), abs(p.x - 0.93)), 0.01, px) * (0.45 + 2.5 * pulse);
  return col + uColor1 * gKick * 0.05 * exp(-dzc * 0.15);
}

// lasers strung across the cross streets, two to a street, crossing
vec3 lasers(float tMax) {
  vec3 acc = vec3(0.0);
  if (gRd.z < 0.05) return acc;
  float base = floor((gRo.z - 0.5) / 4.0);
  float level = 0.3 + 0.75 * uEnergy;                             // energy brings more of them in
  for (int j = 1; j <= 5; j++) {
    float m = base + float(j);
    float dzk = m * 4.0 + 0.5 - gRo.z;
    float tk = dzk / gRd.z;
    if (tk > tMax) break;
    vec2 q = gRo.xy + gRd.xy * tk;
    float h = hash(vec2(mod(m, 384.0), 5.0));
    float s = (fract(h * 57.3) - 0.5) * 1.1;
    float y0 = 1.2 + 4.5 * fract(h * 13.7);
    float d1 = abs(q.y - y0 - s * (q.x - 0.5)) / sqrt(1.0 + s * s);
    float d2 = abs(q.y - y0 * 0.6 - 0.8 + s * 0.7 * (q.x - 0.5)) / sqrt(1.0 + 0.49 * s * s);
    float w = 0.010 + 1.4 * gPx * tk;
    float core = (1.0 - smoothstep(0.0, w, d1)) + (1.0 - smoothstep(0.0, w, d2));
    vec3 c = mix(uColor1, uColor3, step(0.5, fract(h * 7.1)));
    acc += (mix(c, vec3(1.0), 0.6) * core * 1.3 + c * (exp(-d1 * 7.0) + exp(-d2 * 7.0)) * 0.22)
         * smoothstep(h - 0.12, h + 0.12, level)
         * exp(-FOGK * 0.8 * tk) * (1.0 - smoothstep(15.0, 21.0, dzk)) * smoothstep(0.0, 0.6, dzk);
  }
  return acc * (0.75 + 0.6 * gKick);
}

// sparks: motes on planes across the avenue, so they pass the camera with real parallax
vec3 sparks(float tMax) {
  vec3 acc = vec3(0.0);
  if (gRd.z < 0.05) return acc;
  float base = floor(gRo.z / 0.8);
  for (int j = 1; j <= 5; j++) {
    float m = base + float(j);
    float dzp = m * 0.8 - gRo.z;
    float tp = dzp / gRd.z;
    if (tp > tMax) break;
    float seed = mod(m, 96.0);
    vec2 q = (gRo.xy + gRd.xy * tp) * 2.5
           + vec2(seed * 3.7, -(uTime * 0.05 + uHighTime * 0.22) * (0.6 + 0.8 * hash(vec2(seed, 1.0))));
    vec2 id = floor(q);
    float h = hash(id + seed);
    float d = length(fract(q) - 0.5 - (vec2(h, fract(h * 37.0)) - 0.5) * 0.7);
    float s = (1.0 - smoothstep(0.0, max(0.022, 3.0 * gPx * tp), d)) * step(0.6, fract(h * 91.0));
    acc += mix(uColor3, vec3(1.0), 0.45) * s * (0.5 + 0.5 * sin(uHighTime * 5.0 + uTime * 0.7 + h * 40.0))
         * smoothstep(0.15, 0.7, tp) * (1.0 - smoothstep(3.0, 4.0, dzp)) * exp(-0.06 * tp);
  }
  return acc * (0.3 + 2.0 * uHigh + 2.5 * uHighHit);
}

// one ray through the scene
vec3 view(vec2 fc) {
  vec3 ro = gRo;
  vec2 uv = (fc - 0.5 * uResolution) / uResolution.y;
  uv = mat2(gRoll.x, -gRoll.y, gRoll.y, gRoll.x) * uv;
  vec3 rd = normalize(vec3(uv, 0.85));
  float cp = gCam.x, sp = gCam.y, cy = gCam.z, sy = gCam.w;
  rd.yz = vec2(rd.y * cp + rd.z * sp, rd.z * cp - rd.y * sp);
  rd.xz = vec2(rd.x * cy + rd.z * sy, rd.z * cy - rd.x * sy);
  vec3 sg = sign(rd) + 1.0 - abs(sign(rd));                       // never 0
  rd = sg * max(abs(rd), 1e-5);

  gRd = rd; gInv = 1.0 / rd;

  // grid DDA over the lots
  vec2 cell = floor(ro.xz), stp = sign(rd.xz), inv = abs(gInv.xz);
  vec2 side = (cell - ro.xz + max(stp, 0.0)) * gInv.xz;
  float t0 = 0.0, tHit = 1e3, mat = 0.0, beacon = 0.0;
  vec3 nHit = vec3(0.0);
  vec4 lHit = vec4(0.0);
  vec2 cHit = vec2(0.0);
  for (int i = 0; i < STEPS; i++) {
    float t1 = min(side.x, side.y);
    float yb = ro.y + rd.y * t1;
    vec4 L = lot(cell);
    float ya = min(ro.y + rd.y * t0, yb);
    if (ya < L.x) L = assemble(L);                                // only the lots the ray can touch
    if (L.x > 0.0) {
      if (ya < L.x) {
        vec2 m = cell + 0.5, hw, hu; float hA;
        vec3 n, n2;
        float th;
        if (L.z > 1.5) {
          th = box(vec3(cell.x, L.w, m.y - 0.3), vec3(cell.x + 1.0, L.x, m.y + 0.3), n);
          if (th > 0.0) { tHit = th; nHit = n; lHit = L; cHit = cell; mat = 1.0; break; }
        } else {
          massing(cell, L.y, L.z, hw, hu, hA);
          th = box(vec3(m.x - hw.x, 0.0, m.y - hw.y), vec3(m.x + hw.x, min(hA, L.x), m.y + hw.y), n);
          if (L.x > hA) {
            float t2 = box(vec3(m.x - hu.x, hA, m.y - hu.y), vec3(m.x + hu.x, L.x, m.y + hu.y), n2);
            if (t2 > 0.0 && (th < 0.0 || t2 < th)) { th = t2; n = n2; }
          }
        }
        if (th > 0.0) {
          vec3 p = ro + rd * th;
          bool keep = true;
          if (p.y > L.w + 1e-3) {                                 // above the solid part only some panels are in place
            vec2 pid = floor(vec2((abs(n.x) > 0.5 ? p.z : p.x) * 3.0, p.y * 2.0));   // the slabs of the cladding
            keep = n.y < 0.5 && hash(pid + L.y * 53.0) > ((pid.y + 0.5) * 0.5 - L.w) / max(L.x - L.w, 1e-3);
          }
          if (keep) { tHit = th; nHit = n; lHit = L; cHit = cell; mat = 1.0; break; }
        }
      }
      if (L.z > 0.5 && L.z < 1.5) {                               // a megatower's beacon: a laser from its roof into the void
        vec2 d2 = cell + 0.5 - ro.xz;
        float l2 = dot(rd.xz, rd.xz);
        float tc = dot(d2, rd.xz) / l2;
        float pd = abs(d2.x * rd.z - d2.y * rd.x) / sqrt(l2);
        float yc = ro.y + rd.y * tc - L.x;
        float w = 0.006 + 1.6 * gPx * tc;
        beacon += step(0.0, yc) * exp(-yc * 0.1) * w * w / (pd * pd + w * w) * exp(-FOGK * 0.5 * tc);
      }
    }
    if (yb < 0.0) { tHit = -ro.y / rd.y; mat = 2.0; break; }
    if (yb > HMAX || t1 > REACH) break;
    vec2 mk = side.x < side.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    side += mk * inv; cell += mk * stp; t0 = t1;
  }

  vec3 color;
  if (mat > 1.5) color = shadeGround(ro + rd * tHit, tHit);
  else if (mat > 0.5) color = shadeTower(ro + rd * tHit, nHit, lHit, cHit, tHit);
  else color = backdrop(rd);
  if (mat > 0.5) {
    float tr = exp(-fogInt(tHit));
    color = color * tr + haze(rd) * (1.0 - tr);
    // the last stretch dissolves into what lies behind, so nothing pops where the march ends
    if (tHit > REACH - 8.0) color = mix(color, backdrop(rd), smoothstep(REACH - 8.0, REACH, tHit));
  }

  color += mix(uColor2, vec3(1.0), 0.35) * beacon * (0.5 + 0.9 * uEnergy + 0.8 * gKick);
  color += lasers(tHit) + sparks(tHit);
  return min(color, vec3(2.0));
}

void main() {
  // every clock here only ever advances: uTime, and uBassTime for the push-in
  float sway = uTime * 0.043;
  vec3 ro = vec3(0.5 + 0.14 * sin(uTime * 0.061 + 1.0), 0.75 + 0.45 * sin(sway), mod(uTime * 0.1 + uBassTime * 0.18, 1536.0));   // the city repeats every 1536 lots: z stays small
  float yaw = 0.2 * sin(uTime * 0.052) + 0.05 * sin(uTime * 0.13);
  float pitch = 0.34 - 0.1 * sin(sway);                           // lower = looking further up
  float roll = 0.035 * sin(uTime * 0.071);

  gRo = ro;
  gCam = vec4(cos(pitch), sin(pitch), cos(yaw), sin(yaw));
  gRoll = vec2(cos(roll), sin(roll));
  gKick = uBassHit * punch;
  gLight = 1.2 + 0.3 * uBass + 0.7 * gKick;
  gHazeC = mix(vec3(0.86, 0.88, 0.92), uColor2, 0.1);
  gDens = 0.3 + 0.85 * (columns - 6.0) / 42.0 + 0.1 * uEnergy;       // energy builds a little more of it
  gPx = 1.3 / uResolution.y;
  gHalf = 0.5 * (1.0 - mix(0.08, 0.62, clamp((gapw - 0.02) / 0.48, 0.0, 1.0)));
  gSeq = uTime * 0.06 + uBeatClock * 0.03;
  float sph = fract(uBeatClock / 8.0);
  gScanZ = ro.z + 1.2 + sph * 26.0;                               // it starts ahead of the camera, never on the walls beside it
  gScanI = (0.25 + 0.7 * uMid + 1.0 * uMidHit) * smoothstep(0.0, 0.1, sph) * (1.0 - smoothstep(0.7, 1.0, sph));
  gScanY = fract(uBeatClock / 16.0 + 0.5) * 10.0;                 // tops out above all but the megatowers

  // one sample per pixel: with a second one this measured ~6.5 ms at 1080p (M1 Max)
  // against ~1.6, nothing left of the 7 ms budget
  gl_FragColor = vec4(view(gl_FragCoord.xy), 1.0);
}

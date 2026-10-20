precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBeatPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float complexity;
uniform float edge;
uniform float spin;
uniform float snap;

// Escher Stairs: an impossible maze of stairs, platforms and pillars seen in
// pure isometric projection (orthographic camera along (1,1,1), no
// perspective), drawn like a flat three-tone illustration with a bright line
// on every outer and inner edge. The world is an integer voxel lattice that is
// periodic (24 cells on x and z) and is walked with a plain voxel DDA
// (Amanatides-Woo: step along the axis with the nearest cell boundary), so a
// pixel costs a few integer ops per cell. Every cell is a pure function of its
// integer coordinates (hash of the 8x8 macro-block + local offset): a ramp
// that climbs one cell per cell and restarts every 8, 3x3 platforms on
// pillars, with holes. Written from the maths, no third-party code.
// The kick rotates the whole structure by 90 degrees with an overshoot
// (easeOutBack, locked to the beat clock so it works with no audio too), the
// bass breathes the zoom and thickens the edge wire, the highs sparkle on the
// steps, a little light figure climbs one step per beat. Palette rotates
// every 16 beats, the layout re-seeds every 32 with cells rising from below.

const float PI = 3.14159265;
const int NSTEP = 76; // 24 levels x 3 crossings per level at the worst yaw, reaches the ground

int gSeedA;
int gSeedB;
float gTrans;

int pmod(int a, int m) {
  int r = a - (a / m) * m;
  return r < 0 ? r + m : r;
}

float h31(ivec3 p, int s) {
  uint x = uint(p.x) * 1597334677u ^ uint(p.y) * 3812015801u ^ uint(p.z) * 2798796415u ^ uint(s) * 374761393u;
  x = (x ^ (x >> 13u)) * 1274126177u;
  x = x ^ (x >> 16u);
  return float(x & 16777215u) / 16777216.0;
}

float hh(ivec2 mb, int s, int k) {
  return h31(ivec3(mb, k), s);
}

// stair of a macro-block: direction 0..3 and level 0..2
bool stairOf(ivec2 mb, int s, out int di, out int lvl) {
  di = int(hh(mb, s, 0) * 4.0);
  lvl = int(hh(mb, s, 1) * 3.0);
  return hh(mb, s, 2) < 0.5 + 0.5 * complexity;
}

// per-macro-block properties, cached: the DDA stays in the same 8x8 block for
// many steps, so the 6 hashes run only when the ray enters a new block/seed
ivec3 gKey = ivec3(-9999);
bool gHasSt;
int gDi;
int gLvl;
bool gHasPl;
int gPy;
bool gHole;
bool gBrX;
bool gBrZ;

void blk(ivec2 mb, int s) {
  ivec3 key = ivec3(mb, s);
  if (key == gKey) return;
  gKey = key;
  gHasSt = stairOf(mb, s, gDi, gLvl);
  gHasPl = hh(mb, s, 3) < 0.3 + 0.7 * complexity;
  gPy = 8 * int(hh(mb, s, 4) * 3.0) + 7;
  gHole = hh(mb, s, 5) > 0.5;
  // bridge beams through the platform, one per axis: they run to the block
  // edge and meet (or miss) whatever the next block put at that height
  gBrX = hh(mb, s, 6) < 0.25 + 0.5 * complexity;
  gBrZ = hh(mb, s, 7) < 0.25 + 0.5 * complexity;
}

// 0 empty, 1 stone, 2 step, 3 pillar
int occ(ivec3 c) {
  if (c.y < 0 || c.y > 23) return 0;
  int s = (gTrans > 0.0 && float(c.y) < gTrans * 24.0) ? gSeedB : gSeedA;
  int cx = pmod(c.x, 24);
  int cz = pmod(c.z, 24);
  ivec2 mb = ivec2(cx / 8, cz / 8);
  ivec2 l = ivec2(cx - mb.x * 8, cz - mb.y * 8);
  blk(mb, s);
  int di = gDi;
  int lvl = gLvl;
  if (gHasSt) {
    int sa;
    int w;
    if (di == 0) { sa = l.x; w = l.y; }
    else if (di == 1) { sa = 7 - l.x; w = l.y; }
    else if (di == 2) { sa = l.y; w = l.x; }
    else { sa = 7 - l.y; w = l.x; }
    int yb = sa + 8 * lvl;
    if (w >= 2 && w <= 5 && (c.y == yb || c.y == yb - 1)) return 2;
    // the slab the ramp arrives on: a beam along the top edge of the block
    if (sa == 7 && c.y == yb) return 1;
  }
  if (gHasPl) {
    int py = gPy;
    bool inPl = l.x >= 2 && l.x <= 4 && l.y >= 2 && l.y <= 4;
    if (c.y == py) {
      if (inPl) {
        bool hole = (l.x == 3 && l.y == 3 && gHole);
        if (!hole) return 1;
      } else if ((gBrX && l.y == 3) || (gBrZ && l.x == 3)) {
        return 1;
      }
    } else if (inPl && c.y < py && c.y >= py - 7 && (l.x == 2 || l.x == 4) && (l.y == 2 || l.y == 4)) {
      // pillars: full height under the low platforms, stubs under the high ones
      return 3;
    }
  }
  return 0;
}

bool solid(ivec3 c) {
  return occ(c) > 0;
}

float easeBack(float x) {
  float c1 = 1.9;
  float c3 = c1 + 1.0;
  float y = x - 1.0;
  return 1.0 + c3 * y * y * y + c1 * y * y;
}

// palette slot after k rotations (0..2)
vec3 pal(int k, int slot) {
  int j = pmod(k + slot, 3);
  return j == 0 ? uColor1 : (j == 1 ? uColor2 : uColor3);
}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2((uv.x - 0.5) * uResolution.x / uResolution.y, uv.y - 0.5);

  float beats = uBeatClock;

  // palette rotation every 16 beats, cross-faded over the first beat
  float pb = beats / 16.0;
  int pk = int(mod(floor(pb), 3.0));
  float pm = smoothstep(0.0, 1.0, fract(pb) * 16.0);
  int pk0 = pmod(pk + 2, 3);
  vec3 cA = mix(pal(pk0, 0), pal(pk, 0), pm);
  vec3 cB = mix(pal(pk0, 1), pal(pk, 1), pm);
  vec3 cC = mix(pal(pk0, 2), pal(pk, 2), pm);

  // layout seed every 32 beats, cells rise from below during the last beat
  float sb = beats / 32.0;
  gSeedA = int(mod(floor(sb), 1024.0));
  gSeedB = gSeedA + 1;
  gTrans = clamp(fract(sb) * 32.0 - 31.0, 0.0, 1.0);

  // yaw: slow drift + 90 degree snap on a 4-beat step, driven by the beat clock
  float n4 = floor(beats / 4.0);
  float e = easeBack(clamp(fract(beats / 4.0) * 4.0 / 0.6, 0.0, 1.0));
  float q;
  if (snap > 0.999) {
    q = mod(n4, 4.0) + e;
  } else {
    float k = mod(n4, 8.0);
    q = k < 4.0 ? k + e : (8.0 - k) - e;
  }
  float yaw = spin * uTime * 0.05 + snap * (PI * 0.5) * q + 0.04 * uBassHit * sin(uTime * 40.0);

  mat3 R = rotY(yaw);
  vec3 d0 = normalize(vec3(-1.0, -1.0, -1.0));
  vec3 r0 = normalize(cross(d0, vec3(0.0, 1.0, 0.0)));
  vec3 u0 = cross(r0, d0);
  vec3 rd = R * d0;
  vec3 rr = R * r0;
  vec3 ru = R * u0;

  float scale = 9.0 * (1.0 - 0.03 * uBass);
  float tc = mod(uTime * 0.2, 80.0);
  vec3 center = vec3(tc * 0.3, 0.0, tc * 0.3);
  vec3 ro = center + (p.x * rr + p.y * ru) * scale - rd * 60.0;

  // enter the volume y in [0,24] from the top
  float t0 = max((ro.y - 23.999) / max(-rd.y, 0.05), 0.0);
  vec3 pos = ro + rd * t0;
  ivec3 c = ivec3(floor(pos));
  vec3 stp = vec3(rd.x < 0.0 ? -1.0 : 1.0, rd.y < 0.0 ? -1.0 : 1.0, rd.z < 0.0 ? -1.0 : 1.0);
  vec3 ard = max(abs(rd), vec3(1e-4));
  vec3 tDelta = 1.0 / ard;
  vec3 nb = vec3(c) + max(stp, vec3(0.0));
  vec3 tMax = t0 + (nb - pos) / (ard * stp);
  tMax = max(tMax, vec3(t0));

  int axis = 1;
  float tHit = t0;
  int typ = 0;
  bool hit = false;
  for (int i = 0; i < NSTEP; i++) {
    typ = occ(c);
    if (typ > 0) { hit = true; break; }
    if (c.y < 0) break;
    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      tHit = tMax.x; axis = 0; c.x += int(stp.x); tMax.x += tDelta.x;
    } else if (tMax.y < tMax.z) {
      tHit = tMax.y; axis = 1; c.y += int(stp.y); tMax.y += tDelta.y;
    } else {
      tHit = tMax.z; axis = 2; c.z += int(stp.z); tMax.z += tDelta.z;
    }
  }

  vec3 bg = mix(cB * 0.15, cA * 0.3, uv.y) + 0.08;
  vec3 col = bg;
  float tFinal = 90.0;
  float hY = 0.0; // height of what the pixel shows: isometric depth cue

  if (hit) {
    vec3 h = ro + rd * tHit;
    ivec3 nrm;
    ivec3 tu;
    ivec3 tv;
    if (axis == 0) { nrm = ivec3(-int(stp.x), 0, 0); tu = ivec3(0, 1, 0); tv = ivec3(0, 0, 1); }
    else if (axis == 1) { nrm = ivec3(0, 1, 0); tu = ivec3(1, 0, 0); tv = ivec3(0, 0, 1); }
    else { nrm = ivec3(0, 0, -int(stp.z)); tu = ivec3(1, 0, 0); tv = ivec3(0, 1, 0); }

    float fu = fract(dot(h, vec3(tu)));
    float fv = fract(dot(h, vec3(tv)));
    ivec3 fc = c + nrm;

    // three flat tones: top light, side facing screen-left medium, right dark
    vec3 base;
    float side = dot(vec3(nrm), rr);
    if (axis == 1) base = cA * 1.0;
    else if (side < 0.0) base = mix(cA, cB, 0.5) * 0.65;
    else base = cB * 0.4;
    if (typ == 2) base *= vec3(1.12, 1.0, 0.82);
    else if (typ == 3) base = (axis == 1 ? 1.0 : (side < 0.0 ? 0.8 : 0.5)) * cC * 0.5;

    float aa = scale / uResolution.y * 1.5;
    float ew = 0.04 + 0.03 * uBass + aa;
    float ao = 1.0;
    float eg = 0.0;
    float dd[4];
    dd[0] = 1.0 - fu; dd[1] = fu; dd[2] = 1.0 - fv; dd[3] = fv;
    ivec3 sd[4];
    sd[0] = tu; sd[1] = -tu; sd[2] = tv; sd[3] = -tv;
    for (int k = 0; k < 4; k++) {
      bool front = solid(fc + sd[k]);
      bool inpl = solid(c + sd[k]);
      if (front) ao *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.55, dd[k]));
      if (!inpl || front) eg = max(eg, 1.0 - smoothstep(ew - aa * 1.5, ew, dd[k]));
    }

    col = base * ao;

    // kick pulse climbing the stairs: a band of lit tops rising with the decay
    float wave = exp(-abs(float(c.y) - (1.0 - uBassHit) * 24.0) * 0.8) * uBassHit;
    col += cC * wave * (axis == 1 ? 0.7 : 0.3);

    // highs: sparkles on the tops of steps
    if (axis == 1 && typ == 2) {
      float sp = step(0.985, h31(c, int(floor(uTime * 8.0))));
      col += vec3(1.0, 0.95, 0.85) * sp * (0.1 + uHigh);
    }

    // edge wire
    col += cC * eg * edge * (0.6 + 0.8 * uBass);

    tFinal = tHit;
    hY = h.y;
  } else {
    // out of steps or below the volume: dim ground, checker and fog
    float tf = tHit;
    if (rd.y < -0.05) tf = max(tHit, ro.y / -rd.y);
    vec3 g = ro + rd * tf;
    float ch = mod(floor(g.x) + floor(g.z), 2.0);
    vec3 gc = mix(cB * 0.2, cB * 0.32, ch) + cA * 0.04;
    float gl = 1.0 - smoothstep(0.02, 0.06, min(min(fract(g.x), 1.0 - fract(g.x)), min(fract(g.z), 1.0 - fract(g.z))));
    gc += cC * gl * 0.15 * edge;
    col = gc;
    tFinal = tf;
  }

  // the little light figure: one step per beat on the stair of the central block
  {
    ivec2 mbW = ivec2(floor(center.xz / 8.0));
    ivec2 mbl = ivec2(pmod(mbW.x, 3), pmod(mbW.y, 3));
    int di;
    int lvl;
    if (stairOf(mbl, gSeedA, di, lvl)) {
      float stepI = mod(floor(beats), 8.0);
      float sm = smoothstep(0.0, 0.6, fract(beats));
      float a = stepI < 0.5 ? 0.5 : stepI - 0.5 + sm;
      float lat = 4.0;
      vec2 loc;
      if (di == 0) loc = vec2(a, lat);
      else if (di == 1) loc = vec2(8.0 - a, lat);
      else if (di == 2) loc = vec2(lat, a);
      else loc = vec2(lat, 8.0 - a);
      float hop = sqrt(max(sin(PI * uBeatPhase), 0.0)) * 0.35;
      vec3 sp = vec3(vec2(mbW) * 8.0 + loc, 0.0).xzy;
      sp.y = (a - 0.5) + 8.0 * float(lvl) + 1.0 + 0.45 + hop;
      float rad = 0.4 + 0.1 * uBassHit;
      vec3 oc = ro - sp;
      float b = dot(oc, rd);
      float cq = dot(oc, oc) - rad * rad;
      float disc = b * b - cq;
      if (disc > 0.0) {
        float ts = -b - sqrt(disc);
        if (ts > 0.0 && ts < tFinal) {
          vec3 nn = normalize(oc + rd * ts);
          float lit = 0.55 + 0.45 * nn.y;
          col = mix(vec3(1.0), cC, 0.35) * lit * 1.1;
          tFinal = ts;
          hY = sp.y;
        }
      }
      // soft halo around the figure, in screen space
      vec3 dv = sp - center; // screen coords are relative to the view centre, not to this pixel's ray origin
      vec2 sc = vec2(dot(dv, rr), dot(dv, ru)) / scale;
      float dh = length(p - sc);
      col += cC * exp(-dh * dh * 400.0) * (0.25 + 0.4 * uBassHit);
    }
  }

  // depth fog toward the background: in an orthographic iso view depth is
  // height, so the lower layers and the ground recede and the tops pop
  float fog = (1.0 - smoothstep(0.0, 20.0, hY)) * 0.55;
  col = mix(col, bg, fog);

  // gentle tonemap, flat look, never black
  col = 1.0 - exp(-col * 1.8);
  col = max(col, vec3(0.04));
  gl_FragColor = vec4(col, 1.0);
}

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
uniform float uLineBoost;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float pace;
uniform float gap;
uniform float parallax;
uniform float dust;

// Cartoon Chase: the camera tracks left to right down a mansion hall and the
// cast runs on the spot in front of it, the ghost a few steps behind. The
// trick the old studios used to save paint is the whole point: the wall is
// one short tile (window, portrait, candles, door) that comes round again and
// again. Three planes slide at different speeds: the night outside the
// windows, the wall and floor, black columns up close. Bass energy pushes the
// distance run, so the hall goes by faster when the track is loud; every 8
// beats a gag from a hashed list (a look back, a stumble, a burst of speed,
// the ghost lunging for a scarf). Same cel cast and limited animation as
// hallway.frag: 12 fps pose swaps, blur-wheel legs.

const float TAU = 6.2831853;
const float FY = -0.24;                  // where the wall meets the floor
const float SZ = 0.4;                    // height of the teen on screen
const float TW = 1.8;                    // the repeating wall tile

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float vn1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h11(i), h11(i + 1.0), f);
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdEll(vec2 p, vec2 r) {
  float k0 = length(p / r), k1 = length(p / (r * r));
  return k0 < 1e-3 ? -min(r.x, r.y) : k0 * (k0 - 1.0) / k1;
}

// ---- cel kit: the same block lives in hallway.frag and chase.frag ----
vec3 gCol, INK, cSkin, cA, cB, cC;
float gPx, gOw, gPix, gInk, gFr, gKick;

float aa(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }
// a cel shape: ink outline outside the edge, flat paint inside
void cel(float d, vec3 f) {
  gCol = mix(gCol, INK, aa(d - gOw));
  gCol = mix(gCol, f, aa(d));
}
void fill(float d, vec3 f) { gCol = mix(gCol, f, aa(d)); }

// into a character's own space: feet at the origin, facing +x, 1 = teen height
bool local(vec2 p, vec2 o, float s, float dir, vec4 bb, out vec2 q) {
  q = (p - o) / s;
  q.x *= dir;
  gPx = gPix / s;
  gOw = gInk / s;
  return q.x > bb.x && q.y > bb.y && q.x < bb.z && q.y < bb.w;
}

// running legs: the blur wheel, a smear with three shoes going round
void wheel(vec2 q, vec2 c, float r, float ph, vec3 shoe) {
  vec2 d = q - c;
  float l = length(d);
  if (l > r * 1.6) return;
  float sw = fract((atan(d.y, d.x) + ph) / TAU * 3.0 + l / r * 0.35);
  float ring = aa(l - r) * (1.0 - aa(l - r * 0.3));
  gCol = mix(gCol, vec3(1.0), 0.3 * ring * step(sw, 0.55));
  gCol = mix(gCol, INK, aa(abs(l - r * 0.97) - gOw * 0.35) * step(sw, 0.4));
  for (int k = 0; k < 3; k++) {
    float ak = -ph + float(k) * TAU / 3.0;
    vec2 cs = vec2(cos(ak), sin(ak));
    vec2 e = d - cs * r * 0.8;
    cel(sdEll(vec2(dot(e, vec2(-cs.y, cs.x)), dot(e, cs)), vec2(r * 0.44, r * 0.21)), shoe);
  }
}

void sweat(vec2 q, vec2 hc, float n) {
  for (int k = 0; k < 3; k++) {
    float a = fract((gFr + n) / 7.0 + float(k) / 3.0);
    vec2 c = hc + vec2(-0.1 - 0.32 * a, 0.08 + 0.3 * a - 0.5 * a * a);
    vec2 pa = q - c, ba = vec2(0.055, 0.03);
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    cel(length(pa - ba * h) - mix(0.019, 0.002, h), vec3(0.75, 0.93, 1.0));
  }
}

// behind a runner: dust puffs off the heels and speed lines
void puffs(vec2 p, vec2 o, float s, float dir, float n, float amt) {
  vec2 q;
  if (amt <= 0.0 || !local(p, o, s, dir, vec4(-1.15, -0.05, -0.05, 0.9), q)) return;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float hs = h11(floor((gFr + n) / 2.0) + fk * 7.0 + n);
    float y = 0.2 + 0.22 * fk + 0.06 * hs;
    float x0 = -0.3 - 0.2 * hs;
    if (k < 2) gCol = mix(gCol, vec3(1.0), 0.6 * aa(sdSeg(q, vec2(x0, y), vec2(x0 - 0.15 - 0.22 * hs, y)) - 0.005));
    float a = fract((gFr + n * 3.0) / 8.0 + fk / 3.0);
    if (a > 0.85) continue;                 // the puff pops, it does not fade
    vec2 c = vec2(-0.14 - 0.6 * a, 0.035 + 0.1 * a);
    float r = (0.035 + 0.07 * a) * amt;
    float d = min(min(length(q - c) - r, length(q - c - vec2(r * 0.9, -r * 0.25)) - r * 0.7),
                  length(q - c + vec2(r * 0.8, r * 0.2)) - r * 0.65);
    cel(d, mix(vec3(0.82, 0.8, 0.76), cC, 0.15));
  }
}

// mode 0 run, 1 skid, 2 stand; look -1 turns the head back
void teen(vec2 p, vec2 o, float s, float dir, float mode, float look) {
  vec2 q;
  if (!local(p, o, s, dir, vec4(-0.8, -0.05, 0.6, 1.2), q)) return;
  float f2 = mod(gFr, 2.0);
  float skid = step(0.5, mode) * step(mode, 1.5), stand = step(1.5, mode);
  float run = 1.0 - skid - stand;
  q.y -= 0.022 * f2 * run;
  vec3 pants = mix(cC, vec3(0.08, 0.08, 0.16), 0.45), shoe = vec3(0.93, 0.9, 0.84);
  if (run > 0.5) {
    wheel(q, vec2(0.0, 0.2), 0.2, gFr * 0.7, shoe);
  } else {
    // stiff legs: heels dug in on a skid, planted when standing
    vec2 fa = mix(vec2(0.24, 0.045), vec2(0.05, 0.04), stand), fb = mix(vec2(0.14, 0.04), vec2(-0.05, 0.04), stand);
    cel(min(sdSeg(q, vec2(0.01, 0.42), fa), sdSeg(q, vec2(-0.02, 0.42), fb)) - 0.03, pants);
    cel(sdEll(q - fb - vec2(0.03, -0.01), vec2(0.065, 0.032)), shoe);
    cel(sdEll(q - fa - vec2(0.03, -0.01), vec2(0.065, 0.032)), shoe);
  }
  // the upper body leans into the run and away from the skid
  float lean = 0.28 * run - 0.38 * skid;
  vec2 u = vec2(q.x - (q.y - 0.42) * lean, q.y);
  // scarf: trails behind, whips forward when he brakes
  float sd = 1.0 - 2.0 * skid;
  float sx = clamp(u.x * sd, -0.44, -0.02);
  float sy = 0.745 + 0.04 * sin(sx * 16.0 + gFr * 1.7) * smoothstep(-0.02, -0.2, sx) - 0.25 * stand * (sx + 0.02);
  cel(length(vec2(u.x * sd, u.y) - vec2(sx, sy)) - (0.03 + sx * 0.03), cB);
  // arms: grabbing at the air ahead, thrown up on the skid, at the mouth when standing
  vec2 sh = vec2(0.01, 0.67);
  vec2 ha = vec2(0.25, 0.73 - 0.13 * f2) * run + vec2(-0.14, 0.96) * skid + vec2(0.09, 0.76) * stand;
  vec2 hb = vec2(0.23, 0.58 + 0.13 * f2) * run + vec2(0.13, 1.0) * skid + vec2(0.11, 0.7) * stand;
  cel(sdSeg(u, sh, ha) - 0.024, cA * 0.8);
  cel(length(u - ha) - 0.032, cSkin);
  cel(sdBox(u - vec2(0.0, 0.44), vec2(0.045, 0.03)) - 0.02, pants);
  cel(sdSeg(u, vec2(0.0, 0.7), vec2(0.025, 0.8)) - 0.021, cSkin);
  float torso = sdBox(u - vec2(0.0, 0.58), vec2(0.04, 0.115)) - 0.04;
  cel(torso, cA);
  fill(max(torso, u.x + 0.025), cA * 0.78);
  cel(sdBox(u - vec2(0.008, 0.735), vec2(0.04, 0.012)) - 0.016, cB);
  // head
  vec2 hc = vec2(0.035, 0.875);
  vec2 hq = u - hc;
  hq.x *= look;
  cel(min(length(hq) - 0.078, length(hq - vec2(0.085, -0.012)) - 0.021), cSkin);
  cel(max(length(hq - vec2(0.0, 0.012)) - 0.09, -(hq.y - 0.022 + hq.x * 0.22)), cB);
  cel(length(hq - vec2(-0.035, 0.115)) - 0.03, vec3(0.95));
  cel(length(hq - vec2(0.042, -0.002)) - 0.025, vec3(1.0));
  fill(length(hq - vec2(0.053, -0.002)) - 0.01, INK);
  fill(sdEll(hq - vec2(0.045, -0.05), vec2(0.021, 0.015 + 0.004 * f2)), INK);
  cel(sdSeg(u, sh, hb) - 0.024, cA);
  cel(length(u - hb) - 0.032, cSkin);
  if (stand < 0.5) sweat(q, vec2(hc.x + (hc.y - 0.42) * lean, hc.y), 0.0);
}

void kid(vec2 p, vec2 o, float s, float dir, float mode, float look) {
  vec2 q;
  if (!local(p, o, s, dir, vec4(-0.7, -0.05, 1.15, 0.85), q)) return;
  float f2 = mod(gFr + 1.0, 2.0);
  float skid = step(0.5, mode) * step(mode, 1.5), stand = step(1.5, mode);
  float run = 1.0 - skid - stand;
  q.y -= 0.018 * f2 * run;
  vec3 shoe = vec3(0.93, 0.9, 0.84), shorts = mix(cC, vec3(0.08, 0.08, 0.16), 0.45);
  float lean = 0.18 * run - 0.4 * skid;
  vec2 u = vec2(q.x - (q.y - 0.2) * lean, q.y);
  // torch beam: a hard-edged cone, the way a cel paints light
  vec2 tp = vec2(0.24, 0.37 + 0.02 * f2 * run) * (1.0 - skid) + vec2(0.1, 0.72) * skid;
  vec2 tdir = normalize(mix(vec2(1.0, 0.04), vec2(0.5, 1.0), skid));
  vec2 bq = u - tp;
  bq = vec2(dot(bq, tdir), dot(bq, vec2(-tdir.y, tdir.x)));
  float cone = aa(abs(bq.y) - 0.025 - bq.x * 0.3) * step(0.03, bq.x) * (1.0 - smoothstep(0.45, 0.85, bq.x));
  gCol += mix(vec3(1.0, 0.95, 0.75), cA, 0.25) * 0.28 * cone * (0.8 + 0.2 * h11(gFr));
  if (run > 0.5) {
    wheel(q, vec2(0.0, 0.11), 0.11, gFr * 0.9 + 1.0, shoe);
  } else {
    vec2 fa = mix(vec2(0.17, 0.035), vec2(0.045, 0.035), stand), fb = mix(vec2(0.09, 0.035), vec2(-0.045, 0.035), stand);
    cel(min(sdSeg(q, vec2(0.02, 0.2), fa), sdSeg(q, vec2(-0.02, 0.2), fb)) - 0.03, cSkin);
    cel(sdEll(q - fb - vec2(0.025, -0.008), vec2(0.055, 0.03)), shoe);
    cel(sdEll(q - fa - vec2(0.025, -0.008), vec2(0.055, 0.03)), shoe);
  }
  cel(sdBox(u - vec2(0.0, 0.21), vec2(0.06, 0.02)) - 0.025, shorts);
  // hoodie with the hood bunched behind the neck
  float body = min(sdBox(u - vec2(0.0, 0.31), vec2(0.065, 0.075)) - 0.05, length(u - vec2(-0.085, 0.43)) - 0.065);
  cel(body, cB);
  fill(max(body, u.x + 0.045), cB * 0.78);
  vec2 hc = vec2(0.03, 0.53);
  vec2 hq = u - hc;
  hq.x *= look;
  cel(length(hq) - 0.105, cSkin);
  // cap worn backwards
  cel(min(max(length(hq - vec2(0.0, 0.008)) - 0.116, -(hq.y - 0.035 + hq.x * 0.15)),
          sdBox(hq - vec2(-0.14, 0.05), vec2(0.055, 0.006)) - 0.012), cA);
  cel(length(hq - vec2(0.05, -0.005)) - 0.036, vec3(1.0));
  fill(length(hq - vec2(0.066, -0.005)) - 0.013, INK);
  fill(sdEll(hq - vec2(0.055, -0.066), vec2(0.024, 0.014 + 0.005 * f2)), INK);
  // torch arm
  cel(sdSeg(u, vec2(0.02, 0.34), tp - tdir * 0.05) - 0.03, cB);
  cel(min(sdBox(bq + vec2(0.01, 0.0), vec2(0.04, 0.015)) - 0.006, sdBox(bq - vec2(0.03, 0.0), vec2(0.008, 0.028)) - 0.004),
      vec3(0.8, 0.8, 0.85));
  if (stand < 0.5) sweat(q, vec2(hc.x + (hc.y - 0.2) * lean, hc.y + 0.03), 3.0);
}

void dog(vec2 p, vec2 o, float s, float dir, float mode) {
  vec2 q;
  if (!local(p, o, s, dir, vec4(-0.5, -0.05, 0.5, 0.7), q)) return;
  float f2 = mod(gFr, 2.0);
  float skid = step(0.5, mode);
  q.y -= 0.016 * f2 * (1.0 - skid);
  vec3 fur = mix(cC, vec3(1.0), 0.25), dark = fur * 0.55, paw = vec3(0.95, 0.92, 0.86);
  q.x += (q.y - 0.1) * 0.35 * skid;
  float tail = min(sdSeg(q, vec2(-0.15, 0.24), vec2(-0.25, 0.37 + 0.05 * f2)) - 0.02,
                   length(q - vec2(-0.25, 0.37 + 0.05 * f2)) - 0.036);
  cel(tail, fur);
  if (skid < 0.5) {
    wheel(q, vec2(-0.1, 0.075), 0.075, gFr * 0.9, paw);
    wheel(q, vec2(0.11, 0.075), 0.075, gFr * 0.9 + 2.0, paw);
  } else {
    cel(min(sdSeg(q, vec2(-0.1, 0.15), vec2(0.0, 0.03)), sdSeg(q, vec2(0.1, 0.15), vec2(0.22, 0.03))) - 0.027, fur);
  }
  cel(sdSeg(q, vec2(0.13, 0.37), vec2(0.02, 0.47 + 0.05 * f2)) - 0.03, dark);
  float body = sdEll(q - vec2(0.0, 0.2), vec2(0.185, 0.105));
  cel(body, fur);
  fill(max(body, q.y - 0.17 - q.x * 0.2), fur * 0.78);
  cel(min(length(q - vec2(0.17, 0.315)) - 0.092, sdEll(q - vec2(0.265, 0.28), vec2(0.072, 0.046))), fur);
  // tongue out, flapping back
  cel(sdSeg(q, vec2(0.25, 0.245), vec2(0.18, 0.2 + 0.025 * f2)) - 0.017, mix(cB, vec3(1.0, 0.6, 0.65), 0.6));
  fill(length(q - vec2(0.328, 0.298)) - 0.019, INK);
  cel(length(q - vec2(0.2, 0.345)) - 0.028, vec3(1.0));
  fill(length(q - vec2(0.212, 0.345)) - 0.011, INK);
  cel(sdSeg(q, vec2(0.19, 0.39), vec2(0.09, 0.5 - 0.05 * f2)) - 0.03, dark);
}

// mode 0 chase, 1 boo (arms wide, facing out), 2 flee
void ghost(vec2 p, vec2 o, float s, float dir, float mode) {
  vec2 q;
  if (!local(p, o, s, dir, vec4(-1.0, -0.3, 0.9, 1.6), q)) return;
  float f2 = mod(floor(gFr / 2.0), 2.0);
  float boo = step(0.5, mode) * step(mode, 1.5), flee = step(1.5, mode);
  q.y -= 0.12 + 0.03 * sin(gFr * 0.8);
  // the sheet trails behind the head, more the lower it hangs
  float tr = clamp(0.95 - q.y, 0.0, 1.0);
  vec2 u = vec2(q.x + 0.32 * tr * tr * (1.0 - 0.8 * boo), q.y);
  float w = 0.19 + 0.1 * smoothstep(0.8, 0.1, u.y);
  float body = min(length(u - vec2(0.0, 0.9)) - 0.19, sdBox(vec2(u.x * 0.19 / w, u.y - 0.5), vec2(0.19, 0.4)));
  body = max(body, (0.1 + 0.045 * cos(u.x * 30.0 + gFr * 1.3) - u.y) * 0.6);
  vec3 sheet = mix(vec3(1.0), cA, 0.22);
  // halo: the one soft thing on the cel layer
  gCol += cA * 0.3 * exp(-max(body, 0.0) * 9.0) * smoothstep(0.28, 0.0, body) * (0.6 + 0.9 * gKick);
  // arms: sleeves ending in three claws
  vec2 s1 = vec2(0.1, 0.74), s2 = vec2(0.08, 0.8);
  vec2 h1 = vec2(0.42, 0.86 + 0.07 * f2), h2 = vec2(0.35, 1.07 - 0.07 * f2);
  h1 = mix(h1, vec2(0.46, 1.12 + 0.04 * f2), boo);
  h2 = mix(h2, vec2(-0.46, 1.12 - 0.04 * f2), boo);
  s2 = mix(s2, vec2(-0.12, 0.78), boo);
  h1 = mix(h1, vec2(0.4, 0.62 + 0.05 * f2), flee);
  h2 = mix(h2, vec2(0.36, 0.78 - 0.05 * f2), flee);
  vec2 d1 = normalize(h1 - s1), d2 = normalize(h2 - s2);
  float arm2 = sdSeg(u, s2, h2) - 0.05;
  float arm1 = sdSeg(u, s1, h1) - 0.05;
  for (int k = -1; k <= 1; k++) {
    float fk = float(k) * 0.55;
    vec2 c1 = d1 * cos(fk) + vec2(-d1.y, d1.x) * sin(fk);
    vec2 c2 = d2 * cos(fk) + vec2(-d2.y, d2.x) * sin(fk);
    arm1 = min(arm1, sdSeg(u, h1, h1 + c1 * 0.095) - 0.017);
    arm2 = min(arm2, sdSeg(u, h2, h2 + c2 * 0.095) - 0.017);
  }
  cel(arm2, sheet * 0.8);
  cel(body, sheet);
  fill(max(body, u.x + 0.06 + 0.1 * tr), sheet * 0.8);
  // face: slanted sockets with lit pupils, a mouth full of teeth
  vec2 fc = vec2(0.075 * (1.0 - boo) - 0.03 * flee, 0.9);
  vec2 e1 = u - fc - vec2(-0.06, 0.02), e2 = u - fc - vec2(0.065, 0.02);
  float brow = 0.75 - 1.5 * flee;          // angry on the hunt, worried on the run
  fill(max(sdEll(e1, vec2(0.042, 0.058)), e1.y - 0.022 + e1.x * brow), INK);
  fill(max(sdEll(e2, vec2(0.042, 0.058)), e2.y - 0.022 - e2.x * brow), INK);
  vec3 lit = mix(cA, vec3(1.0), 0.3) * (1.1 + 0.8 * gKick);
  fill(length(e1 - vec2(0.008, -0.015)) - 0.014, lit);
  fill(length(e2 - vec2(0.008, -0.015)) - 0.014, lit);
  vec2 m = u - fc - vec2(0.005, -0.135);
  float mouth = sdEll(m, vec2(0.095, 0.058 + 0.014 * f2 + 0.025 * boo));
  fill(mouth, INK);
  fill(max(mouth, -(m.y - 0.018 + 0.036 * abs(fract(m.x * 20.0) - 0.5))), sheet);
  cel(arm1, sheet);
}
// ---- end of the cel kit ----

// arched opening: q.y measured from its sill, hw half width, h height of the straight part
float arch(vec2 q, float hw, float h) {
  return min(sdBox(q - vec2(0.0, h * 0.5), vec2(hw, h * 0.5)), length(q - vec2(0.0, h)) - hw);
}

// the night outside: moon, a bank of cloud, hills and bare trees
vec3 outside(vec2 p, float sc) {
  vec3 c = mix(mix(uColor2, uColor3, 0.5) * 0.3 + vec3(0.03, 0.03, 0.06), uColor3 * 0.14 + vec3(0.008, 0.01, 0.03),
               smoothstep(-0.1, 0.4, p.y));
  vec3 moon = mix(vec3(1.0, 0.97, 0.86), uColor1, 0.18);
  vec2 mq = p - vec2(0.22, 0.2);
  float md = length(mq) - 0.085;
  c += moon * 0.22 * exp(-max(md, 0.0) * 9.0);
  c = mix(c, moon, 1.0 - smoothstep(-0.002, 0.002, md));
  c = mix(c, moon * 0.82, (1.0 - smoothstep(-0.002, 0.002, min(length(mq - vec2(0.03, 0.02)) - 0.022, length(mq + vec2(0.035, 0.03)) - 0.014))));
  float cl = vn(vec2(p.x * 3.0 + sc * 0.12, p.y * 11.0)) + 0.5 * vn(vec2(p.x * 7.0 + sc * 0.2, p.y * 20.0 + 3.0));
  c = mix(c, mix(c, uColor3, 0.25) * 0.55 + 0.02, smoothstep(0.92, 0.95, cl + 0.35 * smoothstep(0.1, 0.3, p.y)));
  float hx = p.x + sc * 0.22;
  float hill = 0.0 + 0.09 * vn1(hx * 2.3) + 0.03 * vn1(hx * 7.0 + 4.0);
  c = mix(c, uColor3 * 0.07 + vec3(0.012, 0.012, 0.03), 1.0 - smoothstep(-0.003, 0.003, p.y - hill));
  // bare trees, nearer than the hills
  float tx = p.x + sc * 0.4;
  float id = floor(tx / 0.5);
  vec2 tq = vec2(mod(tx, 0.5) - 0.25 + (h11(id) - 0.5) * 0.2, p.y + 0.08);
  float lean = (h11(id + 3.0) - 0.5) * 0.12;
  float tree = sdSeg(tq, vec2(0.0), vec2(lean, 0.3)) - 0.012 * (1.0 - tq.y * 2.0);
  tree = min(tree, sdSeg(tq, vec2(lean * 0.5, 0.15), vec2(0.09, 0.27)) - 0.005);
  tree = min(tree, sdSeg(tq, vec2(lean * 0.7, 0.2), vec2(-0.08, 0.3)) - 0.005);
  tree = min(tree, sdSeg(tq, vec2(0.05, 0.215), vec2(0.06, 0.3)) - 0.003);
  c = mix(c, vec3(0.006, 0.006, 0.016), 1.0 - smoothstep(-0.002, 0.002, tree));
  return c;
}

void main() {
  // composed for 16:9; a narrower screen zooms out instead of cropping the cast
  float zoom = max(1.0, 1.6 * uResolution.y / uResolution.x);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y * zoom;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFr = floor(uTime * 12.0);
  gPix = 0.9 * zoom / uResolution.y;
  gInk = 0.0048 * (1.0 + 2.5 * clamp(uLineBoost, 0.0, 1.0)) / 2.25;
  // the camera is hand-held by someone who is also running
  p.y += 0.004 * (mod(floor(gFr / 2.0), 2.0) - 0.5) + 0.004 * gKick;

  INK = vec3(0.012, 0.01, 0.028);
  cA = mix(uColor1, vec3(1.0), 0.16);
  cB = mix(uColor2, vec3(1.0), 0.16);
  cC = mix(uColor3, vec3(1.0), 0.16);
  cSkin = mix(vec3(1.0, 0.82, 0.66), uColor2, 0.08);
  vec3 warm = mix(vec3(1.0, 0.78, 0.45), uColor1, 0.35);
  vec3 cool = mix(vec3(0.6, 0.75, 1.0), uColor3, 0.4);

  float par = clamp(parallax, 0.0, 2.0);
  float sc = (uTime * 0.45 + uBassTime * 0.35) * clamp(pace, 0.3, 3.0);

  // ---- gags: each of the five once per block, in a hashed order ----
  float cyc = uBeatClock / 8.0;
  float n = floor(cyc), tc = fract(cyc);
  float blk = floor(n / 5.0);
  float gag = mod(floor(h11(blk * 3.7 + 0.5) * 5.0) + (1.0 + floor(h11(blk * 7.9 + 1.5) * 4.0)) * n, 5.0);
  float w = smoothstep(0.22, 0.3, tc) * (1.0 - smoothstep(0.62, 0.72, tc));
  float g1 = step(0.5, gag) * step(gag, 1.5), g2 = step(1.5, gag) * step(gag, 2.5);
  float g3 = step(2.5, gag) * step(gag, 3.5), g4 = step(3.5, gag);
  float jt = floor(uTime * 2.5);
  float gx = -0.28 - 0.42 * clamp(gap, 0.0, 1.0) + 0.03 * (h11(jt) - 0.5) + 0.03 * gKick - 0.13 * g3 * w + 0.24 * g4 * w;
  float tx = 0.18 + 0.03 * (h11(jt + 5.0) - 0.5) + 0.1 * g3 * w;
  float kx = 0.42 + 0.03 * (h11(jt + 9.0) - 0.5) + 0.07 * g3 * w;
  float dgx = 0.66 + 0.03 * (h11(jt + 13.0) - 0.5) + 0.04 * g3 * w;
  // the stumble: the kid digs in, drops back, then sprints to catch up
  float trip = g2 * smoothstep(0.25, 0.38, tc) * (1.0 - smoothstep(0.42, 0.7, tc));
  kx -= 0.36 * trip;
  float mK = g2 * step(0.25, tc) * step(tc, 0.38);
  float lookT = 1.0 - 2.0 * g1 * step(0.5, w), lookK = 1.0 - 2.0 * max(g1 * step(0.35, tc) * step(tc, 0.55), g4 * step(0.5, w));
  float hop = g4 * step(0.5, w) * 0.05 * mod(floor(gFr / 2.0), 2.0);

  // ---- wall: one tile, round and round ----
  vec3 wallA = mix(vec3(0.05, 0.04, 0.085), uColor3, 0.17);
  vec3 wood = mix(vec3(0.05, 0.034, 0.036), uColor3, 0.1) + uColor2 * 0.012;
  vec3 doorC = mix(vec3(0.1, 0.06, 0.05), uColor3, 0.12) + uColor2 * 0.03;
  float wx = p.x + sc;
  float lx = mod(wx, TW);
  float grain = vn(vec2(wx * 14.0, p.y * 150.0)) * 0.6 + vn(vec2(wx, p.y) * 60.0) * 0.4;
  float flick = 0.82 + 0.18 * h11(floor(uTime * 8.0));
  vec2 cp = vec2(lx - 1.22, p.y - 0.2);
  float pool = flick * exp(-dot(cp, cp) * 7.0) * (0.8 + 0.6 * gKick + 0.3 * uBass);
  vec2 wq = vec2(lx - 0.42, p.y + 0.07);            // window, from its sill
  float dWin = arch(wq, 0.15, 0.26);
  float moonlit = exp(-max(dWin, 0.0) * 9.0) * 0.35;
  vec3 col;
  gPx = gPix;
  gOw = gInk * 0.7;
  if (p.y > FY) {
    float st = fract(wx / 0.07);
    col = wallA * (st > 0.5 ? 1.32 : 1.0);
    vec2 mq = vec2((st - 0.75) * 0.07, (fract(p.y / 0.09) - 0.5) * 0.09);
    col = mix(col, wallA * 0.8, step(0.5, st) * (1.0 - smoothstep(0.011, 0.013, abs(mq.x) + abs(mq.y) * 0.55)));
    col *= mix(1.15, 0.55, smoothstep(-0.1, 0.5, p.y));
    if (p.y < -0.1) {
      col = wood;
      float pb = sdBox(vec2((fract(wx / 0.15 + 0.5) - 0.5) * 0.15, p.y + 0.175), vec2(0.052, 0.045));
      col = mix(col, wood * 0.72, 1.0 - smoothstep(0.0, 0.003, pb));
      col = mix(col, wood * 1.45, 1.0 - smoothstep(0.001, 0.003, abs(pb + 0.001)));
      col = mix(col, wood * 1.5, step(-0.113, p.y));
      col = mix(col, wood * 0.55, step(p.y, FY + 0.022));
    }
    col = mix(col, wood * 0.5, smoothstep(0.425, 0.43, p.y + 0.012 * abs(sin(wx * 22.4))));
    col += (warm * 0.1 + col * 1.3) * pool * (p.y < -0.1 ? 0.6 : 1.0);
    col += cool * 0.05 * moonlit + col * moonlit;
    col *= 0.9 + 0.2 * grain;

    // window on the night, with tied-back curtains
    if (dWin < 0.03) {
      col = mix(col, INK, aa(dWin - 0.026));
      col = mix(col, doorC * 1.5, aa(dWin - 0.021));
      vec3 o = outside(vec2(p.x, p.y), sc * par);
      float bars = min(abs(wq.x), min(abs(wq.y - 0.13), abs(wq.y - 0.26))) - 0.006;
      o = mix(o, INK + doorC * 0.3, aa(bars));
      float dr = abs(wq.x) - (0.075 + 0.07 * smoothstep(0.05, 0.4, wq.y) - 0.05 * exp(-abs(wq.y - 0.12) * 30.0));
      vec3 cur = mix(vec3(0.1, 0.03, 0.05), uColor2, 0.25) * (0.45 + 0.25 * step(0.5, fract(abs(wq.x) * 45.0 + wq.y * 3.0)));
      o = mix(o, INK, aa(-dr - 0.004));
      o = mix(o, cur, aa(-dr));
      col = mix(col, o, aa(dWin));
    }

    // portrait: the eyes are on the ghost
    vec2 pq = vec2(lx - 0.86, p.y - 0.17);
    float fr = sdEll(pq, vec2(0.075, 0.1));
    if (fr < 0.02) {
      vec3 gold = mix(vec3(0.55, 0.38, 0.12), uColor1, 0.3) * (0.75 + 0.8 * pool);
      col = mix(col, INK, aa(fr - 0.013));
      col = mix(col, gold, aa(fr - 0.009));
      col = mix(col, gold * 0.6, aa(abs(fr - 0.004) - 0.0012));
      col = mix(col, mix(vec3(0.03, 0.03, 0.05), uColor3, 0.1) * (1.0 + pool), aa(fr));
      float bust = min(length(pq - vec2(0.0, 0.015)) - 0.03, sdEll(pq - vec2(0.0, -0.085), vec2(0.06, 0.05)));
      bust = min(bust, sdBox(pq - vec2(0.0, 0.058), vec2(0.022, 0.022)));
      col = mix(col, mix(vec3(0.12, 0.1, 0.12), uColor2, 0.22) * (1.0 + pool), aa(max(bust, fr + 0.004)));
      float lk = clamp((gx - p.x) * 3.0, -1.0, 1.0) * 0.0035;
      col = mix(col, vec3(0.95, 0.95, 0.85), aa(length(vec2(abs(pq.x) - 0.012, pq.y - 0.02)) - 0.0065));
      col = mix(col, INK, aa(length(vec2(abs(pq.x - lk) - 0.012, pq.y - 0.02)) - 0.003));
    }

    // candelabra
    if (abs(cp.x) < 0.09 && abs(cp.y) < 0.13) {
      float cx = clamp(floor(cp.x / 0.045 + 0.5), -1.0, 1.0);
      vec2 cq = vec2(cp.x - cx * 0.045, cp.y);
      float arm = min(sdBox(cp - vec2(0.0, -0.002), vec2(0.052, 0.004)), sdBox(cp - vec2(0.0, -0.03), vec2(0.005, 0.03)));
      arm = min(arm, length(cp - vec2(0.0, -0.06)) - 0.014);
      col = mix(col, INK * 1.5 + warm * 0.04, aa(arm));
      col = mix(col, vec3(0.85, 0.8, 0.65) * (0.6 + 0.3 * pool), aa(sdBox(cq - vec2(0.0, 0.022), vec2(0.0065, 0.02))));
      float fk = h11(floor(uTime * 8.0) + cx * 5.0);
      vec2 fq = cq - vec2((fk - 0.5) * 0.005 - 0.006, 0.058);     // flames lean back in the draught
      float flame = min(length(fq) - 0.0095, sdSeg(fq, vec2(0.0), vec2(-0.012 + (fk - 0.5) * 0.01, 0.026 + 0.012 * gKick)) - 0.004);
      col += warm * 0.5 * exp(-max(flame, 0.0) * 70.0);
      col = mix(col, warm * 1.2, aa(flame));
      col = mix(col, vec3(1.0, 0.97, 0.85), aa(flame + 0.005));
    }

    // a door nobody has time to open
    vec2 dq = vec2(lx - 1.56, p.y - FY);
    float dDoor = arch(dq, 0.1, 0.43);
    if (dDoor < 0.03) {
      col = mix(col, INK, aa(dDoor - 0.02));
      col = mix(col, doorC * (1.35 + 0.8 * pool), aa(dDoor - 0.016));
      vec3 lc = doorC * (1.0 + 0.7 * pool) * (0.9 + 0.2 * grain);
      float pn = min(sdBox(dq - vec2(0.0, 0.34), vec2(0.058, 0.07)) - 0.008, sdBox(dq - vec2(0.0, 0.12), vec2(0.058, 0.08)) - 0.008);
      vec3 lp = mix(lc, lc * 0.68, 1.0 - smoothstep(0.0, 0.004, pn));
      lp = mix(lp, lc * 1.5, 1.0 - smoothstep(0.0015, 0.004, abs(pn + 0.001)));
      float kn = length(dq - vec2(0.075, 0.225)) - 0.011;
      lp = mix(lp, INK, aa(kn - 0.004));
      lp = mix(lp, mix(vec3(0.8, 0.6, 0.2), uColor1, 0.3), aa(kn));
      col = mix(col, lp, aa(dDoor));
    }
  } else {
    // floor: boards and the runner, sliding faster the nearer they are
    float f = (FY - p.y) / 0.26;
    float X = p.x / (1.0 + 0.35 * f) + sc;
    float row = floor(pow(f, 0.7) * 5.0);
    vec3 fl = mix(vec3(0.085, 0.06, 0.06), uColor3, 0.1) * (0.6 + 0.6 * f + 0.15 * h11(row));
    fl *= 1.0 - 0.45 * step(fract(X / 0.34 + row * 0.37), 0.012 / 0.34);
    fl *= 1.0 - 0.4 * step(fract(pow(f, 0.7) * 5.0), 0.05);
    // moonlight through the window, laid across the boards
    float ml = 1.0 - smoothstep(0.1, 0.13, abs(mod(X - 0.42 - 0.25 * f, TW) - 0.0) < 0.5 * TW ? abs(mod(X - 0.42 - 0.25 * f, TW)) : abs(mod(X - 0.42 - 0.25 * f, TW) - TW));
    float lamp = exp(-pow(mod(X - 1.22 + 0.5 * TW, TW) - 0.5 * TW, 2.0) * 7.0) * flick * (0.8 + 0.6 * gKick);
    col = fl * (1.0 + 0.8 * lamp);
    float ry = p.y + 0.41;
    if (abs(ry) < 0.08) {
      vec3 rn = mix(vec3(0.12, 0.035, 0.05), uColor2, 0.2) * 0.5;
      vec2 rq = vec2((fract(X / 0.13) - 0.5) * 0.13, ry);
      rn = mix(rn, rn * 1.6, 1.0 - smoothstep(0.03, 0.033, abs(rq.x) + abs(rq.y) * 0.8));
      rn = mix(rn, rn * 0.6, 1.0 - smoothstep(0.012, 0.015, abs(rq.x) + abs(rq.y) * 0.8));
      rn = mix(rn, mix(uColor1, vec3(0.6, 0.45, 0.2), 0.4) * 0.5, step(0.058, abs(ry)) * step(abs(ry), 0.07));
      col = rn * (0.85 + 0.5 * lamp);
    }
    col += (cool * 0.05 + col * 0.9) * ml * (1.0 - 0.5 * f);
    col *= 0.9 + 0.2 * grain;
  }
  gCol = col;

  // ---- the cast, far lane first ----
  float dst = clamp(dust, 0.0, 2.0);
  vec4 lanes = vec4(-0.36, -0.385, -0.41, -0.435);
  vec4 xs = vec4(gx, tx, kx, dgx);
  for (int i = 0; i < 4; i++) {
    float x = i == 0 ? xs.x : i == 1 ? xs.y : i == 2 ? xs.z : xs.w;
    float ly = i == 0 ? lanes.x : i == 1 ? lanes.y : i == 2 ? lanes.z : lanes.w;
    vec2 sq = (p - vec2(x, ly - 0.004)) / vec2(i == 0 ? 0.11 : 0.08, 0.013);
    gCol *= 1.0 - 0.45 * (1.0 - smoothstep(0.8, 1.0, dot(sq, sq)));
  }
  // all the dust first, so nobody runs behind somebody else's cloud
  float da = dst * (0.85 + 0.4 * g3 * w);
  puffs(p, vec2(tx, lanes.y), SZ, 1.0, 1.0, da);
  puffs(p, vec2(kx, lanes.z), SZ, 1.0, 2.0, da * (1.0 - mK));
  puffs(p, vec2(dgx, lanes.w), SZ, 1.0, 3.0, da);
  ghost(p, vec2(gx, lanes.x), SZ, 1.0, 0.0);
  teen(p, vec2(tx, lanes.y + hop), SZ, 1.0, 0.0, lookT);
  kid(p, vec2(kx, lanes.z + hop * (1.0 - mK)), SZ, 1.0, mK, lookK);
  dog(p, vec2(dgx, lanes.w + hop), SZ, 1.0, 0.0);

  // ---- up close: black columns going by fast, a valance along the top ----
  float fgx = p.x / (1.0 + 0.9 * par) + sc;
  float cxl = mod(fgx, 2.3) - 0.4;
  float cw = 0.03 + 0.012 * smoothstep(0.38, 0.45, abs(p.y + 0.02)) + 0.008 * step(0.44, abs(p.y + 0.02));
  float dcol = (abs(cxl) - cw) * (1.0 + 0.9 * par);
  vec3 fgc = INK + uColor3 * 0.035;
  float flute = step(0.5, fract(cxl / cw * 2.5 + 0.25)) * step(abs(p.y + 0.02), 0.38);
  gPx = gPix;
  gCol = mix(gCol, fgc * (1.0 + 0.8 * flute) + cool * 0.05 * smoothstep(0.0, -0.012, dcol + 0.012 * (1.0 + 0.9 * par)) * step(cxl, 0.0), aa(dcol));
  float val = 0.455 - 0.035 * abs(sin(fgx * 6.5)) - p.y;
  gCol = mix(gCol, fgc, aa(val));

  // the burst: streaks across the whole frame
  float bid = floor((p.y + 0.5) * 11.0);
  float hb = h21(vec2(bid, floor(gFr / 2.0)));
  float streak = step(0.72, hb) * step(abs(fract((p.y + 0.5) * 11.0) - 0.5), 0.045) * step(abs(p.x - (h11(bid + hb) - 0.5) * 1.5), 0.12 + 0.2 * hb);
  gCol = mix(gCol, vec3(1.0), 0.55 * streak * g3 * step(0.5, w) * step(p.y, 0.38));

  col = gCol;
  col *= clamp(1.2 - dot(p, p) * 0.75, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;   // dither: the wall gradients band at 8 bit
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

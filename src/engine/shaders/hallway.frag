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

uniform float tempo;
uniform float crew;
uniform float candle;
uniform float shake;

// Haunted Hallway: the door gag of the Saturday-morning chase cartoon. A fixed
// side view of a mansion corridor painted like a gouache background (soft
// gradients, no outlines), and on top of it flat cel characters with thick ink
// outlines: a sheet ghost, a lanky teen in a beanie, a kid with a torch, a
// small dog. They pop out of one door and dive into another, run into the
// ghost behind the wrong door and skid back, cross each other, and sometimes
// it is the dog that chases the ghost. The choreography runs on the beat clock
// (one gag every 8 beats, doors open and slam on the beat) and is picked by a
// hash of the gag number, so it never settles into a loop. Animation is
// limited on purpose: poses swap at 12 fps, legs are the blur wheel.

const float TAU = 6.2831853;
const float FY = -0.26;                  // where the wall meets the floor
const float SZ = 0.36;                   // height of the teen on screen

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
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

// door outline: a tall panel with a round arch on top (q.y measured from the floor line)
float doorShape(vec2 q) {
  return min(sdBox(q - vec2(0.0, 0.215), vec2(0.1, 0.215)), length(q - vec2(0.0, 0.43)) - 0.1);
}

float gTc, gXd, gOpen, gSlam;

// an actor goes through the door at x at time t: it opens ahead and slams behind
void door(float t, float x) {
  if (abs(x - gXd) > 0.01) return;
  float dt = gTc - t;
  gOpen = max(gOpen, smoothstep(-0.06, -0.035, dt) * step(dt, 0.035));
  if (dt > 0.035 && dt < 0.1) gSlam = max(gSlam, 1.0 - (dt - 0.035) / 0.065);
}

// a run from xa at t0 to xb at t1; da / db say whether that end is a door.
// returns x, depth (0 in the doorway, 1 out on the runner), facing, visible
vec4 leg(vec4 st, float t0, float t1, float xa, float xb, float da, float db) {
  if (da > 0.5) door(t0, xa);
  if (db > 0.5) door(t1, xb);
  if (gTc < t0 || gTc >= t1) return st;
  float e = min(da > 0.5 ? (gTc - t0) / 0.035 : 1.0, db > 0.5 ? (t1 - gTc) / 0.035 : 1.0);
  return vec4(mix(xa, xb, (gTc - t0) / (t1 - t0)), clamp(e, 0.0, 1.0), sign(xb - xa), 1.0);
}

// standing in a doorway held ajar from t0 to t1
vec4 peek(vec4 st, float t0, float t1, float x, float dir, float open) {
  if (abs(x - gXd) < 0.01)
    gOpen = max(gOpen, open * smoothstep(t0 - 0.04, t0, gTc) * step(gTc, t1 + 0.02));
  if (abs(x - gXd) < 0.01 && gTc > t1 + 0.02 && gTc < t1 + 0.085) gSlam = max(gSlam, 1.0 - (gTc - t1 - 0.02) / 0.065);
  if (gTc < t0 || gTc >= t1) return st;
  return vec4(x + 0.052, 0.0, dir, 1.0);        // on the side the leaf leaves open
}

void drawActor(int id, vec2 p, vec4 st, float mode, float lane) {
  float e = st.y;
  vec2 o = vec2(st.x, mix(FY + 0.004, lane, e));
  float s = SZ * mix(0.82, 1.0, e);
  if (e > 0.6) {
    // contact shadow, then the dust the feet kick up
    vec2 sq = (p - vec2(st.x, lane - 0.004)) / vec2(id == 0 ? 0.1 : 0.07, 0.012);
    gCol *= 1.0 - 0.45 * (1.0 - smoothstep(0.8, 1.0, dot(sq, sq)));
    if (mode < 0.5 && id != 0) puffs(p, o, s, st.z, float(id), 1.0);
  }
  if (id == 0) ghost(p, o, s, st.z, mode);
  else if (id == 1) teen(p, o, s, st.z, mode, 1.0);
  else if (id == 2) kid(p, o, s, st.z, mode, 1.0);
  else dog(p, o, s, st.z, mode);
}

void main() {
  // composed for 16:9; a narrower screen zooms out instead of cropping the cast
  float zoom = max(1.0, 1.6 * uResolution.y / uResolution.x);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y * zoom;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFr = floor(uTime * 12.0);
  gPix = 0.9 * zoom / uResolution.y;
  gInk = 0.0048 * (1.0 + 2.5 * clamp(uLineBoost, 0.0, 1.0)) / 2.25;
  // the kick rattles the house: a held, stepped jolt
  p += clamp(shake, 0.0, 2.0) * 0.006 * gKick * gKick * (vec2(h11(gFr), h11(gFr + 9.0)) - 0.5);

  INK = vec3(0.012, 0.01, 0.028);
  cA = mix(uColor1, vec3(1.0), 0.16);
  cB = mix(uColor2, vec3(1.0), 0.16);
  cC = mix(uColor3, vec3(1.0), 0.16);
  cSkin = mix(vec3(1.0, 0.82, 0.66), uColor2, 0.08);
  vec3 warm = mix(vec3(1.0, 0.78, 0.45), uColor1, 0.35);

  // ---- choreography ----
  float cyc = uBeatClock * clamp(tempo, 0.25, 2.0) / 8.0;
  float n = floor(cyc);
  gTc = fract(cyc);
  float di = clamp(floor((p.x + 0.84) / 0.42), 0.0, 3.0);
  gXd = -0.63 + 0.42 * di;
  gOpen = 0.0;
  gSlam = 0.0;
  // every gag once per four, in an order that changes block by block
  float blk = floor(n / 4.0);
  float gag = mod(floor(h11(blk * 3.7 + 0.5) * 4.0) + (h11(blk * 7.9 + 1.5) > 0.5 ? 1.0 : 3.0) * n, 4.0);
  float ia = floor(h11(n * 5.1 + 2.0) * 4.0);
  float off = 2.0 + floor(h11(n * 9.7 + 4.0) * 2.0);
  float xa = -0.63 + 0.42 * ia;
  float xb = -0.63 + 0.42 * mod(ia + off, 4.0);
  float xc = -0.63 + 0.42 * mod(ia + 1.0, 4.0);
  float xe = -0.63 + 0.42 * mod(ia + 5.0 - off, 4.0);
  float dr = sign(xb - xa);
  vec4 sG = vec4(0.0), sT = vec4(0.0), sK = vec4(0.0), sD = vec4(0.0);
  float mG = 0.0, mT = 0.0, mK = 0.0, mD = 0.0;
  float nc = floor(clamp(crew, 1.0, 4.0) + 0.5);
  if (gag < 0.5) {
    // straight chase: out of one door, into another, the ghost on their heels
    sD = leg(sD, 0.125, 0.5, xa, xb, 1.0, 1.0);
    sT = leg(sT, 0.1875, 0.5625, xa, xb, 1.0, 1.0);
    sK = leg(sK, 0.25, 0.625, xa, xb, 1.0, 1.0);
    sG = leg(sG, 0.4375, 0.875, xa, xb, 1.0, 1.0);
  } else if (gag < 1.5) {
    // wrong door: the ghost is behind the one they run for; skid, and back
    float xs = xb - dr * 0.2;
    sD = leg(sD, 0.125, 0.375, xa, xs, 1.0, 0.0);
    sD = leg(sD, 0.375, 0.4375, xs, xs + dr * 0.04, 0.0, 0.0);
    sD = leg(sD, 0.4375, 0.6875, xs + dr * 0.04, xa, 0.0, 1.0);
    sT = leg(sT, 0.1625, 0.39, xa, xs - dr * 0.1, 1.0, 0.0);
    sT = leg(sT, 0.39, 0.46, xs - dr * 0.1, xs - dr * 0.06, 0.0, 0.0);
    sT = leg(sT, 0.46, 0.72, xs - dr * 0.06, xa, 0.0, 1.0);
    sK = leg(sK, 0.2, 0.405, xa, xs - dr * 0.22, 1.0, 0.0);
    sK = leg(sK, 0.405, 0.48, xs - dr * 0.22, xs - dr * 0.18, 0.0, 0.0);
    sK = leg(sK, 0.48, 0.75, xs - dr * 0.18, xa, 0.0, 1.0);
    float sk = step(0.375, gTc) * step(gTc, 0.4375);
    mD = sk;
    mT = step(0.39, gTc) * step(gTc, 0.46);
    mK = step(0.405, gTc) * step(gTc, 0.48);
    sG = peek(sG, 0.36, 0.5, xb, -dr, 1.0);
    mG = step(gTc, 0.5);
    sG = leg(sG, 0.5, 0.9, xb, xa, 1.0, 1.0);
  } else if (gag < 2.5) {
    // criss-cross: everybody through a different door at once
    sT = leg(sT, 0.125, 0.5, xa, xb, 1.0, 1.0);
    sK = leg(sK, 0.1875, 0.5625, xb, xa, 1.0, 1.0);
    sD = leg(sD, 0.25, 0.625, xc, xe, 1.0, 1.0);
    sG = leg(sG, 0.4375, 0.8125, xe, xc, 1.0, 1.0);
  } else {
    // the tables turn: the dog runs the ghost down the hall, the others watch
    sG = leg(sG, 0.125, 0.5, xa, xb, 1.0, 1.0);
    mG = 2.0;
    sD = leg(sD, 0.25, 0.625, xa, xb, 1.0, 1.0);
    sT = peek(sT, 0.2, 0.72, xc, sign(0.5 * (xa + xb) - xc + 0.001), 0.85);
    sK = peek(sK, 0.3, 0.8, xe, sign(0.5 * (xa + xb) - xe + 0.001), 0.85);
    mT = 2.0;
    mK = 2.0;
  }
  sD.w *= step(1.5, nc);
  sT.w *= step(2.5, nc);
  sK.w *= step(3.5, nc);

  // ---- painted background ----
  vec3 wallA = mix(vec3(0.05, 0.04, 0.085), uColor3, 0.17);
  vec3 wood = mix(vec3(0.05, 0.034, 0.036), uColor3, 0.1) + uColor2 * 0.012;
  vec3 doorC = mix(vec3(0.1, 0.06, 0.05), uColor3, 0.12) + uColor2 * 0.03;
  float pool = 0.0;
  for (int i = -1; i <= 1; i++) {
    vec2 sp = p - vec2(float(i) * 0.84, 0.2);
    float fl = 0.82 + 0.18 * h11(floor(uTime * 8.0) + float(i) * 3.0);
    pool += fl * exp(-dot(sp, sp) * 7.0);
  }
  pool *= clamp(candle, 0.0, 2.0) * (0.75 + 0.6 * gKick + 0.3 * uBass);
  float grain = vn(vec2(p.x * 14.0, p.y * 150.0)) * 0.6 + vn(p * 60.0) * 0.4;
  vec3 col;
  float dx = p.x - gXd;
  float dDoor = doorShape(vec2(dx, p.y - FY));
  gPx = gPix;
  gOw = gInk * 0.7;
  if (p.y > FY) {
    float st = fract(p.x / 0.07);
    col = wallA * (step(0.5, st) > 0.5 ? 1.32 : 1.0);
    vec2 mq = vec2((st - 0.75) * 0.07, (fract(p.y / 0.09) - 0.5) * 0.09);
    col = mix(col, wallA * 0.8, step(0.5, st) * (1.0 - smoothstep(0.011, 0.013, abs(mq.x) + abs(mq.y) * 0.55)));
    col *= mix(1.15, 0.55, smoothstep(-0.1, 0.5, p.y));
    // wainscot: panels under a chair rail
    if (p.y < -0.1) {
      col = wood;
      float pb = sdBox(vec2((fract(p.x / 0.14 + 0.5) - 0.5) * 0.14, p.y + 0.185), vec2(0.048, 0.045));
      col = mix(col, wood * 0.72, 1.0 - smoothstep(0.0, 0.003, pb));
      col = mix(col, wood * 1.45, 1.0 - smoothstep(0.001, 0.003, abs(pb + 0.001)));
      col = mix(col, wood * 1.5, step(-0.113, p.y));
      col = mix(col, wood * 0.55, step(p.y, FY + 0.022));
    }
    col = mix(col, wood * 0.5, smoothstep(0.425, 0.43, p.y + 0.012 * abs(sin(p.x * 22.4))));
    // candle light pools on the paint
    col += (warm * 0.1 + col * 1.3) * pool * (p.y < -0.1 ? 0.6 : 1.0);
    col *= 0.9 + 0.2 * grain;

    // portraits whose eyes follow the ghost
    float px = p.x > 0.0 ? 0.42 : -0.42;
    vec2 pq = p - vec2(px, 0.17);
    float fr = sdEll(pq, vec2(0.075, 0.1));
    if (fr < 0.02) {
      vec3 gold = mix(vec3(0.55, 0.38, 0.12), uColor1, 0.3) * (0.7 + 0.8 * pool);
      col = mix(col, INK, aa(fr - 0.013));
      col = mix(col, gold, aa(fr - 0.009));
      col = mix(col, gold * 0.6, aa(abs(fr - 0.004) - 0.0012));
      col = mix(col, mix(vec3(0.03, 0.03, 0.05), uColor3, 0.1) * (1.0 + pool), aa(fr));
      float bust = min(length(pq - vec2(0.0, 0.015)) - 0.03, sdEll(pq - vec2(0.0, -0.085), vec2(0.06, 0.05)));
      if (px > 0.0) bust = min(bust, sdBox(pq - vec2(0.0, 0.058), vec2(0.022, 0.022)));
      else bust = min(bust, sdEll(pq - vec2(0.0, 0.04), vec2(0.042, 0.022)));
      vec3 bc = mix(vec3(0.12, 0.1, 0.12), uColor2, 0.22) * (1.0 + pool);
      col = mix(col, bc, aa(max(bust, fr + 0.004)));
      float lk = clamp(((sG.w > 0.5 ? sG.x : 0.0) - px) * 1.5, -1.0, 1.0) * 0.0035;
      vec2 eq = vec2(abs(pq.x) - 0.012, pq.y - 0.02);
      col = mix(col, vec3(0.95, 0.95, 0.85), aa(length(eq) - 0.0065));
      col = mix(col, INK, aa(length(vec2(abs(pq.x - lk) - 0.012, pq.y - 0.02)) - 0.003));
    }

    // candelabra sconces
    float sx = clamp(floor(p.x / 0.84 + 0.5), -1.0, 1.0) * 0.84;
    vec2 sq = p - vec2(sx, 0.2);
    if (abs(sq.x) < 0.09 && abs(sq.y) < 0.13) {
      float cx = clamp(floor(sq.x / 0.045 + 0.5), -1.0, 1.0);
      vec2 cq = vec2(sq.x - cx * 0.045, sq.y);
      float arm = min(sdBox(sq - vec2(0.0, -0.002), vec2(0.052, 0.004)), sdBox(sq - vec2(0.0, -0.03), vec2(0.005, 0.03)));
      arm = min(arm, length(sq - vec2(0.0, -0.06)) - 0.014);
      col = mix(col, INK * 1.5 + warm * 0.04, aa(arm));
      col = mix(col, vec3(0.85, 0.8, 0.65) * (0.6 + 0.3 * pool), aa(sdBox(cq - vec2(0.0, 0.022), vec2(0.0065, 0.02))));
      float fk = h11(floor(uTime * 8.0) + cx * 5.0 + sx);
      vec2 fq = cq - vec2((fk - 0.5) * 0.005, 0.058);
      float flame = min(length(fq) - 0.0095, sdSeg(fq, vec2(0.0), vec2((fk - 0.5) * 0.01, 0.026 + 0.012 * gKick)) - 0.004);
      float on = step(0.02, candle);
      col += warm * 0.5 * exp(-max(flame, 0.0) * 70.0) * on;
      col = mix(col, warm * 1.2, aa(flame) * on);
      col = mix(col, vec3(1.0, 0.97, 0.85), aa(flame + 0.005) * on);
    }

    // door casing and the dark behind it
    col = mix(col, INK, aa(dDoor - 0.02));
    col = mix(col, doorC * (1.35 + 0.8 * pool), aa(dDoor - 0.016));
    vec3 inside = mix(vec3(0.012, 0.01, 0.025), uColor3 * 0.1, smoothstep(0.3, 0.0, p.y - FY));
    col = mix(col, inside, aa(dDoor));
  } else {
    // floorboards, in a perspective that only the seams suggest
    float f = (FY - p.y) / 0.24;
    float X = p.x / (1.0 + 0.35 * f);
    float row = floor(pow(f, 0.7) * 5.0);
    vec3 fl = mix(vec3(0.085, 0.06, 0.06), uColor3, 0.1) * (0.6 + 0.6 * f + 0.15 * h11(row));
    fl *= 1.0 - 0.45 * step(fract(X / 0.34 + row * 0.37), 0.012 / 0.34);
    fl *= 1.0 - 0.4 * step(fract(pow(f, 0.7) * 5.0), 0.05);
    col = fl * (1.0 + 0.8 * pool);
    // the runner
    float ry = p.y + 0.4;
    if (abs(ry) < 0.075) {
      vec3 rn = mix(vec3(0.12, 0.035, 0.05), uColor2, 0.2) * 0.5;
      vec2 rq = vec2((fract(X / 0.13) - 0.5) * 0.13, ry);
      rn = mix(rn, rn * 1.6, 1.0 - smoothstep(0.03, 0.033, abs(rq.x) + abs(rq.y) * 0.8));
      rn = mix(rn, rn * 0.6, 1.0 - smoothstep(0.012, 0.015, abs(rq.x) + abs(rq.y) * 0.8));
      rn = mix(rn, mix(uColor1, vec3(0.6, 0.45, 0.2), 0.4) * 0.5, step(0.055, abs(ry)) * step(abs(ry), 0.066));
      col = rn * (0.85 + 0.5 * pool);
    }
    col *= 0.9 + 0.2 * grain;
  }
  gCol = col;

  // ---- actors still in a doorway, behind the door leaf ----
  bool inDoor = dDoor < 0.0 && p.y > FY;
  if (inDoor) {
    if (sG.w > 0.5 && sG.y <= 0.6) drawActor(0, p, sG, mG, -0.365);
    if (sT.w > 0.5 && sT.y <= 0.6) drawActor(1, p, sT, mT, -0.39);
    if (sK.w > 0.5 && sK.y <= 0.6) drawActor(2, p, sK, mK, -0.41);
    if (sD.w > 0.5 && sD.y <= 0.6) drawActor(3, p, sD, mD, -0.43);
    gCol = mix(gCol, gCol * 0.45 + INK, 0.35);   // they are still in the dark
  }

  // ---- door leaf, hinged on the left, foreshortened as it swings out ----
  gPx = gPix;
  gOw = gInk * 0.7;
  if (abs(dx) < 0.16 && p.y > FY - 0.03) {
    float ang = gOpen * 1.32;
    float cv = cos(ang), sv = sin(ang);
    float lx = (dx + 0.1) / cv;                          // 0..0.2 across the leaf
    float tt = clamp(lx / 0.2, 0.0, 1.0);
    vec2 lq = vec2(lx - 0.1, (p.y - FY + 0.03 * sv * tt) / (1.0 + 0.16 * sv * tt));
    float dl = doorShape(lq);
    if (lx > 0.0 && dl < gOw + gPx) {
      vec3 lc = doorC * (1.0 - 0.4 * sv) * (1.0 + 0.7 * pool) * (0.9 + 0.2 * grain);
      float pn = min(sdBox(lq - vec2(0.0, 0.34), vec2(0.058, 0.07)) - 0.008, sdBox(lq - vec2(0.0, 0.12), vec2(0.058, 0.08)) - 0.008);
      vec3 lp = mix(lc, lc * 0.68, 1.0 - smoothstep(0.0, 0.004, pn));
      lp = mix(lp, lc * 1.5, 1.0 - smoothstep(0.0015, 0.004, abs(pn + 0.001)));
      float kn = length(lq - vec2(0.075, 0.225)) - 0.011;
      lp = mix(lp, INK, aa(kn - 0.004));
      lp = mix(lp, mix(vec3(0.8, 0.6, 0.2), uColor1, 0.3), aa(kn));
      gCol = mix(gCol, INK, aa(dl - gOw) * step(0.001, gOpen));
      gCol = mix(gCol, lp, aa(dl));
    }
  }
  // the slam: a starburst off the latch side
  if (gSlam > 0.0) {
    vec2 bq = p - vec2(gXd + 0.1, FY + 0.24);
    float bl = length(bq);
    float ray = step(0.78, fract(atan(bq.y, bq.x) / TAU * 11.0 + 0.2));
    float r0 = 0.03 + 0.05 * (1.0 - gSlam);
    gCol = mix(gCol, vec3(1.0), 0.9 * ray * step(r0, bl) * step(bl, r0 + 0.035 + 0.03 * gSlam) * step(0.25, gSlam));
  }

  // ---- actors out on the runner, far lane first ----
  if (sG.w > 0.5 && sG.y > 0.6) drawActor(0, p, sG, mG, -0.365);
  if (sT.w > 0.5 && sT.y > 0.6) drawActor(1, p, sT, mT, -0.39);
  if (sK.w > 0.5 && sK.y > 0.6) drawActor(2, p, sK, mK, -0.41);
  if (sD.w > 0.5 && sD.y > 0.6) drawActor(3, p, sD, mD, -0.43);

  col = gCol;
  col *= clamp(1.2 - dot(p, p) * 0.75, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;   // dither: the wall gradients band at 8 bit
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

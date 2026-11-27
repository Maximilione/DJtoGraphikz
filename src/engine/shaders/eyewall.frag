precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float eyes;
uniform float unison;
uniform float nerve;
uniform float dive;

// Eyewall: a black wall of eyes. Two hex lattices in the same squashed space,
// one three times the other: a coarse cell either holds one giant eye (which
// hides the seven fine cells under it) or leaves its fine cells alone, so a
// pixel only ever shades one eye and no neighbour is tested. Each eye is a
// sphere impostor turned by its gaze, behind two parabolic lids. Gaze, blinks
// and the phrase dive are closed forms of the beat clock and of hashes, so
// both windows draw the same wall.

const float TAU = 6.2831853;
const float SQ3 = 1.7320508;
const float ASP = 0.62;      // lattice squash: eyes are wider than tall
const float FOOT = 1.2;      // cell radius in eye units (1 = half the eye slit)
const float RB = 1.08;       // eyeball radius, eye units
const float SIN_IRIS = 0.426; // iris half-angle on the ball (0.46 / RB)
const vec2 BALL = vec2(0.0, 0.08);
const float LAT = 0.31;     // lattice rotation, radians

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// value noise periodic in x: the iris angle wraps without a seam
float pn(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, per), x1 = mod(i.x + 1.0, per);
  float a = hash21(vec2(x0, i.y)), b = hash21(vec2(x1, i.y));
  float c = hash21(vec2(x0, i.y + 1.0)), d = hash21(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// centre of the hex cell holding p (neighbour spacing 1)
vec2 hexC(vec2 p) {
  vec2 r = vec2(1.0, SQ3), h = r * 0.5;
  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
  return p - (dot(a, a) < dot(b, b) ? a : b);
}

// integer id of a lattice centre
vec2 cid(vec2 c) { return floor(c * vec2(2.0, 2.0 / SQ3) + 0.5); }

// Step response of an under-damped spring, x in beats: peaks ~9% past the
// target at 0.1 beat (47 ms at 128 bpm) and settles by 0.25. A saccade is
// ballistic, so this is never eased at the far end.
float snap(float x) {
  if (x <= 0.0) return 0.0;
  return 1.0 - exp(-23.6 * x) * (cos(31.4 * x) + 0.75 * sin(31.4 * x));
}

// where the wall looks on beat b, screen units
vec2 targetOf(float b, float seed) {
  float k = mod(b, 512.0) + seed * 7.0;
  return vec2((hash11(k + 3.3) - 0.5) * 1.6, (hash11(k + 8.1) - 0.5) * 0.84);
}

// a lash row growing e away from the lid edge, fanning out from the middle
float lashes(float x, float e, float K, float len, float h, float aa, float tw) {
  if (e <= 0.0 || e >= len) return 0.0;
  float s = (x / (1.0 + 1.5 * e) + tw * e) * K;
  float hl = hash11(floor(s) * 1.7 + h * 57.0);
  float t = e / (len * (0.55 + 0.45 * hl));
  if (t >= 1.0) return 0.0;
  float w = 0.11 * (1.0 - t) + 0.02;
  float d = abs(fract(s) - 0.5 + (hl - 0.5) * 0.5 + (hl - 0.4) * 0.4 * t * t);
  return (1.0 - smoothstep(w - aa * K, w + aa * K, d)) * sqrt(max(1.0 - x * x, 0.0));
}

float dith() { return (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float bc = uBeatClock;
  float diveOn = step(0.001, dive);
  float phrase = floor(bc / 32.0);
  float ph = bc - 32.0 * phrase;
  // the wall is reseeded behind the black of the dive; without a dive it stays
  float seed = mod(phrase, 61.0) * diveOn;

  float pitch = 1.78 / clamp(floor(eyes + 0.5), 3.0, 60.0);

  // phrase dive: the last 4 beats push into the pupil of the eye at the
  // origin, up to the zoom where that pupil covers the frame
  float u = clamp((ph - 28.0) / 4.0, 0.0, 1.0);
  float pupilW = 1.23 * pitch / FOOT * RB * SIN_IRIS * 0.8;
  // sized for 16:9 whatever the window, so both windows zoom alike
  float Z = 1.27 / pupilW;
  float zoom = exp(log(Z) * dive * u * u);
  // the next wall arrives still moving
  zoom *= 1.0 - 0.3 * dive * exp(-4.0 * ph);
  p /= zoom;
  float gate = 1.0 - min(dive * 4.0, 1.0) * (1.0 - smoothstep(0.0, 0.6, ph) * (1.0 - smoothstep(31.5, 32.0, ph)));
  float diving = diveOn * smoothstep(0.0, 0.4, u);

  // ---- which eye owns this pixel
  // rows slanted so the lattice never lines up with the frame
  vec2 Lp = rot(vec2(p.x, p.y / ASP), LAT) / pitch;
  vec2 cC = hexC(Lp / 3.0) * 3.0;
  bool centre = dot(cC, cC) < 0.01;
  vec2 idC = cid(cC) + seed * 13.0;
  bool bigCell = centre || hash21(idC + 71.0) < 0.3;

  vec2 cell = cC, cL = cC;
  float rad = 0.0, he = 0.0;
  bool has = false;
  if (bigCell) {
    float size = centre ? 1.0 : 0.8 + 0.2 * hash21(idC + 5.0);
    float ja = hash21(idC + 9.0) * TAU;
    cL = cC + vec2(cos(ja), sin(ja)) * (1.0 - size) * 1.23 * sqrt(hash21(idC + 2.0));
    rad = 1.23 * size;
    he = hash21(idC + 31.0);
    has = length(Lp - cL) < rad;
  }
  if (!has) {
    centre = false;   // a fine eye on the rim of the middle cell is not the dive eye
    cell = hexC(Lp);
    // the giant eye took the seven fine cells under it
    if (!(bigCell && length(cell - cC) < 1.2)) {
      vec2 idF = cid(cell) + seed * 13.0;
      float size = mix(0.52, 1.0, hash21(idF + 5.0));
      float ja = hash21(idF + 9.0) * TAU;
      cL = cell + vec2(cos(ja), sin(ja)) * (1.0 - size) * 0.5 * sqrt(hash21(idF + 2.0));
      rad = 0.5 * size;
      he = hash21(idF);
      has = length(Lp - cL) < rad;
    }
  }
  if (!has) { gl_FragColor = vec4(vec3(0.0), 1.0); return; }

  float eR = length(Lp - cL) / rad;
  float h2 = hash11(he * 113.0 + 1.0), h3 = hash11(he * 271.0 + 2.0), h4 = hash11(he * 59.0 + 3.0);
  vec2 c = rot(cL, -LAT) * pitch * vec2(1.0, ASP);
  float U = rad * pitch / FOOT;
  float px = 1.0 / (uResolution.y * U * zoom);
  float tilt = centre ? 0.0 : (h2 - 0.5) * 0.4;
  float mir = (h3 > 0.5 && !centre) ? -1.0 : 1.0;
  vec2 d = rot((p - c) / U, -tilt);
  d.x *= mir;
  vec2 q = d + BALL;

  // ---- gaze, as the tangent of the two eye angles
  float b = floor(bc), f = bc - b;
  float lit = smoothstep(0.02, 0.12, max(uEnergy, uBass));
  bool follow = h4 < unison * lit;
  bool audience = mod(b, 4.0) > 2.5;

  // idle wander on wall time, so the room is alive with the music stopped
  float tw = uTime * 0.45 + he * 23.0;
  float kw = mod(floor(tw), 997.0);
  vec2 w0 = (vec2(hash21(vec2(kw, he * 91.0)), hash21(vec2(kw, he * 37.0 + 5.0))) - 0.5) * vec2(1.0, 0.5);
  vec2 w1 = (vec2(hash21(vec2(kw + 1.0, he * 91.0)), hash21(vec2(kw + 1.0, he * 37.0 + 5.0))) - 0.5) * vec2(1.0, 0.5);
  // fract(tw) / 0.45 is seconds; snap() wants 0.1 at its 50 ms peak
  vec2 tg = mix(w0, w1, snap(fract(tw) / 0.45 * 2.0));

  // one eye per 16 beats refuses the target for 4 beats
  float blk = floor(b / 16.0);
  // four hashed candidates, the first that is a giant wins: a small rogue is lost in the crowd
  vec2 rC = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i) * 17.0 + mod(blk, 251.0) * 3.7 + seed;
    vec2 rp = vec2((hash11(fi + 1.0) - 0.5) * 1.3, (hash11(fi + 2.0) - 0.5) * 0.7);
    rC = hexC(rot(vec2(rp.x, rp.y / ASP), LAT) / pitch / 3.0) * 3.0;
    if (hash21(cid(rC) + seed * 13.0 + 71.0) < 0.3 && dot(rC, rC) > 0.01) break;
  }
  float rb = mod(b, 16.0);
  bool rogue = rb > 7.5 && rb < 11.5 && lit > 0.5 && length(cell - rC) < 0.1;

  if (follow || rogue) {
    const float D = 0.9;   // the target floats this far in front of the wall
    vec2 t0 = mod(b - 1.0, 4.0) > 2.5 ? vec2(0.0) : (targetOf(b - 1.0, seed) - c) / D;
    vec2 t1 = audience ? vec2(0.0) : (targetOf(b, seed) - c) / D;
    if (rogue) {
      t0 = -t0 + vec2(0.6, -0.15) * (1.0 - smoothstep(0.0, 0.3, length(t0)));
      t1 = -t1 + vec2(0.6, -0.15) * (1.0 - smoothstep(0.0, 0.3, length(t1)));
      if (rb < 8.5) t0 = -t0;   // it was with the others one beat ago
    }
    tg = mix(t0, t1, snap(f - (rogue ? 0.5 : he * 0.02)));
  }
  // highs: micro-saccades, stepped
  float kj = mod(floor(uTime * 13.0 + he * 5.0), 997.0);
  tg += (vec2(hash21(vec2(kj, he * 11.0)), hash21(vec2(kj, he * 29.0 + 3.0))) - 0.5) * 0.09 * uHigh * nerve;
  // peak: each eye crosses its own threshold and snaps to the crowd
  float stare = rogue ? 0.0 : smoothstep(0.0, 0.02, uEnergy - 0.84 - 0.08 * h3);
  float straight = max(stare, centre ? diveOn * step(28.0, ph) : 0.0);
  tg *= 1.0 - straight;
  // the globe cannot turn further than this: saturate, do not clip
  vec2 lim = vec2(0.55, 0.36);
  tg /= sqrt(1.0 + dot(tg / lim, tg / lim));
  vec2 tl = rot(tg, -tilt);
  tl.x *= mir;
  vec3 g = normalize(vec3(tl, 1.0));

  // ---- lids
  float share = mix(0.14, 1.02, smoothstep(0.04, 0.55, uEnergy));
  float oE = clamp((share - (centre ? 0.0 : h4 * 0.7 + he * 0.3)) / 0.06, 0.0, 1.0);
  oE = oE * oE * (3.0 - 2.0 * oE);
  float sleepy = mix(0.45, 1.0, smoothstep(0.05, 0.5, uEnergy)) + 0.06 * sin(uTime * 0.5 + he * 40.0);
  // mids: a blink ring leaves the target every other beat
  float eb = 2.0 * floor(b * 0.5);
  float xw = bc - eb - length(c - targetOf(eb, seed)) / 1.8 - 0.12;
  float blink = smoothstep(0.0, 0.1, xw) * (1.0 - smoothstep(0.12, 0.42, xw)) * smoothstep(0.1, 0.45, uMid);
  // spontaneous blinks: closed in 60 ms, open again by 300
  float ts = uTime * 2.1 + he * 31.0;
  float xs = fract(ts) / 2.1;
  float own = step(hash21(vec2(mod(floor(ts), 997.0), he * 71.0)), 0.04 + 0.11 * nerve);
  blink = max(blink, own * smoothstep(0.0, 0.06, xs) * (1.0 - smoothstep(0.08, 0.3, xs)));
  float open = oE * clamp(sleepy, 0.0, 1.0) * (1.0 - blink);
  if (rogue) open = 1.0 - blink;
  open = mix(open, 1.0, centre ? diving : 0.0);

  float x = q.x, y = q.y;
  float par = max(1.0 - x * x, 0.0);
  // the upper lid does the travel and follows the gaze down; shut, both lie
  // on the same curve
  float hU = mix(-0.13, 0.46 + 0.12 * uBass + 0.1 * stare, open) + 0.3 * g.y * open;
  float hL = mix(0.13, 0.36 + 0.03 * uBass, open) - 0.1 * g.y * open;
  float yU = hU * par * (1.0 - 0.22 * x);
  float yL = -hL * par * (1.0 + 0.25 * x);
  float dU = (yU - y) / sqrt(1.0 + 4.0 * hU * hU * x * x);
  float dL = (y - yL) / sqrt(1.0 + 4.0 * hL * hL * x * x);
  float slit = smoothstep(-px, px, min(dU, dL));

  vec3 Lw = normalize(vec3(-0.45, 0.55, 0.7));
  vec2 lxy = rot(Lw.xy, -tilt);
  lxy.x *= mir;
  vec3 LL = vec3(lxy, Lw.z);
  float hit = clamp(uBassHit, 0.0, 1.0);

  vec3 col = vec3(0.0);

  // ---- the ball
  if (slit > 0.0) {
    vec2 bq = d / RB;
    vec3 n = vec3(bq, sqrt(max(1.0 - dot(bq, bq), 0.0)));
    float cosA = dot(n, g);
    float rI = sqrt(max(1.0 - cosA * cosA, 0.0)) / SIN_IRIS + step(cosA, 0.0) * 9.0;
    float aa = px * 2.5;
    float diff = clamp(dot(n, LL), 0.0, 1.0);
    vec3 ball;

    if (rI < 1.0 + aa) {
      vec3 ax = normalize(vec3(g.z, 0.0, -g.x));
      vec3 ay = cross(g, ax);
      vec2 io = vec2(dot(n, ax), dot(n, ay));
      float a = atan(io.y, io.x) / TAU;
      float pr = 0.34 + 0.24 * uBass - 0.14 * hit + 0.04 * (h2 - 0.5);
      pr = mix(pr, 0.76, max(stare, centre ? diving : 0.0));
      pr = clamp(pr, 0.2, 0.8);
      float fa = pn(vec2(a * 56.0, rI * 1.6 + he * 9.0), 56.0);
      float fb = pn(vec2(a * 150.0, rI * 3.5 + he * 4.0), 150.0);
      float fib = 0.55 * fa + 0.45 * fb;
      fib *= fib;
      // collarette: the ragged border between the two rings
      float rc = pr + (1.0 - pr) * 0.36 + 0.2 * (fa - 0.5);
      vec3 inner = mix(uColor1, uColor2, 0.45 + 0.55 * h3);
      vec3 ic = mix(inner, uColor1, smoothstep(rc - 0.07, rc + 0.12, rI));
      ic *= 0.22 + 2.1 * fib;
      ic += inner * 0.35 * exp(-pow((rI - rc) / 0.07, 2.0)) * fb;
      ic *= 1.0 - 0.8 * smoothstep(0.76, 1.0, rI);          // limbal ring
      // the iris is a dish: it lights up on the side away from the lamp
      ic *= 0.8 + 0.5 * dot(io / SIN_IRIS, -normalize(LL.xy));
      ic *= 0.55 + 0.45 * smoothstep(pr, pr + 0.14, rI);
      ic *= smoothstep(pr - aa, pr + aa, rI) * 0.85;
      ball = ic;
    }
    if (rI > 1.0 - aa) {
      vec3 sc = vec3(0.60, 0.585, 0.57) * (0.3 + 0.7 * diff);   // 0.6 is the ceiling
      float rim = smoothstep(0.25, 0.8, n.z);
      sc *= mix(vec3(0.5, 0.36, 0.33), vec3(1.0), rim);
      float veinAmt = clamp(nerve * (0.2 + 0.8 * smoothstep(0.35, 0.9, uEnergy)), 0.0, 2.0);
      // veins ride the ball: follow the gaze
      vec2 vp = (bq - g.xy) * 5.0 + he * 37.0;
      vp += (vn2(vp * 0.6 + 11.0) - 0.5) * 2.4;
      float vein = smoothstep(0.90, 0.99, 1.0 - abs(2.0 * vn2(vp) - 1.0));
      vein *= smoothstep(1.05, 1.7, rI) * min(veinAmt, 1.0);
      sc = mix(sc, vec3(0.42, 0.04, 0.03) * (0.4 + 0.6 * diff), vein * 0.85);
      sc *= mix(vec3(1.0), vec3(1.0, 0.74, 0.70), 0.5 * veinAmt * (1.0 - rim * 0.6));
      sc *= 1.0 - 0.3 * exp(-(rI - 1.0) * 7.0);
      // caruncle: the wet pink corner
      sc = mix(sc, vec3(0.36, 0.10, 0.09) * (0.35 + 0.65 * diff), smoothstep(-0.70, -0.92, x));
      ball = rI < 1.0 + aa ? mix(ball, sc, smoothstep(1.0 - aa, 1.0 + aa, rI)) : sc;
    }

    // lid thickness: the upper lid overhangs and shades the ball
    ball *= 1.0 - 0.8 * exp(-max(dU, 0.0) / 0.13);
    ball *= 1.0 - 0.4 * exp(-max(dL, 0.0) / 0.05);

    // catchlights sit on the cornea, which bulges toward the gaze
    float onI = 1.0 - smoothstep(0.9, 1.25, rI);
    vec3 nc = normalize(n + 0.45 * g * onI);
    float s1 = dot(nc, normalize(LL + vec3(0.0, 0.0, 1.0)));
    vec3 keyC = mix(vec3(1.0), uColor3, 0.35);
    ball += keyC * smoothstep(0.9972, 0.9986, s1) * (0.9 + 1.3 * hit) * (0.2 + 0.8 * onI);
    ball += keyC * pow(max(s1, 0.0), 50.0) * 0.07;
    vec2 l2 = rot(vec2(0.5, -0.38), -tilt);
    l2.x *= mir;
    float s2 = dot(nc, normalize(vec3(l2, 0.9)));
    ball += uColor3 * smoothstep(0.9990, 0.9996, s2) * (0.3 + 0.5 * hit + 0.4 * uHigh) * onI;
    // tear line along the lower lid
    float tear = exp(-pow((dL - 0.028) / 0.014, 2.0)) * par;
    ball += keyC * tear * (0.10 + 0.55 * uHigh) * (0.45 + 0.55 * sin(x * 21.0 + he * 40.0 + kj));

    col = ball * slit;
  }

  // ---- lids and socket skin, lit as a dome over the ball
  if (slit < 1.0) {
    vec2 bd = d / 1.4;
    vec3 nd = vec3(bd, sqrt(max(1.0 - dot(bd, bd), 0.0)));
    float key = 0.2 + 0.8 * clamp(dot(nd, LL), 0.0, 1.0);
    vec2 r2 = rot(vec2(0.75, 0.5), -tilt);
    r2.x *= mir;
    float rimL = pow(clamp(dot(nd, normalize(vec3(r2, 0.15))), 0.0, 1.0), 2.5);
    float lean = 0.5 * uHigh * (hash21(vec2(kj, he * 3.0)) - 0.5);
    float closed = 1.0 - smoothstep(0.12, 0.45, open);
    vec3 base = vec3(0.25, 0.20, 0.185);
    // upper lid: the fold is fixed on the socket, so the platform under it
    // grows as the lid comes down
    float eU = -dU;
    float ec = 0.64 * (1.0 - 0.8 * x * x) + 0.02 - y;
    float plat = smoothstep(0.0, 0.04, ec);
    float amtU = mix(0.55 * exp(ec / 0.22), 1.0, plat) * (1.0 - 0.75 * exp(-pow(ec / 0.03, 2.0)));
    amtU *= smoothstep(0.0, 0.035, eU) * 0.85 + 0.15;                 // dark underside of the margin
    float edgeU = exp(-pow((eU - 0.03) / 0.015, 2.0)) * plat;
    float lashU = lashes(x, eU, 27.0, 0.15, he, px, lean) * (1.0 - closed);
    // lower lid
    float eD = -dL;
    float wl = (1.0 - smoothstep(0.035, 0.06, eD)) * (1.0 - closed);  // waterline
    float amtD = mix(mix(0.75, 1.0, closed) * exp(-eD / mix(0.2, 0.32, closed)), 1.0, wl) * (1.0 - 0.45 * exp(-pow((eD - 0.22) / 0.035, 2.0)));
    float edgeD = 0.5 * exp(-pow((eD - 0.03) / 0.02, 2.0)) * (1.0 - closed);
    // shut, the upper lashes lie over the lower lid
    float lashD = max(lashes(x, eD - 0.05, 16.0, 0.08, he + 0.3, px, lean) * (1.0 - closed) * 0.7,
                      lashes(x, eD, 27.0, 0.15, he, px, lean) * closed);
    // past the corners the two lids are one skin: blend, no seam
    float k = smoothstep(-0.07, 0.07, eU - eD);
    float amt = mix(amtD, amtU, k), edge = mix(edgeD, edgeU, k), lash = mix(lashD, lashU, k);
    vec3 skin = mix(mix(base, vec3(0.30, 0.14, 0.12), wl), base, k);
    key = mix(0.62 + 0.38 * key, key, k);   // the lower lid faces away from the lamp: fill it
    amt *= 1.0 - 0.3 * closed;
    // shut: the lash line where the two margins meet
    amt *= 1.0 - 0.85 * closed * exp(-pow(min(abs(eU), abs(eD)) / 0.022, 2.0));
    // the cornea pushes the lid out: a sleeping eye still shows where it looks
    vec2 cb = d - g.xy * RB;
    amt *= 1.0 + 0.4 * exp(-dot(cb, cb) / 0.1) * k * plat;
    vec3 lid = skin * key * amt + uColor3 * (0.34 * rimL * amt + 0.22 * edge * key);
    lid *= 1.0 - 0.85 * lash * (1.0 - 0.5 * closed * (1.0 - k));
    col += lid * (1.0 - slit);
  }

  col *= gate * (1.0 - smoothstep(0.78, 1.0, eR));
  gl_FragColor = vec4(max(col + dith(), 0.0), 1.0);
}

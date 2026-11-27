precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float dancers;
uniform float flail;
uniform float canon;
uniform float blast;

// Tube Men: a row of inflatable tube dancers on a night forecourt, floodlit
// from behind through haze. Air pressure is the music. Each dancer is a chain
// of capsules whose joint angles are a closed form of the clocks, so both
// windows draw the same picture and nothing is integrated:
//   - below the fold point the tube is full of air, straight and fat; above it
//     the fabric is limp, curls toward gravity and flaps;
//   - a beat is one breath: the kick sends a bulge from the blower to the head
//     in half a beat, pushing the fold up until the tube snaps straight and the
//     arms fly up, then the pressure leaks and the fold sinks again;
//   - 16 beats are one phrase: a bow in the fourth bar, then one tube tears off
//     its blower and corkscrews away while a new one fills in its place;
//   - 32 beats swap the floodlights to the other side.
// A pixel only tests the two dancers whose lanes bracket it (plus the one in
// flight), so the cost does not grow with the row.

const float PI = 3.14159265;
const vec3 INK = vec3(0.025, 0.02, 0.055);
const float GROUND = -0.36;     // where the blowers stand
const float HZ = -0.27;         // horizon of the forecourt
const int NS = 9;               // spine capsules, the last one is the head
const float SEG = 0.0745;       // one body capsule; the head is 1.4 of these
const float RAD = 0.05;
const float ARM = 0.068;

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}

vec3 gCol;                      // the frame being painted
float gPx;                      // one screen pixel, in scene units
float gInk;                     // half width of the pen line
vec3 gKey;                      // where the floodlight comes from
vec3 gLit, gShade;              // the two cel tones, as multipliers of the fabric colour
vec2 gRimDir;

// one dancer, posed: spine joints and radii, the two arms, the face
vec2 gJ[10];
float gR[10];
vec2 gA[8];                     // left arm 0..3, right arm 4..7
float gArmR;
float gHead;                    // air in the head: 1 taut .. 0 limp
float gYell;                    // 1 = the round mouth of the one in flight
float gLook;
float gBj, gBh;                 // which capsule of the chain was nearest, and where along it

float cut(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }
vec2 dir(float a) { return vec2(sin(a), cos(a)); }   // 0 = up, positive leans right
vec3 pal(float k) { k = mod(k, 3.0); return k < 0.5 ? uColor1 : k < 1.5 ? uColor2 : uColor3; }

// nearest capsule of a chain: x distance, yz the direction away from the axis, w the radius there
void cap(vec2 p, vec2 a, vec2 b, float ra, float rb, inout vec4 best) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 q = pa - ba * h;
  float l = length(q), r = mix(ra, rb, h);
  if (l - r < best.x) { best = vec4(l - r, q / max(l, 1e-5), r); gBh = h; }
}

// a tube as the pen draws it: ink line, two flat tones split along its length by
// the coordinate across it, a rim of the next colour on the edge facing the light
void tube(vec4 t, vec3 base, vec3 rim, float sparkle) {
  if (t.x > gInk + gPx) return;
  float rho = clamp(1.0 + t.x / t.w, 0.0, 1.0);
  float lam = dot(t.yz, gKey.xy) * rho + gKey.z * sqrt(1.0 - rho * rho);
  float e = gPx / t.w;
  vec3 c = base * mix(gShade, gLit, smoothstep(-e, e, lam - 0.12));
  // sequins: single cells of the weave catch the lamps
  vec2 cell = floor(gl_FragCoord.xy / max(uResolution.y / 270.0, 1.0));
  c += sparkle * step(0.975, h21(cell + floor(uTime * 12.0) * 7.0)) * step(0.0, lam);
  float rm = smoothstep(0.74, 0.74 + 2.0 * e, rho) * smoothstep(0.2, 0.35, dot(t.yz, gRimDir));
  c = mix(c, rim, rm);
  gCol = mix(gCol, INK, cut(t.x - gInk));
  gCol = mix(gCol, c, cut(t.x));
}

// The pose of dancer i of n on its blower at x0. q = beats into the phrase,
// lim = how far sideways it may reach (the next lane), grow = air let into a
// new tube, over = overpressure before it tears off, bow = the row's bow.
void pose(float i, float n, float x0, float lim, float q, float grow, float over, float bow, float hs) {
  float ph = i * 2.399;
  // the canon: each lane hears the beat a little later; unison around the phrase events
  float cw = smoothstep(0.0, 1.5, q) * (1.0 - smoothstep(11.0, 12.0, q));
  float c = uBeatClock - cw * canon * i / n;
  float phi = fract(c);
  float sig = mod(floor(c) + i, 2.0) * 2.0 - 1.0;          // which way this beat buckles
  float kick = clamp(max(uBassHit, 1.5 * uBass), 0.0, 1.0) * blast * grow * (1.0 - bow);
  float kc = min(kick, 1.0);

  // with no music one after the other heaves half up and sinks back
  float heave = pow(max(sin(uTime * 0.45 + ph * 1.3), 0.0), 6.0) * (1.0 - smoothstep(0.1, 0.4, uEnergy));
  float press = clamp(0.04 + 0.3 * heave + 0.75 * smoothstep(0.15, 0.85, uEnergy) + 0.35 * uBass
                      + 0.1 * sin(uTime * 1.3 + ph * 2.1) * smoothstep(0.1, 0.3, uEnergy), 0.0, 1.0) * grow;
  press = mix(press, 1.0, over);

  // at rest: where the tube folds and how far the limp part has fallen
  float f0 = mix(0.02, 1.3, smoothstep(0.0, 1.0, press));
  float a0 = mix(2.2, 0.55 * flail, press) * (mod(i, 2.0) * 2.0 - 1.0);
  // the breath of a beat: the bulge front leaves the blower fast and is out of the
  // head by half a beat, pushing the fold ahead of it; then the fold sinks back to a
  // height the bass holds up
  float front = phi < 0.5 ? 5.6 * phi * (1.0 - phi) : 2.8 * phi;
  float fk = clamp(0.15 + 0.4 * uBass + 0.15 * press - 0.15 * (flail - 1.0), 0.12, 0.95);
  float fc = phi < 0.5 ? max(fk, front) : mix(1.4, fk, smoothstep(0.5, 1.0, phi));
  float ac = flail * mix(1.5, 0.9, uBass) * (phi < 0.5 ? 1.0 - smoothstep(0.2, 0.45, phi) : smoothstep(0.5, 0.95, phi));
  float sk = sig * (2.0 * smoothstep(0.3, 0.5, phi) - 1.0);   // the side changes while it stands straight
  float f = mix(f0, fc, kc);
  float A = mix(a0, ac * sk, kc);
  f = mix(f, 0.36, bow);
  A = mix(A, 2.3, bow);
  f = mix(f, 1.6, over);

  float sgn = A / (abs(A) + 0.15);
  float curl = mix(0.62, 0.16, smoothstep(0.1, 0.7, press)) * (1.0 - 0.6 * kc);  // gravity on the limp part, per joint
  float hang = mix(3.7, 2.4, smoothstep(0.1, 0.45, press)); // an empty tube curls under itself on the ground, a half full one only droops
  float crumple = 0.9 * (1.0 - smoothstep(0.1, 0.5, press));
  float shake = flail * 0.07 * smoothstep(0.12, 0.4, press) * (1.0 - smoothstep(0.6, 0.95, press)) + 0.05 * over;
  // follow-through: the top overshoots past upright after the snap and rings down
  float tau = phi - 0.28;
  float whip = tau > 0.0 ? kick * flail * 0.45 * sig * exp(-7.0 * tau) * sin(20.0 * tau) : 0.0;
  hs *= 1.0 + 0.05 * over;

  float a = 0.05 * sin(uTime * 1.9 + ph) - 0.07 * flail * sk * kc;  // the hips answer the head
  float aSh = 0.0;
  vec2 P = vec2(x0, GROUND + 0.035);
  gJ[0] = P;
  for (int j = 0; j < NS; j++) {
    float s = float(j) / float(NS);
    float lj = smoothstep(f - 0.08, f + 0.15, s);          // 0 full of air .. 1 limp
    if (j > 0) {
      float x = (s - f) / 0.17;
      a += A * exp(-x * x) / 2.71;                         // the fold, a bump of bend that slides along the joints
      a += sgn * curl * lj;
      a += lj * flail * (0.24 * s * sin(uTime * 6.1 - 7.0 * s + ph) + 0.13 * sin(uBassTime * 9.0 - 11.0 * s + ph * 2.0));
      a += lj * crumple * sin(float(j) * 2.6 + ph * 3.0);     // an empty tube lies in folds, not in an arc
      a += shake * sin(uTime * 31.0 + float(j) * 2.1 + ph);
      a += 0.78 * whip * s * s;
    }
    float al = hang * tanh(a / hang);
    if (j == 6) aSh = al;
    float bx = (s - front) / 0.16;
    float r = RAD * hs * mix(1.0, 0.9, s) * (1.0 - mix(0.42, 0.3, press) * lj) * (1.0 + 0.5 * min(kick, 1.25) * exp(-bx * bx * 1.6) * min(1.0, 0.3 + 6.0 * s) + 0.22 * over);
    gR[j] = r;
    float len = (j == NS - 1 ? 1.4 : 1.0) * SEG * hs;
    vec2 N = P + dir(al) * len;
    // fabric lies on the tarmac: a capsule that would go under keeps its length along the ground
    float fl = GROUND + 0.7 * r;
    if (N.y < fl) {
      float dy = fl - P.y;
      N = vec2(P.x + sqrt(max(len * len - dy * dy, 0.0)) * clamp(sin(al) * 4.0, -1.0, 1.0), fl);
    }
    gJ[j + 1] = vec2(x0 + lim * tanh((N.x - x0) / lim), N.y);
    P = N;
  }
  gR[NS] = gR[NS - 1] * 0.97;
  gHead = 1.0 - smoothstep(f - 0.08, f + 0.15, 0.95);
  gLook = clamp(-sgn * (1.0 - gHead) + 0.6 * sk * kc, -1.0, 1.0);
  gYell = over;

  // arms: full of air only while the fold is above the shoulders; the lift of the
  // snap reaches each capsule a little later than the one before
  float air = (1.0 - smoothstep(f - 0.08, f + 0.15, 0.667)) * smoothstep(0.2, 0.45, press + 0.4 * kc);
  gArmR = 0.021 * hs * (0.8 + 0.2 * air);
  float la = lim + 0.035;
  for (int sd = 0; sd < 2; sd++) {
    float sg = float(sd) * 2.0 - 1.0;
    vec2 Q = gJ[6] + dir(aSh + sg * PI * 0.5) * 0.7 * gR[6];
    gA[sd * 4] = Q;
    for (int k = 0; k < 3; k++) {
      float fk3 = float(k);
      float t = phi - 0.14 - 0.07 * fk3;
      float up = kick * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.15, 0.5, t));
      float wv = flail * (0.2 + 1.0 * uMid) * (fk3 + 1.0) / 3.0 * sin(uTime * 7.3 - fk3 * 1.2 + ph + sg * 0.9);
      float full = aSh + sg * (PI * 0.5 - 0.15 - min(1.3 * up, 1.4) - 0.9 * over) + wv * (1.0 - 0.7 * min(up, 1.0));
      float limp = sg * (PI - 0.28) + 0.25 * wv - 0.5 * a * fk3 / 3.0;
      Q += dir(mix(limp, full, air)) * ARM * hs;
      Q.y = max(Q.y, GROUND + 0.6 * gArmR);
      gA[sd * 4 + k + 1] = vec2(x0 + la * tanh((Q.x - x0) / la), Q.y);
    }
  }
}

// head of the torn-off tube, t beats after it left its blower at s0
vec2 rpath(float t, vec2 s0, float dx) {
  if (t < 0.0) return s0 + vec2(0.0, 0.9 * t);
  float sc = 1.0 / (1.0 + 0.55 * t * t);
  float th = 3.6 * t;
  vec2 c = mix(s0, vec2(s0.x + dx * 0.3, 0.02), 1.0 - exp(-1.6 * t));
  return c + 0.24 * sc * vec2(dx * (1.0 - cos(th)), sin(th));
}

// the one in flight: its joints are where the head was a moment ago, so the
// body lies along the corkscrew it flew; the open end flaps
void rocketPose(float t, vec2 s0, float dx) {
  float dt = SEG / 0.9;
  float tt = t;
  for (int j = NS; j >= 0; j--) {
    float w = float(NS - j) / float(NS);
    float sc = 1.0 / (1.0 + 0.55 * max(tt, 0.0) * max(tt, 0.0));
    vec2 H = rpath(tt, s0, dx);
    vec2 tn = normalize(H - rpath(tt - 0.02, s0, dx) + vec2(0.0, 1e-5));
    float lv = smoothstep(0.0, 0.5, t);
    gJ[j] = H + vec2(tn.y, -tn.x) * 0.045 * sc * lv * w * w * sin(uTime * 26.0 - w * 9.0);
    gR[j] = RAD * sc * (1.0 - 0.25 * smoothstep(0.0, 3.0, t)) * (1.0 - 0.25 * w * lv);
    tt -= dt * (j == NS ? 1.4 : 1.0);
  }
  float sc5 = gR[6] / RAD;
  vec2 back = normalize(gJ[5] - gJ[6]);
  float ab = atan(back.x, back.y);
  gArmR = 0.02 * sc5;
  for (int sd = 0; sd < 2; sd++) {
    float sg = float(sd) * 2.0 - 1.0;
    vec2 Q = gJ[6] + vec2(back.y, -back.x) * sg * 0.7 * gR[6];
    gA[sd * 4] = Q;
    for (int k = 0; k < 3; k++) {
      Q += dir(ab + sg * (0.75 - 0.2 * float(k)) + 0.35 * sin(uTime * 21.0 - float(k) * 1.3 + sg)) * ARM * sc5;
      gA[sd * 4 + k + 1] = Q;
    }
  }
  gHead = 1.0;
  gYell = 1.0;
  gLook = 0.0;
}

// paint the posed dancer: arms behind, fringe, body, face
void paint(vec2 p, vec3 base, vec3 rim, float seed) {
  vec4 aL = vec4(1e3, 0.0, 0.0, 1.0), aR = aL, bd = aL, hd = aL;
  for (int k = 0; k < 3; k++) {
    float r0 = gArmR * (1.0 - 0.1 * float(k)), r1 = gArmR * (0.9 - 0.1 * float(k));
    cap(p, gA[k], gA[k + 1], r0, r1, aL);
    cap(p, gA[k + 4], gA[k + 5], r0, r1, aR);
  }
  float jn = 0.0;
  for (int j = 0; j < NS - 1; j++) {
    float was = bd.x;
    cap(p, gJ[j], gJ[j + 1], gR[j], gR[j + 1], bd);
    if (bd.x < was) jn = float(j) + step(0.5, gBh);
  }
  cap(p, gJ[NS - 1], gJ[NS], gR[NS - 1], gR[NS], hd);
  if (min(min(aL.x, aR.x), min(bd.x, hd.x)) > 0.11) return;
  float sparkle = 0.9 * uHigh;
  tube(aL, base, rim, sparkle);
  tube(aR, base, rim, sparkle);

  // the head frame: v across, u along
  vec2 hv = gJ[NS] - gJ[NS - 1];
  float hl = max(length(hv), 1e-4), hr = gR[NS];
  vec2 u = hv / hl, v = vec2(u.y, -u.x);
  float lx = dot(p - gJ[NS - 1], v), ly = dot(p - gJ[NS - 1], u);
  float k1 = hr / 0.046;                                   // everything on the head scales with it

  // fringe on the open top: five strands that fan out, flutter with the highs and
  // hang toward the ground when the head has no air
  float fr = 0.07 * k1, fy = ly - hl - 0.4 * hr;
  if (fy > -0.02 * k1 && fy < fr && abs(lx) < 3.0 * hr) {
    float t = clamp(fy / fr, 0.0, 1.0);
    float uu = (lx + (1.0 - gHead) * 0.06 * k1 * t * t * v.y) / (1.0 + 0.9 * t);
    float sp = hr * 0.42;
    float kk = clamp(floor(uu / sp + 0.5), -2.0, 2.0);
    float wob = (0.003 + 0.011 * uHigh) * k1 * t * sin(fy / k1 * 95.0 - uTime * 17.0 + kk * 2.4 + seed);
    float d = abs(uu - kk * sp - wob) * (1.0 + 0.9 * t) - 0.0085 * k1 * (1.0 - 0.65 * t);
    gCol = mix(gCol, INK, cut(d - gInk * 0.7));
    gCol = mix(gCol, mix(rim, base, 0.35) * gLit, cut(d));
  }

  // a crease where the fabric folds: a pen stroke from the inside of the bend at the nearest joint
  float crease = 0.0;
  if (bd.x < 0.0 && bd.x < hd.x && jn > 0.5) {
    int ji = int(jn);
    vec2 J = gJ[ji], d0 = normalize(J - gJ[ji - 1] + 1e-5), d1 = normalize(gJ[ji + 1] - J + 1e-5);
    float bend = d0.x * d1.y - d0.y * d1.x;
    vec2 nb = normalize(d1 - d0 + 1e-5);
    vec2 pj = p - J;
    float along = dot(pj, nb);
    float dl = length(pj - nb * clamp(along, 0.3 * gR[ji], 1.2 * gR[ji]));
    crease = cut(dl - gInk * 0.55) * smoothstep(0.3, 0.6, abs(bend));
  }
  if (hd.x < bd.x) bd = hd;
  tube(bd, base, rim, sparkle);
  gCol = mix(gCol, INK, crease);

  // the face, printed on the fabric: lids and mouth follow the air in the head
  float m = cut(hd.x + gInk * 0.5);
  if (m > 0.0) {
    float er = 0.0155 * k1;
    vec2 e = vec2(abs(lx) - 0.02 * k1, (ly - 0.74 * hl) / 1.25);
    float de = length(e) - er;
    float blink = step(0.955, fract(uTime * 0.21 + seed * 0.37));
    float lid = max(0.72 * (1.0 - gHead), blink) * (1.0 - gYell);
    vec3 fc = mix(INK, vec3(0.96, 0.95, 0.9), cut(de + gInk * 0.8));
    vec2 pu = vec2(lx - sign(lx) * 0.02 * k1 - gLook * 0.006 * k1, (ly - 0.74 * hl) / 1.25 + (0.5 - gHead) * 0.006 * k1);
    fc = mix(fc, INK, cut(length(pu) - er * mix(0.45, 0.3, gYell)) * cut(de + gInk * 0.8));
    float lidLine = e.y - er * (1.0 - 2.0 * lid);
    fc = mix(fc, base * gShade * 1.25, cut(-lidLine) * cut(de + gInk * 0.8));
    fc = mix(fc, INK, cut(abs(lidLine) - gInk * 0.5) * cut(de) * step(0.02, lid));
    gCol = mix(gCol, fc, m * cut(de));

    // mouth: a grin with teeth when taut, turned down when limp, round in flight
    float my = 0.3 * hl, w = 0.031 * k1;
    float xx = 1.0 - (lx / w) * (lx / w);
    float cv = mix(-0.5, 1.0, gHead) * 0.021 * k1;
    float ya = my - cv * xx, yb = my - 0.15 * cv * xx;
    float dm = max(max(min(ya, yb) - ly, ly - max(ya, yb)) - 0.0035 * k1, abs(lx) - w);
    dm = mix(dm, length(vec2(lx, ly - my) / vec2(0.9, 1.2)) - 0.013 * k1, gYell);
    vec3 mc = mix(INK, vec3(0.96, 0.95, 0.9), cut(dm + gInk * 1.2) * step(yb - 0.006 * k1, ly) * step(0.5, gHead) * (1.0 - gYell));
    gCol = mix(gCol, mc, m * cut(dm));
  }
}

// how many times lane i has been refilled by phrase ph: the lanes take turns with a
// stride coprime to n, so each one goes once every n phrases
float genOf(float i, float ph, float n, float stride) {
  float g = floor(ph / n), k0 = n * g;
  for (int k = 0; k < 7; k++) {
    float kk = k0 + float(k);
    if (kk > ph) break;
    if (abs(mod(kk * stride, n) - i) < 0.5) g += 1.0;
  }
  return g;
}

// floodlight towers on one side: x haze glow and beams, y silhouette, z lamp faces
vec3 rig(vec2 p, float side, float hw) {
  float glow = 0.0, sil = 0.0, lamp = 0.0;
  for (int k = 0; k < 2; k++) {
    float sz = k == 0 ? 1.0 : 0.6;
    vec2 L = vec2(side * hw * (k == 0 ? 0.8 : 0.36), k == 0 ? 0.4 : 0.29);
    vec2 d = p - L;
    sil = max(sil, cut(max(abs(d.x) - 0.007 * sz, d.y)) * step(HZ, p.y));
    vec2 b = abs(d) - vec2(0.075, 0.02) * sz;
    sil = max(sil, cut(max(b.x, b.y) - 0.006 * sz));
    float cx = d.x / (0.0375 * sz);
    lamp += cut(length(vec2((fract(cx) - 0.5) * 0.0375 * sz, d.y)) - 0.012 * sz) * step(abs(cx), 2.0) * sz;
    glow += sz * 0.012 / (dot(d, d) + 0.012);
    vec2 aim = normalize(vec2(-side * 0.6, -1.0));
    float al = dot(d, aim), ang = dot(d, vec2(aim.y, -aim.x)) / (0.04 * sz + 0.5 * max(al, 0.0));
    glow += sz * 0.55 * exp(-ang * ang * 1.6) * smoothstep(-0.02, 0.05, al) / (1.0 + 3.0 * al)
          * (0.75 + 0.25 * sin(ang * 9.0 + float(k) * 2.0 + uTime * 0.15) * sin(ang * 23.0 - uTime * 0.11));
  }
  return vec3(glow, sil, lamp);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float hw = 0.5 * aspect;
  gPx = 1.0 / uResolution.y;
  gInk = max(0.0042, 1.6 * gPx);

  float n = clamp(floor(dancers + 0.5), 1.0, 7.0);
  float stride = n < 2.5 ? 1.0 : n < 3.5 ? 2.0 : n < 4.5 ? 3.0 : n < 5.5 ? 2.0 : n < 6.5 ? 5.0 : 3.0;
  float phrase = floor(uBeatClock / 16.0), q = uBeatClock - 16.0 * phrase;

  // floodlights: every 32 beats the other side takes over, in a new colour
  float block = floor(uBeatClock / 32.0);
  float xf = smoothstep(0.0, 1.0, uBeatClock - 32.0 * block);
  float side = mod(block, 2.0) * 2.0 - 1.0;
  vec3 lcNow = mix(vec3(1.0, 0.86, 0.66), pal(block), 0.3 + 0.3 * h11(block));
  vec3 lcOld = mix(vec3(1.0, 0.86, 0.66), pal(block - 1.0), 0.3 + 0.3 * h11(block - 1.0));
  vec3 lc = mix(lcOld, lcNow, xf);
  float flash = blast * uBassHit;
  float amp = (0.5 + 0.4 * uEnergy) * (1.0 + 0.7 * flash);
  float keyX = side * (2.0 * xf - 1.0);
  gKey = normalize(vec3(0.9 * keyX, 0.25, 0.3));
  gRimDir = normalize(vec2(keyX, 0.35));
  gLit = mix(vec3(1.0), lc, 0.25) * (0.85 + 0.15 * min(flash, 1.0));
  gShade = vec3(0.24, 0.22, 0.38);

  // night sky, a far roofline, the towers and what they throw into the haze
  vec3 col = mix(vec3(0.014, 0.016, 0.04), vec3(0.004, 0.005, 0.014), smoothstep(-0.3, 0.5, p.y));
  // the haze glows everywhere a little, most near the ground and on the lamps' side
  col += (lc * 0.05 * amp + uColor3 * 0.035) * exp(-max(p.y - HZ, 0.0) * 2.6) * (1.0 + 0.5 * keyX * p.x / hw);
  float bk = floor(p.x * 3.2 + 40.0);
  if (p.y < HZ + 0.02 + 0.075 * h11(bk) * step(0.35, h11(bk + 9.0))) col = vec3(0.006, 0.007, 0.016);
  // the side that leads at full, the other side kept low as a fill
  float wa = mix(0.3, 1.0, xf), wb = mix(1.0, 0.3, xf);
  vec3 rg = rig(p, side, hw), ro = rig(p, -side, hw);
  vec3 gl = (rg.x * wa + ro.x * wb) * lc;
  float sil = max(rg.y, ro.y), lampf = rg.z * wa + ro.z * wb;
  // a string of pennants between the towers
  float cat = 0.445 - 0.07 * (1.0 - p.x * p.x / (hw * hw * 0.64));
  float pk = floor(p.x * 17.0), pfx = fract(p.x * 17.0) - 0.5;
  float sway = 0.12 * sin(uTime * 2.3 + pk * 1.7);
  float pen = max(abs(pfx + sway * (cat - p.y) * 17.0) - 0.42 * (1.0 - (cat - p.y) / 0.04), p.y - cat);
  if (abs(p.x) < hw * 0.8) {
    col = mix(col, pal(pk) * 0.16 + lc * 0.03, cut(pen / 17.0) * step(p.y, cat));
    col = mix(col, vec3(0.008, 0.008, 0.018), cut(abs(p.y - cat) - 0.0015));
  }
  col = mix(col, vec3(0.008, 0.008, 0.018), sil);
  col += gl * amp * 0.36;
  col += mix(lc, vec3(1.0), 0.6) * lampf * min(amp, 1.2);

  // the forecourt: wet tarmac that smears the lamps, parking bays to the horizon
  if (p.y < HZ) {
    float dz = HZ - p.y;
    vec2 m = vec2(p.x + 0.012 * sin(p.y * 260.0 + p.x * 9.0), HZ + dz * 1.8);
    vec3 rc = (rig(m, side, hw).x * wa + rig(m, -side, hw).x * wb) * lc;
    col = vec3(0.014, 0.015, 0.032) + rc * amp * 0.3 * (0.6 + 0.4 * vn(vec2(p.x * 14.0, dz * 90.0)));
    float bay = abs(fract(p.x / (dz + 0.015) * 0.42 + 0.5) - 0.5) * (dz + 0.015) / 0.42;
    col += (0.05 + 0.25 * dot(rc, vec3(0.33)) * amp) * cut(bay - 0.0035 - 0.012 * dz) * smoothstep(0.0, 0.03, dz);
  }

  gCol = col;
  float W = min(aspect, 2.4) * 0.85;
  float lanew = W / n;
  float lim = min(lanew, 0.62) - 0.065;
  float rl = mod(phrase * stride, n);                      // the lane that tore off at the top of this phrase
  float nextRl = mod((phrase + 1.0) * stride, n);
  float bowUp = smoothstep(12.0, 12.9, q) * (1.0 - smoothstep(14.0, 14.45, q)) * smoothstep(0.2, 0.5, uEnergy + 0.4 * uBass);
  float j0 = floor(p.x / lanew + 0.5 * n - 0.5);
  for (int k = 0; k < 2; k++) {
    float i = j0 + float(k);
    if (i < 0.0 || i > n - 1.0) continue;
    float x0 = (i + 0.5 - 0.5 * n) * lanew;
    if (abs(p.x - x0) > lim + 0.11) continue;
    float gen = genOf(i, phrase, n, stride);
    vec3 base = pal(i + gen), rim = mix(pal(i + gen + 1.0), vec3(1.0), 0.2) * 1.1;
    float fresh = abs(i - rl) < 0.5 ? 1.0 : 0.0;
    float grow = mix(1.0, smoothstep(0.3, 4.0, q), fresh);
    float over = abs(i - nextRl) < 0.5 ? smoothstep(15.0, 15.85, q) : 0.0;
    float hs = 0.94 + 0.11 * h11(i * 7.3 + gen * 3.1);

    // on the tarmac: the shadow thrown toward us, away from the lamps, and the fabric's colour in the wet
    float dn = GROUND - p.y;
    if (dn > -0.01) {
      float sx = p.x - x0 + keyX * dn * 0.9;
      gCol *= 1.0 - 0.55 * exp(-sx * sx / (0.004 + 0.08 * dn * dn)) * smoothstep(-0.01, 0.01, dn) * exp(-dn * 5.0);
      gCol += base * 0.05 * exp(-abs(p.x - x0) * 9.0 - dn * 14.0) * (0.5 + 0.5 * grow);
    }
    pose(i, n, x0, lim, q, grow, over, bowUp, hs);
    paint(p, base, rim, i * 2.399 + gen);

    // the blower: a squat box with a collar, in front of the foot of the tube
    vec2 bp = p - vec2(x0, GROUND + 0.004);
    vec2 bb = abs(bp) - vec2(0.056, 0.026);
    float db = max(bb.x, bb.y) - 0.006;
    db = min(db, max(abs(bp.x) - RAD * 0.92, abs(bp.y - 0.036) - 0.009));
    gCol = mix(gCol, INK, cut(db - gInk));
    vec3 bc = mix(vec3(0.05, 0.055, 0.09), vec3(0.11, 0.12, 0.18), step(0.0, bp.x * keyX + 0.02));
    bc = mix(bc, INK, step(abs(fract(bp.x * 55.0) - 0.5), 0.2) * step(abs(bp.y + 0.004), 0.012) * step(abs(bp.x), 0.04));
    gCol = mix(gCol, bc, cut(db));
    gCol = mix(gCol, rim * 0.8, cut(db) * cut(abs(bp.y - 0.03) - 0.002) * step(abs(bp.x), 0.058));
    // the burst of air out of the blower its tube just left
    if (fresh > 0.5 && q < 1.6) {
      vec2 pf = p - vec2(x0, GROUND + 0.05 + 0.16 * q);
      float puff = length(pf * vec2(1.0, 0.8)) - (0.025 + 0.045 * q) * (1.0 + 0.16 * sin(atan(pf.y, pf.x) * 5.0 + i + q * 2.0));
      float gone = 1.0 - smoothstep(0.8, 1.6, q);
      gCol = mix(gCol, INK, cut(puff - gInk) * gone * 0.8);
      gCol = mix(gCol, mix(uColor3 * 0.6, vec3(0.9), 0.6), cut(puff) * gone);
    }
  }

  // the one that tore off
  if (q < 4.6) {
    float x0 = (rl + 0.5 - 0.5 * n) * lanew;
    float gen = genOf(rl, phrase, n, stride) - 1.0;
    float hs = 0.94 + 0.11 * h11(rl * 7.3 + gen * 3.1);
    vec2 s0 = vec2(x0, GROUND + 0.035 + (float(NS) + 0.4) * SEG * hs * 1.05);
    float dx = abs(x0) < 0.01 ? (h11(phrase) < 0.5 ? -1.0 : 1.0) : -sign(x0);
    vec2 hp = rpath(q, s0, dx);
    float sc = 1.0 / (1.0 + 0.55 * q * q);
    if (length(p - hp) < 0.95 * sc + 0.08) {
      rocketPose(q, s0, dx);
      vec3 keep = gCol;
      float ink = gInk;
      gInk *= max(sc, 0.4);
      paint(p, pal(rl + gen), mix(pal(rl + gen + 1.0), vec3(1.0), 0.2) * 1.1, rl * 2.399 + gen);
      gInk = ink;
      gCol = mix(keep, gCol, 1.0 - smoothstep(3.6, 4.6, q));
    }
  }
  col = gCol;

  // ground haze in front of everything low, in colour 3, lit by the lamps
  float hz = exp(-max(p.y - HZ, 0.0) * 6.5) * exp(-max(HZ - p.y, 0.0) * 3.0);
  float drift = 0.55 + 0.45 * vn(vec2(p.x * 2.2 + uTime * 0.05, p.y * 7.0 - uTime * 0.02)) * (0.6 + 0.8 * vn(vec2(p.x * 5.5 - uTime * 0.08, p.y * 13.0)));
  vec3 fog = uColor3 * 0.3 + lc * 0.12 * amp * (0.5 + 0.35 * keyX * p.x / hw);
  col = mix(col, fog, 0.4 * hz * drift) + fog * 0.3 * hz * drift;

  // soft knee: the lamps and the flash roll off instead of clipping flat
  vec3 kn = max(col - 0.8, 0.0);
  col = min(col, 0.8) + 0.2 * (1.0 - exp(-kn * 2.5));
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}

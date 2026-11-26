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

uniform float pace;
uniform float pyro;
uniform float haze;
uniform float tape;

// Robo vs Kaiju: a cel from a giant-robot cartoon. Two things sixty metres tall
// fight side on in a city that reaches their knees: a super robot (a V of gold
// across the chest, pylons on the shoulders, a crest of two blades) against a
// reptile with a row of bone plates down its back. They trade blows two beats
// at a time and every blow lands on a beat: jab and cross, the heavy one, a
// kick, a grab and a throw over the head, a block, a bite, a fist that leaves
// the arm on a rocket. Every few bars one of them brings out the big move (the
// blade of light, the tail that comes round) and the other goes down, gets up,
// and answers. At the end of the 16 bars both fire and the beams meet in the
// middle. The heavy blows stop the picture: an impact frame, the pose held,
// the camera thrown at the hit, a block of the street coming down.
// Everything is flat paint: two tones and a pen line per surface, the sun, the
// moon or the storm behind them and its light along their edge. The sky (dusk,
// night, storm) changes every eight bars and the street is whole again.

// ---- cel kit: the same block lives in titanhand.frag, kaijustomp.frag and robokaiju.frag ----
const float TAU = 6.2831853;
const vec3 INK = vec3(0.025, 0.02, 0.055);

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.62 * vn(p) + 0.38 * vn(p * 2.3 + 7.3); }

vec3 gCol;                      // the frame being painted
float gPx;                      // one screen pixel, in scene units
float gU;                       // one sheet unit, in scene units
float gFit;
// the light on whatever is painted next
vec3 gKeyDir, gKeyCol, gShadeCol, gRimCol;
vec2 gRimDir;
float gSil;                     // 0 = lit from the front .. 1 = a black shape against the light

// a hard edge, one pixel soft: 1 inside (d < 0)
float cut(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }
void fill(float d, vec3 c) { gCol = mix(gCol, c, cut(d)); }

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdBox(vec2 p, vec2 b) { vec2 w = abs(p) - b; return max(w.x, w.y); }
// a tapered capsule that also returns its gradient in .yz
vec3 gSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 q = pa - ba * h;
  float l = length(q);
  return vec3(l - mix(ra, rb, h), q / max(l, 1e-5));
}
vec3 smin3(vec3 a, vec3 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
}

// two flat tones, a hot spot and a rim for a surface with normal n
vec3 celTone(vec3 base, vec3 n, float dim) {
  float lam = dot(n, gKeyDir) - 0.22 * dim;
  float e = 0.02;
  vec3 c = mix(base * gShadeCol, base * gKeyCol, smoothstep(0.3 - e, 0.3 + e, lam));
  c = mix(c, mix(base, vec3(1.0), 0.32) * gKeyCol, smoothstep(0.965 - e, 0.965 + e, lam) * (1.0 - dim));
  c = mix(c, INK + base * 0.05, gSil);
  float side = dot(n.xy / max(length(n.xy), 1e-4), gRimDir);
  float rim = smoothstep(0.8, 0.86, length(n.xy)) * smoothstep(0.2, 0.35, side);
  return mix(c, gRimCol, rim * (0.55 + 0.45 * gSil));
}

// one texel of a cel sheet (scripts/toku/cel.py): A the silhouette, B the class,
// R G the normal. dir mirrors it. tpp = sheet texels per screen pixel. Four lit
// colours: the two lit classes (suit, white) and the far variant of each
void celPaint(vec4 t, float dir, vec3 suit, vec3 suitFar, vec3 white, vec3 whiteFar, float tpp) {
  float w = clamp(0.19 * tpp, 0.02, 0.2);
  float line = smoothstep(0.24 - w, 0.24 + w, t.a);
  if (line <= 0.0) return;
  float body = smoothstep(0.5 - w, 0.5 + w, t.a);
  float b = t.b;
  if (b < 0.09) {                                           // energy: no pen line, it glows
    vec3 e = t.r > 0.8 ? vec3(1.0) : t.r > 0.45 ? mix(suit, vec3(1.0), 0.55) : suit * 1.25;
    gCol = mix(gCol, e, body);
    return;
  }
  vec3 c;
  if (b > 0.9) c = t.r > 0.5 ? mix(vec3(1.0, 0.78, 0.2), INK, 0.6 * gSil)
                             : (t.g > 0.5 ? vec3(0.86, 0.95, 1.0) : mix(vec3(0.05, 0.07, 0.2), gRimCol, 0.18 + 0.5 * gSil));
  else if (b > 0.4 && b < 0.62) c = INK;
  else {
    vec2 nxy = vec2((t.r * 2.0 - 1.0) * dir, t.g * 2.0 - 1.0);
    vec3 n = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0)));
    float far = b > 0.62 ? step(b, 0.75) : step(b, 0.235);
    c = celTone(b > 0.62 ? mix(white, whiteFar, far) : mix(suit, suitFar, far), n, far);
  }
  gCol = mix(gCol, mix(INK, c, body), line);
}

// a charge going off, as an animator would paint it: a white core, a hot ring, the
// colour, then balls of smoke that rise and thin. q from the charge, R its size
void celBoom(vec2 q, float age, float R, vec3 hue, float seed) {
  if (age <= 0.0 || age > 1.5 || dot(q, q) > R * R * 6.0) return;
  float grow = 1.0 - exp(-age * 9.0);
  q.y -= R * 0.5 * age;
  float a = atan(q.y, q.x);
  float lump = 0.1 * sin(a * 5.0 + seed * 3.0) + 0.07 * sin(a * 9.0 - seed * 5.0 + age * 3.0) + 0.3 * (fbm(q * 4.0 / R + seed * 7.0) - 0.5);
  float d = length(q * vec2(1.0, 0.88)) / (R * (0.25 + 0.75 * grow)) + lump;
  float heat = clamp(1.0 - age * 1.7, 0.0, 1.0);
  float thin = smoothstep(0.75, 1.5, age) * 1.2;             // the smoke is eaten away from the outside and through its holes
  fill((d - 1.0 + thin * (0.4 + fbm(q * 7.0 / R + seed))) * R, mix(hue * 0.22, INK, 0.45));
  fill((d - 0.86 + thin * 1.6) * R, mix(hue * 0.5, vec3(0.2, 0.18, 0.22), 0.4));
  fill((d - 0.72 * heat - 0.02) * R + (1.0 - step(0.001, heat)), hue);
  fill((d - 0.5 * heat) * R + (1.0 - step(0.001, heat)), mix(hue, vec3(1.0, 0.9, 0.45), 0.75));
  fill((d - 0.27 * heat * heat) * R + (1.0 - step(0.001, heat)), vec3(1.0, 0.98, 0.9));
}

// a shower of sparks thrown up from q = 0, falling under gravity
vec3 sparks(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 9.0) return vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    acc += cut(sdSeg(q, pos, pos - vel * 0.07) - R * 0.014) * step(age, 0.55 + 0.45 * h11(fi + seed * 3.0));
  }
  return vec3(1.0, 0.86, 0.5) * min(acc, 1.0);
}

// an impact frame: the plate goes to one hot colour and ink lines fly out of the hit
vec3 impactFrame(vec2 q, vec3 hot, float seed) {
  float a = atan(q.y, q.x) / TAU, r = length(q);
  float k = floor(a * 70.0);
  float f = abs(fract(a * 70.0) - 0.5);
  float wdt = 0.5 * h11(k + seed) * smoothstep(0.05, 0.9, r);
  float ln = step(0.45, h11(k * 3.1 + seed)) * step(0.12 + 0.4 * h11(k * 7.3 + seed), r) * step(f, wdt);
  return mix(mix(vec3(1.0, 0.97, 0.9), hot, smoothstep(0.1, 0.75, r)), INK, ln);
}

// the print: screen-tone dots in the dark tones, a little grain in the paper
vec3 printLook(vec3 c, vec2 fc, float amt) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * fc / (uResolution.y / 190.0);
  float dot_ = length(fract(g) - 0.5);
  float tone = smoothstep(0.42, 0.06, lum);
  c *= 1.0 - 0.3 * amt * tone * (1.0 - smoothstep(0.3 * tone, 0.3 * tone + 0.1, dot_));
  c *= 1.0 + 0.05 * amt * (fbm(fc / (uResolution.y / 300.0)) - 0.5);
  return c;
}
// ---- end of the cel kit ----

uniform sampler2D uAtlasRobo;
uniform sampler2D uAtlasKaiju;

// The scene is measured in the units the sheets are drawn in (scripts/toku/robo.py,
// kaiju.py: 8 x 8 cells of 288 x 224 units, feet at 120 / 140 from the left and 12
// from the bottom of a cell); the frame is VH of them tall, so a whole cell stands on the street inside it
const float VH = 250.0;
const float GY = -95.0;                  // the street
const float RX = -72.0, KX = 72.0;       // where each one stands
const vec2 LENS = vec2(9.5, 107.0);      // robo.json "emitter": the lens of the chest in the beam cells, from the feet
const vec2 MOUTH = vec2(86.2, 118.2);    // kaiju.json "mouth": where the breath leaves the jaws
const vec2 WRIST = vec2(86.0, 126.0);    // robo.json "rocketWrist"
const float APART = 44.0;                // how far each backs off before the beams (the kaiju, whose jaws reach further, 18 more)
const float M_IDLE = 0.0, M_PUNCH = 1.0, M_HEAVY = 2.0, M_KICK = 3.0, M_GRAB = 4.0, M_GETUP = 5.0, M_SPEC = 6.0, M_CHARGE = 7.0, M_FIRE = 8.0,
            M_BITE = 9.0, M_ROCKET = 10.0, M_TAUNT = 11.0;

float gB, gPace, gU01, gHaze, gPy, gCam, gHitAge, gHitPow, gBlocked, gBeam, gSlamAge, gSlamX, gImpact, gPunch, gKick, gCharge, gRoar;
float gMood, gStorm, gBolt_, gBlock, gFlash;
vec2 gShake, gHitPos, gCamC, gClash, gDisc;
vec3 gR, gK;                             // per fighter: frame on the sheet, how far it has moved toward the other, how high
vec4 gFist;                              // the rocket fist: x, y, on, direction
float gFirst;                            // who is drawn first (the one being hit)
vec3 cA, eR, eK;                         // the armour, and the colour of each one's energy
vec3 gSkyH, gSkyM, gSkyT, gAmbRim, gFar, gMid, gNear, gGround, gDiscCol;

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// seconds since u0 of the slot (a beat is taken as 0.47 s, as in titanhand.frag)
float secs(float u0) { return (gU01 - u0) * 0.94 / gPace; }

// the fight, two beats at a time: who attacks (0 robot, 1 kaiju), with what, and whether it is blocked.
// 32 slots = 16 bars, then it starts again: nobody stays down
vec3 slotDef(float s) {
  s = mod(s, 32.0);
  if (s < 8.0) {
    if (s < 0.5) return vec3(0.0, M_PUNCH, 0.0);
    if (s < 1.5) return vec3(1.0, M_HEAVY, 1.0);
    if (s < 2.5) return vec3(1.0, M_KICK, 0.0);
    if (s < 3.5) return vec3(0.0, M_GRAB, 0.0);
    if (s < 4.5) return vec3(1.0, M_GETUP, 1.0);
    if (s < 5.5) return vec3(0.0, M_HEAVY, 1.0);
    if (s < 6.5) return vec3(1.0, M_PUNCH, 0.0);
    return vec3(0.0, M_SPEC, 0.0);                       // bar 4: the blade
  }
  if (s < 16.0) {
    if (s < 8.5) return vec3(1.0, M_GETUP, 0.0);
    if (s < 9.5) return vec3(1.0, M_HEAVY, 0.0);
    if (s < 10.5) return vec3(0.0, M_KICK, 0.0);
    if (s < 11.5) return vec3(1.0, M_SPEC, 0.0);         // bar 6: the tail
    if (s < 12.5) return vec3(0.0, M_GETUP, 0.0);
    if (s < 13.5) return vec3(1.0, M_GRAB, 0.0);
    if (s < 14.5) return vec3(0.0, M_GETUP, 1.0);
    return vec3(0.0, M_ROCKET, 0.0);                     // bar 8: the rocket punch
  }
  if (s < 24.0) {
    if (s < 16.5) return vec3(1.0, M_BITE, 0.0);
    if (s < 17.5) return vec3(0.0, M_HEAVY, 0.0);
    if (s < 18.5) return vec3(0.0, M_KICK, 0.0);
    if (s < 19.5) return vec3(1.0, M_GRAB, 0.0);
    if (s < 20.5) return vec3(0.0, M_GETUP, 1.0);
    if (s < 21.5) return vec3(1.0, M_HEAVY, 1.0);
    if (s < 22.5) return vec3(0.0, M_PUNCH, 0.0);
    return vec3(1.0, M_SPEC, 0.0);                       // bar 12: the tail
  }
  if (s < 24.5) return vec3(0.0, M_GETUP, 0.0);
  if (s < 25.5) return vec3(0.0, M_HEAVY, 0.0);
  if (s < 26.5) return vec3(1.0, M_BITE, 0.0);
  if (s < 27.5) return vec3(0.0, M_SPEC, 0.0);           // bar 14: the blade
  if (s < 28.5) return vec3(1.0, M_GETUP, 0.0);
  if (s < 29.5) return vec3(0.0, M_TAUNT, 0.0);          // a fist in the air, a roar
  if (s < 30.5) return vec3(0.0, M_CHARGE, 0.0);         // bars 15-16: both fire, the beams meet
  return vec3(0.0, M_FIRE, 0.0);
}

// what one of them is doing at u (0..1) of the slot: frame, how far it has moved toward the other, how high.
// Every hit is at u = 0.5, which is a beat; the second punch of a combo at 0.75, the half beat
vec3 fighter(float who, vec3 d, float u, float thrown, float apart) {
  float idle = mod(floor(gB * 2.0) + who * 2.0, 4.0);
  float f = idle, ox = 0.0, oy = 0.0;
  bool atk = abs(d.x - who) < 0.5;
  float m = d.y;
  float back = u > 0.5 ? exp(-(u - 0.5) * 7.0) : 0.0;
  if (m == M_PUNCH) {
    if (atk) f = u < 0.38 ? idle : u < 0.5 ? 10.0 : u < 0.6 ? 11.0 : u < 0.68 ? 12.0 : u < 0.75 ? 13.0 : u < 0.85 ? 14.0 : u < 0.94 ? 15.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.6 ? 32.0 : u < 0.7 ? 33.0 : u < 0.75 ? idle : u < 0.86 ? 32.0 : u < 0.96 ? 33.0 : idle; ox = -5.0 * back - (u > 0.75 ? 6.0 * exp(-(u - 0.75) * 9.0) : 0.0); }
  } else if (m == M_HEAVY) {
    if (atk) {
      f = u < 0.25 ? idle : u < 0.36 ? 16.0 : u < 0.5 ? 17.0 : u < 0.6 ? 18.0 : u < 0.78 ? 19.0 : u < 0.9 ? 20.0 : idle;
      if (d.z > 0.5 && u >= 0.5) ox = -14.0 * (1.0 - smoothstep(0.78, 0.9, u));     // stopped short by the guard
    }
    else if (d.z > 0.5) { f = u < 0.4 ? idle : u < 0.5 ? 43.0 : u < 0.64 ? 44.0 : u < 0.84 ? 43.0 : idle; ox = -9.0 * back; }
    else { f = u < 0.5 ? idle : u < 0.68 ? 32.0 : u < 0.86 ? 33.0 : idle; ox = -14.0 * back; }
  } else if (m == M_KICK) {
    if (atk) f = u < 0.36 ? idle : u < 0.5 ? 21.0 : u < 0.58 ? 22.0 : u < 0.74 ? 23.0 : u < 0.84 ? 24.0 : u < 0.94 ? 25.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.66 ? 32.0 : u < 0.86 ? 33.0 : idle; ox = -11.0 * back; }
  } else if (m == M_BITE) {
    // the jaws thrown open, then the whole body thrown after them
    if (atk) f = u < 0.2 ? idle : u < 0.5 ? 59.0 : u < 0.58 ? 60.0 : u < 0.86 ? 61.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.7 ? 32.0 : u < 0.9 ? 33.0 : idle; ox = -15.0 * back; }
  } else if (m == M_ROCKET) {
    // the arm levelled and steadied, the fist gone from it until it comes home
    if (atk) f = u < 0.16 ? idle : u < 0.42 ? 59.0 : u < 0.88 ? 60.0 : u < 0.96 ? 59.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.7 ? 32.0 : u < 0.9 ? 33.0 : idle; ox = -16.0 * back; }
  } else if (m == M_GRAB) {
    if (atk) f = u < 0.2 ? idle : u < 0.3 ? 26.0 : u < 0.4 ? 27.0 : u < 0.5 ? 28.0 : u < 0.72 ? 29.0 : u < 0.86 ? 30.0 : 31.0;
    else if (u >= 0.3) {
      // seized, hauled overhead on the beat, thrown back where it came from. Held as high as
      // the frame allows (its top is 220 units above the street) and over the hands that hold it
      vec2 hold = who < 0.5 ? vec2(KX - RX - 26.0, 150.0) : vec2(KX - RX - 28.0, 128.0);
      if (u < 0.4) { f = 32.0; ox = 12.0 * (u - 0.3) / 0.1; }
      else if (u < 0.5) { float v = ease((u - 0.4) / 0.1); f = 34.0; ox = mix(12.0, hold.x, v); oy = hold.y * v; }
      else if (u < 0.72) { f = 37.0; ox = hold.x; oy = hold.y + (u < 0.56 ? 3.0 : 0.0); }
      else { float v = (u - 0.72) / 0.28; f = v < 0.7 ? 35.0 : 36.0; ox = mix(hold.x, 0.0, v); oy = hold.y * (1.0 - v * v) + 14.0 * sin(v * 3.14159); }
    }
  } else if (m == M_GETUP) {
    if (atk) f = u < 0.07 && thrown > 0.5 ? 36.0 : u < 0.16 && thrown > 0.5 ? 37.0 : u < 0.3 ? 38.0 : u < 0.46 ? 39.0 : u < 0.62 ? 40.0 : u < 0.76 ? 41.0 : u < 0.9 ? 42.0 : idle;
    else f = d.z > 0.5 && u > 0.12 && u < 0.62 ? 58.0 : idle;
  } else if (m == M_SPEC) {
    if (atk) {
      if (who < 0.5) f = u < 0.08 ? idle : u < 0.2 ? 45.0 : u < 0.32 ? 46.0 : u < 0.5 ? 47.0 : u < 0.55 ? 48.0 : u < 0.62 ? 49.0 : u < 0.72 ? 50.0 : u < 0.88 ? 51.0 : 52.0;
      else f = u < 0.1 ? idle : u < 0.36 ? 45.0 : u < 0.5 ? 46.0 : u < 0.58 ? 47.0 : u < 0.68 ? 48.0 : u < 0.78 ? 49.0 : u < 0.86 ? 50.0 : u < 0.93 ? 51.0 : 52.0;
    } else if (u >= 0.5) {
      f = u < 0.57 ? 34.0 : u < 0.67 ? 35.0 : u < 0.75 ? 36.0 : u < 0.85 ? 37.0 : 38.0;
      oy = 22.0 * sin(clamp((u - 0.5) / 0.25, 0.0, 1.0) * 3.14159);
    }
  } else if (m == M_TAUNT) {
    f = u > 0.14 && u < 0.86 ? 58.0 : idle;
  } else if (m == M_CHARGE) {
    // they back off to give the beams room
    f = u < 0.2 ? 9.0 - mod(floor(gB * 6.0), 6.0) : u < 0.5 ? 53.0 : u < 0.75 ? 54.0 : 55.0;
    ox = -(APART + who * 18.0) * ease(u / 0.2);
  } else if (m == M_FIRE) {
    f = u < 0.5 ? 56.0 + mod(floor(gB * 8.0), 2.0) : u < 0.66 ? 32.0 : u < 0.84 ? 33.0 : idle;
    ox = -(APART + who * 18.0) - (u < 0.5 ? 3.0 * u : 12.0 * back);
  }
  if (apart > 0.5 && u < 0.3) {                           // and walk back in when the smoke clears
    f = 4.0 + mod(floor(gB * 6.0), 6.0);
    ox = -(APART + who * 18.0) * (1.0 - u / 0.3);
  }
  return vec3(f, ox, oy);
}

// the light on a figure standing at x: the key from above and behind the robot, a rim from
// the disc in the sky or, when the other one's energy is out, from that
void figureLight(float x, float who) {
  gKeyDir = normalize(vec3(-0.45, 0.6, 0.66));
  gKeyCol = (gMood < 0.5 ? vec3(1.0, 0.96, 0.9) : gMood < 1.5 ? vec3(0.82, 0.88, 1.0) : vec3(0.84, 0.92, 0.92)) * (1.0 + 0.3 * gFlash + 0.5 * gBolt_);
  gShadeCol = mix(vec3(0.3, 0.26, 0.5), gSkyM * 1.5, 0.35);
  float lit = max(gBeam, gCharge);
  gRimDir = normalize(mix(normalize(vec2(gDisc.x - x, 70.0)), vec2(who < 0.5 ? 1.0 : -1.0, 0.2), lit) + vec2(1e-4, 0.0));
  gRimCol = mix(gAmbRim, (who < 0.5 ? eK : eR) * 1.35, lit) + vec3(1.0, 0.85, 0.6) * 0.5 * gFlash;
  gSil = max(gImpact, gMood < 0.5 ? 0.14 : gMood < 1.5 ? 0.1 : 0.2);
}

// one cell of a fighter's sheet, feet on the street at its place
void duelSprite(vec2 q, vec3 st, float who) {
  float dir = who < 0.5 ? 1.0 : -1.0;
  vec2 c = q - vec2(who < 0.5 ? RX + st.y : KX - st.y, GY + st.z);
  c = vec2(c.x * dir + (who < 0.5 ? 120.0 : 140.0), c.y + 12.0);
  if (c.x < 0.5 || c.y < 0.5 || c.x > 287.5 || c.y > 223.5) return;
  vec2 uv = vec2((mod(st.x, 8.0) * 288.0 + c.x) / 2304.0, 1.0 - (floor(st.x / 8.0) * 224.0 + 224.0 - c.y) / 1792.0);
  figureLight(who < 0.5 ? RX + st.y : KX - st.y, who);
  if (who < 0.5) {
    vec4 t = texture2D(uAtlasRobo, uv);
    celPaint(t, dir, t.b < 0.09 ? eR : cA, mix(cA * 0.4, vec3(0.13, 0.14, 0.21), 0.55), vec3(0.97, 0.96, 0.92), vec3(0.6, 0.62, 0.7), 2.0 * gPx);
  } else {
    // the seams of light in its plates beat with the bass
    vec4 t = texture2D(uAtlasKaiju, uv);
    vec3 hide = mix(vec3(0.17, 0.3, 0.3), uColor3, 0.16);
    celPaint(t, dir, t.b < 0.09 ? eK * (0.5 + 0.5 * uBass + 0.5 * gKick + gCharge) : hide, hide * 0.55, vec3(0.97, 0.93, 0.8), mix(vec3(0.66, 0.55, 0.42), hide, 0.2), 2.0 * gPx);
  }
}

// the fist in flight: cell 61 of the robot's sheet, its wrist on gFist.xy
void rocketFist(vec2 q) {
  vec2 c = vec2((q.x - gFist.x) * gFist.w, q.y - gFist.y);
  if (gFist.z < 0.5 || c.x < -72.0 || c.x > 20.0 || abs(c.y) > 18.0) return;
  c += vec2(120.0, 112.0);
  vec4 t = texture2D(uAtlasRobo, vec2((5.0 * 288.0 + c.x) / 2304.0, 1.0 - (7.0 * 224.0 + 224.0 - c.y) / 1792.0));
  figureLight(gFist.x, 0.0);
  celPaint(t, gFist.w, t.b < 0.09 ? eR : cA, cA * 0.5, vec3(0.97, 0.96, 0.92), vec3(0.6, 0.62, 0.7), 2.0 * gPx);
}

// a beam, as it is painted on a cel: three flat layers whose edges ripple at 12 frames a second
void beam(vec2 q, vec2 a, vec2 b, float w, vec3 hue) {
  vec2 ba = b - a;
  float L = length(ba);
  vec2 dir = ba / L;
  float x = dot(q - a, dir), y = dot(q - a, vec2(-dir.y, dir.x));
  if (x < -w * 2.0 || x > L + w || abs(y) > w * 2.0) return;
  float t12 = floor(uTime * 12.0);
  float rip = 0.16 * sin(x * 0.21 - t12 * 1.9) + 0.1 * sin(x * 0.53 + t12 * 2.7 + sign(y) * 2.0);
  float ww = w * (0.9 + 0.1 * h11(t12 * 1.3)) * (1.0 + rip);
  float cap = max(-x, x - L);
  float flare = length(q - a) - w * 1.5 * (0.9 + 0.2 * h11(t12));      // where it leaves the lens or the jaws
  vec3 hot = mix(hue, vec3(1.0), 0.6);
  fill(min(max(abs(y) - ww, cap), flare), hue * 1.1);
  fill(min(max(abs(y) - ww * 0.62, cap), flare + w * 0.45), hot);
  fill(min(max(abs(y) - ww * 0.3, cap), flare + w * 0.85), vec3(1.0));
}

// the outline of a burst: n spikes of uneven length round e = 0. Returns the reach in that direction, 0.3 .. 1.2
float burst(vec2 e, float n, float seed) {
  float k = atan(e.y, e.x) / TAU * n;
  return 0.3 + 0.9 * (0.45 + 0.55 * h11(floor(k) + seed)) * pow(1.0 - abs(fract(k) - 0.5) * 2.0, 1.5);
}

// broken masonry thrown from q = 0: flat chips with a lit and a dark face, tumbling
void debris(vec2 q, float age, float R, float seed, vec3 col) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 30.0) return;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float an = mix(0.4, 2.75, h11(fi * 1.9 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (1.6 + 2.6 * h11(fi * 2.7 + seed + 3.0));
    vec2 e = q - v * age - vec2(0.0, -3.6 * R * age * age);
    float sz = R * (0.09 + 0.1 * h11(fi * 4.1 + seed));
    if (dot(e, e) > sz * sz * 4.0) continue;
    float a = age * (5.0 + 9.0 * h11(fi + seed)) + fi;
    vec2 r = vec2(cos(a) * e.x + sin(a) * e.y, cos(a) * e.y - sin(a) * e.x);
    float d = max(max(abs(r.x) - sz, abs(r.y) - sz * 0.62), (r.x + r.y) * 0.7071 - sz * 0.5);     // a slab with a corner knocked off
    fill(d - 0.7, INK);
    fill(d, r.y - 0.3 * r.x > 0.0 ? col * 1.6 : col * 0.75);
  }
}

// a row of the city: flat blocks, the roof line catching the sky, windows far too small. live = the
// row the fight brings down: a block falls on a beat where a blow lands and lies there until the sky changes
void skyline(vec2 q, float X, float base, float wd, float hmin, float hvar, float seed, vec3 body, float win, float live) {
  float y = q.y - base;
  if (y < 0.0 || y > hmin + hvar + 12.0) return;
  float id = floor(X / wd), lx = X - id * wd;
  float r1 = h11(id * 1.7 + seed), r2 = h11(id * 5.3 + seed + 4.0);
  float hh = floor(hmin + hvar * r1 * r1);                    // most are low, a few are towers
  float top = hh, fall = 0.0;
  if (live > 0.5) {
    float tb = gB - gBlock - (1.0 + 2.0 * floor(h11(id * 7.7 + seed + gBlock) * 8.0));
    fall = step(0.4, h11(id * 3.3 + gBlock * 0.37)) * ease(tb * 1.4);
    top = mix(hh, hh * 0.16 + 5.0 * vn(vec2(X * 0.4, id)), fall);
    lx += fall > 0.0 && fall < 1.0 ? 1.2 * sin(uTime * 70.0 + q.y * 0.4) : 0.0;
  }
  float half_ = wd * 0.5 - 1.0 - 3.0 * r2 - step(0.55, r2) * step(hh * 0.64, y) * wd * 0.13 * (1.0 - fall);    // some step back near the top
  float d = max(abs(lx - wd * 0.5) - half_, y - top);
  float mast = max(abs(lx - wd * 0.42) - 0.35, y - top - 10.0 * step(0.7, r1) * (1.0 - fall));
  if (min(d, mast) > 1.0) return;
  fill(min(d, mast), body);
  fill(max(d, wd * 0.5 + half_ * 0.42 - lx), body * 0.7);                         // the side turned away
  if (win > 0.0 && fall < 0.5) {
    vec2 wc = vec2((lx - wd * 0.5 + half_) / 3.4, y / 4.4);
    vec2 wi = floor(wc), wf = fract(wc) - 0.5;
    float on = step(0.8 - 0.4 * uHigh * step(0.4, h21(wi + 3.0 + id)), h21(wi + id * 7.0 + seed + floor(uBeatClock * 0.125) * 0.37));
    fill(max(max(abs(wf.x) * 3.4 - 0.85, abs(wf.y) * 4.4 - 1.2), d + 1.6) + (1.0 - on * win), mix(mix(uColor2, vec3(1.0, 0.86, 0.55), 0.7), vec3(1.0), 0.3 * uHigh));
  }
  fill(max(d, top - 1.1 - y), mix(body * 1.7, gAmbRim, 0.35));                   // the roof line
  gCol = mix(gCol, body * 0.5, fall * cut(d) * step(0.5, h21(floor(vec2(X, y) / 2.5))) * 0.6);   // rubble
}

void sky(vec2 q) {
  float dim = 1.0 - 0.35 * max(gCharge, gBeam);               // the sky goes down when the energy comes up
  float b1 = GY + 50.0 + 16.0 * (fbm(vec2(q.x * 0.011 + uTime * 0.012, 3.0)) - 0.5);
  float b2 = GY + 96.0 + 26.0 * (fbm(vec2(q.x * 0.008 - uTime * 0.008, 9.0)) - 0.5);
  gCol = gSkyT * dim;
  fill(q.y - b2 - 24.0, mix(gSkyT, gSkyM, 0.5) * dim);
  fill(q.y - b2, gSkyM * dim);
  vec2 sq = q - gDisc;
  if (gMood < 0.5) {
    // the sun going down: two flat tones, bars of cloud across it
    float dd = length(sq) - 47.0;
    fill(dd - 7.0, mix(gSkyM, gDiscCol, 0.3) * dim);
    fill(dd, gDiscCol);
    fill(max(dd, sq.y + 6.0 + 3.0 * sin(sq.x * 0.2)), mix(gDiscCol, gSkyH, 0.55));
    fill(max(dd - 9.0, abs(sq.y + 16.0) - 2.6 - 1.5 * sin(sq.x * 0.11 + 1.0)), gSkyM * dim);
    fill(max(dd - 16.0, abs(sq.y - 13.0) - 1.3), gSkyM * dim);
  } else if (gMood < 1.5) {
    vec2 sg = floor(q / 1.3);
    float st = step(0.994, h21(sg)) * step(b1 + 6.0, q.y);
    gCol = mix(gCol, vec3(0.85, 0.9, 1.0), st * (0.45 + 0.55 * step(0.5, fract(h21(sg + 5.0) * 7.0 + uTime * 0.6 + uHigh))));
    float dd = length(sq) - 31.0;
    fill(dd - 5.0, mix(gSkyM, gDiscCol, 0.22) * dim);
    fill(dd, gDiscCol);
    fill(max(dd, 27.0 - length(sq - vec2(9.0, 4.0))), gDiscCol * vec3(0.72, 0.78, 0.9));       // its dark limb
    fill(length(sq - vec2(-8.0, 9.0)) - 4.5, gDiscCol * vec3(0.8, 0.85, 0.94));
    fill(length(sq - vec2(4.0, -11.0)) - 3.0, gDiscCol * vec3(0.8, 0.85, 0.94));
  }
  fill(q.y - b1, mix(gSkyM, gSkyH, 0.55) * dim);
  fill(q.y - b1 + 20.0, gSkyH * dim);
  if (gStorm > 0.5) {
    // the storm: a lid of cloud in flat lumps, and on the kick a bolt down to the roofs
    float lid = GY + 128.0 + 30.0 * (fbm(vec2(q.x * 0.02 + uTime * 0.05, 5.0)) - 0.5) + 6.0 * sin(q.x * 0.09 + uTime * 0.2);
    fill(lid - q.y, gSkyT * 0.7);
    fill(lid + 16.0 - q.y, gSkyT * 0.45);
    float bs = floor(uBeatClock);
    float bx = (h11(bs * 2.3) - 0.5) * 300.0;
    float path = bx + 30.0 * (vn(vec2(q.y * 0.07, bs)) - 0.5) + 9.0 * (vn(vec2(q.y * 0.3, bs + 3.0)) - 0.5);
    float bd = max(abs(q.x - path) - 0.5 - 0.012 * (q.y - GY), GY + 30.0 - q.y);
    gCol += gBolt_ * vec3(0.2, 0.26, 0.32);
    fill(bd - 1.6 + (1.0 - step(0.25, gBolt_)) * 99.0, mix(gSkyM, vec3(0.8, 0.9, 1.0), 0.6));
    fill(bd + (1.0 - step(0.25, gBolt_)) * 99.0, vec3(1.0));
  }
}

// a searchlight from the roofs: a flat cone that the bass opens
void searchlight(vec2 q, float x0, float ph) {
  vec2 e = q - vec2(x0 - gCam * 0.5, GY + 16.0);
  float an = 1.5708 + 0.55 * sin(uTime * 0.37 + ph) + 0.12 * sin(uTime * 1.3 + ph * 2.0);
  vec2 d = vec2(cos(an), sin(an));
  float t = dot(e, d);
  float cone = abs(e.x * d.y - e.y * d.x) - t * (0.035 + 0.035 * uBass) - 0.6;
  gCol = mix(gCol, mix(vec3(1.0), uColor2, 0.35), (0.07 + 0.2 * uBass + 0.12 * gKick) * cut(max(cone, -t)) * (1.0 - 0.5 * gStorm));
}

void street(vec2 q) {
  float f = GY + 8.0 - q.y;                                   // 0 at the kerb, growing toward the lens
  float Xr = q.x / (1.0 + f * 0.012) + gCam;
  gCol = gGround;
  fill(f - 4.0, gGround * 1.45);                              // the pavement, its kerb
  fill(abs(f - 4.3) - 0.35, INK);
  fill(f - 1.2, gGround * 0.6);                               // where the blocks stand on it
  fill(max(abs(f - 20.0) - 0.9, abs(mod(Xr, 36.0) - 9.0) - 9.0), gGround * 2.3);
  gCol *= 1.0 - 0.18 * step(27.0, f);                         // the near lane, in the shade of what stands by the lens
  if (gBeam > 0.5) {
    // the beams light the road under them: two hard wedges, each in its colour
    vec3 hue = q.x < gClash.x ? eR : eK;
    float span = max(RX - 20.0 - q.x, q.x - KX - 18.0);
    gCol = mix(gCol, gCol * 0.55 + hue * 0.35, cut(max(span - f * 0.6, 4.0 - f)));
    gCol = mix(gCol, gCol * 0.35 + hue * 0.75, cut(max(max(span + 14.0, abs(f - 12.0) - 3.5 - 1.5 * sin(Xr * 0.15 + uTime * 9.0)), -1.0)));
  }
  if (gSlamAge > 0.0 && gSlamAge < 0.6) {
    // the road gives under a body: a ring of white, cracks of ink out from it
    vec2 cq = (q - vec2(gSlamX, GY - 6.0)) / vec2(1.0, 0.26);
    float rr = 60.0 * (1.0 - exp(-gSlamAge * 7.0));
    fill(abs(length(cq) - rr) - 2.2 * exp(-gSlamAge * 4.0) + step(0.0, -f) * 99.0, vec3(1.0));
    float a = atan(cq.y, cq.x) * 5.0;
    fill(max(abs(fract(a) - 0.5) * length(cq) * 0.25 - 0.5, length(cq) - rr * 0.8) + step(0.0, -f) * 99.0, INK);
  }
  gCol += gBolt_ * vec3(0.16, 0.2, 0.26);
}

// a flat shadow on the road under whoever stands at x, smaller the higher it is held
void shadowAt(vec2 q, float x, float w, float up) {
  vec2 e = (q - vec2(x, GY - 3.0)) / (vec2(w, 4.5) * (1.0 - 0.4 * clamp(up / 120.0, 0.0, 1.0)));
  gCol = mix(gCol, gCol * 0.42, cut((length(e) - 1.0) * 4.5));
}

vec3 render(vec2 fc) {
  vec2 q = (fc - 0.5 * uResolution) / uResolution.y * gFit * VH;
  q = gCamC + (q - gCamC) * (1.0 - gPunch) + gShake;
  float rx = RX + gR.y, kx = KX - gK.y;
  vec3 dust = mix(gGround * 2.6, gSkyH, 0.25);
  if (gImpact > 0.5) gCol = impactFrame((q - gHitPos) / VH, mix(gHitPow > 1.7 ? mix(eR, eK, 0.5) : gFirst < 0.5 ? eK : eR, vec3(1.0, 0.75, 0.3), 0.4), floor(gB));
  else {
    if (q.y > GY + 8.0) {
      sky(q);
      searchlight(q, -170.0, 0.0);
      searchlight(q, 30.0, 2.1);
      searchlight(q, 190.0, 4.4);
      // the city in three flat layers, each lost a little more in the air than the one in front
      skyline(q, q.x + gCam * 0.25 + 300.0, GY + 20.0, 23.0, 12.0, 58.0, 3.0, gFar, 0.0, 0.0);
      float m0 = GY + 30.0 + 5.0 * sin(q.x * 0.03 + uTime * 0.11) + 2.5 * sin(q.x * 0.08 - uTime * 0.17);
      gCol = mix(gCol, mix(gSkyH, vec3(1.0), 0.15), min(0.42 * gHaze, 0.85) * cut(q.y - m0));
      skyline(q, q.x + gCam * 0.55 + 500.0, GY + 13.0, 31.0, 14.0, 52.0, 1.0, gMid, 0.75, 0.0);
      float m1 = GY + 21.0 + 3.5 * sin(q.x * 0.045 - uTime * 0.14) + 2.0 * sin(q.x * 0.11 + uTime * 0.21);
      gCol = mix(gCol, mix(gSkyH, gMid, 0.45), min(0.3 * gHaze, 0.8) * cut(q.y - m1));
      float Xn = q.x + gCam + 700.0;
      skyline(q, Xn, GY + 8.0, 38.0, 14.0, 44.0, 5.0, gNear, 1.0, 1.0);
      // the dust of the one coming down, in its own column
      float id = floor(Xn / 38.0);
      float tb = gB - gBlock - (1.0 + 2.0 * floor(h11(id * 7.7 + 5.0 + gBlock) * 8.0));
      if (tb > 0.0 && tb < 3.0 && gPy > 0.0 && h11(id * 3.3 + gBlock * 0.37) > 0.4)
        celBoom(vec2(Xn - (id + 0.5) * 38.0, q.y - GY - 12.0), tb * 0.45 + 0.6, 20.0 * (0.6 + 0.4 * gPy), dust, id);
      gCol += gBolt_ * vec3(0.12, 0.16, 0.2) * step(q.y, GY + 80.0);
    } else street(q);
    // rain, in the storm
    vec2 rq = vec2(q.x + q.y * 0.25, q.y) * vec2(0.28, 0.023) + vec2(0.0, uTime * 9.0);
    gCol = mix(gCol, gAmbRim, 0.3 * gStorm * step(0.93, h21(floor(rq))) * step(abs(fract(rq.x) - 0.5), 0.09));
    // mist along the street, in two flat layers
    float m2 = GY + 15.0 + 5.0 * sin(q.x * 0.024 + uTime * 0.3) + 2.5 * sin(q.x * 0.06 - uTime * 0.5);
    vec3 mist = mix(mix(gSkyH, gGround * 2.4, 0.5), mix(eR, eK, step(gClash.x, q.x)), 0.4 * gBeam);
    gCol = mix(gCol, mist, min(0.26 * gHaze, 0.8) * cut(max(q.y - m2, GY - 2.0 - q.y)));
    gCol = mix(gCol, mist, min(0.2 * gHaze, 0.7) * cut(max(q.y - m2 + 7.0 + 2.0 * sin(q.x * 0.05 + uTime * 0.4), GY - 9.0 - q.y)));
    shadowAt(q, rx - 2.0, 46.0, gR.z);
    shadowAt(q, kx + 14.0, 70.0, gK.z);
    if (gSlamAge > 0.0) {
      celBoom(q - vec2(gSlamX - 34.0, GY + 4.0), gSlamAge * 0.9 + 0.6, 22.0 * (0.5 + 0.5 * gHaze), dust, 7.0);
      celBoom(q - vec2(gSlamX + 38.0, GY + 2.0), gSlamAge * 0.9 + 0.64, 18.0 * (0.5 + 0.5 * gHaze), dust * 0.85, 9.0);
    }
  }

  // the two of them: the one being hit first, so the blow is drawn over it
  if (gFirst < 0.5) { duelSprite(q, gR, 0.0); duelSprite(q, gK, 1.0); }
  else { duelSprite(q, gK, 1.0); duelSprite(q, gR, 0.0); }
  rocketFist(q);

  // the roar: rings of air out of the jaws
  if (gRoar > 0.0) {
    vec2 e = q - vec2(kx - 40.0, GY + 170.0);
    for (int i = 0; i < 3; i++) {
      float r = 10.0 + 52.0 * fract(gRoar * 3.0 + float(i) / 3.0);
      gCol = mix(gCol, vec3(1.0), 0.7 * (1.0 - r / 62.0) * cut(max(abs(length(e) - r) - 1.3, (0.8 - dot(normalize(e), normalize(vec2(-1.0, 0.45)))) * r)));
    }
  }
  // the beams and where they meet
  if (gBeam > 0.5) {
    vec2 a = vec2(rx + LENS.x, GY + LENS.y), b = vec2(kx - MOUTH.x, GY + MOUTH.y);
    beam(q, a, gClash, 8.5, eR);
    beam(q, b, gClash, 8.5, eK);
    float t12 = floor(uTime * 12.0);
    vec2 e = q - gClash;
    vec3 hue = mix(eR, eK, step(0.0, e.x));
    float r = length(e) / (24.0 * burst(e, 11.0, t12));
    fill((r - 1.0) * 14.0, hue * 1.15);
    fill((r - 0.72) * 14.0, mix(hue, vec3(1.0), 0.6));
    fill(length(e) - 7.0 - 2.0 * h11(t12), vec3(1.0));
  }
  // the blow: a star of impact, sparks, masonry; a charge goes off on the big ones
  if (gHitAge >= 0.0) {
    vec2 e = q - gHitPos;
    vec3 hot = gBlocked > 0.5 ? vec3(0.6, 0.85, 1.0) : vec3(1.0, 0.82, 0.3);
    if (gHitPow > 0.9 && gBlocked < 0.5 && gPy > 0.0 && gImpact < 0.5)
      celBoom(e - vec2(0.0, 4.0), gHitAge * 1.1 + 0.02, (gHitPow > 1.7 ? 58.0 : 22.0) * (0.5 + 0.5 * gPy), gHitPow > 1.7 ? mix(eR, eK, 0.5) : vec3(1.0, 0.5, 0.18), floor(gB) + 3.0);
    if (gHitAge < 0.12 && gHitPow < 1.7) {
      float r = length(e) / ((gBlocked > 0.5 ? 15.0 : 22.0) * gHitPow * (0.7 + 4.0 * gHitAge) * burst(e, 9.0, floor(gB)));
      fill((r - 1.0) * 12.0, hot);
      fill((r - 0.62) * 12.0, vec3(1.0));
    }
    vec3 sp = sparks(e, gHitAge * 1.5, 24.0 * gHitPow, floor(gB));
    gCol = mix(gCol, mix(vec3(1.0, 0.9, 0.6), hot, 0.4), min(sp.r, 1.0));
    if (gBlocked < 0.5 && gImpact < 0.5 && gHitPow < 1.7) debris(e, gHitAge * 1.2 - 0.05, 15.0 * gHitPow, floor(gB) + 5.0, gNear * 2.2 + 0.08);
  }
  if (gSlamAge > 0.0) {                                    // a thrown body meets the street
    vec2 e = q - vec2(gSlamX, GY + 4.0);
    debris(e, gSlamAge * 0.9, 20.0, floor(gB) + 7.0, gGround * 2.0 + 0.06);
    vec3 sp = sparks(e, gSlamAge * 1.4, 26.0, floor(gB) + 2.0);
    gCol = mix(gCol, vec3(1.0, 0.9, 0.6), min(sp.r, 1.0));
  }

  // what stands an inch from the lens: roofs, a mast with its lamp, black against the street
  if (gImpact < 0.5) {
    float X = q.x + gCam * 1.8;
    float cell = floor(X / 26.0);
    float roof = q.y + 0.5 * VH - (3.0 + 15.0 * h11(cell * 1.3 + 2.0)) * smoothstep(40.0, 150.0, abs(q.x)) - 2.0;
    float tank = max(abs(mod(X, 26.0) - 13.0) - 3.5, q.y + 0.5 * VH - 22.0 * step(0.7, h11(cell * 4.1)) * smoothstep(60.0, 150.0, abs(q.x)));
    float mast = min(max(abs(q.x + 190.0 + gCam * 1.8) - 0.9, q.y + 50.0), max(abs(q.x + 190.0 + gCam * 1.8) - 5.0, abs(abs(q.y + 72.0) - 9.0) - 0.6));
    float fg = min(min(roof, tank), mast);
    fill(fg - 1.0, mix(INK, gAmbRim, 0.5));
    fill(fg, INK);
    fill(length(q - vec2(-190.0 - gCam * 1.8, -48.0)) - 1.6, mix(vec3(0.9, 0.12, 0.1), vec3(1.0, 0.8, 0.7), gKick));
  }
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  gU = 1.0;                                // the scene is in sheet units
  gPx = gFit * VH / uResolution.y;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  cA = mix(uColor1, vec3(1.0), 0.08);
  eR = mix(mix(uColor2, vec3(1.0), 0.12), vec3(0.3, 0.9, 1.0), 0.12);
  eK = mix(mix(uColor3, vec3(1.0), 0.12), vec3(1.0, 0.35, 0.2), 0.12);

  // the fight keeps to the beat: half, normal or double time, never in between
  gPace = pace < 0.75 ? 0.5 : pace < 1.5 ? 1.0 : 2.0;
  gB = uBeatClock * gPace;
  float s = floor(gB * 0.5), u = fract(gB * 0.5);
  gU01 = u;
  vec3 d = slotDef(s), dp = slotDef(s - 1.0);
  float thrown = dp.y == M_GRAB ? 1.0 : 0.0;
  float apart = dp.y == M_FIRE ? 1.0 : 0.0;
  // hit-stop: on the blows with weight the two of them hold the drawing of the hit while the
  // sparks and the camera go on, then catch up with the beat
  float hs = d.y == M_HEAVY || d.y == M_KICK || d.y == M_SPEC || d.y == M_BITE || d.y == M_ROCKET ? 0.075 : 0.0;
  float uw = u < 0.5 ? u : 0.5 + max(u - 0.5 - hs, 0.0) * 0.5 / (0.5 - hs);
  gR = fighter(0.0, d, uw, thrown, apart);
  gK = fighter(1.0, d, uw, thrown, apart);
  gFirst = d.x > 0.5 ? 0.0 : 1.0;                           // the attacker is drawn last

  // what lands in this slot, and where
  // (where the fist, the claw, the skull, the foot or the tail is in the drawing of the hit, from the attacker's feet)
  bool rb = d.x < 0.5;
  vec2 hp = vec2(100.0, 110.0);
  gHitAge = -1.0; gHitPow = 0.0; gBlocked = d.z; gSlamAge = -1.0; gBeam = 0.0; gSlamX = 0.0;
  if (d.y == M_PUNCH) { gHitAge = u < 0.5 ? -1.0 : u < 0.75 ? secs(0.5) : secs(0.75); gHitPow = 0.6; hp = rb ? (u < 0.75 ? vec2(108.0, 133.0) : vec2(86.0, 125.0)) : (u < 0.75 ? vec2(112.0, 92.0) : vec2(120.0, 100.0)); }
  else if (d.y == M_HEAVY) { gHitAge = secs(0.5); gHitPow = 1.0; hp = rb ? vec2(102.0, 116.0) : vec2(d.z > 0.5 ? 112.0 : 124.0, 98.0); }
  else if (d.y == M_KICK) { gHitAge = secs(0.5); gHitPow = 0.8; hp = rb ? vec2(108.0, 98.0) : vec2(104.0, 72.0); }
  else if (d.y == M_SPEC) { gHitAge = secs(0.5); gHitPow = 1.5; hp = rb ? vec2(108.0, 86.0) : vec2(126.0, 90.0); }
  else if (d.y == M_BITE) { gHitAge = secs(0.5); gHitPow = 1.2; hp = vec2(120.0, 92.0); }
  else if (d.y == M_ROCKET) { gHitAge = secs(0.5); gHitPow = 1.2; hp = vec2(KX - RX - 40.0, 120.0); }
  else if (d.y == M_FIRE) { gHitAge = secs(0.5); gHitPow = 2.0; gBeam = u < 0.5 ? 1.0 : 0.0; }
  gHitPos = vec2(rb ? RX + hp.x : KX - hp.x, GY + hp.y);
  if (d.y == M_GETUP && thrown > 0.5) { gSlamAge = secs(0.0); gSlamX = d.x < 0.5 ? RX - 10.0 : KX + 14.0; }
  if (d.y != M_HEAVY) gBlocked = 0.0;
  // the beams meet in the middle and push each other back and forth, eight steps to the beat
  vec2 ba = vec2(RX - APART + LENS.x, GY + LENS.y), bb = vec2(KX + APART + 18.0 - MOUTH.x, GY + MOUTH.y);
  gClash = mix(ba, bb, 0.5 + 0.2 * sin(floor(gB * 8.0) * 0.9) * min(u * 4.0, 1.0));
  if (d.y == M_FIRE) gHitPos = gClash;
  gCharge = d.y == M_CHARGE ? smoothstep(0.2, 0.9, u) : 0.0;
  gRoar = d.y == M_TAUNT && u > 0.14 && u < 0.86 ? (u - 0.14) / 0.72 : 0.0;
  // the rocket fist: out of the elbow on a tail of fire, into the chest on the beat, back up over the street and home
  gFist = vec4(0.0);
  if (d.y == M_ROCKET && u > 0.42 && u < 0.88) {
    vec2 w0 = vec2(RX + WRIST.x - 4.0, GY + WRIST.y), w1 = gHitPos - vec2(8.0, 0.0);
    float v = (u - 0.5) / 0.38;
    gFist = u < 0.5 ? vec4(mix(w0, w1, pow((u - 0.42) / 0.08, 1.5)), 1.0, 1.0)
                    : vec4(mix(w1, w0, ease(v)) + vec2(0.0, 34.0 * sin(v * 3.14159)), 1.0, -1.0);
  }

  // the sky: dusk, night, storm, eight slots each; the street is whole again when it changes
  gBlock = floor(s / 8.0) * 16.0;
  gMood = mod(floor(s / 8.0), 3.0);
  gStorm = step(1.5, gMood);
  gBolt_ = gStorm * gKick * gKick * step(0.5, h11(floor(uBeatClock) * 3.7));
  vec3 tint = mix(vec3(1.0), min(uColor3 / max(dot(uColor3, vec3(0.333)), 0.05), 1.6), 0.16);
  if (gMood < 0.5) {
    gSkyH = mix(vec3(1.0, 0.5, 0.22), uColor2, 0.3); gSkyM = mix(vec3(0.6, 0.17, 0.4), uColor3, 0.3); gSkyT = mix(vec3(0.15, 0.06, 0.3), uColor3 * 0.3, 0.3);
    gDiscCol = vec3(1.0, 0.93, 0.62); gAmbRim = vec3(1.0, 0.74, 0.42);
    gFar = mix(gSkyH, gSkyM, 0.55) * 0.82; gMid = vec3(0.3, 0.12, 0.27) * tint; gNear = vec3(0.14, 0.07, 0.19) * tint; gGround = vec3(0.21, 0.12, 0.23) * tint;
    gDisc = vec2(26.0, GY + 60.0);
  } else if (gMood < 1.5) {
    gSkyH = mix(vec3(0.1, 0.3, 0.52), uColor3, 0.25); gSkyM = mix(vec3(0.045, 0.1, 0.27), uColor3 * 0.4, 0.2); gSkyT = vec3(0.02, 0.03, 0.1);
    gDiscCol = vec3(0.93, 0.96, 1.0); gAmbRim = vec3(0.6, 0.72, 1.0);
    gFar = mix(gSkyH, gSkyM, 0.5) * 0.8; gMid = vec3(0.06, 0.1, 0.22) * tint; gNear = vec3(0.035, 0.05, 0.12) * tint; gGround = vec3(0.07, 0.085, 0.18) * tint;
    gDisc = vec2(-10.0, GY + 176.0);
  } else {
    gSkyH = mix(vec3(0.44, 0.52, 0.48), uColor3, 0.18); gSkyM = vec3(0.19, 0.26, 0.28); gSkyT = vec3(0.07, 0.1, 0.13);
    gDiscCol = vec3(0.8, 0.9, 1.0); gAmbRim = vec3(0.74, 0.92, 1.0);
    gFar = mix(gSkyH, gSkyM, 0.6) * 0.8; gMid = vec3(0.1, 0.155, 0.17) * tint; gNear = vec3(0.05, 0.078, 0.1) * tint; gGround = vec3(0.09, 0.12, 0.14) * tint;
    gDisc = vec2(20.0, GY + 150.0);
  }

  // camera: a drift along the street, a jolt on every hit, a punch-in on the ones with weight
  gCam = 7.0 * sin(gB * 3.14159 / 16.0);
  gDisc.x -= gCam * 0.1;
  float hit = (gHitAge >= 0.0 ? exp(-gHitAge * 9.0) * gHitPow : 0.0) + (gSlamAge >= 0.0 ? exp(-gSlamAge * 9.0) * 1.3 : 0.0) + 0.22 * gBeam + 0.12 * gKick
            + 0.3 * step(0.001, gRoar);
  gShake = hit * vec2(3.2 * sin(uTime * 61.0), 4.2 * cos(uTime * 47.0));
  float heavy = step(0.9, gHitPow) * (1.0 - gBlocked);
  gImpact = heavy * step(0.0, gHitAge) * step(gHitAge, 0.085) * step(0.01, pyro);
  gPunch = heavy * 0.08 * exp(-max(gHitAge, 0.0) * 5.0) * step(0.0, gHitAge) + 0.05 * gCharge + 0.03 * gBeam;
  gCamC = heavy > 0.5 && gHitAge >= 0.0 ? gHitPos : vec2(0.5 * (RX + KX), GY + 100.0);
  gFlash = gHitAge >= 0.0 ? exp(-gHitAge * 8.0) * min(gHitPow, 1.5) * gPy * (1.0 - gBlocked) : 0.0;

  vec3 col = render(gl_FragCoord.xy);
  col = printLook(col, gl_FragCoord.xy, tp);
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.22 - dot(vp, vp) * 0.75, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

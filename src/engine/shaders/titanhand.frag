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

uniform float tempo;
uniform float crew;
uniform float pyro;
uniform float tape;

// Titan Hand: a cel from a giant-monster cartoon. The foot of a building too big
// for the frame, three steel bay doors, a plaza. Three suited heroes hold the
// plaza. Every 8 beats a bay rattles, bursts open on the beat and the hand of
// something the size of the building comes out of it, black against the light
// behind the doors. It gropes after the team, pats the ground, winds up and slams
// (an impact frame, sparks, shake, a punch-in), shakes its fist and is gone; the
// doors slam and the team runs to the next bay and strikes the roll-call pose
// with a coloured charge going off behind each of them.
// Everything is flat paint: two tones and a pen line per surface, a rim of
// whatever light is behind it. The mood of the street (night, dusk, storm)
// changes every two rounds.

const float FY = -0.2;                   // where the facade meets the plaza
const float HAND = 0.74;                 // the size the hand sheet is drawn at

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

uniform sampler2D uAtlasHero0;
uniform sampler2D uAtlasHero1;
uniform sampler2D uAtlasHero2;
uniform sampler2D uAtlasHand;

// frames on a hero's sheet (16 x 8 cells of 144 units, a hero 95 units tall)
const float F_STANCE = 0.0, F_WALK = 8.0, F_RUN = 16.0, F_LOOK = 28.0, F_FLIP = 40.0, F_SKID = 52.0, F_KNOCK = 58.0, F_GETUP = 66.0,
            F_POSE = 76.0, F_PUNCH = 88.0, F_KICK = 96.0, F_FKICK = 104.0, F_BLAST = 112.0, F_TURN = 122.0, F_BOLT = 124.0;

// one frame of hero v's sheet, feet at o
void heroSprite(vec2 p, vec2 o, float dir, float idx, vec3 suit, float v) {
  vec2 c = (p - o) / gU;
  c = vec2(c.x * dir + 72.0, c.y + 12.0);
  if (c.x < 0.5 || c.y < 0.5 || c.x > 143.5 || c.y > 143.5) return;
  vec2 uv = vec2((mod(idx, 16.0) * 144.0 + c.x) / 2304.0, 1.0 - (floor(idx / 16.0) * 144.0 + 144.0 - c.y) / 1152.0);
  vec4 t = v < 0.5 ? texture2D(uAtlasHero0, uv) : v < 1.5 ? texture2D(uAtlasHero1, uv) : texture2D(uAtlasHero2, uv);
  celPaint(t, dir, suit, suit * 0.7, vec3(0.97, 0.96, 0.92), vec3(0.66, 0.65, 0.66), 2.0 * gPx / gU);
}

float gTc, gXd, gSide, gOpen, gRum, gKick, gHandOn, gCurl, gSpread, gHS, gSlamX, gImpAge, gBurstAge, gShutAge, gPoseAge, gPat1, gPat2, gShadow, gCrew;
float gMood, gBolt_, gStorm, gImpact, gPunch;
vec2 gW, gHD, gShake;
vec3 gGlow, gWall, gWallLit, gGround, gAmbRim, cA, cB, cC;
vec4 gS0, gS1, gS2;                      // per hero: x, hop, facing, frame on the sheet
float gHandFrame;
vec4 gBolt;                              // the energy bolt: x, y, on, direction
vec4 gBoltA, gBoltC;                     // the two bolts of the finisher, same layout
float gFin;                              // 1 on the rounds that end with the double blast instead of the kicks

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float kf(float a, float b) { return clamp((gTc - a) / (b - a), 0.0, 1.0); }
float secs(float t0) { return (gTc - t0) * 8.0 * 0.47 / clamp(tempo, 0.25, 2.0); }
float bay(float n) {
  float blk = floor(n / 3.0);
  return mod(n * (h11(blk * 7.9 + 1.5) > 0.5 ? 1.0 : 2.0) + floor(h11(blk * 3.7 + 0.5) * 3.0), 3.0) - 1.0;
}

vec3 facade(vec2 p) {
  float xd = clamp(floor(p.x / 0.6 + 0.5), -1.0, 1.0) * 0.6;
  float act = step(abs(xd - gXd), 0.01);
  vec2 dq = vec2(p.x - xd, p.y - FY);
  // the wall: two flat tones, parted by the stepped shadow of the block across the street
  float sh = p.y - 0.07 - 0.5 * p.x - 0.07 * step(0.5, fract(p.x * 1.7 + 0.2)) - 0.04 * step(0.6, fract(p.x * 4.3));
  gCol = mix(gWallLit, gWall, cut(-sh));
  // cast panels
  vec2 pj = abs(fract(p / vec2(0.2, 0.11) + 0.5) - 0.5) * vec2(0.2, 0.11);
  gCol *= 1.0 - 0.2 * cut(min(pj.x, pj.y) - 0.0016);
  // streaks of rain water under the ledge
  float stx = floor(p.x / 0.021);
  gCol *= 1.0 - 0.16 * step(0.72, h11(stx)) * step(0.345 - 0.3 * h11(stx + 9.0), p.y) * step(p.y, 0.345);
  if (p.y > 0.36) {
    // upper storeys: ranks of windows far too small, which is what makes it huge
    gCol = gWall * 0.8;
    vec2 wc = vec2(p.x / 0.024, (p.y - 0.372) / 0.04);
    vec2 wi = floor(wc), wf = fract(wc) - 0.5;
    float on = step(0.86 - 0.3 * uHigh * step(0.5, h21(wi + 3.0)), h21(wi + floor(uBeatClock * 0.125) * 0.37));
    fill(max(abs(wf.x) - 0.22, abs(wf.y) - 0.3) * 0.036, mix(gWall * 1.45, mix(uColor2, vec3(1.0, 0.86, 0.55), 0.7), on));
  }
  // the ledge, catching the sky
  fill(abs(p.y - 0.348) - 0.012, mix(gWallLit * 1.5, gAmbRim, 0.25));
  fill(abs(p.y - 0.334) - 0.003, INK);
  // piers between the bays: a lit face and a shaded one
  float px = abs(abs(p.x) - 0.6) - 0.3;
  if (p.y < 0.33) {
    fill(abs(px) - 0.05, gWallLit * 1.25);
    fill(max(abs(px - 0.03) - 0.02, 0.0), gWall * 0.75);
    fill(abs(abs(px) - 0.05) - 0.002, INK);
  }
  // the bay: a hazard-striped frame, two slatted leaves
  dq.x += act * gRum * 0.005 * sin(uTime * 75.0);
  float dB = max(abs(dq.x) - 0.15, dq.y - 0.5);
  if (dB < 0.03) {
    float hz = step(0.5, fract((dq.x + dq.y) * 20.0));
    fill(dB - 0.022, mix(mix(vec3(0.98, 0.76, 0.1), gGlow, 0.35 * act * gOpen), INK, hz));
    fill(abs(dB - 0.024) - 0.0022, INK);
    if (dB < 0.0) {
      float ang = act * gOpen * 1.45 + act * gRum * 0.12 * abs(sin(uTime * 31.0));
      float lxx = (0.15 - abs(dq.x)) / cos(ang);
      if (lxx < 0.15) {
        float sv = sin(ang);
        float yy = dq.y / (1.0 + 0.12 * sv * lxx / 0.15);
        float sl = fract(yy / 0.036);
        vec3 steel = mix(gWallLit * 1.5, uColor2 * 0.42, 0.45) * (1.0 - 0.45 * sv);
        gCol = mix(steel, steel * 0.62, step(0.55, sl));
        // light through the slats when the thing behind them leans on the doors, and on the kick
        float leak = max(act * gRum, 0.22 * gKick) * step(0.9, sl);
        gCol = mix(gCol, gGlow * 1.3, leak);
        fill(0.004 - (0.15 - lxx), mix(INK, gGlow, 0.5 * gKick + act * gRum));     // the seam where the leaves meet
        gCol = mix(gCol, mix(vec3(0.98, 0.76, 0.1), INK, step(0.5, fract((lxx + yy) * 18.0))), step(yy, 0.04));
      } else {
        // inside: the light that is behind whatever lives here, in three bands, and its smoke
        float sm = fbm(vec2(dq.x * 9.0, dq.y * 6.0 - uTime * 0.7));
        float lv = 1.0 - dq.y / 0.5 + 0.35 * (sm - 0.5);
        gCol = lv > 0.72 ? mix(gGlow, vec3(1.0, 0.95, 0.8), 0.65) : lv > 0.4 ? gGlow : gGlow * 0.5;
        gCol = mix(gCol, gGlow * 0.22, step(0.62, fbm(vec2(dq.x * 7.0 + uTime * 0.3, dq.y * 5.0 - uTime * 0.5))) * step(0.12, dq.y));
      }
    }
  }
  // lightning lights the whole street for a frame or two
  gCol += gBolt_ * vec3(0.3, 0.38, 0.5);
  return gCol;
}

vec3 plaza(vec2 p) {
  float f = FY - p.y;
  float X = p.x / (1.0 + f * 1.6);
  gCol = gGround;
  gCol *= 1.0 - 0.2 * cut(abs(fract(X / 0.25) - 0.5) * 0.25 * (1.0 + f * 1.6) - 0.0015 * (1.0 + f * 4.0));
  float row = pow(f / 0.3, 0.75) * 4.0;
  gCol *= 1.0 - 0.2 * step(fract(row), 0.05);
  fill(abs(f - 0.045) - 0.004 + step(fract(X / 0.1), 0.3), vec3(0.9, 0.72, 0.15) * (0.45 + 0.4 * dot(gGround, vec3(1.0))));
  fill(f - 0.012, gGround * 0.55);                              // where the wall stands on it
  // the light of an open bay thrown across the plaza: two hard wedges
  float ax = abs(p.x - gXd);
  gCol = mix(gCol, gCol * 0.6 + gGlow * 0.42, gOpen * cut(ax - 0.17 - f * 1.5));
  gCol = mix(gCol, gCol * 0.3 + gGlow * 0.8, gOpen * cut(max(ax - 0.11 - f * 0.7, f - 0.2)));
  // puddles keep a piece of the wall
  float pud = step(0.63, fbm(vec2(X * 7.0, f * 26.0) + 3.0)) * step(0.05, f);
  gCol = mix(gCol, mix(gWallLit * 1.3, gGlow, 0.5 * gOpen * step(ax, 0.3)), 0.5 * pud * (0.4 + 0.6 * gStorm));
  gCol += gBolt_ * vec3(0.22, 0.28, 0.38);
  return gCol;
}

// the light on a figure standing at x: the street's own, or the open bay's from the side
void figureLight(float x, float sil) {
  vec3 door = normalize(vec3((gXd - x) * 3.0, 0.45, 0.42));
  gKeyDir = normalize(mix(vec3(-0.45, 0.6, 0.66), door, 0.85 * gOpen));
  gRimDir = normalize(mix(vec2(0.55, 0.83), vec2(gXd - x, 0.22), gOpen) + vec2(1e-4, 0.0));
  gSil = sil;
}

void titanHand(vec2 p) {
  if (gHandOn < 0.5) return;
  vec2 R = vec2(gXd, FY + 0.27);
  if (sdSeg(p, R, gW) > 0.7) return;
  vec3 hide = mix(vec3(0.33, 0.29, 0.44), uColor3, 0.2);
  figureLight(gW.x - gSide * 0.5, 0.45);
  // the arm: fur, thin and lost in the light at the far end. The sheet takes over at the wrist
  vec2 C = mix(R, gW, 0.5) + vec2(-gSide * 0.04, 0.16);
  vec3 g = vec3(1e3, 0.0, 0.0);
  vec2 pa = R;
  for (int i = 1; i <= 5; i++) {
    float t = float(i) / 5.0;
    vec2 pb = mix(mix(R, C, t), mix(C, gW, t), t);
    g = smin3(g, gSeg(p, pa, pb, mix(0.05, 0.105, t - 0.2), mix(0.05, 0.105, t)), 0.02);
    pa = pb;
  }
  vec2 ad = normalize(gW - C);
  g.x += (abs(fract(dot(p, ad) / 0.03 + 0.4 * sin(dot(p, vec2(-ad.y, ad.x)) * 40.0)) - 0.5) - 0.25) * 0.02 * (0.35 + vn(p * 26.0)) * smoothstep(0.02, 0.2, length(p - R));     // tufts along both edges
  if (g.x < 0.012) {
    float t = clamp(-g.x / 0.1, 0.0, 1.0);
    vec3 n = vec3(g.yz * (1.0 - t), sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)));
    vec3 c = celTone(hide * 0.6, n, 1.0);
    c = mix(INK + gGlow * 0.05, c, smoothstep(0.0, 0.22, length(p - R)));          // the far end is only a shape against the light
    fill(g.x - 0.006, INK);
    fill(g.x, c);
  }
  // the hand: one frame of the 6 x 3 sheet (cells of 288 units), wrist on gW. It is drawn
  // already turned the way it points, for a reach to the right: mirrored for the left
  vec2 c = (p - gW) / (gU * HAND);
  c = vec2(c.x * gSide + 144.0, c.y + 144.0);
  if (c.x < 0.5 || c.y < 0.5 || c.x > 287.5 || c.y > 287.5) return;
  vec4 t = texture2D(uAtlasHand, vec2((mod(gHandFrame, 6.0) * 288.0 + c.x) / 1728.0, 1.0 - (floor(gHandFrame / 6.0) * 288.0 + 288.0 - c.y) / 864.0));
  celPaint(t, gSide, hide, hide * 0.6, vec3(0.96, 0.92, 0.78), vec3(0.7, 0.66, 0.56), 2.0 * gPx / (gU * HAND));
}

// a flat shadow on the plaza, thrown away from the open bay
void shadowAt(vec2 p, float x, float y, float w) {
  float away = gOpen * clamp((x - gXd) * 0.5, -0.12, 0.12);
  vec2 q = (p - vec2(x + away, y)) / vec2(w + abs(away), 0.012);
  gCol = mix(gCol, gCol * 0.42, cut((length(q) - 1.0) * 0.012));
}

vec3 render(vec2 fc) {
  vec2 p = (fc - 0.5 * uResolution) / uResolution.y * gFit;
  vec2 pc = vec2(gSlamX, -0.3);
  p = pc + (p - pc) * (1.0 - gPunch) + gShake;
  float py = clamp(pyro, 0.0, 2.0);
  float sil = max(gImpact, clamp(exp(-max(gPoseAge, 0.0) * 4.0) * step(0.0, gPoseAge) * 1.3 * min(py, 1.0), 0.0, 1.0));
  if (gImpact > 0.5) gCol = impactFrame(p - vec2(gSlamX, -0.34), mix(uColor1, vec3(1.0, 0.75, 0.3), 0.45), floor(uBeatClock));
  else gCol = p.y > FY ? facade(p) : plaza(p);

  if (gImpact < 0.5) {
    // rain, in the storm
    vec2 rq = vec2(p.x + p.y * 0.25, p.y) * vec2(60.0, 5.0) + vec2(0.0, uTime * 9.0);
    float rain = step(0.93, h21(floor(rq))) * step(abs(fract(rq.x) - 0.5), 0.09);
    gCol = mix(gCol, gAmbRim, 0.3 * rain * gStorm);
    // mist along the foot of the wall, in two flat layers
    float m1 = FY + 0.03 + 0.022 * sin(p.x * 5.0 + uTime * 0.3) + 0.012 * sin(p.x * 13.0 - uTime * 0.5);
    vec3 mist = mix(gWallLit * 1.9, gGlow, 0.35 * gOpen);
    gCol = mix(gCol, mist, 0.3 * cut(max(p.y - m1, FY - 0.035 - p.y)));
    // shadow of the hand before it lands
    vec2 sq = (p - vec2(gSlamX, -0.37)) / vec2(0.2, 0.035);
    gCol = mix(gCol, gCol * 0.4, gShadow * cut((length(sq) - 1.0) * 0.03));
    // roll call: one charge behind each of them, in their colour
    if (gPoseAge > 0.0 && py > 0.0) {
      celBoom(p - vec2(gS0.x - 0.03, -0.17), gPoseAge, 0.26 * py, cA, 1.0);
      if (gCrew > 1.5) celBoom(p - vec2(gS1.x + 0.05, -0.14), gPoseAge - 0.06, 0.28 * py, cB, 2.0);
      if (gCrew > 2.5) celBoom(p - vec2(gS2.x - 0.05, -0.15), gPoseAge - 0.12, 0.26 * py, cC, 3.0);
    }
    // dust blown out of the bay when the doors go
    if (gBurstAge > 0.0) celBoom(p - vec2(gXd, FY + 0.08), gBurstAge * 1.1 + 0.6, 0.1 + 0.1 * smoothstep(0.0, 0.5, gBurstAge), mix(gWallLit * 2.2, gGlow, 0.3), 5.0);
  }

  for (int k = 2; k >= 1; k--) {
    vec4 hh = k == 1 ? gS1 : gS2;
    if (gCrew < float(k) + 0.5) continue;
    float ly = k == 1 ? -0.36 : -0.34;
    if (gImpact < 0.5) shadowAt(p, hh.x, ly, 0.065);
    figureLight(hh.x, sil);
    heroSprite(p, vec2(hh.x, ly + hh.y), hh.z, hh.w, k == 1 ? cB : cC, float(k));
  }
  titanHand(p);
  if (gImpact < 0.5) shadowAt(p, gS0.x, -0.385, 0.07);
  figureLight(gS0.x, sil);
  heroSprite(p, vec2(gS0.x, -0.385 + gS0.y), gS0.z, gS0.w, cA, 0.0);
  // the second one's bolt, on its way to the hand
  float bf = F_BOLT + mod(floor(uTime * 12.0), 4.0);
  if (gBolt.z > 0.5) heroSprite(p, gBolt.xy - vec2(0.0, 60.0 * gU), gBolt.w, bf, cB, 1.0);
  if (gBoltA.z > 0.5) heroSprite(p, gBoltA.xy - vec2(0.0, 60.0 * gU), gBoltA.w, bf, cA, 0.0);
  if (gBoltC.z > 0.5 && gCrew > 2.5) heroSprite(p, gBoltC.xy - vec2(0.0, 60.0 * gU), gBoltC.w, bf, cC, 2.0);
  // the two bolts meet on the fist
  if (gFin > 0.5) celBoom(p - gW - vec2(0.0, 0.08), secs(0.68), 0.2 * py, mix(uColor1, vec3(1.0, 0.8, 0.4), 0.5), 11.0);

  // sparks: the slam, the two pats, the doors, the bolt and the kick
  vec3 sp = sparks(p - vec2(gSlamX, -0.36), gImpAge * 1.3, 0.22 * (0.5 + 0.5 * py), 1.0);
  sp += sparks(p - vec2(gTc < 0.375 ? gPat1 : gPat2, -0.33), secs(gTc < 0.375 ? 0.25 : 0.375) * 2.0, 0.09 * py, 2.0);
  sp += sparks(p - vec2(gXd, FY + 0.3), gBurstAge * 1.5, 0.2 * (0.4 + 0.6 * py), 4.0);
  sp += sparks(p - vec2(gXd, FY + 0.02), gShutAge * 2.0, 0.1 * py, 5.0);
  sp += sparks(p - gW, secs(0.43) * 2.2, 0.12 * py, 6.0) + sparks(p - gW - vec2(0.0, 0.1), secs(gFin > 0.5 ? 0.68 : 0.64) * 2.2, 0.14 * py, 8.0);
  gCol = mix(gCol, vec3(1.0, 0.9, 0.6), min(sp.r, 1.0));
  if (gImpAge > 0.0 && gImpact < 0.5) {
    celBoom(p - vec2(gSlamX - 0.12, -0.35), gImpAge * 0.9 + 0.62, 0.11, gGround * 2.4, 7.0);
    celBoom(p - vec2(gSlamX + 0.13, -0.36), gImpAge * 0.9 + 0.66, 0.09, gGround * 2.0, 9.0);
    // the ground gives: a ring of ink cracks out from under the palm
    vec2 cq = (p - vec2(gSlamX, -0.37)) / vec2(1.0, 0.3);
    float ring = abs(length(cq) - 0.5 * (1.0 - exp(-gImpAge * 7.0))) - 0.012 * exp(-gImpAge * 3.0);
    gCol = mix(gCol, vec3(1.0), cut(ring) * step(p.y, FY) * step(gImpAge, 0.5));
  }

  // what stands an inch from the lens: a lamp post and a heap of rubble, black
  if (gImpact < 0.5) {
    float lamp = min(sdBox(p - vec2(-0.83, -0.2), vec2(0.011, 0.36)), sdBox(p - vec2(-0.78, 0.165), vec2(0.06, 0.008)));
    lamp = min(lamp, sdBox(p - vec2(-0.735, 0.15), vec2(0.022, 0.012)));
    float heap = p.y + 0.5 - 0.1 * (1.0 - smoothstep(0.0, 0.34, abs(p.x - 0.8))) - 0.03 * vn(vec2(p.x * 22.0, 1.0));
    float fg = min(lamp, heap);
    fill(fg - 0.004, mix(INK, gAmbRim, 0.5));
    fill(fg, INK);
    fill(length((p - vec2(-0.735, 0.128)) * vec2(1.0, 1.6)) - 0.013, mix(vec3(1.0, 0.9, 0.6), vec3(1.0), gKick));
  }
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  gU = gFit / 216.0;                       // a sheet unit: a hero is 95 of them tall
  gPx = gFit / uResolution.y;
  gCrew = floor(clamp(crew, 1.0, 3.0) + 0.5);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);

  // ---- the 8-beat routine ----
  float cyc = uBeatClock * clamp(tempo, 0.25, 2.0) / 8.0;
  float n = floor(cyc);
  gTc = fract(cyc);
  gFin = mod(n, 2.0);
  gBoltA = gBoltC = vec4(0.0);
  gXd = bay(n) * 0.6;
  float xn = bay(n + 1.0) * 0.6;
  gSide = abs(gXd) > 0.3 ? -sign(gXd) : (h11(n * 5.3 + 2.0) > 0.5 ? 1.0 : -1.0);
  gRum = smoothstep(0.04, 0.12, gTc) * step(gTc, 0.125);
  gOpen = step(0.125, gTc) * step(gTc, 0.75);
  gBurstAge = secs(0.125);
  gShutAge = secs(0.75);
  gImpAge = secs(0.5);
  gPoseAge = gTc > 0.5 ? secs(0.875) : secs(-0.125);
  gHandOn = step(0.125, gTc) * step(gTc, 0.75);
  gHS = 1.0;
  gSlamX = clamp(gXd + gSide * 0.47, -0.8, 0.8);

  // the hand: out, grope, wind up, slam, fist, gone
  vec2 R = vec2(gXd, FY + 0.27);
  vec2 d1 = normalize(vec2(gSide * 0.55, -1.0)), d4 = normalize(vec2(gSide * 0.9, -0.45)), d5 = normalize(vec2(gSide * 0.25, 1.0));
  float pat = exp(-pow((gTc - 0.25) / 0.012, 2.0)) + exp(-pow((gTc - 0.375) / 0.012, 2.0));
  gPat1 = gXd + gSide * 0.24;
  gPat2 = gXd + gSide * 0.33;
  vec2 P1 = vec2(gXd + gSide * 0.1, -0.02);
  vec2 P2 = vec2(gXd + gSide * 0.2, -0.06);
  vec2 P3 = vec2(gSlamX - gSide * 0.22, 0.14);
  vec2 P4 = vec2(gSlamX, -0.33) - d4 * 0.2;
  vec2 P5 = vec2(gXd + gSide * 0.2, -0.02);
  float o1 = kf(0.125, 0.185);
  gW = mix(R, P1, 1.0 - pow(1.0 - o1, 3.0) + 0.25 * sin(o1 * 3.14159) * (1.0 - o1));
  gW = mix(gW, P2, ease(kf(0.19, 0.42)));
  gW.y -= 0.075 * pat;
  gW = mix(gW, P3, ease(kf(0.42, 0.49)));
  gW = mix(gW, P4, pow(kf(0.49, 0.5), 2.0));
  gW = mix(gW, P5, ease(kf(0.57, 0.63)));
  gW += vec2(0.018 * sin(uTime * 26.0), 0.0) * step(0.63, gTc) * step(gTc, 0.69);
  gW = mix(gW, R, ease(kf(0.69, 0.75)));
  gHD = mix(vec2(0.0, -1.0), d1, ease(kf(0.125, 0.19)));
  gHD = mix(gHD, d4, ease(kf(0.42, 0.5)));
  gHD = mix(gHD, d5, ease(kf(0.57, 0.63)));
  gHD = normalize(mix(gHD, vec2(0.0, -1.0), ease(kf(0.69, 0.75))) + vec2(1e-4, 0.0));
  gCurl = 0.35 * (1.0 - kf(0.125, 0.17)) + 0.25 * pat + ease(kf(0.57, 0.62)) * (1.0 - ease(kf(0.69, 0.73)));
  gSpread = ease(kf(0.14, 0.2)) * (1.0 - 0.5 * ease(kf(0.57, 0.62)));
  gHS *= mix(0.55, 1.0, ease(kf(0.125, 0.18))) * mix(1.0, 0.55, ease(kf(0.69, 0.75)));
  // which drawing of the hand: it opens as it comes out, gropes, pats, snatches
  // at nothing, slams flat, makes a fist, half closes as it goes
  gHandFrame = mod(floor(uTime * 8.0), 4.0);
  if (gTc < 0.17) gHandFrame = 9.0 - floor(kf(0.125, 0.17) * 3.99);
  if (pat > 0.15) gHandFrame = pat > 0.55 ? 5.0 : 4.0;
  if (gTc >= 0.395 && gTc < 0.44) gHandFrame = 6.0 + floor(min(kf(0.395, 0.42) * 3.99, 3.0));
  if (gTc >= 0.44 && gTc < 0.5) gHandFrame = 10.0;
  if (gTc >= 0.5 && gTc < 0.57) gHandFrame = gTc < 0.515 ? 11.0 : 12.0;
  if (gTc >= 0.57 && gTc < 0.69) gHandFrame = gTc < 0.59 ? 9.0 : 13.0 + mod(floor(uTime * 10.0), 2.0);
  if (gTc >= 0.69) gHandFrame = 15.0 + floor(kf(0.69, 0.75) * 1.99);
  gShadow = ease(kf(0.42, 0.5)) * (1.0 - ease(kf(0.56, 0.62)));

  // the team: every change of action is a cross-fade of joint angles, and each
  // of the three runs the routine a little later than the one before
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float off = k == 0 ? 0.0 : k == 1 ? 0.25 : -0.25;
    float start = clamp(gXd + off, -0.68, 0.68), next = clamp(xn + off, -0.68, 0.68);
    float flee = clamp(k == 0 ? gSlamX : k == 1 ? gXd + gSide * 0.78 : gXd - gSide * 0.34, -0.82, 0.82);
    float flee2 = k == 0 ? clamp(flee + gSide * 0.26, -0.82, 0.82) : flee;
    float t1 = 0.3 + 0.025 * fk;
    float a = kf(0.13 + 0.02 * fk, t1), c = kf(0.752 + 0.012 * fk, 0.86 + 0.004 * fk);
    float j = k == 0 ? kf(0.455, 0.585) : 0.0;
    float x = mix(mix(mix(start, flee, ease(a)), flee2, ease(j)), next, ease(c));
    float bA = smoothstep(0.0, 0.1, a) * (1.0 - smoothstep(0.8, 0.96, a));
    float bC = smoothstep(0.0, 0.1, c) * (1.0 - smoothstep(0.84, 1.0, c));
    float roll = k == 2 ? a : j;
    float wTum = (k == 1 ? 0.0 : 1.0) * smoothstep(0.0, 0.07, roll) * (1.0 - smoothstep(0.93, 1.0, roll));
    float wRun = (k == 2 ? 0.0 : bA) + bC;
    float skid = (k == 2 ? 0.0 : smoothstep(0.78, 0.96, a) * (1.0 - kf(t1 + 0.012, t1 + 0.05))) + 0.8 * smoothstep(0.8, 1.0, c) * (1.0 - kf(0.866, 0.88));
    float late = gTc - 0.87 - 0.006 * fk;
    float pp = gTc > 0.5 ? late / 0.075 : 1.0;
    float wPose = gTc > 0.5 ? smoothstep(0.0, 0.2, pp) : 1.0 - smoothstep(0.045 + 0.012 * fk, 0.08 + 0.012 * fk, gTc);
    float face = sign(gXd + gSide * 0.15 - x + 1e-3);
    if (a > 0.001 && a < 0.97) face = sign(flee - start + 1e-3);
    if (j > 0.001 && j < 0.999) face = gSide;
    if (c > 0.001 && c < 0.97) face = sign(next - flee2 + 1e-3);
    if (wPose > 0.5) face = 1.0;
    float lb = k == 2 ? 0.0 : smoothstep(0.3, 0.42, a) * (1.0 - smoothstep(0.66, 0.8, a));
    float hop = k == 0 ? 0.14 * sin(j * 3.14159) : k == 2 ? 0.06 * sin(a * 3.14159) : 0.03 * sin(kf(0.5, 0.56) * 3.14159);
    // which drawing: the action that weighs most picks the animation, its progress the frame
    float fr = F_STANCE + floor(fract(uBeatClock * 0.5 + fk * 0.31) * 8.0);
    if (wRun > 0.35) fr = (lb > 0.5 ? F_LOOK : F_RUN) + floor(fract(uBeatClock * 1.5 + fk * 0.37) * 12.0);
    if (skid > 0.45) fr = F_SKID + floor(clamp((skid - 0.45) / 0.5, 0.0, 1.0) * 5.99);
    if (wPose > 0.5) fr = F_POSE + floor(clamp(pp, 0.0, 1.0) * 11.99);
    if (wTum > 0.5) fr = F_FLIP + floor(roll * 11.99);
    // a beat of turning round before each run: nobody flips like a card
    if ((a > 0.001 && a < 0.07) || (c > 0.001 && c < 0.06)) fr = F_TURN + (a > 0.035 || c > 0.03 ? 1.0 : 0.0);
    // and they fight back, each with a move of his own
    // every other round the first and the third finish it together: two bolts into the fist
    if (gFin > 0.5 && k != 1) {
      float bp = kf(0.585, 0.685), fl = kf(0.635, 0.68);
      float ly = k == 0 ? -0.385 : -0.34;
      if (bp > 0.001 && bp < 0.999) { fr = F_BLAST + floor(bp * 9.99); face = sign(gW.x - x + 1e-3); hop = 0.0; }
      vec4 b = vec4(mix(x + face * 0.2, gW.x, fl), mix(ly + 0.33, gW.y + 0.08, fl), step(0.001, fl) * step(fl, 0.999), face);
      if (k == 0) gBoltA = b; else gBoltC = b;
    }
    if (k == 0 && gFin < 0.5) {
      // the first one lands a flying kick on the fist while it is still shaking
      float fkp = kf(0.6, 0.675);
      if (fkp > 0.001 && fkp < 0.999) {
        fr = F_FKICK + floor(fkp * 7.99);
        face = -gSide;
        x = mix(x, gXd + gSide * 0.42, ease(clamp((fkp - 0.2) / 0.5, 0.0, 1.0)) * (1.0 - ease((fkp - 0.8) / 0.2)));
        hop = 0.2 * smoothstep(0.2, 0.45, fkp) * (1.0 - smoothstep(0.75, 0.95, fkp));
      }
    }
    if (k == 1) {
      // the second one fires an energy bolt at it while it gropes
      float bp = kf(0.335, 0.435);
      if (bp > 0.001 && bp < 0.999) { fr = F_BLAST + floor(bp * 9.99); face = -gSide; }
      float fl = kf(0.385, 0.43);
      gBolt = vec4(mix(x - gSide * 0.2, gW.x, fl), mix(-0.14, gW.y, fl), step(0.001, fl) * step(fl, 0.999), -gSide);
      // the slam throws him off his feet; he is up again before the doors shut
      float kd = kf(0.5, 0.56), up = kf(0.6, 0.72);
      if (gTc >= 0.5 && gTc < 0.6) { fr = F_KNOCK + floor(kd * 7.99); face = -gSide; x += gSide * 0.07 * ease(kd); hop = 0.0; }
      if (gTc >= 0.6 && gTc < 0.72) { fr = F_GETUP + floor(up * 9.99); face = -gSide; x += gSide * 0.07; hop = 0.0; }
    }
    if (k == 2) {
      // the third one comes in under the arm with a roundhouse
      float rk = kf(0.6, 0.68);
      if (rk > 0.001 && rk < 0.999 && gFin < 0.5) { fr = F_KICK + floor(rk * 7.99); face = sign(gXd + gSide * 0.1 - x + 1e-3); }
      if (gTc > 0.4 && gTc < 0.48) fr = F_PUNCH + floor(kf(0.4, 0.48) * 7.99);
    }
    vec4 hs = vec4(x, hop, face, fr);
    if (k == 0) gS0 = hs; else if (k == 1) gS1 = hs; else gS2 = hs;
  }

  // the street: night, dusk, storm, two rounds each
  gMood = mod(floor(n / 2.0), 3.0);
  gStorm = step(1.5, gMood);
  vec3 wall = gMood < 0.5 ? vec3(0.075, 0.065, 0.16) : gMood < 1.5 ? vec3(0.24, 0.11, 0.17) : vec3(0.05, 0.075, 0.105);
  vec3 lit = gMood < 0.5 ? vec3(0.13, 0.125, 0.27) : gMood < 1.5 ? vec3(0.52, 0.27, 0.23) : vec3(0.1, 0.145, 0.19);
  gAmbRim = gMood < 0.5 ? vec3(0.55, 0.66, 1.0) : gMood < 1.5 ? vec3(1.0, 0.72, 0.42) : vec3(0.72, 0.9, 1.0);
  vec3 tint = mix(vec3(1.0), min(uColor3 / max(dot(uColor3, vec3(0.333)), 0.05), 1.6), 0.16);
  gWall = wall * tint;
  gWallLit = lit * tint;
  gGround = mix(gWall, gWallLit, 0.62);
  gBolt_ = gStorm * gKick * gKick * step(0.5, h11(floor(uBeatClock) * 3.7));

  // camera: a jolt on every hit, a punch-in on the slam
  float hit = exp(-max(gImpAge, 0.0) * 7.0) * step(0.0, gImpAge) + 0.5 * exp(-max(gBurstAge, 0.0) * 8.0) * step(0.0, gBurstAge)
            + 0.3 * exp(-max(gShutAge, 0.0) * 9.0) * step(0.0, gShutAge) + 0.15 * gRum + 0.12 * gKick;
  gShake = hit * 0.02 * vec2(sin(uTime * 61.0), cos(uTime * 47.0));
  gImpact = step(0.0, gImpAge) * step(gImpAge, 0.085) * step(0.01, pyro);
  gPunch = 0.07 * exp(-max(gImpAge, 0.0) * 5.0) * step(0.0, gImpAge);
  float flash = (exp(-max(gPoseAge, 0.0) * 5.0) * step(0.0, gPoseAge) + exp(-max(gImpAge, 0.0) * 9.0) * step(0.0, gImpAge)) * clamp(pyro, 0.0, 2.0);
  gGlow = mix(uColor1, vec3(1.0, 0.62, 0.3), 0.3) * (0.85 + 0.35 * gKick + 0.2 * uBass);
  gKeyCol = vec3(1.0, 0.98, 0.94) * (1.0 + 0.25 * flash + 0.5 * gBolt_);
  gShadeCol = mix(vec3(0.3, 0.26, 0.5), gWallLit * 1.6, 0.25);
  gRimCol = mix(gAmbRim, gGlow * 1.35, gOpen) + vec3(1.0, 0.85, 0.6) * 0.5 * flash;

  vec3 col = render(gl_FragCoord.xy);
  col = printLook(col, gl_FragCoord.xy, tp);
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.22 - dot(vp, vp) * 0.75, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

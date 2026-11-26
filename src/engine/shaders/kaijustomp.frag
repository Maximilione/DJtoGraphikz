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

// Kaiju Stomp: the running shot from a giant-monster cartoon. The camera tracks
// left to right along a street: a disc of sun or moon, two skylines sunk in the
// air, the blocks of the street with their shops and signs, a pavement of lamp
// posts and parked cars, the road. Three suited heroes sprint on the spot in
// front of it. Behind them walks something whose foot is the size of a building,
// a dark mass with the light of the sky down one edge. Every 4 beats its shadow
// spreads on the road and the foot comes down on the beat: an impact frame, the
// camera jolts and punches in, the road cracks and throws up slabs and dust, the
// cars jump. It stays planted, slides away with the road, lifts.
// No two stomps in a row are the same. In turn: the charges buried along the
// street go off behind the team; the second hero turns and puts a bolt into the
// toes; the shock throws the last in line off his feet and he has to sprint back;
// the last in line lands a flying kick on the claws while the leader skids to a
// halt and strikes the roll-call pose. The foot feels all of it: its toes come
// up off the road and slap down again.
// The mood of the street (dusk, night, storm) changes every four stomps.
// Everything is flat paint: two tones and a pen line per surface. The scroll is
// locked to the beat clock, so a planted foot stays where the road takes it.

const float SY = -0.2;                   // far kerb
const float GY = -0.3;                   // the line on the road the foot comes down on

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
uniform sampler2D uAtlasFoot;

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

float gKick, gSc, gM, gT, gKind, gMood, gStorm, gNight, gImpAge, gTapAge, gPoseAge, gBoomAge, gHitAge, gHaze, gPy, gPc, gImpact, gPunch, gFlashL,
      gFx, gNxt, gUp, gDwn, gFootF, gSheen, gDiscR, gLamp, gWinTh, gShLen;
vec2 gShake, gSun;
vec3 gDisc, gSkyTop, gSkyMid, gSkyLow, gWall, gWallLit, gRoad, gAmbRim, gHide, gBlk, cA, cB, cC;
vec4 gS0, gS1, gS2;                      // per hero: x, y, lane, frame on the sheet
vec3 gFace;                              // which way each of them faces
vec4 gBolt;                              // the energy bolt: x, y, on

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float kf(float a, float b) { return clamp((gT - a) / (b - a), 0.0, 1.0); }
float secs(float t0) { return (gT - t0) * 4.0 * 0.47; }
float land(float m) { return -0.92 + 0.08 * h11(m * 3.3 + 0.7); }  // heel of stomp m, on screen at impact: the claws end just short of the team

// the foot: one frame of the 4 x 2 sheet (cells of 384 x 352 units), heel end of the
// sole at o. Above the top of the cell the leg just goes on
void footSprite(vec2 p, vec2 o, float f) {
  vec2 c = (p - o) / gU + vec2(128.0, 8.0);
  if (c.x < 0.5 || c.x > 383.5 || c.y < 0.5) return;
  c.y = min(c.y, 351.0);
  vec4 t = texture2D(uAtlasFoot, vec2((mod(f, 4.0) * 384.0 + c.x) / 1536.0, 1.0 - (floor(f / 4.0) * 352.0 + 352.0 - c.y) / 704.0));
  celPaint(t, 1.0, gHide, gHide * 0.6, vec3(0.96, 0.92, 0.78), vec3(0.7, 0.66, 0.56), 2.0 * gPx / gU);
}

// the roofline of a row of blocks, above the kerb
float blocksTop(float X, float wd, float hmin, float hvar, float seed) {
  float id = floor(X / wd), lx = fract(X / wd);
  float hh = hmin + hvar * h11(id * 1.7 + seed);
  hh += 0.028 * step(0.55, h11(id * 3.3 + seed)) * step(abs(lx - 0.45), 0.24);      // a plant room on the roof
  hh += 0.07 * step(0.8, h11(id * 5.9 + seed)) * step(abs(lx - 0.45), 0.02);        // a mast
  return hh;
}

// the sky, the disc in it, two skylines and the tail: all that no block of the street covers
void backdrop(vec2 p) {
  // three flat bands, parted by banks of cloud
  float bank = 0.05 * sin(p.x * 2.6 + gSc * 0.03) + 0.08 * (fbm(vec2(p.x * 2.0 + gSc * 0.03, 1.5)) - 0.5);
  gCol = gSkyTop;
  fill(p.y - 0.31 - bank, gSkyMid);
  fill(p.y - 0.1 - 0.03 * sin(p.x * 4.1 - gSc * 0.05 + 2.0) + 0.6 * bank, gSkyLow);
  vec2 dq = p - gSun;
  float dl = length(dq);
  if (gStorm < 0.5) {
    // the disc: two rings of its light that swell with the bass, then the disc
    gCol = mix(gCol, gDisc, 0.13 * cut(dl - gDiscR * (1.8 + 0.35 * uBass)));
    gCol = mix(gCol, gDisc, 0.2 * cut(dl - gDiscR * (1.34 + 0.2 * uBass + 0.1 * gKick)));
    fill(dl - gDiscR, gDisc);
    if (gNight > 0.5) {
      float mare = min(length(dq - gDiscR * vec2(-0.32, 0.28)) - gDiscR * 0.3, min(length(dq - gDiscR * vec2(0.3, -0.12)) - gDiscR * 0.22, length(dq - gDiscR * vec2(-0.1, -0.5)) - gDiscR * 0.16));
      fill(max(mare, dl - gDiscR), gDisc * vec3(0.78, 0.82, 0.9));
      // stars, a few of them stirred by the highs
      vec2 sg = p * 34.0, si = floor(sg);
      float sh = h21(si);
      float tw = step(0.5, h21(si + 5.0)) * uHigh;
      gCol = mix(gCol, vec3(0.9, 0.95, 1.0), step(0.9, sh) * step(dl, 9.0) * step(gDiscR * 1.2, dl) * cut((length(fract(sg) - 0.5 - 0.3 * (vec2(h21(si + 1.0), h21(si + 2.0)) - 0.5)) - 0.05 - 0.07 * tw) / 34.0));
    } else {
      fill(max(dl - gDiscR, dq.y + gDiscR * 0.3 + 0.012 * sin(p.x * 23.0 + 1.0)), mix(gDisc, mix(vec3(1.0, 0.5, 0.28), uColor1, 0.15), 0.55));     // the foot of the sun is redder
    }
    // strips of cloud across it
    float c1 = abs(dq.y + 0.035) - 0.013 * (1.0 - pow((dq.x - 0.12 * sin(gSc * 0.02 + 1.0)) / 0.36, 2.0));
    float c2 = abs(dq.y - 0.09) - 0.008 * (1.0 - pow((dq.x + 0.15) / 0.22, 2.0));
    fill(min(c1, c2), gSkyMid);
  } else if (gFlashL > 0.25 && p.y > -0.05) {
    // the bolt itself
    float sd = floor(uBeatClock) * 1.3;
    float sg = p.y * 13.0;
    float zx = -0.55 + 1.3 * h11(sd) + 0.16 * (mix(h11(floor(sg) + sd), h11(floor(sg) + 1.0 + sd), fract(sg)) - 0.5) + (0.5 - p.y) * 0.12;
    fill(abs(p.x - zx) - 0.012, mix(gSkyLow, vec3(0.8, 0.9, 1.0), 0.6));
    fill(abs(p.x - zx) - 0.004, vec3(1.0));
  }
  // the furthest skyline is almost the colour of the air
  fill(p.y - SY - blocksTop(p.x + gSc * 0.07 + 3.0, 0.11, 0.2, 0.3, 3.0), mix(gSkyLow, gWall, 0.3));
  float XB = p.x + gSc * 0.2 + 7.0;
  float dB = p.y - SY - blocksTop(XB, 0.17, 0.12, 0.24, 5.0);
  vec3 cb = mix(gSkyLow, gWall, 0.62);
  fill(dB, cb);
  if (dB < -0.012) {
    vec2 wc = vec2(XB / 0.0121, (p.y - SY) / 0.02);
    vec2 wi = floor(wc), wf = fract(wc) - 0.5;
    float on = step(gWinTh + 0.06 - 0.3 * uHigh * step(0.5, h21(wi + 3.0)), h21(wi + floor(uBeatClock * 0.25) * 0.37));
    gCol = mix(gCol, mix(cb, mix(uColor2, vec3(1.0, 0.86, 0.55), 0.7), 0.75), on * cut(max(abs(wf.x) - 0.22, abs(wf.y) - 0.28) * 0.0121));
  }
  // the tail, over the rooftops: a shape against the sky with light down its back
  if (p.x < 0.45 && p.y > -0.02) {
    float sway = sin(uBeatClock * TAU / 8.0);
    vec2 t0 = vec2(-1.15, 0.44), t1 = vec2(-0.5 + 0.1 * sway, 0.52 + 0.06 * sway), t2 = vec2(-0.1 + 0.22 * sway, 0.2 - 0.05 * sway);
    vec3 tg = vec3(1e3, 0.0, 0.0);
    float fin = 1e3;
    vec2 pa = t0;
    for (int i = 1; i <= 5; i++) {
      float t = float(i) / 5.0;
      vec2 pb = mix(mix(t0, t1, t), mix(t1, t2, t), t);
      float r = 0.1 - 0.082 * t;
      vec2 tn = normalize(pb - pa);
      vec2 nr = vec2(-tn.y, tn.x);
      fin = min(fin, gSeg(p, pb + nr * r * 0.7 - tn * r * 0.3, pb + nr * r * 1.9 + tn * r * 0.5, r * 0.42, 0.0).x);     // a plate on its back at every joint
      tg = smin3(tg, gSeg(p, pa, pb, r + 0.0164, r), 0.02);
      pa = pb;
    }
    vec3 tc = mix(gWall * 0.45, gSkyLow, 0.1);
    fill(min(tg.x, fin) - 0.004, mix(tc, gAmbRim, 0.6));
    fill(min(tg.x + 0.006 * smoothstep(0.0, 0.5, dot(tg.yz, vec2(0.5, 0.86))), fin), tc);
  }
}

// the blocks of the street: the distance to them, and their paint in gBlk
float street(vec2 p) {
  float y = p.y - SY - 0.03;
  if (y > 0.5) return 1.0;
  float X = p.x + gSc * 0.55;
  const float wd = 0.36, wB = 0.325;
  float id = floor(X / wd), lx = fract(X / wd) * wd;
  float kind = h11(id * 2.3 + 1.0);
  float hh = kind < 0.25 ? 0.078 : 0.15 + 0.19 * h11(id * 1.7 + 1.0);     // some lots hold only a shop: the sky shows over it
  vec3 neon = h11(id * 4.1) > 0.5 ? uColor1 : uColor2;
  float d = max(max(y - hh, -y), max(lx - wB, -lx));
  vec3 c = mix(gWall, gWallLit, step(wB - 0.05, lx));                       // the end wall faces the light
  float cx = lx - 0.016;
  if (cx > 0.0 && cx < 0.246 && y > 0.085 && y < hh - 0.02) {
    // windows: the highs switch more of them on
    vec2 wc = vec2(cx / 0.041, (y - 0.085) / 0.05);
    vec2 wi = floor(wc), wf = fract(wc) - 0.5;
    float on = step(gWinTh - 0.35 * uHigh * step(0.5, h21(wi + 3.0)), h21(wi + id * 7.0 + floor(uBeatClock * 0.125) * 0.37));
    c = mix(c, mix(gWall * 1.5 + gSkyLow * 0.05, mix(uColor2, vec3(1.0, 0.86, 0.55), 0.7), on), cut(max(abs(wf.x) - 0.29, abs(wf.y) - 0.3) * 0.041));
  }
  if (y < 0.07 && lx < wB - 0.05) {
    // the shop: a striped awning over a lit window, or a shutter
    if (y > 0.047) c = mix(mix(neon, gWall, 0.35), mix(vec3(0.9, 0.86, 0.76), gWall, 0.35), step(0.5, fract(lx / 0.026))) * (y > 0.064 ? 1.25 : 1.0);
    else if (h11(id * 6.3) > 0.4) c = mix(mix(uColor2, vec3(1.0, 0.84, 0.5), 0.72) * (0.75 + 0.25 * step(0.02, y)), INK, step(abs(fract(lx / 0.068 + 0.5) - 0.5), 0.045));
    else c = gWall * (1.25 - 0.3 * step(0.5, fract(y / 0.009)));
  }
  c = mix(c, mix(gWallLit * 1.5, gAmbRim, 0.4), step(hh - 0.006, y));        // the parapet catches the sky
  if (kind > 0.8) {
    // a hoarding on the roof that runs an equaliser off the music
    vec2 b = vec2(lx - 0.135, y - hh - 0.066);
    float dP = sdBox(b, vec2(0.105, 0.042));
    float legs = max(abs(abs(b.x) - 0.07) - 0.004, abs(y - hh - 0.012) - 0.014);
    if (min(dP, legs) < d) {
      d = min(dP, legs);
      float bi = floor((b.x + 0.096) / 0.024);
      float lvl = bi < 2.5 ? uBass : bi < 5.5 ? uMid : uHigh;
      lvl = clamp(lvl * (0.75 + 0.5 * h11(bi + floor(uBeatClock * 4.0) * 1.3)) + 0.25 * gKick, 0.1, 1.0);
      float bar = step(abs(fract((b.x + 0.096) / 0.024) - 0.5), 0.34) * step(b.y + 0.033, lvl * 0.066) * step(abs(b.x), 0.096) * step(abs(b.y), 0.034);
      c = dP < legs ? mix(mix(INK, gWall, 0.3), neon * 1.15, bar) : gWall * 0.7;
      c = mix(c, gWallLit * 1.4, step(-0.005, dP) * step(dP, legs));
    }
  } else if (kind > 0.25 && kind < 0.45) {
    // a water tank
    vec2 b = vec2(lx - 0.21, y - hh);
    float dT = min(sdBox(b - vec2(0.0, 0.04), vec2(0.032, 0.022)), max(abs(abs(b.x) - 0.022) - 0.003, abs(b.y - 0.01) - 0.012));
    if (dT < d) { d = dT; c = mix(gWall * 0.75, mix(gWallLit * 1.5, gAmbRim, 0.4), step(0.058, b.y)); }
  }
  if (kind > 0.45) {
    // a sign of neon tiles hung in the alley: the highs light them
    float s0 = 0.085, s1 = hh - 0.02;
    float dS = max(abs(lx - wB - 0.0175) - 0.012, max(s0 - y, y - s1));
    if (dS < d) {
      d = dS;
      float cell = floor((y - s0) / 0.027);
      float on = step(0.6 - 0.6 * uHigh - 0.2 * gKick, h11(cell * 3.1 + id + floor(uBeatClock * 2.0) * 1.7));
      float tile = step(max(abs(lx - wB - 0.0175) - 0.0075, abs(fract((y - s0) / 0.027) - 0.5) * 0.027 - 0.009), 0.0);
      c = mix(INK, neon * (0.28 + 1.0 * on), tile);
    }
  }
  gBlk = c + gFlashL * vec3(0.3, 0.38, 0.5);
  return d;
}

void road(vec2 p) {
  float f = SY - p.y;
  float pers = 1.0 + f * 1.4;
  float X = p.x / pers + gSc;
  gCol = gRoad;
  gCol *= 1.0 - 0.14 * cut(abs(fract(X / 0.6) - 0.5) * 0.6 * pers - 0.0015 * (1.0 + f * 4.0));        // joints in the slab
  // the disc on the asphalt: two hard wedges of its light, broken into bars the way water breaks it
  float ax = abs(p.x - gSun.x);
  float rw = pow(f / 0.3, 0.7) * 9.0;
  gCol = mix(gCol, gCol * 0.72 + gDisc * 0.2, gSheen * cut(ax - 0.11 - f * 1.5));
  float rh = h11(floor(rw) + 2.0);
  gCol = mix(gCol, gCol * 0.5 + gDisc * 0.38, gSheen * step(0.3 + 0.4 * rh, fract(rw)) * cut(abs(p.x - gSun.x - (rh - 0.5) * (0.05 + f * 0.5)) - (0.02 + f * 0.5) * (0.35 + rh)));
  // the lamp posts throw theirs right across it
  float sl = f * 1.2;
  float l0 = (floor((p.x - ((p.x - gSun.x) * 1.1 - 0.25) * sl + gSc + 0.2) / 0.8) + 0.5) * 0.8 - 0.2 - gSc;
  gCol = mix(gCol, gCol * 0.55, step(0.5, gSheen) * cut(max(abs(p.x - l0 - ((l0 - gSun.x) * 1.1 - 0.25) * sl) - 0.004 - 0.014 * f, f - 0.075 * gShLen)));
  // paint
  vec3 paint = vec3(0.92, 0.88, 0.76) * (0.3 + 0.75 * dot(gRoad, vec3(1.0)));
  fill(max(abs(f - 0.085) - 0.004 - 0.012 * f, (0.45 - fract(X / 0.22)) * 0.22 * pers), paint);
  fill(abs(f - 0.272) - 0.008, paint);
  // what the stomp left: a dent, cracks run out of it as it lands and the road carries them off
  vec2 cq = vec2(p.x - gFx - 0.6, (f - 0.1) * 3.0);
  float cr = length(cq);
  if (cr < 0.62) {
    float a = atan(cq.y, cq.x) / TAU * 7.0 + 0.35 * abs(fract(cr * 7.0 + 0.3) - 0.5) + 0.2 * h11(floor(cr * 7.0 + 0.3) + gM);     // they run in straight bits, like breaks in a slab
    float reach = min(0.25 + 0.34 * h11(floor(a) + gM), gImpAge * 5.0);
    fill(cr - min(0.27, gImpAge * 6.0) + 0.02 * sin(a * 4.0), gCol * 0.72);
    float ln = abs(fract(a) - 0.5) * cr * 0.7 - 0.0045 * (1.0 - cr / 0.6);
    fill(max(ln, cr - reach), INK);
    fill(max(abs(cr - 0.27 - 0.02 * sin(a * 4.0)) - 0.003, 0.5 - h11(floor(a * 2.0) + gM)) + step(gImpAge, 0.04), INK);
  }
  // scratches of light on the asphalt that the pace of the music draws out
  float sr = floor(f * 70.0);
  gCol = mix(gCol, gAmbRim, 0.22 * step(0.82, h11(sr)) * step(fract(X * 0.9 + h11(sr + 1.0) * 5.0), 0.3 * uEnergy * uEnergy));
  // the kerb
  fill(f - 0.016, gWall * 0.6);
  fill(f - 0.004, gWallLit * 1.5);
  // in the rain the road keeps a piece of the sky
  if (gStorm > 0.5) gCol = mix(gCol, gSkyLow * 1.2, 0.4 * step(0.62, fbm(vec2(X * 6.0, f * 24.0) + 3.0)) * step(0.03, f));
  gCol += gFlashL * vec3(0.22, 0.28, 0.38);
}

// a parked car, c in car units (two long, one high), k = one scene unit in car units
void car(vec2 c, float k, vec3 paint) {
  float body = min(sdBox(c - vec2(0.0, 0.3), vec2(0.93, 0.12)) - 0.07, max(abs(c.y - 0.6) - 0.2, abs(c.x + 0.1) - 0.62 + (c.y - 0.4) * 0.55) - 0.04);
  fill((body - 0.035) / k, INK);
  fill(body / k, mix(paint * gShadeCol * 1.3, paint, cut((0.36 - c.y) / k)));
  fill(max(body + 0.05, 0.75 - c.y) / k, mix(paint, gAmbRim, 0.6));          // the roof catches the sky
  fill(max(max(abs(c.y - 0.61) - 0.11, abs(c.x + 0.1) - 0.56 + (c.y - 0.4) * 0.55), 0.035 - abs(c.x + 0.08)) / k, mix(vec3(0.05, 0.07, 0.2), gSkyLow, 0.3));
  float wh = length(vec2(abs(c.x) - 0.58, c.y - 0.14)) - 0.17;
  fill(wh / k, INK);
  fill((wh + 0.1) / k, gWallLit * 2.0);
}

// lamp posts and parked cars along the far pavement
void pavement(vec2 p) {
  float X = p.x + gSc;
  fill(max(p.y - SY - 0.03, SY - p.y), mix(gRoad, gWallLit, 0.75) * (1.0 - 0.18 * step(fract(X / 0.09), 0.07)));
  vec2 lq = vec2(mod(X + 0.2, 0.8) - 0.4, p.y - SY - 0.012);
  if (abs(lq.x) < 0.14 && lq.y < 0.42) {
    float post = min(sdBox(lq - vec2(0.0, 0.17), vec2(0.0045, 0.17)), min(sdBox(lq - vec2(0.03, 0.337), vec2(0.03, 0.004)), sdBox(lq - vec2(0.056, 0.328), vec2(0.017, 0.007))));
    vec2 lh = lq - vec2(0.056, 0.314);
    gCol = mix(gCol, vec3(1.0, 0.88, 0.6), gLamp * 0.22 * cut(length(lh) - 0.035 - 0.035 * gKick));
    fill(post - 0.003, mix(INK, gAmbRim, 0.4));
    fill(post, INK);
    fill(length(lh * vec2(1.0, 1.7)) - 0.012, mix(gWallLit * 1.6, vec3(1.0, 0.92, 0.7), gLamp));
  }
  float ci = floor(X / 1.3);
  if (h11(ci * 5.1) > 0.3) {
    // the nearer the toes, the further the car is thrown, and it turns over in the air
    float carx = (ci + 0.5) * 1.3 - gSc;
    float near = exp(-pow((carx - gFx - 1.0) / 0.5, 2.0));
    float jp = clamp(gImpAge * 2.2 - 0.2 * h11(ci), 0.0, 1.0);
    float jump = sin(jp * 3.14159) * (0.03 + 0.2 * near);
    vec2 c = vec2(mod(X, 1.3) - 0.65, p.y - SY - 0.006 - jump) / 0.15 - vec2(0.0, 0.35);
    float spin = jp * (1.0 - jp) * 4.0 * near * 1.4 * (h11(ci + 3.0) > 0.5 ? 1.0 : -1.0);
    c = vec2(c.x * cos(spin) - c.y * sin(spin), c.x * sin(spin) + c.y * cos(spin)) + vec2(0.0, 0.35);
    if (abs(c.x) < 1.3 && c.y > -0.3 && c.y < 1.2) {
      float hc = h11(ci * 3.7);
      vec2 sq = vec2(c.x, (c.y + jump / 0.15) * 5.0 + 0.3);
      gCol = mix(gCol, gCol * 0.45, cut((length(sq) - 1.05) * 0.03));
      car(c, 1.0 / 0.15, hc < 0.3 ? cA : hc < 0.55 ? cB : hc < 0.8 ? vec3(0.8, 0.78, 0.74) : cC);
    }
  }
}

// a shadow on the road, long and hard, thrown towards the lens and away from the disc
void shadowAt(vec2 p, float x, float y, float w) {
  vec2 q = (p - vec2(x, y)) * vec2(1.0, 3.2);
  vec2 e = vec2((x - gSun.x) * 1.1 - 0.25, -1.0) * w * gShLen;
  float d = min(gSeg(q, vec2(0.0, 0.03), e, w * 0.5, w * 0.1).x, (length((q - vec2(0.0, 0.03)) / vec2(w * 0.75, w * 0.5)) - 1.0) * w * 0.5);
  gCol = mix(gCol, gCol * 0.4, cut(d * 0.4));
}

// slabs of road thrown up by the toes
void rubble(vec2 q, float age, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > 0.5) return;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float an = mix(0.5, 2.5, h11(fi * 1.9 + seed));
    vec2 v = vec2(cos(an), sin(an)) * (0.5 + 0.6 * h11(fi * 2.7 + seed + 3.0));
    vec2 e = q - v * age - vec2(0.0, -1.0 * age * age);
    float ra = age * (4.0 + 8.0 * h11(fi + seed)) * (h11(fi * 5.3 + seed) > 0.5 ? 1.0 : -1.0);
    e = vec2(e.x * cos(ra) - e.y * sin(ra), e.x * sin(ra) + e.y * cos(ra));
    float sz = (0.016 + 0.028 * h11(fi * 4.1 + seed)) * (1.0 - smoothstep(0.8, 1.0, age));
    float d = max(sdBox(e, vec2(sz, sz * 0.6)), abs(e.x + e.y * 0.7) - sz * 0.85);
    fill(d - 0.004, INK);
    fill(d, mix(gRoad * 0.6, mix(gRoad * 1.9, gAmbRim, 0.25), cut(sz * 0.12 - e.y)));
  }
}

vec3 render(vec2 fc) {
  vec2 p = (fc - 0.5 * uResolution) / uResolution.y * gFit;
  vec2 pc = vec2(0.12, -0.3);
  p = pc + (p - pc) * (1.0 - gPunch) + gShake;
  vec2 toes = vec2(gFx + 1.04, GY);                         // where the claws are
  float flash = max(exp(-max(gBoomAge - 0.05, 0.0) * 4.0) * step(0.05, gBoomAge), exp(-max(gPoseAge, 0.0) * 4.0) * step(0.0, gPoseAge));
  float sil = max(gImpact, clamp(0.1 + flash * 1.3 * min(gPy, 1.0), 0.0, 1.0));

  if (gImpact > 0.5) gCol = impactFrame(p - vec2(gFx + 0.8, GY), mix(uColor1, vec3(1.0, 0.75, 0.3), 0.45), floor(uBeatClock));
  else if (p.y > SY) {
    float d = street(p);
    if (d > -gPx) backdrop(p);
    fill(d, gBlk);
  } else road(p);

  if (gImpact < 0.5) {
    if (p.y > SY - 0.01 && p.y < SY + 0.45) pavement(p);
    // rain, in the storm
    vec2 rq = vec2(p.x + p.y * 0.25, p.y) * vec2(60.0, 5.0) + vec2(0.0, uTime * 9.0);
    gCol = mix(gCol, gAmbRim, 0.3 * gStorm * step(0.93, h21(floor(rq))) * step(abs(fract(rq.x) - 0.5), 0.09));
    // mist in flat layers: one hanging in the street, one along the kerb, one that the stomp sends over the road
    vec3 mist = mix(gSkyLow, vec3(1.0), 0.12);
    float m0 = SY + 0.13 + 0.03 * sin(p.x * 3.1 + gSc * 0.6 + uTime * 0.1) + 0.015 * sin(p.x * 8.3 + gSc * 1.1);
    gCol = mix(gCol, mist, 0.16 * gHaze * cut(max(p.y - m0, SY - p.y)));
    float m1 = SY + 0.045 + 0.022 * sin(p.x * 5.0 + gSc * 2.0 + uTime * 0.3) + 0.012 * sin(p.x * 13.0 + gSc * 3.0 - uTime * 0.5);
    gCol = mix(gCol, mist, 0.26 * gHaze * cut(max(p.y - m1, SY - 0.03 - p.y)));
    float swell = exp(-gImpAge * 1.6);
    float m2 = GY - 0.02 + 0.07 * swell + 0.02 * sin(p.x * 6.0 + gSc * 3.0) * (0.5 + swell);
    gCol = mix(gCol, mist, 0.2 * gHaze * swell * cut(max(p.y - m2, GY - 0.09 - p.y)));

    // the shadow of the foot that is on its way: it spreads and hardens
    float sh = smoothstep(0.4, 1.0, gT);
    vec2 sq = (p - vec2(gNxt + 0.5, GY - 0.02)) / vec2(0.25 + 0.4 * sh, 0.025 + 0.06 * sh);
    gCol = mix(gCol, gCol * 0.55, step(0.01, sh) * cut((length(sq) - 1.0) * 0.04));
    gCol = mix(gCol, gCol * 0.6, step(0.5, sh) * cut((length(sq) - 0.3 - 0.5 * (sh - 0.5)) * 0.04));
    // and of the one that is planted
    vec2 s1 = (p - vec2(gFx + 0.5 - 0.5 * gUp, GY - 0.03)) / vec2(0.66 * (1.0 - 0.6 * gUp), 0.055);
    vec2 s2 = (p - vec2(gFx + 0.3, GY - 0.075)) / vec2(0.6, 0.05);
    gCol = mix(gCol, gCol * 0.42, (1.0 - gUp) * cut((min(length(s1), length(s2) + 0.3 + 0.3 * gStorm) - 1.0) * 0.04));

    // the charges along the street, behind the team, in their colours
    if (gPy > 0.0 && gBoomAge > 0.0) {
      float bx = gBoomAge * 0.2 * gPc * 2.13;
      celBoom(p - vec2(0.2 - bx, -0.18), (gBoomAge - 0.05) * 1.5, 0.16 * gPy, cA * 1.2, gM + 1.0);
      celBoom(p - vec2(0.47 - bx, -0.15), (gBoomAge - 0.22) * 1.5, 0.18 * gPy, cB * 1.2, gM + 2.0);
      celBoom(p - vec2(0.76 - bx, -0.18), (gBoomAge - 0.4) * 1.5, 0.16 * gPy, cC * 1.2, gM + 3.0);
    }
    // the one behind the leader's pose
    if (gPy > 0.0 && gPoseAge > 0.0) celBoom(p - vec2(gS2.x - 0.03, -0.17), gPoseAge * 1.4, 0.27 * gPy, cC * 1.2, gM + 5.0);
    // dust the foot throws up behind itself
    float dR = (0.1 + 0.12 * smoothstep(0.0, 0.5, gImpAge)) * (0.5 + 0.5 * gHaze);
    vec3 dust = mix(gRoad * 5.0, gAmbRim * 1.6, 0.45);     // over-bright: the kit paints smoke at half its hue
    celBoom(p - vec2(gFx + 0.5, GY + 0.04), gImpAge * 1.25 + 0.6, dR * 1.5, dust, 11.0);
    celBoom(p - vec2(gFx + 0.95, GY + 0.06), gImpAge * 1.25 + 0.62, dR * 1.1, dust, 12.0);
  }

  // the feet: shapes against the sky, the light of it down one edge
  gKeyDir = normalize(vec3(-0.45, 0.6, 0.66));
  gRimDir = normalize(vec2(0.8, 0.6));
  gSil = max(gImpact, 0.74);
  footSprite(p, vec2(gFx + 0.5 * gUp * gUp, GY + 1.3 * gUp * gUp - (gFootF > 5.5 ? 60.0 * gU : 0.0)), gFootF);     // the lifted drawing is already off the ground
  if (gT > 0.78) footSprite(p, vec2(gNxt, GY + 0.95 * (1.0 - gDwn * gDwn)), gDwn > 0.5 ? 1.0 : 0.0);

  // the team: the two in the far lane, then the one nearest the lens
  gRimDir = normalize(vec2(0.55, 0.83));
  gSil = sil;
  for (int k = 0; k < 3; k++) {
    vec4 hs = k == 0 ? gS2 : k == 1 ? gS0 : gS1;
    float v = k == 0 ? 2.0 : k == 1 ? 0.0 : 1.0;
    if (gImpact < 0.5) shadowAt(p, hs.x, hs.z, 0.06);
    heroSprite(p, hs.xy, k == 0 ? gFace.z : k == 1 ? gFace.x : gFace.y, hs.w, k == 0 ? cC : k == 1 ? cA : cB, v);
  }
  if (gBolt.z > 0.5) heroSprite(p, gBolt.xy - vec2(0.0, 60.0 * gU), -1.0, F_BOLT + mod(floor(uTime * 12.0), 4.0), cB, 1.0);

  // sparks: the claws on the road, whatever the team lands on them, the toes slapping down
  vec3 sp = sparks(p - toes - vec2(0.1, -0.02), gImpAge * 1.2, 0.2 * (0.3 + 0.7 * gPy), gM);
  sp += sparks(p - toes - vec2(0.0, 0.07), gHitAge * 2.0, 0.14 * (0.4 + 0.6 * gPy), gM + 9.0);
  sp += sparks(p - toes - vec2(0.05, -0.02), gTapAge * 2.2, 0.09, gM + 4.0);
  gCol = mix(gCol, vec3(1.0, 0.9, 0.6), min(sp.r, 1.0));
  rubble(p - toes - vec2(0.02, 0.0), gImpAge * 1.05, gM);
  if (gImpact < 0.5) {
    // dust in front of it, and a puff when the toes slap down
    float dR = (0.07 + 0.07 * smoothstep(0.0, 0.5, gImpAge)) * (0.5 + 0.5 * gHaze);
    vec3 dust = mix(gRoad * 5.0, gAmbRim * 1.6, 0.45);     // over-bright: the kit paints smoke at half its hue
    celBoom(p - vec2(gFx + 0.3, GY - 0.07), gImpAge * 1.35 + 0.64, dR, dust, 13.0);
    celBoom(p - toes - vec2(0.1, -0.05), gImpAge * 1.35 + 0.62, dR * 0.9, dust, 14.0);
    celBoom(p - toes - vec2(0.02, -0.01), gTapAge * 2.5 + 0.62, 0.07 * (0.5 + 0.5 * gHaze), dust, 15.0);
    // the ground gives: a ring out from under the foot
    vec2 cq = (p - vec2(gFx + 0.6, GY - 0.03)) / vec2(1.0, 0.3);
    float ring = abs(length(cq) - 0.85 * (1.0 - exp(-gImpAge * 6.0))) - 0.014 * exp(-gImpAge * 3.0);
    gCol = mix(gCol, vec3(1.0), cut(ring) * step(p.y, SY) * step(gImpAge, 0.5));

    // what passes an inch from the lens: posts, some with a sign, black with the sky on their edges
    float nx = (mod(p.x / 2.4 + gSc, 2.6) - 0.5) * 2.4;
    float sgn = step(0.5, h11(floor((p.x / 2.4 + gSc) / 2.6) * 3.3));
    float fg = min(abs(nx) - 0.016, mix(1.0, sdBox(vec2(nx - 0.07, p.y - 0.33), vec2(0.11, 0.07)), sgn));
    fill(fg - 0.005, mix(INK, gAmbRim, 0.5));
    fill(fg, INK);
  }
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  gU = gFit / 216.0;                       // a sheet unit: a hero is 95 of them tall
  gPx = gFit / uResolution.y;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  gPc = clamp(pace, 0.3, 3.0);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);

  // ---- the 4-beat stomp ----
  gSc = uBeatClock * 0.2 * gPc;
  float sb = uBeatClock / 4.0;
  gM = floor(sb);
  gT = fract(sb);
  gKind = mod(gM, 4.0);                    // 0 charges, 1 bolt, 2 shock wave, 3 counter-attack
  float kindN = gT > 0.5 ? mod(gM + 1.0, 4.0) : gKind;      // of the impact nearest in time
  gImpAge = secs(0.0);
  float trav = 0.8 * gPc;                  // what the road covers in one stomp
  gFx = land(gM) - gT * trav;
  gNxt = land(gM + 1.0) + (1.0 - gT) * trav;
  gUp = ease((gT - 0.5) / 0.22);
  gDwn = clamp((gT - 0.8) / 0.2, 0.0, 1.0);
  gBoomAge = gKind < 0.5 ? gImpAge : -1.0;
  gPoseAge = gKind > 2.5 ? secs(0.5) : -1.0;
  // what the team lands on the claws, and when: the bolt, the kick
  float hitT = gKind < 0.5 ? 0.18 : gKind < 1.5 ? 0.32 : gKind < 2.5 ? 9.0 : 0.185;
  gHitAge = gKind < 0.5 ? -1.0 : secs(hitT);
  // the foot: down, squashed, settled, planted; heel up, off. In between the toes come up
  // off the road, stung or just restless, and slap down again
  gFootF = gUp > 0.35 ? 6.0 : gUp > 0.02 ? 5.0 : gImpAge < 0.07 ? 2.0 : gImpAge < 0.2 ? 3.0 : 4.0;
  float fl = (gT - hitT) / 0.07;
  if (fl > 0.0 && fl < 1.0) gFootF = fl < 0.2 || fl > 0.85 ? 0.0 : 7.0;
  gTapAge = secs(hitT + 0.07);
  if (gTapAge > 0.0 && gTapAge < 0.09) gFootF = 3.0;

  // the team: three strides out of step, a look back as the shadow comes over
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = 0.3 + 0.2 * fk + 0.02 * sin(uBeatClock * (0.7 + 0.23 * fk) + fk * 2.0);
    float ly = k == 1 ? -0.4 : -0.37;
    float hop = 0.045 * sin(clamp(gImpAge * 2.6 - 0.12 * fk, 0.0, 1.0) * 3.14159);
    float face = 1.0;
    float lb = k == 2 ? 0.0 : smoothstep(0.5 + 0.06 * fk, 0.6 + 0.06 * fk, gT) * (1.0 - smoothstep(0.84, 0.92, gT));
    float fr = (lb > 0.5 ? F_LOOK : F_RUN) + floor(fract(uBeatClock * 1.5 + fk * 0.37) * 12.0);
    if (k == 0) {
      // the last in line dives clear of the foot and rolls back onto his feet
      float dv = kindN > 1.5 ? 0.0 : clamp((gT > 0.5 ? gT - 0.92 : gT + 0.08) / 0.24, 0.0, 1.0);
      float wT = smoothstep(0.0, 0.08, dv) * (1.0 - smoothstep(0.9, 1.0, dv));
      hop = mix(hop, 0.12 * sin(dv * 3.14159), wT);
      x += 0.06 * sin(dv * 3.14159);
      if (wT > 0.5) fr = F_FLIP + floor(dv * 11.99);
      if (gKind > 1.5 && gKind < 2.5) {
        // or the shock throws him off his feet: he lies there while the road takes him back
        // towards the foot, gets up, turns and sprints to catch the others
        float kd = kf(0.0, 0.13);
        float off = 0.12 * ease(kd) - min((clamp(gT, 0.13, 0.45) - 0.13) * trav, 0.3);
        x += off * (1.0 - ease(kf(0.45, 0.72)));
        if (gT < 0.45) { face = -1.0; hop = 0.0; }
        if (gT < 0.2) { fr = F_KNOCK + floor(kd * 7.99); hop = 0.06 * sin(kd * 3.14159); }
        else if (gT < 0.42) fr = F_GETUP + floor(kf(0.2, 0.42) * 9.99);
        else if (gT < 0.45) fr = F_TURN + (gT < 0.435 ? 1.0 : 0.0);
      }
      if (gKind > 2.5) {
        // or he goes for it: a flying kick into the claws
        float fp = kf(0.05, 0.27);
        if (gT > 0.02 && gT < 0.3) {
          face = -1.0;
          fr = gT < 0.05 ? F_TURN + step(0.035, gT) : gT > 0.27 ? F_TURN + step(gT, 0.285) : F_FKICK + floor(fp * 7.99);
          x = mix(x, gFx + 1.2, ease((fp - 0.2) / 0.5) * (1.0 - ease((fp - 0.8) / 0.2)));
          hop = 0.15 * smoothstep(0.2, 0.45, fp) * (1.0 - smoothstep(0.75, 0.95, fp));
        }
      }
    }
    if (k == 1) {
      // the second one turns and puts a bolt into the toes
      float on = gKind > 0.5 && gKind < 1.5 ? 1.0 : 0.0;
      float bp = clamp((gT - 0.1) / 0.24, 0.0, 1.0) * on;
      if (bp > 0.001 && bp < 0.999) {
        face = -1.0;
        fr = bp < 0.08 ? F_TURN : bp > 0.92 ? F_TURN + 1.0 : F_BLAST + floor(clamp((bp - 0.08) / 0.84, 0.0, 1.0) * 9.99);
      }
      float fb = clamp((bp - 0.52) / 0.4, 0.0, 1.0);
      gBolt = vec4(mix(x - 0.2, gFx + 1.04, fb), mix(-0.2, -0.23, fb), step(0.001, fb) * step(fb, 0.999) * on, 0.0);
    }
    if (k == 2 && gKind > 2.5) {
      // the leader skids to a halt, strikes the roll-call pose with a charge going off behind
      // him while the road carries him back, and runs to the front again
      float off = -min((clamp(gT, 0.4, 0.64) - 0.4) * trav, 0.3);
      x += off * (1.0 - ease(kf(0.64, 0.9)));
      if (gT > 0.36 && gT < 0.44) fr = F_SKID + floor(kf(0.36, 0.44) * 5.99);
      else if (gT >= 0.44 && gT < 0.64) fr = F_POSE + floor(kf(0.44, 0.62) * 11.99);
      if (gT > 0.36 && gT < 0.64) hop = 0.0;
    }
    vec4 hs = vec4(x, ly + hop, ly, fr);
    if (k == 0) { gS0 = hs; gFace.x = face; } else if (k == 1) { gS1 = hs; gFace.y = face; } else { gS2 = hs; gFace.z = face; }
  }

  // the street: dusk, night, storm, four stomps each
  gMood = mod(floor(gM / 4.0), 3.0);
  gNight = step(0.5, gMood) * step(gMood, 1.5);
  gStorm = step(1.5, gMood);
  vec3 wall = gMood < 0.5 ? vec3(0.2, 0.095, 0.17) : gMood < 1.5 ? vec3(0.06, 0.055, 0.15) : vec3(0.045, 0.07, 0.1);
  vec3 lit = gMood < 0.5 ? vec3(0.5, 0.25, 0.23) : gMood < 1.5 ? vec3(0.12, 0.125, 0.28) : vec3(0.1, 0.145, 0.19);
  gAmbRim = gMood < 0.5 ? vec3(1.0, 0.74, 0.42) : gMood < 1.5 ? vec3(0.6, 0.72, 1.0) : vec3(0.72, 0.9, 1.0);
  vec3 tint = mix(vec3(1.0), min(uColor3 / max(dot(uColor3, vec3(0.333)), 0.05), 1.6), 0.16);
  gWall = wall * tint;
  gWallLit = lit * tint;
  gRoad = mix(gWall, gWallLit, 0.5);
  float pump = 0.9 + 0.16 * uBass + 0.1 * gKick;
  gSkyTop = (gMood < 0.5 ? mix(vec3(0.3, 0.15, 0.36), uColor3 * 0.45, 0.45) : gMood < 1.5 ? mix(vec3(0.03, 0.04, 0.13), uColor3 * 0.12, 0.3) : vec3(0.05, 0.07, 0.09));
  gSkyMid = (gMood < 0.5 ? mix(vec3(0.9, 0.4, 0.36), uColor1 * 0.7, 0.15) : gMood < 1.5 ? mix(vec3(0.07, 0.09, 0.26), uColor1 * 0.3, 0.3) : vec3(0.1, 0.14, 0.17)) * pump;
  gSkyLow = (gMood < 0.5 ? mix(vec3(1.0, 0.68, 0.38), mix(uColor1, vec3(1.0), 0.4), 0.25) : gMood < 1.5 ? mix(vec3(0.16, 0.22, 0.46), uColor1 * 0.55, 0.4) : mix(vec3(0.2, 0.27, 0.3), uColor1 * 0.3, 0.2)) * pump;
  gDisc = gMood < 0.5 ? mix(vec3(1.0, 0.93, 0.7), uColor1, 0.1) : mix(vec3(0.88, 0.93, 1.0), uColor2, 0.08);
  gSun = gMood < 0.5 ? vec2(0.2, 0.1) : vec2(0.34, 0.24);
  gDiscR = gMood < 0.5 ? 0.27 : 0.15;
  gSheen = gMood < 0.5 ? 1.0 : gMood < 1.5 ? 0.8 : 0.0;
  gLamp = gMood < 0.5 ? 0.3 : 1.0;
  gWinTh = gMood < 0.5 ? 0.84 : 0.66;
  gShLen = gMood < 0.5 ? 4.5 : gMood < 1.5 ? 3.2 : 1.0;
  gFlashL = gStorm * gKick * gKick * step(0.5, h11(floor(uBeatClock) * 3.7));
  gHide = mix(vec3(0.33, 0.29, 0.44), uColor3, 0.2);

  // camera: the stomp throws it down and shakes it, and it punches in; a jolt for everything else
  float hit = exp(-gImpAge * 5.0) + 0.3 * exp(-max(gTapAge, 0.0) * 9.0) * step(0.0, gTapAge) + 0.1 * gKick;
  gShake = hit * vec2(0.02 * sin(uTime * 61.0), 0.03 * cos(uTime * 47.0)) + vec2(0.0, -0.035 * exp(-gImpAge * 11.0));
  gImpact = step(gImpAge, 0.085) * step(0.01, pyro);
  gPunch = 0.08 * exp(-gImpAge * 5.0);
  float flash = (max(exp(-max(gBoomAge - 0.1, 0.0) * 5.0) * step(0.0, gBoomAge), exp(-max(gPoseAge, 0.0) * 5.0) * step(0.0, gPoseAge)) + exp(-gImpAge * 9.0)) * gPy;
  gKeyCol = vec3(1.0, 0.98, 0.94) * (1.0 + 0.25 * flash + 0.5 * gFlashL);
  gShadeCol = mix(vec3(0.3, 0.26, 0.5), gWallLit * 1.6, 0.25);
  gRimCol = gAmbRim * (1.0 + 0.3 * gKick) + vec3(1.0, 0.85, 0.6) * 0.5 * flash;

  vec3 col = render(gl_FragCoord.xy);
  col = printLook(col, gl_FragCoord.xy, tp);
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.22 - dot(vp, vp) * 0.75, 0.45, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

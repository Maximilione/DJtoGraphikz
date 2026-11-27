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

// Titan Hand: a frame from a 90s tokusatsu episode. The set is a miniature:
// the foot of a building too big for the frame, three steel bay doors, a
// plaza, smoke-machine haze along the ground, model trees out of focus in
// front of the lens. Three suited heroes hold the plaza. Every 8 beats a bay
// rattles, bursts open on the beat, and the hand of something the size of the
// building comes out of it along the wall: a giant ape's hand on a shaggy
// forearm. It gropes after the team, pats the ground, winds up and slams
// (sparks, shake, a punch-in), shakes its fist and is gone; the doors slam
// and the team runs to the next bay and strikes the roll-call pose with a
// coloured charge going off behind each of them. All of it is pixel art on
// one grid: the set, the smoke and the sparks are drawn in flat tones like
// the sprites. `tape` adds what a home deck would have done to the picture.

const float FY = -0.2;                   // where the facade meets the plaza

// ---- tokusatsu kit: the same block lives in titanhand.frag and kaijustomp.frag ----
// Pixel art, all of it. The picture is worked out once per virtual pixel (about
// 216 lines, a whole number of screen pixels each) and everything the shader
// draws itself follows the rules the sprite sheets follow: hard edges, at most
// five flat tones per material on a ramp that shifts hue (shadows cool and
// lose saturation, highlights go warm), a one-pixel outline, light from the
// top left, and an ordered 2x2 dither only on the transitions that ask for it.
const float TAU = 6.2831853;
const vec3 INK = vec3(0.04, 0.03, 0.08);

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
float gVP;                      // one virtual pixel, in scene units
float gPx;                      // one virtual pixel, in the units of the field being drawn
vec2 gQ;                        // this virtual pixel, counted from the middle of the set
float gD;                       // its threshold in the 2x2 Bayer cell `0 2 / 3 1`
vec3 gL;                        // key light, from the top left
vec3 cA, cB, cC;                // the three suit colours, from the palette
vec3 gSprLight;                 // the light of the set on the sprites (a pyro flash lifts it)

float sn(float x) { return floor(x / gVP + 0.5) * gVP; }      // a position, snapped to the grid
float nv(float x) { return floor(x / gVP + 0.5); }            // a length, in whole virtual pixels
vec2 snapv(vec2 o) { return floor(o / gVP + 0.5) * gVP; }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
// v in n flat steps; w = how much of each step's edge is dithered (0 = hard)
float qz(float v, float n, float w) { return floor(v * n + 0.5 + (gD - 0.5) * w) / n; }

// the ramp of a material: tone 4 is its colour, 3..1 go darker, cooler and
// greyer towards a blue violet, 5 is a warm highlight. Never black, never white.
// lift raises the dark end (white cloth does not go as deep as a coloured suit)
vec3 ramp(vec3 b, float lv, float lift) {
  if (lv > 4.5) return mix(b, vec3(1.0, 0.95, 0.7), 0.5);
  if (lv > 3.5) return b;
  float k = mix(lv > 2.5 ? 0.74 : lv > 1.5 ? 0.5 : 0.3, 1.0, lift);
  float cool = lv > 2.5 ? 0.12 : lv > 1.5 ? 0.26 : 0.44;
  float l = dot(b, vec3(0.299, 0.587, 0.114));
  return mix(mix(b, vec3(l), cool * 0.6) * k, vec3(0.6, 0.5, 1.45) * l * k + vec3(0.02, 0.015, 0.05), cool);
}
vec3 shade(vec3 c) { return c * vec3(0.5, 0.48, 0.64); }       // a cast shadow: one flat step down, towards blue

// distance fields that also return their gradient in .yz
vec3 gCirc(vec2 p, float r) { float l = length(p); return vec3(l - r, p / max(l, 1e-5)); }
vec3 gSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 q = pa - ba * h;
  float l = length(q);
  return vec3(l - mix(ra, rb, h), q / max(l, 1e-5));
}
vec3 gEll(vec2 p, vec2 r) {
  float k0 = length(p / r);
  vec2 g = p / (r * r);
  float k1 = length(g);
  return vec3(k0 * (k0 - 1.0) / max(k1, 1e-5), g / max(k1, 1e-5));
}
vec3 gBox(vec2 p, vec2 b, float r) {
  vec2 w = abs(p) - b + r;
  float g = max(w.x, w.y);
  vec2 q = max(w, 0.0);
  float l = length(q);
  vec2 n = g > 0.0 ? q / max(l, 1e-5) : (w.x > w.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3((g > 0.0 ? l : g) - r, sign(p) * n);
}
vec3 smin3(vec3 a, vec3 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// a field as a rounded solid, the way a sprite would draw it. Returns the tone:
// 0 outside, -1 the outline on the shadow side (ink), -2 the outline on the lit
// side (the material's darkest tone), 1..5 inside. The tone follows the light,
// not the distance from the edge. rad = how far in the surface keeps curving;
// gloss > 0.3 earns a highlight; jit moves the band edges, one value per cluster
float litLv(vec3 dg, float rad, float gloss, float jit) {
  float d = dg.x;
  if (d > 0.0) return 0.0;
  if (d > -gPx) return dot(dg.yz, gL.xy) > 0.25 ? -2.0 : -1.0;
  float t = clamp(-d / rad, 0.0, 1.0);
  vec3 n = normalize(vec3(dg.yz * (1.0 - t), sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0)) + 0.06));
  float dif = dot(n, gL) + jit;
  if (gloss > 0.3 && dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))) > mix(0.99, 0.955, gloss)) return 5.0;
  return dif < 0.08 ? 1.0 : dif < 0.45 ? 2.0 : dif < 0.78 ? 3.0 : 4.0;
}
void lit(vec3 dg, float rad, vec3 alb, float gloss, float jit) {
  float lv = litLv(dg, rad, gloss, jit);
  if (lv != 0.0) gCol = lv < -1.5 ? ramp(alb, 1.0, 0.0) : lv < 0.0 ? INK : ramp(alb, lv, 0.0);
}

// ---- sprites ----
// Heroes, hand and foot are pixel art, drawn frame by frame by
// scripts/toku/*.py (yarn gen:sprites): one texel is one virtual pixel and
// their positions snap to the grid, so every pixel on screen is the same size.
uniform sampler2D uAtlasHero0;
uniform sampler2D uAtlasHero1;
uniform sampler2D uAtlasHero2;

// frames on a hero's sheet (16 x 8 cells of 144 px, a hero about 100 px tall)
const float F_STANCE = 0.0, F_WALK = 8.0, F_RUN = 16.0, F_LOOK = 28.0, F_FLIP = 40.0, F_SKID = 52.0, F_KNOCK = 58.0, F_GETUP = 66.0,
            F_POSE = 76.0, F_PUNCH = 88.0, F_KICK = 96.0, F_FKICK = 104.0, F_BLAST = 112.0, F_TURN = 122.0, F_BOLT = 124.0;

// one frame of hero v's sheet, feet at o. The sheet is indexed: R = material,
// G = tone 1..5; the ramp of each material is built here from the suit colour
void heroSprite(vec2 p, vec2 o, float dir, float idx, vec3 suit, float v) {
  vec2 c = (p - snapv(o)) / gVP;
  c = vec2(c.x * dir + 72.0, c.y + 12.0);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= 144.0 || c.y >= 144.0) return;
  vec2 px = vec2(mod(idx, 16.0) * 144.0 + floor(c.x), floor(idx / 16.0) * 144.0 + 143.0 - floor(c.y));
  vec2 uv = vec2((px.x + 0.5) / 2304.0, 1.0 - (px.y + 0.5) / 1152.0);
  vec4 t = v < 0.5 ? texture2D(uAtlasHero0, uv) : v < 1.5 ? texture2D(uAtlasHero1, uv) : texture2D(uAtlasHero2, uv);
  if (t.a < 0.5) return;
  float mat = floor(t.r * 255.0 / 40.0 + 0.5), lv = floor(t.g * 255.0 / 50.0 + 0.5);
  if (mat > 5.5) gCol = lv > 4.5 ? vec3(1.0, 0.98, 0.9) : lv > 2.5 ? mix(suit, vec3(1.0, 0.96, 0.8), 0.6) : suit * 1.2;   // energy, swooshes
  else if (mat > 4.5) gCol = INK;
  else {
    // gloves and boots are white past the tone curve (1.4 comes out near 0.88), their shading two clear greys
    vec3 base = mat < 1.5 ? suit : mat < 2.5 ? vec3(1.4, 1.4, 1.36) : mat < 3.5 ? vec3(0.13, 0.16, 0.3) : vec3(1.1, 0.8, 0.08);
    vec3 col = ramp(base, lv, 0.0);
    if (mat < 1.5 && lv > 1.5 && lv < 2.5) col *= 0.8;                                    // the suit's core shadow sits at 0.4
    if (mat > 2.5 && mat < 3.5 && lv > 3.5) col = vec3(0.8, 0.88, 1.0);                     // the glint on the visor
    gCol = col * gSprLight;
  }
}

// smoke as an FX sprite: nothing, a checker fringe, tone a, tone b
void puff(float dens, vec3 a, vec3 b) {
  if (dens > 0.62) gCol = b;
  else if (dens > 0.38 || (dens > 0.32 && gD > 0.5)) gCol = a;
}

// a pyro charge, drawn on twos: a warm white core, the fire in three tones of
// its colour, then two tones of smoke that rise and break up. q from the
// charge, R its size, age in seconds-ish (0 = ignition)
void addBoom(vec2 q, float age, float R, vec3 hue, float seed) {
  if (age <= 0.0 || age > 1.6 || abs(q.x) > R * 2.2 || abs(q.y) > R * 3.2) return;
  age = floor(age * 15.0) / 15.0 + 0.03;
  float grow = 1.0 - exp(-age * 8.0);
  q.y -= R * 0.55 * age;
  float n = fbm(q * 5.0 / R + vec2(seed * 9.0, -age * 2.5));
  float d = length(q * vec2(1.0, 0.8)) / (R * (0.2 + 0.8 * grow)) + (n - 0.5) * 0.9 + 0.9 * smoothstep(0.9, 1.6, age);
  if (d > 1.05 || (d > 0.99 && gD < 0.5)) return;
  float fire = clamp(1.0 - age * 1.9, 0.0, 1.0) * (1.25 - d);
  vec3 sm = mix(hue, vec3(0.5, 0.48, 0.47), 0.6);
  gCol = fire > 0.8 ? vec3(1.0, 0.97, 0.8) : fire > 0.56 ? ramp(hue, 5.0, 0.0) : fire > 0.34 ? hue : fire > 0.16 ? ramp(hue, 3.0, 0.0)
       : ramp(sm, n + 0.5 * (q.y - q.x) / R > 0.56 ? 3.0 : 2.0, 0.0);
}

// a shower of sparks thrown up from q = 0, falling under gravity: one pixel
// wide streaks, white at the head and orange behind, and a hard star at the start
void addSparks(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 9.0) return;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    if (age > 0.45 + 0.55 * h11(fi + seed * 3.0)) continue;                    // each one burns out in its own time
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    if (sdSeg(q, pos, pos - vel * 0.07) < 0.55 * gVP)
      gCol = length(q - pos) < 1.6 * gVP ? vec3(1.0, 0.97, 0.8) : age < 0.5 ? vec3(1.0, 0.72, 0.26) : vec3(0.86, 0.36, 0.2);
  }
  vec2 a = abs(q) / R;
  float star = max(a.x, a.y) + 5.0 * min(a.x, a.y);
  float sz = 0.55 * (1.0 - age * 7.0);
  if (star < sz) gCol = star < sz * 0.45 ? vec3(1.0, 0.97, 0.8) : vec3(1.0, 0.8, 0.36);
}

// what a consumer deck did to the picture. Up to half way the pixels stay
// clean: the deck only pushes the colour and lifts the blacks. Past that (hi)
// the tape itself shows: colour smeared sideways with the red lagging the blue
// (cl is the frame two pixels to the left: the one extra render it costs),
// interlace, noise, the head-switching band
vec3 tapeLook(vec3 c0, vec3 cl, vec2 fc, float amt, float hi) {
  vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 av = (c0 + cl) * 0.5;
  vec3 chroma = vec3(cl.r - dot(cl, W), av.g - dot(av, W), c0.b - dot(c0, W));
  vec3 c = mix(c0, vec3(dot(c0, W) * 0.85 + dot(av, W) * 0.15) + chroma * 1.25, hi);
  float line = floor(fc.y / uResolution.y * 486.0);
  c *= 1.0 - 0.1 * hi * mod(line + floor(uTime * 30.0), 2.0);                   // interlace
  c += (h21(fc + fract(uTime) * 91.0) - 0.5) * 0.07 * hi;                     // tape noise
  float sw = step(fc.y / uResolution.y, 0.02) * hi;                            // head-switching band
  c = mix(c, vec3(h21(vec2(floor(fc.x / 5.0), floor(uTime * 60.0) + line))) * 0.8, 0.6 * sw * step(0.35, h11(line + floor(uTime * 60.0))));
  c = mix(vec3(dot(c, W)), c, 1.0 + 0.25 * amt);                              // tape oversaturates
  c = c * (1.0 - 0.04 * amt) + 0.022 * amt;                                    // lifted blacks
  return c;
}
// ---- end of the tokusatsu kit ----

float gTc, gXd, gSide, gOpen, gRum, gKick, gHandOn, gCurl, gSpread, gHS, gSlamX, gImpAge, gBurstAge, gShutAge, gPoseAge, gPat1, gPat2, gFit, gShadow, gCrew;
vec2 gW, gHit, gHD, gShake;               // gHit: the middle of the hand, where a blow lands
vec3 gGlow;
vec4 gS0, gS1, gS2;                      // per hero: x, hop, facing, frame on the sheet
float gHandFrame;
vec4 gBolt;                              // the energy bolt: x, y, on, direction
uniform sampler2D uAtlasHand;

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float kf(float a, float b) { return clamp((gTc - a) / (b - a), 0.0, 1.0); }
float secs(float t0) { return (gTc - t0) * 8.0 * 0.47 / clamp(tempo, 0.25, 2.0); }
float bay(float n) {
  float blk = floor(n / 3.0);
  return mod(n * (h11(blk * 7.9 + 1.5) > 0.5 ? 1.0 : 2.0) + floor(h11(blk * 3.7 + 0.5) * 3.0), 3.0) - 1.0;
}

// the wall, in whole pixels: v.x counts columns from the middle, v.y rows up from the plaza
vec3 facade(vec2 p) {
  vec3 conc = mix(vec3(0.66, 0.64, 0.6), uColor3, 0.16);
  vec2 v = floor(vec2(p.x, p.y - sn(FY)) / gVP);
  float G = nv(0.6), BW = nv(0.15), BH = nv(0.5), FR = nv(0.024), LY = nv(0.53), LH = nv(0.03);
  float xd = clamp(floor((v.x + 0.5) / G + 0.5), -1.0, 1.0);
  float act = step(abs(xd * 0.6 - gXd), 0.01);
  // cast panels: a dark joint, and the top and left arris of each panel catching the key
  float jx = mod(v.x + 0.5 * G, nv(0.2)), jy = mod(v.y, nv(0.11));
  float lv = jx < 1.0 || jy < 1.0 ? 2.0 : jy > nv(0.11) - 1.5 || jx < 2.0 ? 4.0 : 3.0;
  // rain streaks under the ledge, three pixels wide
  float sc = floor(v.x / 3.0);
  if (h11(sc * 1.3 + 4.0) > 0.8 && v.y > LY - 8.0 - 44.0 * h11(sc * 2.9)) lv = 2.0;
  if (v.y >= LY - 3.0) lv = 2.0;                                // the ledge's own shadow
  vec3 col = ramp(conc, lv, 0.0);
  if (v.y >= LY + LH) {
    // upper storeys: ranks of windows far too small, which is what makes it huge
    float wy = v.y - LY - LH, wx = v.x + 700.0;
    float cx = mod(wx, 7.0), cy = mod(wy, 9.0);
    col = ramp(conc, 2.0, 0.0);
    if (cx >= 2.0 && cx < 6.0 && cy >= 2.0 && cy < 7.0)
      col = h21(vec2(floor(wx / 7.0), floor(wy / 9.0))) > 0.82 ? (cy >= 6.0 ? vec3(1.0, 0.93, 0.68) : vec3(0.96, 0.76, 0.4))
                                                              : (cy >= 5.0 ? vec3(0.26, 0.33, 0.45) : vec3(0.07, 0.09, 0.17));
    else if (cy >= 1.0 && cy < 2.0 && cx >= 1.0) col = ramp(conc, 3.0, 0.0);      // the sill
  } else if (v.y >= LY) col = ramp(conc, v.y >= LY + LH - 1.0 ? 5.0 : v.y < LY + 2.0 ? 2.0 : 4.0, 0.0);
  else {
    // piers between the bays: lit on the left arris, shaded on the right, a shadow on the wall beside them
    float px = v.x + 0.5 - (floor((v.x + 0.5) / G) + 0.5) * G, pw = nv(0.05);
    if (abs(px) < pw) {
      lv = px < 1.0 - pw ? 5.0 : px > pw - 2.0 ? 2.0 : 4.0;
      if (v.y < 6.0) lv = v.y > 4.5 ? 5.0 : lv - 1.0;           // plinth
      col = ramp(conc, lv, 0.0);
    } else if (px >= pw && px < pw + 4.0) col = ramp(conc, 2.0, 0.0);
  }
  // the bay: a painted steel lintel, hazard-striped jambs, slatted doors
  float dx = v.x + 0.5 - xd * G + act * floor(gRum * 1.4 * sin(uTime * 75.0) + 0.5);
  float ax = abs(dx);
  if (ax < BW + FR && v.y < BH + FR) {
    vec3 yel = vec3(0.93, 0.74, 0.12), blk = vec3(0.09, 0.08, 0.13);
    if (v.y >= BH) col = ramp(mix(vec3(0.5, 0.5, 0.48), uColor1, 0.5), v.y >= BH + FR - 1.0 ? 5.0 : v.y < BH + 1.0 ? 2.0 : 3.0, 0.0);
    else col = mod(dx + v.y + 400.0, 8.0) < 4.0 ? yel : blk;
    if (ax > BW + FR - 1.0 && dx > 0.0) col = INK;
    if (ax < BW && v.y < BH) {
      float ang = act * (gOpen * 1.45 + gRum * 0.12 * floor(abs(sin(uTime * 31.0)) * 2.0 + 0.5) * 0.5);
      float lx = (BW - ax) / cos(ang);
      if (lx < BW) {
        float sv = sin(ang);
        float yy = floor(v.y / (1.0 + 0.12 * sv * lx / BW));
        float s = mod(yy, 6.0);
        float dl = s < 1.0 ? 1.0 : s < 2.0 ? 2.0 : s < 5.0 ? 3.0 : 4.0;
        // the leaves sit back in the frame (its shadow lies across their top and the lit jamb's side) and go dark as they swing in
        if (sv > 0.5 || v.y >= BH - 3.0 || dx < 3.0 - BW) dl = max(dl - 1.0, 1.0);
        col = ramp(mix(vec3(0.4, 0.42, 0.46), uColor2, 0.42), dl, 0.0);
        if (yy < nv(0.045)) col = mod(floor(lx) + yy, 6.0) < 3.0 ? yel * (dl < 2.5 ? 0.7 : 1.0) : blk;
        if (lx > BW - 1.5 || yy < 1.0) col = INK;
      } else {
        // inside: dark, and smoke lit from behind in three flat steps
        float tq = floor(uTime * 10.0) / 10.0;
        float sm = fbm(vec2(dx * 7.0, v.y * 5.0) * gVP + vec2(tq * 0.25, -tq * 0.6));
        float g = (0.18 + 0.75 * sm * sm) * clamp(1.0 - v.y / nv(0.55), 0.0, 1.0);
        col = vec3(0.03, 0.03, 0.07) + gGlow * 0.26 * floor(g * 3.6 + 0.5 + (step(0.5, gD) - 0.5) * 0.16);
      }
    }
  }
  return col;
}

// the plaza: a floor of rows, each one scaled by its distance, as a 16-bit console would raster it
vec3 plaza(vec2 p) {
  float r = floor((sn(FY) - p.y) / gVP);
  float f = (r + 0.5) * gVP, k = 1.0 + f * 1.6;
  float X = p.x / k;
  float lv = 3.0;
  if (abs(fract(X / 0.25 + 0.5) - 0.5) * 0.25 * k < 0.5 * gVP) lv = 2.0;                               // slab joints, converging
  if (floor(pow(f / 0.3, 0.75) * 4.0) != floor(pow((f + gVP) / 0.3, 0.75) * 4.0)) lv = 2.0;
  if (r < 2.0) lv = 1.0; else if (r < 4.0 || (r < 5.0 && gD > 0.5)) lv = 2.0;                         // the foot of the wall
  vec3 col = ramp(mix(vec3(0.42, 0.42, 0.45), uColor3, 0.07), lv, 0.0);
  float yl = r - nv(0.04);
  if (yl >= 0.0 && yl < 2.0 && fract(X / 0.1) > 0.3) col = yl < 1.0 ? vec3(0.86, 0.72, 0.18) : vec3(0.6, 0.46, 0.16);
  // hosed down before the take: the set shows in the tarmac, squashed to half and dimmer with distance
  float rn = nv(0.16);
  if (r < rn) col = mix(col, facade(vec2(p.x, sn(FY) + (2.0 * r + 0.5) * gVP)), r < 0.4 * rn ? 0.22 : r < 0.7 * rn ? 0.14 : 0.07);
  // light spilling out of an open bay, in flat steps
  float sx = (p.x - gXd) / 0.22;
  col += gGlow * 0.1 * gOpen * floor(exp(-sx * sx) * exp(-f * 7.0) * 3.0 + 0.5);
  return col;
}

// the hand: one frame of the 6 x 3 sheet (288 px cells, scripts/toku/ingest_giants.py). The arm lies
// along the wall and comes out of the bay sideways: gW is the cut end of the forearm (column 40,
// row 150 of the cell) and nothing shows beyond the far jamb, so the arm slides out of the dark.
// It is drawn for a reach to the right: mirrored for the left
void titanHand(vec2 p) {
  if (gHandOn < 0.5) return;
  float jb = (floor(p.x / gVP) + 0.5 - floor(gXd / 0.6 + 0.5) * nv(0.6)) * gSide + nv(0.15);       // pixels in from the far jamb
  if (jb < 0.0) return;
  // on its way out and back in it is still inside: nothing of it shows over the lintel of its own bay
  float lid = min(kf(0.15, 0.19), 1.0 - kf(0.69, 0.73));
  if (jb < 2.0 * nv(0.15) && floor((p.y - sn(FY)) / gVP) >= nv(0.5) + 200.0 * lid) return;
  vec2 c = (p - snapv(gW)) / gVP;
  c = vec2(c.x * gSide + 40.0, c.y + 137.5);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= 288.0 || c.y >= 288.0) return;
  vec2 px = vec2(mod(gHandFrame, 6.0) * 288.0 + floor(c.x), floor(gHandFrame / 6.0) * 288.0 + 287.0 - floor(c.y));
  vec4 t = texture2D(uAtlasHand, vec2((px.x + 0.5) / 1728.0, 1.0 - (px.y + 0.5) / 864.0));
  if (t.a < 0.5) return;
  vec3 col = t.rgb * gSprLight;
  gCol = jb < 5.0 ? shade(shade(col)) : jb < 12.0 ? shade(col) : col;                              // the shadow of the bay on the arm
}

// a flat oval of shadow on the ground
void blob(vec2 p, vec2 o, vec2 r) {
  vec2 s = (p - o) / r;
  if (dot(s, s) < 1.0) gCol = shade(gCol);
}

// iq = the virtual pixel, counted from the middle of the screen
vec3 render(vec2 iq) {
  vec2 p = (iq + 0.5) * gVP + gShake;
  gQ = floor(p / gVP);
  gD = bayer2(gQ) + 0.125;
  gPx = gVP;
  gCol = p.y > sn(FY) ? facade(p) : plaza(p);
  // smoke machine: a low bank along the foot of the wall
  float hz = fbm(vec2(p.x * 3.0 - uTime * 0.07, p.y * 24.0));
  vec3 hazeC = mix(vec3(0.66, 0.7, 0.76), gGlow, 0.15);
  puff(exp(-pow((p.y - FY + 0.02) / 0.07, 2.0)) * hz * hz * 1.15, hazeC, mix(hazeC, vec3(0.93, 0.94, 0.96), 0.5));
  // shadow of the hand before it lands: a checker while it is high, solid as it comes down
  vec2 sq = (p - vec2(gSlamX, -0.265)) / vec2(0.24, 0.03);
  float ss = dot(sq, sq);
  if (gShadow > 0.6 ? ss < 1.0 : (gShadow > 0.15 && ss < 0.7 && gD > 0.5)) gCol = shade(gCol);

  float py = clamp(pyro, 0.0, 2.0);
  // roll call: one charge behind each of them, in their colour
  if (gPoseAge > 0.0 && py > 0.0) {
    addBoom(p - vec2(gS0.x - 0.03, -0.17), gPoseAge, 0.26 * py, cA, 1.0);
    if (gCrew > 1.5) addBoom(p - vec2(gS1.x + 0.05, -0.14), gPoseAge - 0.06, 0.28 * py, cB, 2.0);
    if (gCrew > 2.5) addBoom(p - vec2(gS2.x - 0.05, -0.15), gPoseAge - 0.12, 0.26 * py, cC, 3.0);
  }
  // dust blown out of the bay when the doors go
  if (gBurstAge > 0.0) addBoom(p - vec2(gXd, FY + 0.08), gBurstAge * 1.1 + 0.55, 0.06 + 0.08 * smoothstep(0.0, 0.5, gBurstAge), vec3(0.75, 0.72, 0.68), 5.0);

  titanHand(p);                           // along the wall, behind the three of them
  for (int k = 2; k >= 1; k--) {
    vec4 hh = k == 1 ? gS1 : gS2;
    if (gCrew < float(k) + 0.5) continue;
    float ly = k == 1 ? -0.36 : -0.34;
    blob(p, vec2(hh.x, ly), vec2(0.07, 0.012));
    heroSprite(p, vec2(hh.x, ly + hh.y), hh.z, hh.w, k == 1 ? cB : cC, float(k));
  }
  blob(p, vec2(gS0.x, -0.385), vec2(0.075, 0.013));
  heroSprite(p, vec2(gS0.x, -0.385 + gS0.y), gS0.z, gS0.w, cA, 0.0);
  // the second one's bolt, on its way to the hand
  if (gBolt.z > 0.5) heroSprite(p, gBolt.xy - vec2(0.0, 60.0 * gVP), gBolt.w, F_BOLT + mod(floor(uTime * 12.0), 4.0), cB, 1.0);

  // practical sparks: the slam, the two pats, the doors
  addSparks(p - vec2(gSlamX, -0.26), gImpAge * 1.3, 0.22 * (0.5 + 0.5 * py), 1.0);
  addSparks(p - vec2(gTc < 0.375 ? gPat1 : gPat2, -0.26), secs(gTc < 0.375 ? 0.25 : 0.375) * 2.0, 0.09 * py, 2.0);
  addSparks(p - vec2(gXd, FY + 0.3), gBurstAge * 1.5, 0.2 * (0.4 + 0.6 * py), 4.0);
  addSparks(p - vec2(gXd, FY + 0.02), gShutAge * 2.0, 0.1 * py, 5.0);
  addSparks(p - gHit, secs(0.43) * 2.2, 0.12 * py, 6.0);                                  // the bolt and the kick land
  addSparks(p - gHit - vec2(gSide * 0.2, 0.0), secs(0.64) * 2.2, 0.14 * py, 8.0);
  if (gImpAge > 0.0) addBoom(p - vec2(gSlamX, -0.25), gImpAge * 0.9 + 0.55, 0.06 + 0.08 * smoothstep(0.0, 0.5, gImpAge), vec3(0.6, 0.57, 0.52), 7.0);

  // model trees an inch from the lens: dark cut-outs, a few clumps of leaves catching the key
  vec2 tc = p.x < 0.0 ? vec2(-0.95, -0.56) : vec2(0.97, -0.58);
  vec2 tq = (p - tc) * vec2(p.x < 0.0 ? 0.8 : 0.9, 1.0);
  float td = length(tq);
  if (td < 0.36) {
    td += 0.12 * fbm(p * 5.0 + 3.0);
    if (td < 0.23) gCol = td < 0.19 && vn(p * 24.0) + 0.9 * (tq.y - tq.x) > 0.62 ? vec3(0.07, 0.15, 0.1) : vec3(0.035, 0.06, 0.07);
  }
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  // one grid of virtual pixels for everything: about 216 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 216.0 + 0.5));
  gVP = scl * gFit / uResolution.y;
  gCrew = floor(clamp(crew, 1.0, 3.0) + 0.5);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);

  // ---- the 8-beat routine ----
  float cyc = uBeatClock * clamp(tempo, 0.25, 2.0) / 8.0;
  float n = floor(cyc);
  gTc = fract(cyc);
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
  gSlamX = gXd + gSide * 0.38;

  // the hand: out, grope, wind up, slam, fist, gone. ca = where the cut end of the arm is along the
  // wall, from the middle of the bay: the middle of the hand is 0.5 further out, the fingertips 0.87
  vec2 d1 = normalize(vec2(gSide * 0.55, -1.0)), d4 = normalize(vec2(gSide * 0.9, -0.45)), d5 = normalize(vec2(gSide * 0.25, 1.0));
  float pat = exp(-pow((gTc - 0.25) / 0.012, 2.0)) + exp(-pow((gTc - 0.375) / 0.012, 2.0));
  gPat1 = gXd + gSide * 0.24;
  gPat2 = gXd + gSide * 0.33;
  float o1 = kf(0.125, 0.185);
  float ca = mix(-1.05, -0.35, 1.0 - pow(1.0 - o1, 3.0) + 0.25 * sin(o1 * 3.14159) * (1.0 - o1));
  ca = mix(ca, -0.23, ease(kf(0.19, 0.42)));
  ca = mix(ca, -0.34, ease(kf(0.42, 0.49)));
  ca = mix(ca, -0.12, pow(kf(0.49, 0.5), 2.0));
  ca = mix(ca, -0.45, ease(kf(0.57, 0.63)));
  ca += 0.018 * sin(uTime * 26.0) * step(0.63, gTc) * step(gTc, 0.69);
  ca = mix(ca, -1.05, ease(kf(0.69, 0.75)));
  gW = vec2(gXd + gSide * ca, 0.04 - 0.035 * pat);
  gHD = mix(vec2(0.0, -1.0), d1, ease(kf(0.125, 0.19)));
  gHD = mix(gHD, d4, ease(kf(0.42, 0.5)));
  gHD = mix(gHD, d5, ease(kf(0.57, 0.63)));
  gHD = normalize(mix(gHD, vec2(0.0, -1.0), ease(kf(0.69, 0.75))) + vec2(1e-4, 0.0));
  gCurl = 0.35 * (1.0 - kf(0.125, 0.17)) + 0.25 * pat + ease(kf(0.57, 0.62)) * (1.0 - ease(kf(0.69, 0.73)));
  gSpread = ease(kf(0.14, 0.2)) * (1.0 - 0.5 * ease(kf(0.57, 0.62)));
  gHS *= mix(0.55, 1.0, ease(kf(0.125, 0.18))) * mix(1.0, 0.55, ease(kf(0.69, 0.75)));
  // which drawing of the hand: it opens as it comes out, gropes, pats, snatches
  // at nothing, brings its fist down, shakes it, goes limp and pulls back
  gHandFrame = mod(floor(uTime * 8.0), 4.0);
  if (gTc < 0.17) gHandFrame = 9.0 - floor(kf(0.125, 0.17) * 3.99);
  if (pat > 0.15) gHandFrame = pat > 0.55 ? 5.0 : 4.0;
  if (gTc >= 0.395 && gTc < 0.44) gHandFrame = 6.0 + floor(min(kf(0.395, 0.42) * 3.99, 3.0));
  if (gTc >= 0.44 && gTc < 0.5) gHandFrame = 10.0;
  if (gTc >= 0.5 && gTc < 0.57) gHandFrame = gTc < 0.515 ? 11.0 : 12.0;
  if (gTc >= 0.57 && gTc < 0.69) gHandFrame = gTc < 0.59 ? 9.0 : 13.0 + mod(floor(uTime * 10.0), 2.0);
  if (gTc >= 0.69) gHandFrame = 15.0 + floor(kf(0.69, 0.75) * 2.99);
  // the drawings that touch the plaza (the pat, the fist coming down and flattened) have the ground on row 205 of the cell
  if (abs(gHandFrame - 5.0) < 0.5 || (gHandFrame > 10.5 && gHandFrame < 12.5)) gW.y = -0.25 + 55.0 * gVP;
  gHit = gW + vec2(gSide * 0.5, 0.0);
  gShadow = ease(kf(0.42, 0.5)) * (1.0 - ease(kf(0.56, 0.62)));

  // the team: every change of action is a cross-fade of joint angles, and each
  // of the three runs the routine a little later than the one before
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    // they are about 76 px wide: the roll call stands 0.4 apart, half way between the bay and the middle of the
    // set so that all three fit. room = how far a hero can go on the hand's side before he leaves the frame
    float off = k == 0 ? 0.0 : k == 1 ? 0.4 : -0.4;
    float start = gXd * 0.5 - 0.02 + off, next = xn * 0.5 - 0.02 + off;
    float room = 0.7 - gXd * gSide;
    float flee = clamp(k == 0 ? gSlamX : k == 1 ? gXd + gSide * min(1.08, room) : gXd - gSide * 0.32, -0.72, 0.72);
    float flee2 = k == 0 ? gXd + gSide * min(0.72, room - 0.08) : flee;
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
    if (k == 0) {
      // the first one lands a flying kick on the fist while it is still shaking
      float fkp = kf(0.6, 0.675);
      if (fkp > 0.001 && fkp < 0.999) {
        fr = F_FKICK + floor(fkp * 7.99);
        face = -gSide;
        x = mix(x, gXd + gSide * 0.5, ease(clamp((fkp - 0.2) / 0.5, 0.0, 1.0)) * (1.0 - ease((fkp - 0.8) / 0.2)));
        hop = 0.2 * smoothstep(0.2, 0.45, fkp) * (1.0 - smoothstep(0.75, 0.95, fkp));
      }
    }
    if (k == 1) {
      // the second one fires an energy bolt at it while it gropes
      float bp = kf(0.335, 0.435);
      if (bp > 0.001 && bp < 0.999) { fr = F_BLAST + floor(bp * 9.99); face = -gSide; }
      float fl = kf(0.385, 0.43);
      gBolt = vec4(mix(x - gSide * 0.2, gHit.x, fl), mix(-0.14, gHit.y, fl), step(0.001, fl) * step(fl, 0.999), -gSide);
      // the slam throws him off his feet; he is up again before the doors shut
      float kd = kf(0.5, 0.56), up = kf(0.6, 0.72);
      if (gTc >= 0.5 && gTc < 0.6) { fr = F_KNOCK + floor(kd * 7.99); face = -gSide; x += gSide * 0.07 * step(1.0, room) * ease(kd); hop = 0.0; }
      if (gTc >= 0.6 && gTc < 0.72) { fr = F_GETUP + floor(up * 9.99); face = -gSide; x += gSide * 0.07 * step(1.0, room); hop = 0.0; }
    }
    if (k == 2) {
      // the third one comes in under the arm with a roundhouse
      float rk = kf(0.6, 0.68);
      if (rk > 0.001 && rk < 0.999) { fr = F_KICK + floor(rk * 7.99); face = sign(gXd + gSide * 0.1 - x + 1e-3); }
      if (gTc > 0.4 && gTc < 0.48) fr = F_PUNCH + floor(kf(0.4, 0.48) * 7.99);
    }
    vec4 hs = vec4(x, hop, face, fr);
    if (k == 0) gS0 = hs; else if (k == 1) gS1 = hs; else gS2 = hs;
  }

  // camera: hand-held jolt on every hit, in whole pixels
  float hit = exp(-max(gImpAge, 0.0) * 7.0) * step(0.0, gImpAge) + 0.5 * exp(-max(gBurstAge, 0.0) * 8.0) * step(0.0, gBurstAge)
            + 0.3 * exp(-max(gShutAge, 0.0) * 9.0) * step(0.0, gShutAge) + 0.15 * gRum + 0.12 * gKick;
  gShake = snapv(hit * 0.02 * vec2(sin(uTime * 61.0), cos(uTime * 47.0)));
  // light: a hard key from upper left, a coloured lamp behind the doors; a charge going off lifts the sprites one flat step
  float flash = (exp(-max(gPoseAge, 0.0) * 5.0) * step(0.0, gPoseAge) + exp(-max(gImpAge, 0.0) * 9.0) * step(0.0, gImpAge)) * clamp(pyro, 0.0, 2.0);
  gL = normalize(vec3(-0.5, 0.55, 0.67));
  gGlow = mix(uColor1, vec3(1.0, 0.6, 0.3), 0.3) * (0.7 + 0.5 * gKick + 0.3 * uBass);
  gSprLight = vec3(1.0, 0.98, 0.95) * (1.0 + 0.35 * flash);

  // the frame is worked out once per virtual pixel. The middle of the screen sits on a
  // pixel boundary at any resolution, so sprite texels never straddle two of them
  vec2 vq = floor(gl_FragCoord.xy / scl);
  float hi = smoothstep(0.5, 1.0, tp);
  // tracking error, only at the high end of the tape: a row slips sideways by a whole pixel
  vq.x += floor(hi * 1.6 * (h11(vq.y + floor(uTime * 30.0) * 3.1) - 0.5) + 0.5);
  vq -= floor(0.5 * uResolution / scl);
  vec3 c0 = render(vq);
  vec3 cl = c0;
  if (hi > 0.0) cl = render(vq - vec2(2.0, 0.0));
  gl_FragColor = vec4(max(tapeLook(c0, cl, gl_FragCoord.xy, tp, hi), 0.0), 1.0);
}

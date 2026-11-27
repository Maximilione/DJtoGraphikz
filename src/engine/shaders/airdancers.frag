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

// Tube Men: a row of inflatable tube dancers on a car lot at night, as pixel
// art. The dancers are sprites (scripts/toku/ingest_tube.py: 17 cells of
// 160 x 160, R = material, G = tone) drawn 1 texel = 1 virtual pixel on a grid
// of about 216 lines; the lot is painted on the same grid in flat tones.
// Nothing is interpolated: every lane picks a drawing from the beat clock and
// holds it, and what moves does so by whole pixels.
//   - silence: limp heaps that now and then heave half up; a little energy and
//     they hang over their blowers; more and they stand;
//   - a beat: snap straight with the arms up (and a hop), then lean or buckle
//     to one side, the other side on the next beat; canon delays each lane;
//   - beats 12-14 of the 16: the whole row bows;
//   - top of the phrase: one tube tears off and flies away, a new one grows;
//   - 32 beats: the floodlight changes tower and colour.
// A pixel reads the two lanes that can reach it (three when the lanes are
// closer than a hanging head is long) and the tube in flight: 4 texels at most.
uniform sampler2D uAtlasTube;

const float F_HEAP = 0.0, F_SAG = 1.0, F_STAND = 2.0, F_BUCKA = 3.0, F_BUCKB = 4.0, F_SCURVE = 5.0, F_BOW = 6.0, F_YELL = 7.0,
            F_STUMP = 8.0, F_FLOPR = 9.0, F_FLOPL = 10.0, F_LEANA = 11.0, F_LEANB = 12.0, F_CORK = 13.0, F_ROCKET = 14.0, F_TUMBLE = 15.0, F_BLOWER = 16.0;
const float BH = 22.0;                   // rows of a cell taken by the blower: the tube hops, the blower stays
const float REACH_L = 59.0, REACH_R = 76.0;   // how far a pose goes left and right of its blower

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }

vec2 gVQ;                                // the virtual pixel being painted
float gBC, gPB, gN, gSp, gX0, gGY, gHW, gTorn, gFly, gFlail, gBlast, gCanon;
vec3 gLamp, gLight;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
// a gradient cut into n flat bands; only the last w of each band is dithered into the next
float bands(float v, float n, float w) { return floor(clamp(v, 0.0, 1.0) * n + bayer2(gVQ) * w) / n; }
// the five tones of a material: shadows lose saturation and drift to violet, the highlight to warm yellow
vec3 ramp(vec3 b, float lv) {
  if (lv > 4.5) return mix(b, vec3(1.0, 0.95, 0.72), 0.5);
  if (lv > 3.5) return b;
  float k = lv < 1.5 ? 0.3 : lv < 2.5 ? 0.52 : 0.76;
  float t = lv < 1.5 ? 0.4 : lv < 2.5 ? 0.22 : 0.08;
  vec3 s = b * k;
  return mix(mix(s, vec3(dot(s, vec3(0.299, 0.587, 0.114))), 0.6 * t), vec3(0.14, 0.08, 0.36) * (0.5 + k), t);
}
// a palette colour as paint: never darker than a fabric under a floodlight
vec3 paint(float i) {
  i = mod(i, 3.0);
  vec3 c = i < 0.5 ? uColor1 : i < 1.5 ? uColor2 : uColor3;
  return mix(c * max(1.0, 0.75 / max(max(c.r, max(c.g, c.b)), 0.05)), vec3(1.0), 0.06);
}

// one texel of a cell: c.x from the left, c.y from the bottom, whole numbers
vec4 cellTex(float f, vec2 c) {
  vec2 px = vec2(mod(f, 6.0) * 160.0 + c.x, floor(f / 6.0) * 160.0 + 159.0 - c.y);
  return texture2D(uAtlasTube, vec2((px.x + 0.5) / 960.0, 1.0 - (px.y + 0.5) / 480.0));
}
vec3 dress(vec4 t, vec3 fab) {
  float mat = floor(t.r * 255.0 / 40.0 + 0.5), lv = floor(t.g * 255.0 / 50.0 + 0.5);
  if (mat > 4.5) return vec3(0.03, 0.025, 0.07);
  vec3 c = mat < 1.5 ? ramp(fab, lv)
         : mat < 2.5 ? vec3(0.97, 0.97, 0.93)
         : mat < 3.5 ? (lv < 2.0 ? fab * 0.16 + vec3(0.05, 0.0, 0.04) : vec3(0.88, 0.12, 0.17))
         : (lv < 1.5 ? vec3(0.1, 0.105, 0.15) : lv < 2.5 ? vec3(0.17, 0.18, 0.24) : lv < 3.5 ? vec3(0.25, 0.26, 0.33) : vec3(0.36, 0.37, 0.45));
  return c * gLight;
}

// what lane i shows now: drawing, mirrored or not, hop in pixels (negative = squashed), age of the puff of air (< 0 none)
vec4 lanePose(float i) {
  float bl = gBC - gCanon * i / gN;
  float k = floor(bl), u = bl - k;
  float r1 = h11(i * 7.3 + k * 1.7), r2 = h11(i * 3.1 + floor(bl * 0.25) * 5.3), r3 = h11(i * 5.9 + k * 2.3 + 4.0);
  float eLow = 0.07 + 0.03 * h11(i + 3.0), eUp = 0.2 + 0.08 * h11(i + 9.0);
  if (gFly > 0.5 && abs(i - gTorn) < 0.5 && gPB < 4.0)     // torn off: a bare blower, then a new tube fills
    return gPB < 1.0 ? vec4(F_BLOWER, 0.0, 0.0, gPB * 0.34)
         : gPB < 2.0 ? vec4(F_STUMP, 0.0, gPB < 1.12 ? 1.0 : 0.0, -1.0)
         : gPB < 2.75 ? vec4(F_SAG, 0.0, 0.0, -1.0)
         : gPB < 3.5 ? vec4(F_FLOPR, 0.0, 0.0, -1.0)
         : vec4(F_STAND, 0.0, gPB < 3.62 ? 2.0 : 0.0, -1.0);
  if (uEnergy < eLow) {                                    // silence: a heap, that sometimes heaves half up
    float b4 = mod(bl, 4.0);
    if (r2 < 0.35 && b4 > 1.0 && b4 < 3.0) return vec4(b4 > 1.5 && b4 < 2.5 ? F_FLOPR : F_STUMP, 0.0, 0.0, -1.0);
    return vec4(F_HEAP, 0.0, 0.0, -1.0);
  }
  if (uEnergy < eUp) {                                     // not enough air to stand: it hangs to one side, then the other
    float m = mod(k, 4.0);
    return vec4(m < 0.5 ? F_FLOPR : m < 1.5 ? F_SAG : m < 2.5 ? F_FLOPL : F_SAG, 0.0, u < 0.12 ? 1.0 : 0.0, -1.0);
  }
  if (gPB >= 12.0 && gPB < 14.0)                           // the bow, all together
    return gPB < 12.25 ? vec4(F_SAG, 0.0, 0.0, -1.0)
         : gPB < 13.5 ? vec4(F_BOW, 0.0, gPB >= 13.0 && gPB < 13.12 ? -2.0 : 0.0, -1.0)
         : gPB < 13.75 ? vec4(F_SAG, 0.0, 0.0, -1.0)
         : vec4(F_STAND, 0.0, 2.0, -1.0);
  float side = mod(k, 2.0);
  if (u < 0.2) {                                           // the kick: straight up, arms in the air
    bool hard = gBlast > 1.3 || (gBlast > 0.6 && uBassHit > 0.5);
    return vec4(hard ? F_YELL : F_STAND, 0.0, floor(gBlast * (u < 0.1 ? 3.0 : 1.5) + 0.5), u);
  }
  if (r1 >= gFlail * 0.5 + max(gBlast - 1.0, 0.0) * 0.3)   // upright sway
    return vec4(r3 < 0.5 ? F_LEANA : F_LEANB, side, u > 0.6 ? -1.0 : 0.0, u);
  if (u < 0.5) return vec4(r3 < 0.5 ? F_BUCKA : F_BUCKB, side, 0.0, u);
  return vec4(r3 < gFlail - 1.0 ? F_CORK : F_SCURVE, side, u > 0.75 ? -1.0 : 0.0, u);
}

// a parked car of the lot, side on: x from its tail, y from the ground
vec4 car(vec2 p, float id) {
  if (p.x < 0.0 || p.x > 36.0 || p.y < 0.0 || p.y > 15.0 || h11(id * 3.3) < 0.18) return vec4(0.0);
  if (p.y < 4.0) return abs(p.x - 7.5) < 3.0 || abs(p.x - 28.5) < 3.0 ? vec4(0.02, 0.02, 0.04, 1.0) : vec4(0.0);
  vec3 body = mix(vec3(0.09, 0.1, 0.17), paint(id) * 0.3, 0.5 * step(0.4, h11(id * 1.9)));
  if (p.y < 9.0) return vec4(p.y > 8.0 ? body * 1.5 : p.x > 34.0 && p.y > 6.0 ? vec3(0.9, 0.8, 0.5) : body, 1.0);
  float in0 = 8.0 + (p.y > 13.0 ? 2.0 : 0.0), in1 = 27.0 - (p.y > 12.0 ? 2.0 : 0.0);
  if (p.x < in0 || p.x > in1) return vec4(0.0);
  if (p.y > 14.0) return vec4(mix(body * 1.5, gLamp, 0.35), 1.0);
  return vec4(p.x > in0 + 2.0 && p.x < in1 - 2.0 && abs(p.x - 17.5) > 1.0 ? vec3(0.13, 0.17, 0.27) : body, 1.0);
}

void main() {
  // one grid of virtual pixels for everything: about 216 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 216.0 + 0.5));
  gVQ = floor(gl_FragCoord.xy / scl);
  vec2 half_ = floor(0.5 * uResolution / scl);
  vec2 q = gVQ - half_;                                    // whole numbers, 0 in the middle
  gHW = half_.x;
  gGY = 38.0 - half_.y;                                    // the line the blowers stand on
  gN = clamp(floor(dancers + 0.5), 1.0, 7.0);
  gFlail = clamp(flail, 0.0, 2.0);
  gBlast = clamp(blast, 0.0, 2.0);
  gCanon = clamp(canon, 0.0, 1.0);
  gSp = min(floor((2.0 * gHW - 30.0) / gN), 104.0);
  gX0 = -floor(gN * gSp * 0.5) + floor(gSp * 0.5) - 8.0;   // the first lane; the others every gSp. Heads hang to the right: the row sits a little left
  gBC = uBeatClock;
  gPB = mod(gBC, 16.0);
  float phrase = floor(gBC / 16.0);
  gTorn = min(floor(h11(phrase * 3.7 + 1.0) * gN), gN - 1.0);
  gFly = step(0.14, uEnergy);
  float lampN = floor(gBC / 32.0);
  float sL = mod(lampN, 2.0) < 0.5 ? -1.0 : 1.0;           // which tower is lit
  gLamp = mix(paint(lampN), vec3(1.0, 0.95, 0.85), 0.35);
  gLight = mix(vec3(0.93, 0.93, 1.0), gLamp, 0.14);

  float yy = q.y - (gGY + 10.0);                           // above the far edge of the tarmac
  float xT = gHW - 20.0;                                   // the towers
  float lampY = gGY + 168.0;
  // ---- night sky in flat bands, a few stars ----
  vec3 col = mix(mix(vec3(0.1, 0.07, 0.19), gLamp * 0.22, 0.3), vec3(0.015, 0.02, 0.06), bands(yy / 150.0, 5.0, 0.5));
  if (yy > 40.0 && h21(q) > 0.9965) col = vec3(0.7, 0.75, 0.9);
  // ---- the light of the lit tower through the damp air: a wedge, dithered ----
  {
    float dy = lampY - q.y, in_ = (q.x - sL * xT) * -sL;
    if (dy > 0.0 && yy > 0.0 && in_ > 0.3 * dy && in_ < 1.9 * dy) {
      float b = bayer2(gVQ);
      if (b < (in_ > 0.7 * dy && in_ < 1.3 * dy ? 0.45 : 0.2)) col = mix(col, gLamp, 0.2);
    }
  }
  // ---- the far roofline ----
  {
    float X = q.x + 3000.0, id = floor(X / 28.0), lx = X - id * 28.0;
    float hh = 12.0 + floor(26.0 * h11(id * 1.7));
    if (yy >= 0.0 && yy < hh && lx > 0.5) {
      col = yy > hh - 1.5 ? vec3(0.08, 0.085, 0.16) : vec3(0.04, 0.045, 0.095);
      vec2 wc = vec2(floor(lx / 6.0), floor(yy / 8.0)), wf = vec2(mod(lx, 6.0), mod(yy, 8.0));
      if (wf.x > 1.5 && wf.x < 4.5 && wf.y > 2.5 && wf.y < 6.5 && yy < hh - 3.0 && lx < 24.0 && h21(wc + id * 7.0) > 0.8) col = vec3(0.42, 0.34, 0.2);
    }
  }
  // ---- the string of pennants between the towers ----
  {
    float sag = 1.0 - (q.x / xT) * (q.x / xT);
    if (abs(q.x) < xT) {
      if (q.y == lampY - 3.0 - floor(8.0 * sag)) col = vec3(0.3, 0.3, 0.38);
      float id = floor((q.x + 7.0) / 14.0), lx = q.x - id * 14.0;
      float cs = 1.0 - (id * 14.0 / xT) * (id * 14.0 / xT);
      float dy = lampY - 3.0 - floor(8.0 * cs) - q.y;
      // the bass flutters them: the tip leans one pixel, held
      lx -= dy > 3.5 ? mod(floor(uBassTime * 3.0 + gBC) + id, 2.0) * 2.0 - 1.0 : 0.0;
      if (dy >= 1.0 && dy <= 8.0 && abs(lx) <= 4.0 - dy * 0.5) col = paint(id) * (lx < 0.0 ? 0.62 : 0.8);
    }
  }
  // ---- the two floodlight towers ----
  for (int s = 0; s < 2; s++) {
    float sd = s == 0 ? -1.0 : 1.0;
    vec2 e = vec2(q.x - sd * xT, q.y - lampY);
    if (yy >= 0.0 && e.y < 0.0 && (abs(e.x) < 1.5 || (abs(e.x) < 3.5 && mod(yy, 12.0) < 1.0))) col = vec3(0.1, 0.105, 0.17);
    if (abs(e.x) < 10.0 && e.y >= 0.0 && e.y < 8.0) {
      bool lit = sd == sL;
      bool face = abs(e.x) < 8.5 && e.y >= 1.0 && e.y < 7.0 && mod(e.x + 8.0, 6.0) >= 1.0;
      col = !face ? vec3(0.08, 0.085, 0.14) : lit ? mix(gLamp, vec3(1.0), e.y < 5.0 ? 0.75 : 0.45) : vec3(0.17, 0.18, 0.25);
    }
  }
  // ---- the cars at the back of the lot ----
  if (yy >= 0.0 && yy < 16.0) {
    float X = q.x + 5000.0, id = floor(X / 46.0);
    vec4 c = car(vec2(X - id * 46.0 - 5.0, yy), id);
    col = mix(col, c.rgb, c.a);
  }
  // ---- wet tarmac: a pool of the lamp's colour, the bays, the lamp's streak ----
  float d = -yy;                                           // rows toward the viewer
  vec3 wet = vec3(0.0);
  if (d > 0.0) {
    vec2 e = vec2((q.x - sL * xT * 0.3) / 190.0, (d - 22.0) / 34.0);
    float pool = bands(1.0 - length(e), 3.0, 0.5);
    wet = vec3(0.05, 0.055, 0.09) + gLamp * 0.1 * pool;
    col = wet;
    float xs = q.x / (1.0 + d * 0.012);
    if (d > 5.0 && d < 42.0 && mod(xs - gX0 + gSp * 0.5 + 0.75, gSp) < 1.5 * (1.0 + d * 0.012) && abs(xs) < gN * gSp * 0.5 + 2.0) col = vec3(0.3, 0.3, 0.3) * (0.6 + 0.6 * pool);
    if (d > 4.0 && d < 6.0 && abs(q.x) < gN * gSp * 0.5) col = vec3(0.3, 0.3, 0.3) * (0.6 + 0.6 * pool);
    if (abs(q.x - sL * xT) < 3.0 && mod(d, 3.0) < 2.0) col = mix(col, gLamp, 0.4);
    if (d < 1.5) col *= 0.6;
  }
  // ---- the row: right to left, so a hanging head is in front of the next blower ----
  float cy = q.y - gGY + 1.0;                              // row of the cell, from its bottom
  bool refl = cy < 1.0;                                    // below the feet: the wet ground mirrors them
  float iHi = floor((q.x + REACH_L - gX0) / gSp);
  for (int k = 0; k < 3; k++) {
    if (k == 2 && gSp >= 68.0) break;
    float i = iHi - float(k);
    if (i < 0.0 || i > gN - 0.5) continue;
    float lx = q.x - (gX0 + i * gSp);
    if (lx < -REACH_L - 1.0 || lx > REACH_R + 1.0 || cy > 168.0) continue;
    vec4 st = lanePose(i);
    float ry = refl ? 1.0 - cy : cy;
    // a hop stretches the tube from a row of fabric just above its hem, a squash swallows rows there
    if (!refl && ry > BH + 4.0) ry = st.z > 0.0 ? max(ry - st.z, BH + 4.0) : ry - st.z;
    if (refl) lx += mod(ry, 4.0) < 2.0 ? 0.0 : 1.0;
    float cx = st.y > 0.5 ? 79.0 - lx : lx + 80.0;
    if (cx >= 0.0 && cx < 160.0 && ry >= 0.0 && ry < 160.0 && (!refl || mod(ry, 2.0) < 1.0)) {
      vec4 t = cellTex(st.x, vec2(cx, ry));
      if (t.a > 0.5) col = refl ? mix(wet, dress(t, paint(i)), 0.45) : dress(t, paint(i));
    }
    // the air the kick pushes out of the blower, both sides
    if (st.w >= 0.0 && st.w < 0.34 && gBlast > 0.0 && !refl) {
      float pr = floor((3.0 + 22.0 * st.w) * (0.4 + 0.3 * gBlast) * (0.7 + 0.3 * uBassHit));
      vec2 e = vec2(abs(q.x - (gX0 + i * gSp)) - 17.0 - floor(st.w * 40.0), cy - 7.0 - floor(st.w * 14.0));
      if (dot(e, e) < pr * pr && (st.w < 0.17 || bayer2(gVQ) < 0.45)) col = e.y - e.x > 0.0 ? vec3(0.62, 0.64, 0.74) : vec3(0.4, 0.42, 0.54);
    }
  }
  // ---- the one that tore off: the rocket, then tumbling a quarter turn at a time ----
  if (gFly > 0.5 && gPB < 4.0) {
    float cL = gX0 + gTorn * gSp;
    float dir = cL > 0.0 ? -1.0 : 1.0;
    float t = gPB * 0.25;
    // the open end of the rocket leaves from the blower
    vec2 pos = floor(vec2(cL + dir * (40.0 + (gHW + 50.0 + abs(cL)) * t * (0.4 + 0.6 * t)), gGY + 84.0 + 42.0 * sin(t * 2.6)));
    vec2 c = q - pos + 80.0;
    if (c.x >= 0.0 && c.x < 160.0 && c.y >= 0.0 && c.y < 160.0) {
      float f = F_ROCKET;
      if (gPB >= 1.5) {
        f = F_TUMBLE;
        float r = mod(floor((gPB - 1.5) * 2.0), 4.0);
        c = r < 0.5 ? c : r < 1.5 ? vec2(c.y, 159.0 - c.x) : r < 2.5 ? 159.0 - c : vec2(159.0 - c.y, c.x);
      }
      if (dir < 0.0) c.x = 159.0 - c.x;
      vec4 tx = cellTex(f, c);
      if (tx.a > 0.5) col = dress(tx, paint(gTorn));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}

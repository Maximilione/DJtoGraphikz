precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uHighTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float strobe;
uniform float fixtures;
uniform float spin;

// Truss: the lighting rig of a big hall, seen from the floor while the camera
// pushes slowly under it. A 52 cm box truss (four chords, zigzag lacing on
// every face, a frame where the 3 m sections are pinned) crosses the hall
// every 8 m. Each one carries twelve moving heads on clamps, four 2x2
// blinders on the audience side and an LED batten under the front chord.
//
// The heads play a cue list the way a lighting desk does: six looks of 16
// beats (wide fan, wave, focus through one point, mirrored ballyhoo, into the
// crowd, tunnel), each a set of amplitudes for the same pan/tilt formula, so a
// change of look is a two-beat move of every head and never a cut. Left and
// right halves of a truss are mirrored, rows alternate.
//
// Nothing here is marched except the moving heads. A beam is a thin cone: its
// glow along the view ray has a closed form at the point where the two lines
// pass closest (gaussian across, 1/width along, 1/sin of the angle between
// them), which also gives the blow-out when a head looks straight into the
// lens. The same form, on the ray mirrored in the floor, is the reflection in
// the polished concrete. The truss is closed form too (chords are cylinders,
// lacing and frames are lines on its four faces), with the coverage of a
// pixel-wide cone so tubes two pixels wide do not crawl. Only the heads are
// sphere traced, inside the thin slab they hang in.
//
// Strobe safety: blinders and the LED flash are local sources with a bounded
// bloom, never a full-frame white; `strobe` scales only their intensity.
//
// Motion only reads accumulated clocks times constants (uBeatClock, uTime,
// uHighTime). `spin` and the audio scale amplitudes and brightness, never a
// clock rate, so an audio mapping on any param cannot make the rig jump.
// `fixtures` lights heads that are already hanging there, in an order that
// stays spread across the truss: the rig itself never moves or pops.

const float PITCH = 8.0;            // metres between trusses
const float NROW = 48.0;            // rows before the row number wraps (even, multiple of 6)
const float TY = 7.8;               // truss centre line
const float TH = 0.26;              // half the chord spacing
const float FY = TY - TH - 0.50;    // tilt pivot of the heads
const float SP = 1.5;               // head spacing
const float XT = 9.5;               // half length of a truss
const float W0 = 0.075;             // beam radius at the lens
const float PHI = 2.4;              // phase a wave gains across half a truss
// (cos, sin) of ua = (m + 0.5) / 6 * PHI for the 6 head positions m = 0..5
const vec2 CSU[6] = vec2[6](vec2(0.9800666, 0.1986693), vec2(0.8253356, 0.5646425), vec2(0.5403023, 0.8414710), vec2(0.1699671, 0.9854497), vec2(-0.2272021, 0.9738476), vec2(-0.5885011, 0.8084964));
const float FOC = 1.05;
const vec3 COLD = vec3(0.78, 0.90, 1.0);
const vec3 WARM = vec3(1.0, 0.60, 0.28);
const vec3 LK = vec3(0.1508, -0.5528, -0.8195);   // where the light on the metal comes from: the floor and the haze ahead
const float FLARE_R = 0.14;      // screen radius of a flare, in frame heights

// the look being played (slopes are tan of the angle off the vertical)
float gFan, gWaveS, gWaveP, gCirc, gSat, gSelRow, gSelU;
float gRockA, gRockL, gTilt, gS1, gS1b;
vec2 gSC2, gChSC;
float gLit, gKW, gBright, gChase, gChasePos, gGobo, gGoboT;
// the row being evaluated
float rZ, rK, rPar, rSin, rCos, rB, rFade;
// the view ray against that row (and its mirror image in the floor): everything
// a beam needs that its x does not change, and what this pixel can see of the row
vec3 gMr, gMr2;
vec2 gW, gW2;
float gDr, gDr2, gL2r;
bool rowVis, rowRefl, rowPool, rowFlare;
// the pixel
vec3 gRo, gRd, gCamR, gCamU, gCamF, gGlow, gPool, gFp;
vec2 gUv;
vec3 gRd2, gKey, gWashL, gBack, gHalf, gMet;
float gTHit, gCov, gTF, gRefl, gCull, gPix, gBl, gFlash, gMetW, gRowCov, gRowT;
bool gFloor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// value noise, periodic in y every `per` cells
float vnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, per), y1 = mod(i.y + 1.0, per);
  return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
             mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x), f.y);
}

float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// mv1 = fan, mirrored wave, travelling wave, tilt
// mv2 = rock (rows alternate), rock (all rows together), circle
// cl  = saturation, colour by row, colour by position on the truss
void look(float l, out vec4 mv1, out vec3 mv2, out vec3 cl) {
  if (l < 0.5)      { mv1 = vec4( 1.05, 0.0, 0.0, -0.10); mv2 = vec3(0.55, 0.0, 0.0); cl = vec3(0.30, 1.0, 0.0); } // wide fan, sheets crossing
  else if (l < 1.5) { mv1 = vec4( 0.12, 0.0, 0.55, 0.15); mv2 = vec3(0.0, 0.0, 0.35); cl = vec3(0.90, 1.0, 0.0); } // wave across the rig
  else if (l < 2.5) { mv1 = vec4(-1.50, 0.0, 0.0, 0.0);   mv2 = vec3(0.0, 0.40, 0.0); cl = vec3(0.36, 0.0, 1.0); } // focus: every beam through one point
  else if (l < 3.5) { mv1 = vec4( 0.35, 0.65, 0.0, 0.20); mv2 = vec3(0.0, 0.0, 0.55); cl = vec3(0.90, 0.0, 1.0); } // mirrored ballyhoo
  else if (l < 4.5) { mv1 = vec4( 0.55, 0.0, 0.0, -1.10); mv2 = vec3(0.0, 0.30, 0.0); cl = vec3(0.26, 1.0, 0.0); } // into the crowd
  else              { mv1 = vec4( 0.28, 0.0, 0.0, 1.40);  mv2 = vec3(0.25, 0.0, 0.0); cl = vec3(0.85, 1.0, 0.0); } // tunnel to the vanishing point
}

// the order heads light up as `fixtures` grows: spread over the truss at any count
float rankOf(float m) {
  return m < 0.5 ? 1.0 : m < 1.5 ? 4.0 : m < 2.5 ? 0.0 : m < 3.5 ? 5.0 : m < 4.5 ? 2.0 : 3.0;
}

void setRow(float j, float k0, float f) {
  rZ = (j - f) * PITCH;
  rK = mod(k0 + j, NROW);
  rPar = mod(rK, 2.0);
  float th = rK * 1.0471976;
  vec2 c = vec2(cos(th), sin(th));
  rSin = gSC2.x * c.x + gSC2.y * c.y;
  rCos = gSC2.y * c.x - gSC2.x * c.y;
  rB = gTilt + gRockA * (1.0 - 2.0 * rPar) * gS1 + gRockL * gS1b;
  // the row behind the camera and the furthest one fade, so none ever pops
  rFade = j < 0.5 ? smoothstep(1.0, 0.0, f) : j > 3.5 ? smoothstep(0.0, 1.0, f) : 1.0;
}

// slopes of the two mirrored heads m = 0..5 (centre out) of the current row.
// csu = cos/sin of the phase a wave has there. xy = right head, zw = left.
vec4 pairSlopes(float m, vec2 csu) {
  float u = (m + 0.5) / 6.0;
  float aS = gFan * u + gWaveS * (rSin * csu.x - rCos * csu.y);    // mirrored: fan and ballyhoo
  float pA = gWaveP * rSin * csu.x, pB = gWaveP * rCos * csu.y;    // travelling wave, not mirrored
  float bz = rB + gCirc * (rCos * csu.x + rSin * csu.y);
  return vec4(aS + pA + pB, bz, pA - pB - aS, bz);
}

// dimmer of a head, cx = cos of its place in the chase
float dimmer(float cx) {
  float ch = 0.5 + 0.5 * cx;
  return rFade * gBright * mix(1.0, 0.12 + 1.5 * ch * ch, gChase);
}

vec3 headCol(float m) {
  return mix(COLD, mix(uColor1, uColor2, clamp(gSelRow * rPar + gSelU * step(2.5, m), 0.0, 1.0)), gSat);
}

// ---------------------------------------------------------------- metal

// One piece of metal in front of this pixel: coverage c, depth t, shade. The
// pieces of a row are averaged by coverage, rows are composited front to back.
void metal(float c, float t, vec3 sh) {
  gMet += sh * c;
  gMetW += c;
  gRowCov = 1.0 - (1.0 - gRowCov) * (1.0 - c);
  if (c > 0.15) gRowT = min(gRowT, t);
}

vec3 shadeMetal(vec3 n, float alb, float spec, float rimk) {
  float dk = max(dot(n, LK), 0.0), du = max(-n.y, 0.0);
  float rim = 1.0 - abs(dot(n, gRd)); rim *= rim * rim;
  float sp = max(dot(n, gHalf), 0.0); sp *= sp; sp *= sp; sp *= sp; sp *= sp; sp *= sp;
  return alb * (gKey * dk + gWashL * du + 0.03) + gKey * (sp * spec) + gBack * (rim * rimk);
}

// The truss of the current row, in closed form, for a ray o + t d in row space
// (origin on the truss centre line). Chords are cylinders; the lacing and the
// frames where sections are pinned are lines on the four faces, each met where
// the ray crosses that face. Every piece gets the coverage of a pixel-wide
// cone, so tubes one pixel thick neither crawl nor vanish.
void trussRow(vec3 o, vec3 d) {
  float iL = 1.0 / dot(d.yz, d.yz);
  // the four chords, and the LED batten under the front one
  for (int i = 0; i < 5; i++) {
    vec2 c = i == 4 ? vec2(-TH - 0.075, -TH) : vec2(i < 2 ? -TH : TH, (i == 0 || i == 2) ? -TH : TH);
    float r = i == 4 ? 0.03 : 0.027;
    vec2 o2 = o.yz - c;
    float b = dot(o2, d.yz);
    float tca = -b * iL;                                 // where the ray passes closest to the axis
    float q = dot(o2, o2) - b * b * iL;                  // and how close, squared
    float cv = clamp(0.5 + (r - sqrt(max(q, 0.0))) / (tca * gPix), 0.0, 1.0);
    float x = o.x + d.x * tca;
    if (cv <= 0.0 || tca <= 0.0 || abs(x) > (i == 4 ? XT - 0.3 : XT)) continue;
    float th = tca - sqrt(max(r * r - q, 0.0) * iL);
    if (i == 4) {
      float cell = x * 4.0;
      float px = smoothstep(0.34, 0.26, abs(fract(cell) - 0.5));
      float tw = step(0.93, hash21(vec2(floor(cell), rK + mod(floor(uHighTime * 8.0 + uTime * 1.5), 512.0))));
      metal(cv, th, (mix(uColor2, uColor1, rPar) * (0.22 + 0.5 * uHigh) + COLD * (tw * (0.8 + 3.0 * uHighHit) + 10.0 * gFlash)) * px + 0.01);
    } else {
      metal(cv, th, shadeMetal(vec3(0.0, normalize(o2 + d.yz * th)), 0.6, 1.5, 1.0));
    }
  }
  // lacing and end frames on the faces z = -TH, +TH, then y = -TH, +TH
  for (int i = 0; i < 4; i++) {
    bool zf = i < 2;
    float sg = (i == 0 || i == 2) ? -TH : TH;
    float dc = zf ? d.z : d.y;                           // across the face
    float du = zf ? d.y : d.z;                           // along it, across the truss
    float t = (sg - (zf ? o.z : o.y)) / dc;
    float x = o.x + d.x * t, u = (zf ? o.y : o.z) + du * t;
    if (t <= 0.0 || abs(u) > TH + 0.02 || abs(x) > XT) continue;
    float ipr = 1.0 / (t * gPix);
    // the zigzag: one zig per metre, 46 degrees off the chords
    float fx = fract(x);
    float su = (fx < 0.5) == zf ? -1.0 : 1.0;            // this stroke runs down or up
    float delta = abs(u + su * TH * (abs(fx - 0.5) * 4.0 - 1.0) * (fx < 0.5 ? 1.0 : -1.0)) * 0.69;
    // from distance in the face to distance from the ray, which is what the eye sees
    float dn = 0.69 * du - su * 0.72 * d.x;
    float cv = clamp(0.5 + (0.013 - delta * abs(dc) * inversesqrt(dn * dn + dc * dc)) * ipr, 0.0, 1.0);
    if (cv > 0.0) {
      vec3 ax = zf ? vec3(0.69, su * 0.72, 0.0) : vec3(0.69, 0.0, su * 0.72);
      metal(cv, t, shadeMetal(normalize(ax * dot(d, ax) - d), 0.6, 1.5, 1.0));
    }
    float xs = abs(x - 3.0 * floor(x / 3.0 + 0.5));
    cv = clamp(0.5 + (0.018 - xs * abs(dc) * inversesqrt(d.x * d.x + dc * dc)) * ipr, 0.0, 1.0);
    if (cv > 0.0) {
      vec3 ax = zf ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      metal(cv, t, shadeMetal(normalize(ax * dot(d, ax) - d), 0.6, 1.5, 1.0));
    }
  }
}

// The four 2x2 blinders on the audience face: a plate with four lamps, and
// the underside of the housing
void blinderRow(vec3 o, vec3 d) {
  float t = (-TH - 0.165 - o.z) / d.z;
  vec2 q = vec2(abs(abs(o.x + d.x * t) - 4.5) - 1.5, o.y + d.y * t);
  float e = length(max(abs(q) - 0.17, 0.0)) - 0.03;
  float cv = clamp(0.5 - e / (t * gPix), 0.0, 1.0);
  if (cv > 0.0 && t > 0.0) {
    float lamp = smoothstep(0.08, 0.06, length(abs(q) - 0.095));
    metal(cv, t, mix(shadeMetal(vec3(0.0, 0.0, -1.0), 0.03, 0.3, 0.2), WARM * (0.06 + 9.0 * gBl), lamp));
  }
  t = (-0.2 - o.y) / d.y;
  q = vec2(abs(abs(o.x + d.x * t) - 4.5) - 1.5, o.z + d.z * t + TH + 0.105);
  e = max(abs(q.x) - 0.2, abs(q.y) - 0.06);
  cv = clamp(0.5 - e / (t * gPix), 0.0, 1.0);
  if (cv > 0.0 && t > 0.0) metal(cv, t, shadeMetal(vec3(0.0, -1.0, 0.0), 0.03, 0.3, 0.2));
}

// clamp, base, yoke and head of the nearest hanging position
float sdFix(vec3 q, out float part) {
  part = 1.0;
  float xc = (clamp(floor(q.x / SP), -6.0, 5.0) + 0.5) * SP;
  vec3 h = vec3(q.x - xc, q.y + TH + 0.50, q.z);         // from the tilt pivot
  if (abs(h.x) > 0.5) return abs(h.x) - 0.38;
  float m = floor(abs(xc) / SP);
  vec4 sl = pairSlopes(m, CSU[int(m)]);
  vec2 ab = xc < 0.0 ? sl.zw : sl.xy;
  vec3 D = normalize(vec3(ab.x, -1.0, ab.y));
  float d = sdBox(vec3(h.x, h.y - 0.43, h.z), vec3(0.025, 0.07, TH + 0.03));          // hanger across the chords
  d = min(d, max(length(vec2(q.y + TH, abs(q.z) - TH)) - 0.047, abs(h.x) - 0.04));    // half couplers
  d = min(d, sdBox(vec3(h.x, h.y - 0.30, h.z), vec3(0.17, 0.06, 0.15)) - 0.012);      // base
  vec2 e = normalize(vec2(-D.z, D.x) + vec2(1e-3, 0.0));                              // tilt axis
  vec3 ya = vec3(abs(h.x * e.x + h.z * e.y) - 0.165, h.y - clamp(h.y, 0.0, 0.25), (h.x * e.y - h.z * e.x) * 0.55);
  d = min(d, length(ya) - 0.028);                                                     // yoke arms
  float al = dot(h, D);
  float rad = length(h - al * D);
  vec2 hc = vec2(rad - 0.105, abs(al - 0.03) - 0.165);
  float dh = length(max(hc, 0.0)) + min(max(hc.x, hc.y), 0.0) - 0.015;                // head
  if (dh < d) { d = dh; if (al > 0.185 && rad < 0.10) part = 2.0; }
  return d;
}

// ---------------------------------------------------------------- light

// Glow of one beam along one ray, in closed form. U = (a, -1, b) runs down the
// beam, w0 is the ray origin seen from the pivot; Mr = w0 x rd, Dr = rd . w0
// and W = w0.yz are the row's part of them. Everything up to the first test is
// unnormalised and sqrt-free: most beams are nowhere near most pixels.
float vol(float x, vec2 ab, float n2, vec3 rd, vec3 Mr, vec2 W, float Dr, float tMin, float tFade, float tHit, float seed) {
  float bu = ab.x * rd.x - rd.y + ab.y * rd.z;           // U . rd
  float sdu = ab.x * Mr.x - (Mr.y + x * rd.z) + ab.y * (Mr.z - x * rd.y);   // U . (w0 x rd)
  float Cn = max(n2 - bu * bu, 1e-4 * n2);               // |U|^2 sin^2 of the angle between ray and beam
  if (sdu * sdu > gCull * Cn) return 0.0;                // the two lines never come within a beam width
  float inv = inversesqrt(n2);
  float w0x = gRo.x - x;
  float dd = rd.x * w0x + Dr;
  float bb = bu * inv, C = Cn * inv * inv;
  float sS = ((ab.x * w0x - W.x + ab.y * W.y) * inv - bb * dd) / C;   // along the beam, where the ray passes closest
  float sc = clamp(sS, 0.2, FY / inv);                   // from the lens to the floor
  float ds = sc - sS;
  float iw = 1.0 / (W0 + gKW * sc);
  float x2 = (sdu * sdu / Cn + C * ds * ds) * iw * iw;   // distance from the axis in beam radii, squared
  float tc = sc * bb - dd;                               // depth of that point along the ray
  if (x2 > 16.0 || tc < tMin) return 0.0;
  float rs = inversesqrt(C + 0.0015);                    // 1 / sin: a beam seen end-on blows out
  float prof = exp(-x2) + 0.07 * (1.0 / (1.0 + x2) - 0.0588);
  // a prism in the beam: streaks along it that turn with the hats
  float tex = 1.0 + gGobo * (abs(fract(sdu * inv * rs * iw * 0.8 + seed + gGoboT) - 0.5) * 4.0 - 1.0);
  // haze is never even: slow clumps drift down the beam
  tex *= 0.78 + 0.44 * abs(fract(sc * 0.25 + tc * 0.09 + seed * 7.0 - uTime * 0.11) - 0.5);
  float att = 1.0 / (1.0 + 0.025 * sc + 0.015 * tc);
  return W0 * iw * prof * rs * att * att * tex * (tc < tHit ? 1.0 : 1.0 - gCov) * smoothstep(tMin, tMin + tFade, tc);
}

// one beam: glow in the haze, its reflection and its pool on the floor, and
// the flare when it is aimed at the camera
void beam(float x, vec2 ab, vec3 col, float I, float seed, bool dir, bool refl, bool pool, bool flare) {
  float n2 = 1.0 + dot(ab, ab);
  float g = 0.0;
  if (dir) g = vol(x, ab, n2, gRd, gMr, gW, gDr, 3.0, 6.0, gTHit, seed);
  if (refl) g += gRefl * vol(x, ab, n2, gRd2, gMr2, gW2, gDr2, gTF, 1.0, 1e9, seed);
  gGlow += col * (I * g);
  if (pool) {
    vec3 fp = vec3(gFp.x - x, -FY, gFp.z - rZ);
    float alu = ab.x * fp.x + FY + ab.y * fp.z;          // U . fp
    float r2 = dot(fp, fp) - alu * alu / n2;             // from the floor point to the beam axis, squared
    if (r2 < 4.0) {
      float inv = inversesqrt(n2);
      float we = 1.0 / (W0 + gKW * FY / inv);
      float xf = r2 * we * we;
      if (xf < 9.0) gPool += col * (I * W0 * W0 * we * we * inv * exp(-xf));
    }
  }
  if (flare) {
    float w0x = gRo.x - x;
    float eu = ab.x * w0x - gW.x + ab.y * gW.y;          // U . w0
    float l2 = w0x * w0x + gL2r;
    if (eu > 0.0 && eu * eu > 0.3025 * n2 * l2) {        // aimed within 57 degrees of the camera
      float fl = (eu * inversesqrt(n2 * l2) - 0.55) / 0.45;
      fl *= fl; fl *= fl;
      vec3 w0 = vec3(w0x, gW);
      float vf = dot(w0, gCamF);
      vec2 dl = gUv - vec2(dot(w0, gCamR), dot(w0, gCamU)) * (FOC / vf);
      float vis = -vf < gTHit + 0.6 ? 1.0 : 1.0 - gCov;
      // glare that ends at FLARE_R and an anamorphic streak level with the lens:
      // both are zero where the caller stops asking for them
      gGlow += col * (I * fl * vis / (1.0 + 0.03 * sqrt(l2))
                      * (max(0.0003 / (dot(dl, dl) + 0.00005) - 0.0003 / (FLARE_R * FLARE_R + 0.00005), 0.0)
                         + 0.2 * exp(-dl.y * dl.y * 9000.0) * smoothstep(0.03, 0.02, abs(dl.y)) / (1.0 + dl.x * dl.x * 60.0)));
    }
  }
}

// Haze lit by the lights along a truss: the ray integral of a soft tube round
// the batten. Returns it for a wide radius (wash) and a tight one (the LEDs).
vec2 lineGlow(float roy, vec3 rd, float z, float tHit) {
  vec2 c = vec2(TY - TH - 0.08 - roy, z);
  float iL = 1.0 / dot(rd.yz, rd.yz);
  float tl = dot(c, rd.yz) * iL;
  if (tl < 0.0) return vec2(0.0);
  float cr = c.x * rd.z - c.y * rd.y;
  float d2 = cr * cr * iL;
  float xa = abs(gRo.x + tl * rd.x);
  float k = sqrt(iL) / (1.0 + 0.03 * tl) * (tl < tHit ? 1.0 : 1.0 - gCov);
  return vec2(2.6 / (d2 + 2.6) * smoothstep(XT + 1.5, XT - 1.5, xa), 0.026 / (d2 + 0.026) * smoothstep(XT, XT - 0.3, xa)) * k;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float nrg = clamp(uEnergy, 0.0, 1.0);
  float bc = uBeatClock;

  // ---- cue list: this look and the one it is leaving
  float lp = bc / 16.0;
  float li = floor(lp);
  vec4 a0, a1; vec3 b0, b1, c0, c1;
  look(mod(li, 6.0), a1, b1, c1);
  look(mod(li + 5.0, 6.0), a0, b0, c0);
  float bl = smoothstep(0.0, 2.0, (lp - li) * 16.0);
  vec4 A = mix(a0, a1, bl);
  vec3 B = mix(b0, b1, bl), Cl = mix(c0, c1, bl);
  float mv = 1.7 * spin / (0.42 + spin) * (0.85 + 0.3 * nrg);
  gFan = A.x * (1.0 + 0.10 * kick);
  gWaveS = A.y * mv; gWaveP = A.z * mv; gTilt = A.w;
  gRockA = B.x * mv; gRockL = B.y * mv; gCirc = B.z * mv;
  gSat = Cl.x; gSelRow = Cl.y; gSelU = Cl.z;
  float th1 = 6.2831853 * fract(lp);
  gS1 = sin(th1); gS1b = sin(th1 + 0.9);
  float th2 = 6.2831853 * fract(bc / 8.0);
  gSC2 = vec2(sin(th2), cos(th2));
  gLit = 0.5 * clamp(fixtures, 3.0, 12.0) + nrg;
  gKW = mix(0.030, 0.017, nrg) + 0.008 * kick;
  gBright = 2.2 + 2.4 * uBass + 1.0 * nrg + 4.0 * kick;
  gChase = clamp(0.12 + 0.8 * uMid + 0.5 * uMidHit, 0.0, 0.8);
  float q8 = bc * 2.0;
  gChasePos = mod(floor(q8) + smoothstep(0.0, 0.35, fract(q8)), 6.0);
  gChSC = vec2(sin(gChasePos * 1.0471976), cos(gChasePos * 1.0471976));
  gGobo = clamp(0.16 + 0.5 * uHigh + 0.3 * uHighHit, 0.0, 0.8);
  gGoboT = uHighTime * 0.9 + uTime * 0.05;
  float blEnv = strobe * (0.03 + pow(kick, 0.8));
  float flash = strobe * kick * kick * kick;

  // ---- camera: a slow crane push under the rig
  float zc = mod(uTime * 1.1, PITCH * NROW) / PITCH;
  float k0 = floor(zc), f = zc - k0;
  float roll = 0.025 * sin(uTime * 0.043);
  uv = vec2(uv.x + roll * uv.y, uv.y - roll * uv.x);
  gUv = uv;
  gRo = vec3(1.6 * sin(uTime * 0.071), 1.9 + 0.45 * sin(uTime * 0.053 + 1.0), 0.0);
  float pitch = 0.215 + 0.05 * sin(uTime * 0.047 + 0.5);
  float yaw = 0.06 * sin(uTime * 0.061 + 2.0) - gRo.x * 0.03;
  gCamF = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));
  gCamR = vec3(cos(yaw), 0.0, -sin(yaw));
  gCamU = cross(gCamF, gCamR);
  gRd = normalize(uv.x * gCamR + uv.y * gCamU + FOC * gCamF);
  vec3 ro = gRo, rd = gRd;

  // ---- metal, row by row from the nearest: truss and blinders in closed
  // form, the moving heads sphere traced inside the slab they hang in
  gCov = 0.0; gTHit = 1e5;
  gPix = 1.0 / (FOC * uResolution.y);
  gBl = blEnv; gFlash = flash;
  gKey = COLD * (0.12 + 0.40 * uBass + 0.6 * kick);
  gWashL = uColor3 * (0.10 + 0.25 * uBass);
  gBack = WARM * blEnv * 0.6 + gWashL * 0.3;
  gHalf = normalize(LK - rd);
  vec3 metalCol = vec3(0.0);
  float iy = 1.0 / (abs(rd.y) < 1e-4 ? 1e-4 : rd.y);
  float iz = 1.0 / rd.z;
  for (int j = 1; j < 5; j++) {
    float zr = (float(j) - f) * PITCH;
    vec3 o = vec3(ro.x, ro.y - TY, -zr);
    // the slab everything of this row hangs in
    float ta = (-TH - 0.76 - o.y) * iy, tb = (TH + 0.06 - o.y) * iy;
    float tc = (-TH - 0.2 - o.z) * iz, td = (0.37 - o.z) * iz;
    float tn = max(max(min(ta, tb), tc), 0.0), tf = min(max(ta, tb), td);
    if (tn >= tf || abs(o.x + rd.x * tn) > XT + 2.0) continue;
    setRow(float(j), k0, f);
    gMet = vec3(0.0); gMetW = 0.0; gRowCov = 0.0; gRowT = 1e5;
    trussRow(o, rd);
    blinderRow(o, rd);
    // moving heads: under the chords
    tb = (-TH + 0.05 - o.y) * iy;
    tc = (-0.36 - o.z) * iz;
    float t = max(max(min(ta, tb), tc), 0.0);
    tf = min(max(ta, tb), td);
    if (t < tf) {
      float cb = 0.0, tbest = t, part, pbest = 1.0;
      for (int i = 0; i < 20; i++) {
        float d = sdFix(o + rd * t, part);
        float pr = t * gPix;
        float c = 1.0 - d / pr;
        if (c > cb) { cb = c; tbest = t; pbest = part; }
        if (d < 0.3 * pr) break;
        t += max(d * 0.9, 0.4 * pr);
        if (t > tf) break;
      }
      if (cb > 0.0) {
        vec3 hq = o + rd * tbest;
        const vec2 k = vec2(1.0, -1.0);
        float e = max(0.004, tbest * gPix);
        float p1;
        vec3 nr = normalize(k.xyy * sdFix(hq + k.xyy * e, p1) + k.yyx * sdFix(hq + k.yyx * e, p1) +
                            k.yxy * sdFix(hq + k.yxy * e, p1) + k.xxx * sdFix(hq + k.xxx * e, p1));
        vec3 sh = shadeMetal(nr, 0.04, 0.6, 0.2);
        if (pbest > 1.5) {                                // the lens
          float xc = (clamp(floor(hq.x / SP), -6.0, 5.0) + 0.5) * SP;
          float m = floor(abs(xc) / SP);
          vec4 sl = pairSlopes(m, CSU[int(m)]);
          vec2 ab = xc < 0.0 ? sl.zw : sl.xy;
          float face = max(dot(normalize(vec3(ab.x, -1.0, ab.y)), normalize(vec3(ro.x - xc, ro.y - FY, -rZ))), 0.0);
          float f2 = face * face; f2 *= f2;
          float I = dimmer(cos((m - gChasePos) * 1.0471976 + rK * 2.0943951)) * clamp(gLit - rankOf(m), 0.0, 1.0);
          sh = headCol(m) * (I * (0.5 + 5.0 * f2 * f2)) + 0.01;
        }
        metal(min(cb, 1.0), tbest, sh);
      }
    }
    if (gRowCov > 0.0) {
      metalCol += gMet * ((1.0 - gCov) * gRowCov / (gMetW * (1.0 + 0.03 * gRowT)));
      gCov += (1.0 - gCov) * gRowCov;
      gTHit = min(gTHit, gRowT);
    }
    if (gCov > 0.97) break;
  }

  // ---- floor: polished concrete, so the ray also carries on as its mirror image
  gFloor = rd.y < -1e-3;
  gTF = gFloor ? -ro.y / rd.y : 1e5;
  gFp = vec3(ro.x + rd.x * gTF, 0.0, rd.z * gTF);
  gRd2 = vec3(rd.x, -rd.y, rd.z);
  vec2 fw = vec2(gFp.x, gFp.z + zc * PITCH);
  float gloss = gFloor ? 0.55 + 0.45 * vnoise(fw * 0.3125, 120.0) : 0.0;   // scales that divide the 384 m the camera z wraps at
  float fres = 1.0 + rd.y; fres *= fres; fres *= fres;
  gRefl = (0.05 + 0.5 * fres) * gloss / (1.0 + 0.02 * gTF);

  // ---- beams
  gGlow = vec3(0.0); gPool = vec3(0.0);
  vec3 lines = vec3(0.0);
  gCull = W0 + gKW * FY * 2.6;
  gCull *= 16.0 * gCull;
  float sideM = 0.7 * length(rd.yz);
  float bSpan = abs(gCirc);
  // per pixel, not per row: which heads are lit and what the two row colours are
  float lit[6];
  for (int mi = 0; mi < 6; mi++) lit[mi] = clamp(gLit - rankOf(float(mi)), 0.0, 1.0);
  vec3 tA0 = mix(COLD, uColor1, gSat), tA1 = mix(COLD, mix(uColor1, uColor2, clamp(gSelRow, 0.0, 1.0)), gSat);
  vec3 tB0 = mix(COLD, mix(uColor1, uColor2, clamp(gSelU, 0.0, 1.0)), gSat), tB1 = mix(COLD, mix(uColor1, uColor2, clamp(gSelRow + gSelU, 0.0, 1.0)), gSat);
  for (int j = 0; j < 5; j++) {
    setRow(float(j), k0, f);
    if (rFade <= 0.0) continue;
    // In the (z, y) plane every beam of the row is a segment from the pivot to
    // the floor, inside a triangle: a ray that misses it sees none of them
    float bLo = (rB - bSpan) * FY, bHi = (rB + bSpan) * FY;
    float sA = (FY - ro.y) * rd.z - rZ * rd.y, sB = -ro.y * rd.z - rZ * rd.y;
    float s1 = sB - bLo * rd.y, s2 = sB - bHi * rd.y;
    rowVis = min(sA, min(s1, s2)) < sideM && max(sA, max(s1, s2)) > -sideM && rZ + bHi > 2.0;
    rowRefl = false; rowPool = false;
    if (gFloor) {
      sA = (FY + ro.y) * rd.z + rZ * rd.y; sB = ro.y * rd.z + rZ * rd.y;
      s1 = sB + bLo * rd.y; s2 = sB + bHi * rd.y;
      rowRefl = min(sA, min(s1, s2)) < sideM && max(sA, max(s1, s2)) > -sideM;
      rowPool = gFp.z > rZ + min(bLo, 0.0) - 2.0 && gFp.z < rZ + max(bHi, 0.0) + 2.0;
    }
    // flares and blinder bloom only reach the pixels near the row on screen:
    // its pivots project to a straight line, found from its two ends
    vec3 vr = vec3(-ro.x, FY - ro.y, rZ);
    vec3 pc = vec3(dot(vr, gCamR), dot(vr, gCamU), dot(vr, gCamF));
    vec3 pe = vec3(gCamR.x, gCamU.x, gCamF.x) * 8.0;
    vec2 e1 = (pc.xy - pe.xy) * (FOC / (pc.z - pe.z)), e2 = (pc.xy + pe.xy) * (FOC / (pc.z + pe.z));
    float band = j > 0 ? abs(uv.y - mix(e1.y, e2.y, (uv.x - e1.x) / (e2.x - e1.x))) : 9.0;
    rowFlare = band < FLARE_R;
    if (rowVis || rowRefl || rowPool || rowFlare) {
      gW = vec2(ro.y - FY, -rZ);
      gMr = cross(vec3(ro.x, gW), rd);
      gDr = dot(rd.yz, gW);
      gL2r = dot(gW, gW);
      gW2 = vec2(-ro.y - FY, -rZ);
      gMr2 = cross(vec3(ro.x, gW2), gRd2);
      gDr2 = dot(gRd2.yz, gW2);
      vec3 colA = rPar < 0.5 ? tA0 : tA1, colB = rPar < 0.5 ? tB0 : tB1;
      // how far across the truss a flare reaches, in metres, and where this pixel is on it
      float xF = ro.x + rd.x * rZ / rd.z;
      float dF = band < 0.03 ? 99.0 : FLARE_R * rZ / FOC + 0.5;
      for (int mi = 0; mi < 6; mi++) {
        float m = float(mi);
        float litm = lit[mi];
        if (litm <= 0.0) continue;
        float x = (m + 0.5) * SP;
        vec4 sl = pairSlopes(m, CSU[mi]);
        // The two heads share a tilt, so their beams lie in one sheet and the
        // ray meets it at one point: only a beam passing within reach of that
        // point (xc across, h below the pivots) can light this pixel
        float aa = max(abs(sl.x), abs(sl.z));
        float slant = sqrt((1.0 + aa * aa) * (1.0 + sl.y * sl.y));
        bool dR = false, dL = false, rR = false, rL = false, pR = false, pL = false;
        if (rowVis) {
          float den = rd.z + sl.y * rd.y;
          if (den < 0.2) { dR = true; dL = true; }       // grazing the sheet: leave it to vol()
          else {
            float t = (rZ + sl.y * (FY - ro.y)) / den;
            float h = FY - ro.y - t * rd.y;
            float D = 4.6 * (W0 + gKW * slant * (clamp(h, 0.0, FY) + 1.0)) * slant / den;
            float xc = ro.x + t * rd.x;
            if (t > 0.0 && h > -0.5 - D && h < FY + 0.5 + D) { dR = abs(x + sl.x * h - xc) < D; dL = abs(sl.z * h - x - xc) < D; }
          }
        }
        if (rowRefl) {
          float den = rd.z - sl.y * rd.y;
          if (den < 0.2) { rR = true; rL = true; }
          else {
            float t = (rZ + sl.y * (FY + ro.y)) / den;
            float h = FY + ro.y + t * rd.y;
            float D = 4.6 * (W0 + gKW * slant * (clamp(h, 0.0, FY) + 1.0)) * slant / den;
            float xc = ro.x + t * rd.x;
            if (t > gTF - D && h > -0.5 - D && h < FY + 0.5 + D) { rR = abs(x + sl.x * h - xc) < D; rL = abs(sl.z * h - x - xc) < D; }
          }
        }
        if (rowPool && abs(rZ + sl.y * FY - gFp.z) < 2.0) { pR = abs(x + sl.x * FY - gFp.x) < 2.0; pL = abs(sl.z * FY - x - gFp.x) < 2.0; }
        bool fR = rowFlare && abs(x - xF) < dF, fL = rowFlare && abs(x + xF) < dF;
        if (!(dR || dL || rR || rL || pR || pL || fR || fL)) continue;
        float seed = fract(m * 0.37 + rK * 0.61);
        vec3 hc = mi < 3 ? colA : colB;
        float I = dimmer(cos((m - gChasePos) * 1.0471976 + rK * 2.0943951)) * litm;
        beam(x, sl.xy, hc, I, seed, dR, rR, pR, fR);
        beam(-x, sl.zw, hc, I, seed + 0.5, dL, rL, pL, fL);
      }
    }
    // wash light and the LED batten, as haze glowing along the truss
    vec3 washC = mix(uColor3, mix(uColor1, uColor2, rPar), 0.3) * (rFade * (0.10 + 0.12 * uBass + 0.08 * kick));
    vec3 batC = (mix(uColor2, uColor1, rPar) * (0.04 + 0.10 * uHigh) + COLD * 1.0 * flash) * rFade;
    vec2 lg = lineGlow(ro.y, rd, rZ - TH, gTHit);
    if (gFloor) lg += gRefl * lineGlow(-ro.y, gRd2, rZ - TH, 1e9);
    lines += washC * lg.x + batC * lg.y;
    // blinders: bloom that ends at 0.3 of the frame height, and a streak
    if (band < 0.42 && blEnv > 0.08) {
      float fade = blEnv * rFade;
      for (int b = 0; b < 4; b++) {
        float xb = (b < 2 ? 3.0 : 6.0) * (b == 0 || b == 2 ? -1.0 : 1.0);
        vec3 v = vec3(xb - ro.x, TY - ro.y, rZ - TH - 0.18);
        float vf = dot(v, gCamF);
        vec2 dl = uv - vec2(dot(v, gCamR), dot(v, gCamU)) * (FOC / vf);
        float vis = vf < gTHit + 0.6 ? 1.0 : 1.0 - gCov;
        gGlow += WARM * (fade * vis / (1.0 + 0.03 * vf)
                 * (max(0.0012 / (dot(dl, dl) + 0.00008) - 0.0133, 0.0)
                    + 0.5 * exp(-dl.y * dl.y * 7000.0) * smoothstep(0.035, 0.025, abs(dl.y)) / (1.0 + dl.x * dl.x * 40.0)));
      }
    }
  }

  // ---- the hall: haze, far glow, floor
  float el = rd.y / length(rd.xz), az = rd.x / rd.z;
  float smoke = 0.72 + 0.56 * (0.6 * vnoise(vec2(az, el) * 3.0 + vec2(uTime * 0.03, -uTime * 0.012), 1e4)
                             + 0.4 * vnoise(vec2(az, el) * 7.0 - vec2(uTime * 0.021, uTime * 0.017), 1e4));
  vec3 col = uColor3 * (0.012 + 0.02 * uBass) * smoothstep(-0.25, 0.5, el);
  col += mix(uColor3, COLD, 0.25) * (0.05 + 0.22 * uBass + 0.25 * kick) * exp(-el * el * 30.0 - az * az * 5.0);
  if (gFloor) {
    float alb = 0.10 + 0.07 * vnoise(fw * 0.4375, 168.0) + 0.03 * vnoise(fw * 2.25, 864.0);
    col = mix(col * (0.25 + 0.75 * fres), gPool * alb * 60.0 + col * 0.15, 1.0 / (1.0 + 0.05 * gTF));
  }

  col = col * (1.0 - gCov) + metalCol;

  col += gGlow * smoke * 0.9 + lines * smoke;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(gUv, gUv) * 0.7, 0.4, 1.0);
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither: haze gradients band on 8-bit
  gl_FragColor = vec4(col, 1.0);
}

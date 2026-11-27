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

uniform float ranks;
uniform float bite;
uniform float swing;
uniform float giant;

// Dentiere: wind-up chattering teeth on the stage of a toy shop, facing the
// audience. Pink gums, block teeth with one gold tooth, googly eyes on stalks,
// red shoes, the key at the side. A rank of big ones in front, ranks of small
// ones behind, a curtain, two spotlights. On every beat they snap shut, hop,
// land and bounce open; `swing` delays the ranks and the columns so the
// chatter runs through the army. Now and then one turns round for a beat and
// shows its key. Every 16 beats an angry one the size of the stage rises
// behind them with its mouth open and slams it shut on the downbeat: one
// impact frame, loose teeth, dust, and the front rank sees stars.
//
// Pixel art: the whole picture is one grid of virtual pixels (about 216
// lines, a whole number of screen pixels each). The toys are sprites drawn by
// hand for each size (scripts/toku/ingest_teeth.py, sheet 1 texel = 1 virtual
// pixel), animated by choosing a drawing and holding it, moved by whole
// pixels. Flat tones, ordered dither only.
// Cost: a pixel finds its column in each rank by division, so it reads the
// sheet once for the front rank and once for each small rank whose band it is
// in, front to back, and stops at the first one that covers it.

uniform sampler2D uAtlasTeeth;

// the sheet, from ingest_teeth.py --glsl: group = x, y of its first cell from the top left, cell w, h; _AX = the column the toy is centred on
const vec2 SHEET = vec2(512.0, 411.0);
const vec4 BIG = vec4(0.0, 0.0, 61.0, 67.0); const float BIG_AX = 26.0;
const vec4 SMALL = vec4(0.0, 67.0, 36.0, 40.0); const float SMALL_AX = 15.0;
const vec4 GIANT = vec4(108.0, 67.0, 162.0, 152.0); const float GIANT_AX = 69.0;
const vec4 TOOTH = vec4(432.0, 67.0, 19.0, 19.0);
const vec4 PUFF = vec4(0.0, 219.0, 41.0, 24.0); const float PUFF_AX = 20.0;
const vec4 BURST = vec4(41.0, 219.0, 221.0, 192.0); const float BURST_AX = 110.0;
// drawings of the big toy, of the small one
const float F_OPEN = 0.0, F_HALF = 1.0, F_SHUT = 2.0, F_HOP = 3.0, F_LAND = 4.0, F_DIZZY = 5.0, F_BACK = 6.0, F_YELL = 7.0;
const float S_OPEN = 0.0, S_SHUT = 1.0, S_HOP = 2.0;

const float HY = -20.0;                  // where the floor meets the curtain, in virtual pixels from the middle of the frame
const float Y0 = -103.0;                 // the feet of the front rank
const float PITCH = 72.0, SPITCH = 40.0; // column to column, big and small

vec2 gVQ;                                // the virtual pixel being painted
float gBite, gSwing, gN, gAct, gTop;
float gGf, gGy, gGx, gSlam, gFlash;      // the giant: drawing (-1 = away), bottom line, x; beats since the slam (-1 = none)
vec3 cGum, cShoe, cCurt;

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
// the five tones of a material: shadows lose saturation and drift to violet, the highlight to warm yellow
vec3 ramp(vec3 b, float lv) {
  if (lv > 4.5) return mix(b, vec3(1.0, 0.95, 0.72), 0.5);
  if (lv > 3.5) return b;
  float k = lv < 1.5 ? 0.3 : lv < 2.5 ? 0.52 : 0.76;
  float t = lv < 1.5 ? 0.4 : lv < 2.5 ? 0.22 : 0.08;
  vec3 s = b * k;
  return mix(mix(s, vec3(dot(s, vec3(0.299, 0.587, 0.114))), 0.6 * t), vec3(0.14, 0.08, 0.36) * (0.5 + k), t);
}
// a palette colour as paint: never so dark that the toy disappears
vec3 paint(vec3 c) {
  c = mix(c, vec3(1.0), 0.1);
  return c * max(1.0, 0.6 / max(max(c.r, c.g), c.b));
}

// one texel: cell f of a group, c = pixel in the cell from its bottom left. Nothing is read outside the cell
vec4 cel(vec4 g, float f, vec2 c) {
  if (c.x < 0.0 || c.y < 0.0 || c.x >= g.z || c.y >= g.w) return vec4(0.0);
  return texture2D(uAtlasTeeth, vec2(g.x + f * g.z + c.x + 0.5, SHEET.y - (g.y + g.w - c.y) + 0.5) / SHEET);
}
// the sheet is indexed (R = material * 30, G = tone * 50): the toy is dressed here
vec3 dress(vec4 t, vec3 gum, vec3 shoe) {
  float mat = floor(t.r * 8.5 + 0.5), lv = floor(t.g * 5.1 + 0.5);
  if (mat < 1.5) return ramp(gum, lv) * 1.25;
  if (mat < 2.5 || (mat > 4.5 && mat < 5.5)) return ramp(vec3(1.5, 1.5, 1.45), min(lv, 4.0));   // teeth, eyes
  if (mat < 3.5) return ramp(vec3(1.3, 0.85, 0.1), lv);
  if (mat < 4.5) return ramp(shoe, lv) * 1.2;
  if (mat < 6.5) return lv < 2.5 ? vec3(0.1, 0.02, 0.05) * lv : ramp(vec3(1.0, 0.16, 0.2), lv);   // inside of the mouth, tongue
  if (mat < 7.5) return vec3(0.03, 0.02, 0.06);
  return ramp(mix(vec3(1.1, 1.1, 1.2), cCurt, 0.12), min(lv, 4.0));                              // dust
}

// what a toy is doing at its own beat time tb: x = drawing, y = how high off the floor, z = 1 while its dust is up.
// Drawings are chosen and held, heights are whole pixels
vec3 dance(float tb, float id, float big) {
  float u = fract(tb), b = floor(tb);
  float hop = floor(gBite * (big > 0.5 ? 7.0 : 4.0) + 0.5);
  if (gSlam >= 0.0 && gSlam < 1.5) {                       // the slam throws everybody up; the big ones come down seeing stars
    float y = gSlam < 0.12 ? 5.0 : gSlam < 0.3 ? 9.0 : gSlam < 0.42 ? 5.0 : 0.0;
    if (big < 0.5) return vec3(y > 0.0 ? S_HOP : S_SHUT, floor(y * 0.6), 0.0);
    return vec3(y > 0.0 ? F_HOP : F_DIZZY, y > 0.0 ? y : mod(floor(gSlam * 4.0) + id, 2.0), gSlam > 0.42 && gSlam < 0.7 ? 1.0 : 0.0);
  }
  if (gAct < 0.5) {                                       // nobody is playing: mouth half open, a knee bends now and then
    if (big < 0.5) return vec3(mod(b + floor(id * 7.0), 6.0) < 1.0 && u < 0.25 ? S_SHUT : S_OPEN, 0.0, 0.0);
    float turn = h11(id + floor(tb * 0.25) * 3.7) > 0.93 && mod(b, 4.0) > 2.5 ? 1.0 : 0.0;
    return vec3(turn > 0.5 ? F_BACK : mod(b + floor(id * 5.0), 3.0) < 1.0 && u < 0.5 ? F_LAND : F_HALF, 0.0, 0.0);
  }
  float f, y = 0.0, dust = 0.0;
  float sq = 0.07 + 0.04 * gBite;                         // how long it stays squashed
  if (big < 0.5) {
    if (u < sq) f = S_SHUT;
    else if (u < 0.42 && hop > 0.0) { f = S_HOP; y = u < 0.18 || u > 0.34 ? ceil(hop * 0.5) : hop; }
    else f = u < 0.25 ? S_SHUT : S_OPEN;
    if (uBassHit > 0.7 && y < 0.5 && u > 0.5) f = S_SHUT;  // a kick off the grid still shuts them
    return vec3(f, y, 0.0);
  }
  if (u < sq) f = F_SHUT;
  else if (u < 0.42 && hop > 0.0) { f = F_HOP; y = u < 0.18 || u > 0.34 ? ceil(hop * 0.55) : hop; }
  else if (u < 0.56) { f = hop > 0.0 ? F_LAND : F_SHUT; dust = gBite > 0.3 ? 1.0 : 0.0; }
  else if (u < 0.74) { f = mod(b, 4.0) > 2.5 ? F_YELL : F_OPEN; y = u < 0.64 && gBite > 0.7 ? 1.0 : 0.0; dust = u < 0.64 && gBite > 0.3 ? 2.0 : 0.0; }
  else f = F_HALF;
  if (uBassHit > 0.7 && y < 0.5 && u > 0.74) f = F_SHUT;
  // one of them turns round for a beat and shows its key
  if (h11(id + floor(tb * 0.5) * 3.7) > 0.9 && mod(b, 2.0) > 0.5) f = F_BACK;
  return vec3(f, y, dust);
}

// the stage behind everybody
vec3 stage(vec2 p) {
  // two spots, from the top corners to pools on the floor; they follow the bass, a pixel at a time
  float sway = floor(22.0 * sin(uBassTime * 0.7) + 0.5);
  vec2 pa = vec2(-78.0 + sway, -70.0), pb = vec2(78.0 - sway, -70.0);
  if (p.y >= HY) {
    // the curtain: folds in flat tones, one step lighter in the beams
    float fx = mod(p.x + floor(3.0 * sin(p.y * 0.05)) + 240.0, 24.0);
    float lv = fx < 5.0 ? 1.0 : fx < 10.0 ? 2.0 : fx < 16.0 ? 3.0 : fx < 20.0 ? 2.0 : 1.0;
    float t = (gTop + 12.0 - p.y) / (gTop + 12.0 - pa.y);
    float hw = 5.0 + 38.0 * t;
    float da = abs(p.x - mix(-176.0, pa.x, t)), db = abs(p.x - mix(176.0, pb.x, t));
    float beam = min(da, db) - hw;
    if (beam < 0.0 || (beam < 3.0 && bayer2(gVQ) < 0.5)) lv += 1.0;
    vec3 c = ramp(cCurt, lv) * 0.75;
    if (gFlash > 0.5) c = vec3(1.5, 1.45, 1.3);                                  // the impact frame: the wall goes white, once
    if (p.y < HY + 3.0) c = vec3(0.04, 0.03, 0.07);                               // the hem
    // the valance: scallops with a gold fringe
    float sc = gTop - 13.0 - floor(7.0 * abs(sin((p.x + 240.0) * 3.14159 / 48.0)));
    if (p.y > sc) c = p.y < sc + 3.0 ? ramp(vec3(1.3, 0.85, 0.1), mod(p.x, 2.0) < 1.0 ? 4.0 : 3.0) : ramp(cCurt, p.y > gTop - 6.0 ? 2.0 : 3.0);
    return c;
  }
  // the floor: a checkerboard going away to the foot of the curtain
  float d = HY - p.y;
  float z = 84.0 / d;
  vec2 w = vec2(p.x * z, 84.0 * z);
  float chk = mod(floor(w.x / 36.0 + 0.5) + floor(w.y / 44.0), 2.0);
  vec3 base = mix(vec3(0.2, 0.17, 0.27), cCurt * 0.4, 0.3);
  vec3 c = d < 18.0 ? base * 1.25 : chk < 0.5 ? base * 0.8 : base * 1.7 + 0.02;      // too far to draw a tile: one tone
  c *= 1.0 - 0.2 * floor(clamp(1.0 - d / 80.0, 0.0, 1.0) * 3.0 + bayer2(gVQ) * 0.5);       // darker toward the back, three bands
  vec2 ea = (p - pa) / vec2(52.0, 15.0), eb = (p - pb) / vec2(52.0, 15.0);
  float e = min(dot(ea, ea), dot(eb, eb));
  if (e < 1.0 || (e < 1.25 && bayer2(gVQ) < 0.5)) c = c * 1.55 + vec3(0.05, 0.04, 0.02);
  if (gFlash > 0.5) c = c * 1.6 + 0.25;
  return c;
}

// p = whole virtual pixels from the middle of the frame
vec3 render(vec2 p) {
  vec4 t;
  // ---- loose teeth, in front of everything: thrown from the giant's mouth, eight positions to the beat ----
  if (gSlam >= 0.0 && gSlam < 2.25) {
    float tq = floor(gSlam * 8.0) / 8.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float an = 2.55 - fi * 0.65;
      vec2 pos = floor(vec2(gGx + (fi - 1.5) * 16.0, HY + 40.0) + vec2(cos(an) * 1.5, sin(an)) * 92.0 * tq - vec2(0.0, 78.0 * tq * tq));
      vec2 c = p - pos + 9.0;
      if (mod(floor(gSlam * 4.0) + fi, 2.0) > 0.5) c.x = 18.0 - c.x;       // it tumbles: mirrored every other drawing
      t = cel(TOOTH, fi, c);
      if (t.a > 0.5) return dress(t, cGum, cShoe);
    }
  }
  // ---- the front rank ----
  {
    float k = floor((p.x + BIG_AX) / PITCH);
    float id = k + 31.0;
    vec3 st = dance(uBeatClock - gSwing * (k + 3.0) * 0.11, id, 1.0);
    // the dust of its landing, over its shoes: one drawing, then the same a little higher and cut to a checker
    if (st.z > 0.5 && (st.z < 1.5 || bayer2(gVQ) < 0.5)) {
      t = cel(PUFF, 0.0, vec2(p.x - k * PITCH - 1.0 + PUFF_AX, p.y - Y0 + 4.0 - (st.z > 1.5 ? 2.0 : 0.0)));
      if (t.a > 0.5) return dress(t, cGum, cShoe);
    }
    t = cel(BIG, st.x, vec2(p.x - k * PITCH + BIG_AX, p.y - Y0 - st.y));
    bool swap = mod(k, 3.0) > 1.5;
    if (t.a > 0.5) return dress(t, swap ? cShoe : cGum, swap ? cGum : cShoe);
    // and its shadow on the floor, smaller while it is in the air
    vec2 s = vec2(p.x - k * PITCH - 3.0, p.y - Y0 - 1.0) / vec2(st.y > 0.5 ? 16.0 : 22.0, 3.0);
    if (dot(s, s) < 1.0 && mod(gVQ.x + gVQ.y, 2.0) < 1.0) return vec3(0.03, 0.02, 0.06);
  }
  // ---- the small ranks, front to back ----
  for (int i = 1; i < 8; i++) {
    float r = float(i);
    if (r > gN - 0.5) break;
    float yr = floor(mix(-68.0, -26.0, (r - 0.5) / max(gN - 1.0, 1.0)));
    if (p.y < yr || p.y >= yr + SMALL.w + 9.0) continue;
    float xo = mod(r, 2.0) * 20.0 + r * 5.0;
    float k = floor((p.x - xo + SMALL_AX) / SPITCH);
    float id = k + r * 17.0;
    vec3 st = dance(uBeatClock - gSwing * (r * 0.22 + (k + 6.0) * 0.055), id, 0.0);
    t = cel(SMALL, st.x, vec2(p.x - xo - k * SPITCH + SMALL_AX, p.y - yr - st.y));
    if (t.a < 0.5) continue;
    bool swap = mod(k + r, 3.0) > 1.5;
    vec3 c = dress(t, swap ? cShoe : cGum, swap ? cGum : cShoe);
    return mix(c, ramp(cCurt, 1.0), r > 3.5 ? 0.3 : 0.15);  // the far ones sit back in the dark, one flat step
  }
  // ---- the giant, between the ranks and the curtain ----
  if (gGf > -0.5 && p.y >= HY) {
    t = cel(GIANT, gGf, vec2(p.x - gGx + GIANT_AX, p.y - gGy));
    if (t.a > 0.5) return dress(t, cShoe, cGum);
    if (gSlam >= 0.0 && gSlam < 0.75 && (gSlam < 0.5 || bayer2(gVQ) < 0.5)) {   // the burst of the slam behind its head: held, then cut to a checker
      t = cel(BURST, 0.0, p - vec2(gGx, gGy + 58.0) + vec2(BURST_AX, 96.0));
      if (t.a > 0.5) return dress(t, cGum, cShoe);
    }
  }
  return stage(p);
}

void main() {
  // one grid of virtual pixels for everything: about 216 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 216.0 + 0.5));
  gVQ = floor(gl_FragCoord.xy / scl);
  vec2 mid = floor(0.5 * uResolution / scl);
  gTop = uResolution.y / scl - mid.y;
  gBite = clamp(bite, 0.0, 2.0);
  gSwing = clamp(swing, 0.0, 1.0);
  gN = floor(clamp(ranks, 1.0, 8.0) + 0.5);
  gAct = step(0.04, uEnergy + uBass);
  cGum = paint(uColor1);
  cShoe = paint(uColor2);
  cCurt = mix(paint(uColor3), vec3(0.6, 0.1, 0.2), 0.3);

  // the giant: every 16 beats (32, 64 when `giant` is low). It comes up over the last four, half a beat a step,
  // waits with its mouth open, slams on the downbeat and goes back down
  float g = clamp(giant, 0.0, 1.0);
  float per = g >= 0.5 ? 16.0 : g >= 0.25 ? 32.0 : 64.0;
  float pb = mod(uBeatClock, per);
  float G = floor(mix(84.0, 126.0, g));                    // how much of it shows over the floor line
  gGf = -1.0; gSlam = -1.0; gFlash = 0.0; gGx = 0.0; gGy = HY;
  if (g > 0.005 && gAct > 0.5) {
    if (pb >= per - 4.0) {
      float stp = floor((pb - per + 4.0) * 2.0) + 1.0;     // 1..8
      gGf = 0.0;
      gGy = HY - 150.0 + floor(G * min(stp, 6.0) / 6.0);
      if (stp > 6.5) gGx = mod(floor(pb * 4.0), 2.0) * 2.0 - 1.0;   // it trembles before the bite
    } else if (uBeatClock >= per && pb < 3.5) {            // (not at the very start of the clock: it has not risen yet)
      gSlam = pb;
      gFlash = pb < 0.22 ? 1.0 : 0.0;
      gGf = 1.0;
      float sink = pb < 2.0 ? 0.0 : floor((pb - 2.0) * 2.0) + 1.0;   // 1..3
      gGy = HY - 150.0 + floor(G * (1.0 - sink / 3.0)) + (pb < 2.0 ? 24.0 : 0.0) - (pb < 0.25 ? 3.0 : 0.0);
    }
  }
  // the slam shakes the stage: whole pixels, four positions, then still
  vec2 shake = gSlam >= 0.0 && gSlam < 0.5 ? floor((1.0 - gSlam * 2.0) * vec2(3.0, 4.0) * (mod(floor(gSlam * 16.0) + vec2(0.0, 1.0), 2.0) * 2.0 - 1.0) + 0.5) : vec2(0.0);

  vec3 col = render(gVQ - mid + shake);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

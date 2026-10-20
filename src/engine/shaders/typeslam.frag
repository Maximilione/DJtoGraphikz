precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uHighHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float words;
uniform float change;
uniform float gap;
uniform float scheme;

// Type Slam: brutalist poster lettering. A 5x7 block alphabet of our own is
// packed in two ints per glyph (rows 0-3 in .x, 20 bits; rows 4-6 in .y, 15
// bits; row 0 is the top). Everything is stateless: the spring is a closed
// form of the time since the beat, the layout a grid of letter cells, and the
// misregistration is the same mask evaluated three times at shifted positions.

// A B C D E F H I K L M N O P R S U V W Y !
const ivec2 GL[21] = ivec2[21](
  ivec2(1044334, 28539),
  ivec2(520047, 16251),
  ivec2(101502, 30819),
  ivec2(913263, 16251),
  ivec2(494719, 31843),
  ivec2(494719, 3171),
  ivec2(1044347, 28539),
  ivec2(473567, 32206),
  ivec2(245627, 28527),
  ivec2(101475, 31843),
  ivec2(917361, 28539),
  ivec2(1048315, 28541),
  ivec2(913262, 15227),
  ivec2(520047, 3171),
  ivec2(520047, 28519),
  ivec2(461950, 16152),
  ivec2(913275, 15227),
  ivec2(913275, 4571),
  ivec2(913275, 28671),
  ivec2(487291, 14798),
  ivec2(473550, 14350)
);

// 12 words of 4 glyph ids: BASS KICK DROP RAVE / ACID LOUD HARD DEEP / MOVE BODY FREE NOW!
const int WD[48] = int[48](
  1, 0, 15, 15,   8, 7, 2, 8,    3, 14, 12, 13,   14, 0, 17, 4,
  0, 2, 7, 3,     9, 12, 16, 3,  6, 0, 14, 3,     3, 4, 4, 13,
  10, 12, 17, 4,  1, 12, 3, 19,  5, 14, 4, 4,     11, 12, 18, 20
);

float hash11(float x) {
  x = fract(x * 0.1031);
  x *= x + 33.33;
  x *= x + x;
  return fract(x);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

bool bitOn(int g, int c, int r) {
  if (c < 0 || c > 4 || r < 0 || r > 6) return false;
  int w = r < 4 ? GL[g].x : GL[g].y;
  int sh = (r < 4 ? r : r - 4) * 5 + c;
  return ((w >> sh) & 1) == 1;
}

// per-frame state, filled in main()
int gLay; int gSet; int gLetter;
float gTb, gTw, gCh, gWordIdx, gProg, gAmp, gGap, gAsp, gPx;

int wordFor(int line) {
  if (gSet < 3) {
    int w = int(mod(gWordIdx + floor(hash11(float(gSet) + 1.0) * 7.0) + float(line), 4.0));
    return gSet * 4 + w;
  }
  return int(hash11(gWordIdx * 1.7 + float(line) * 3.1) * 11.99);
}

float spring(float t) {
  return 1.0 - exp(-9.0 * t) * cos(22.0 * t);
}

// coverage of line ri's glyphs at row ly of that line. ly may run past the
// 8-row box: a letter mid-slam is clipped by its own bitmap, not by the line.
float glyphCov(int ri, float ly, float mx, float m) {
  if (gLay == 1 && ri == 1) mx -= 2.0;
  int li = int(floor(mx / 6.0));
  bool inWord = gLay == 3 ? li == 0 : (li >= 0 && li < 4);
  if (!inWord) return 0.0;
  int ci = gLay == 3 ? gLetter : li;
  int g = WD[wordFor(ri) * 4 + ci];
  float lx = mx - 6.0 * float(li);

  // spring: even letters fall from above, odd ones rise from below
  float tl = max(gTb - float(li) * 0.06, 0.0);
  float sp = gProg < 1.0 ? 1.0 : spring(tl);
  float dir = (ci & 1) == 1 ? -1.0 : 1.0;
  // travel of 5 rows, not 7: the first bounce then peaks at ~1.5 rows, a punch
  // that still reads as the same word on the two-line poster
  float off = clamp((1.0 - sp) * gAmp * dir * 5.0, -3.0, 3.0);
  float sc = max(1.0 + (sp - 1.0) * 0.4, 0.3);
  float lyy = 3.5 + (ly - 3.5 - off) / sc;

  int c = int(floor(lx));
  int r = int(floor(lyy));
  float fx = fract(lx), fy = fract(lyy);
  bool on = bitOn(g, c, r);
  if (on) {
    // fragment assembly on a word change, modules falling away before the next
    float hm = hash(vec2(float(ci * 8 + c) + float(ri) * 37.0, float(r)) + gWordIdx);
    float thr = max((gTw - (gCh - 0.25)) * 4.0, 0.0);
    on = hm < gProg && hm >= thr;
  }
  if (!on) return 0.0;
  float d = min(min(fx, 1.0 - fx), min(fy, 1.0 - fy)) - gGap * 0.5;
  return clamp(d / (gPx / m) + 1.0, 0.0, 1.0);
}

// returns (coverage, line index)
vec2 mask(vec2 p) {
  p /= 1.0 + 0.05 * uBassHit;
  float m, x0, ytop;
  int nl = 1;
  if (gLay == 0) { m = min(gAsp * 0.92 / 23.0, 0.9 / 7.0); x0 = -11.5 * m; ytop = 3.5 * m; }
  else if (gLay == 1) { m = min(gAsp * 0.9 / 23.0, 0.92 / 15.0); x0 = -11.5 * m; ytop = 7.5 * m; nl = 2; }
  else if (gLay == 2) { m = 0.95 / 31.0; x0 = -11.5 * m; ytop = 15.5 * m; nl = 4; }
  else { m = 0.17; x0 = -2.5 * m + (gTb - 0.5) * 0.4; ytop = 3.5 * m; }

  vec2 mq = vec2((p.x - x0) / m, (ytop - p.y) / m);
  // a single line has no box at all: the whole frame belongs to it, so the
  // slam never cuts a letter at the top or bottom of its cell
  float rif = nl == 1 ? 0.0 : floor(mq.y / 8.0);
  int ri = int(rif);
  if (ri < 0 || ri >= nl) return vec2(0.0, rif);
  float ly = mq.y - rif * 8.0;

  float cov = glyphCov(ri, ly, mq.x, m);
  // two-line poster: a letter mid-slam crosses the gap into the next line's
  // box, so near the gap the neighbour line is drawn too. The four-line
  // layout prints in bands, where the overlap is ink on ink and hidden anyway.
  if (gLay == 1) {
    if (ly < 3.0 && ri > 0) cov = max(cov, glyphCov(ri - 1, ly + 8.0, mq.x, m));
    else if (ly > 5.0 && ri < nl - 1) cov = max(cov, glyphCov(ri + 1, ly - 8.0, mq.x, m));
  }
  // four-line layout: odd lines are printed in negative on a full-width band
  if (gLay == 2 && (ri & 1) == 1) cov = 1.0 - cov;
  return vec2(cov, rif);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / uResolution;
  gAsp = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * gAsp, uv.y - 0.5);
  gPx = 1.0 / uResolution.y;

  float bc = max(uBeatClock, 0.0);
  gTb = fract(bc);
  gCh = max(floor(change + 0.5), 1.0);
  gWordIdx = floor(bc / gCh);
  gTw = bc - gWordIdx * gCh;
  float layIdx = floor(bc / 4.0);
  float inv = mod(floor(bc / 16.0), 2.0);
  gLay = int(clamp(floor(hash11(layIdx * 1.37) * 4.0), 0.0, 3.0));
  gSet = int(clamp(floor(words + 0.5), 0.0, 3.0));
  gLetter = int(mod(floor(bc), 4.0));
  gProg = clamp(gTw * 1.6, 0.0, 1.0);
  gAmp = 0.6 + 0.9 * uBassHit;
  gGap = clamp(gap, 0.0, 0.4) * (1.0 - 0.6 * uBass);

  // chewed silkscreen edges: a small domain warp of ~2 px makes the outlines
  // ragged without opening seams between adjacent modules at gap 0
  vec2 wq = vec2(vnoise(px * 0.21), vnoise(px * 0.21 + 31.7)) - 0.5;
  vec2 pw = p + wq * 4.0 * gPx;

  vec2 o = vec2(0.004 + 0.012 * uBass, 0.002);
  vec2 kk = mask(pw);
  float mK = kk.x;
  float mA = mask(pw + o).x;
  float mB = mask(pw - o * 0.7).x;

  float th = 0.5 + 0.15 * (wq.x + wq.y);
  mK = smoothstep(th - 0.25, th + 0.25, mK);
  mA = smoothstep(th - 0.25, th + 0.25, mA);
  mB = smoothstep(th - 0.25, th + 0.25, mB);

  // oblique bars on the highs
  float sl = step(0.985 - 0.05 * uHighHit, fract(dot(p, normalize(vec2(1.0, -0.35))) * 3.0 + floor(bc) * 0.37))
           * step(0.2, uHighHit);
  float grain = (hash(floor(px / 2.0) + floor(uTime * 12.0)) - 0.5) * uHighHit * 0.12;

  // poster: cream paper, two spot colours, black ink on top
  vec3 paper = vec3(0.93, 0.90, 0.82) + (hash(floor(px / 2.0)) - 0.5) * 0.04 + grain;
  vec3 poster = mix(paper, vec3(0.0), 0.16 * sl);
  poster = mix(poster, uColor1, mA * 0.9);
  poster = mix(poster, uColor2 * 0.9, mB * 0.6);
  vec3 ink = vec3(0.05) * (1.0 - 0.18 * vnoise(px * 0.35) - 0.10 * hash(px));
  poster = mix(poster, ink, mK);

  // neon on black
  vec3 neon = vec3(0.01) + uColor3 * sl * 0.5 + uColor1 * mA * 0.5 + uColor3 * mB * 0.35 + grain * 0.5;
  neon = mix(neon, uColor1 * 1.1 + 0.15, mK);

  float s = scheme > 1.5 ? mod(kk.y + layIdx + 8.0, 2.0) : (scheme > 0.5 ? 1.0 : 0.0);
  vec3 col = mix(poster, neon, s);

  // every 16 beats the print goes negative; a hard kick flips it for a frame (XOR, so it
  // still flashes during the negative phases)
  float flip = abs(inv - step(0.85, uBassHit));
  col = mix(col, 1.0 - col * 0.95, flip);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float density;
uniform float fogamt;
uniform float wavefreq;
uniform float uLineBoost;

varying vec2 vUv;

// Vaporwave / outrun: a wedge coupe from behind, driving down a neon grid
// toward a slit sun between two ranges of wireframe mountains.
//
// Everything is analytic: the floor is one plane (z = CAM_H / dy), the
// mountains are 2D polylines on the horizon, the car is a handful of 2D
// distances. No ray march, no fwidth: every line gets its pixel footprint from
// the projection itself, so nothing shimmers at the horizon or on silhouettes.

#define TAU 6.28318530718

const float CAM_H = 1.0;      // camera height above the road, world units
const float ROAD = 1.25;      // road half width
const float CAR_Z = 3.6;      // distance of the car's tail
const float CAR_A = 0.18;     // car half width on screen (screen heights)
const float GF = 2.0;         // grid lines per world unit at density 1
const vec2 SUN_C = vec2(0.0, 0.165);
const float SUN_R = 0.255;

// set once in main, read by the floor helpers
float gScroll, gCarX, gHill, gRing, gRingR, gRingW;

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// The sunset. k = 0 on the horizon, 1 at the top of the disc. The warm ramp
// (hot pink, orange, yellow) is what makes it a sunset whatever the palette;
// colour 2 tints it from the bottom up, so the disc still belongs to the look.
vec3 sunRamp(float k) {
  vec3 warm = mix(vec3(1.0, 0.10, 0.42), vec3(1.0, 0.36, 0.06), smoothstep(0.05, 0.5, k));
  warm = mix(warm, vec3(1.0, 0.80, 0.12), smoothstep(0.45, 1.0, k));
  return mix(warm, uColor2, 0.10 + 0.42 * (1.0 - smoothstep(0.0, 0.62, k)));
}

// One family of parallel lines at the integers of c. w = half width in cells,
// f = half width of one pixel in cells. A line is never drawn thinner than the
// pixel: it gets dimmer instead (same energy), and once the cells are a couple
// of pixels wide the family turns into its own average. No moire, no crawl.
float gline(float c, float w, float f) {
  float d = abs(fract(c + 0.5) - 0.5);
  float dw = max(w, f);
  float l = (1.0 - smoothstep(dw - f, dw + f, d)) * (w / dw);
  return mix(l, 2.0 * w, smoothstep(0.12, 0.4, f));
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
// symmetric trapezoid from y0 to y1, half width w0 -> w1 (exact on its edges)
float sdTrap(vec2 p, float y0, float y1, float w0, float w1) {
  float side = (abs(p.x) - mix(w0, w1, (p.y - y0) / (y1 - y0))) * (y1 - y0) / length(vec2(y1 - y0, w1 - w0));
  return max(side, max(y0 - p.y, p.y - y1));
}

// ---- mountains: a ridge over hashed vertices, alternately peak and saddle,
// rising away from the sun so the road to it stays open ----
float mtnH(float i, float sp, float amp, float seed) {
  float x = abs(i * sp);
  float env = smoothstep(0.08, 0.62, x) * (1.0 - 0.3 * smoothstep(0.7, 1.1, x));
  float r = hash2(vec2(i, seed));
  return amp * env * (mod(i, 2.0) < 0.5 ? 0.55 + 0.45 * r : 0.16 + 0.32 * r);
}

// One range. Ridge polyline, a rib from every vertex down to the feet, one
// contour at half height: the facets of a low-poly mesh, flat lit from the sun
// side. q = screen position above the horizon. Returns colour and coverage.
vec4 mtnRange(vec2 q, float sp, float amp, float seed, float px, vec3 body, vec3 wire, vec3 sunC, float rim) {
  float u = q.x / sp, i = floor(u), f = u - i;
  float hA = mtnH(i, sp, amp, seed), hB = mtnH(i + 1.0, sp, amp, seed);
  float top = mix(hA, hB, f);
  float cov = smoothstep(px, -px, q.y - top);
  if (cov <= 0.0) return vec4(0.0);
  vec2 l = vec2(f * sp, q.y), a = vec2(0.0, hA), b = vec2(sp, hB), m = vec2(0.5 * sp, 0.0);
  // which facet: left of the rib from a, right of the rib from b, or the saddle between
  float fa = step(0.5 * sp * (l.y - hA) + hA * l.x, 0.0);
  float fb = step(0.0, -0.5 * sp * (l.y - hB) + hB * (l.x - sp));
  float toSun = q.x > 0.0 ? fb : fa, away = q.x > 0.0 ? fa : fb;
  float hk = q.y / max(top, 1e-4);
  vec3 c = body * (0.7 + 0.5 * toSun - 0.35 * away) + sunC * toSun * (0.05 + 0.10 * hk) * rim;
  float w = px * (0.7 + 0.9 * uLineBoost);
  float dRib = min(sdSeg(l, a, m), sdSeg(l, b, m));
  float dCon = abs(hk - 0.5) * top;
  float ribs = 1.0 - smoothstep(w - px, w + px, min(dRib, dCon));
  float ridge = 1.0 - smoothstep(w * 1.4 - px, w * 1.4 + px, sdSeg(l, a, b));
  c += wire * ribs * (0.25 + 0.5 * hk);
  // the ridge is the rim: sun coloured where the range stands against it
  c += mix(wire, sunC * 1.4, rim) * ridge * (0.6 + 0.9 * rim);
  return vec4(c, cov);
}

// ---- floor relief: dunes beside the road and the kick's ring, both flattened
// with distance so the fixed point in main stays a contraction ----
float relief(vec2 w, out float ring) {
  float zw = w.y + gScroll;
  float side = smoothstep(ROAD + 0.3, ROAD + 3.2, abs(w.x));
  float dune = side * (0.5 + 0.5 * sin(w.x * 0.55 + 1.3 * sin(zw * 0.23))) * (0.55 + 0.45 * sin(zw * 0.41 + w.x * 0.2));
  float r = (length(w - vec2(gCarX, CAR_Z)) - gRingR) / gRingW;
  ring = exp(-r * r);
  return min(1.0, 3.2 / w.y) * (gHill * dune + 0.07 * gRing * ring);
}

void main() {
  float t = uTime;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // ---- camera: follows the car's sway a little, bobs with the bar, and the
  // field of view opens on the bass (about the vanishing point) ----
  // sway on the continuous beat clock (a bar = 4 beats): uBarPhase snaps while the
  // tracker locks on after start-up and threw the car across the lanes
  float barA = TAU * uBeatClock * 0.25;
  float carX = 0.34 * sin(barA) + 0.10 * sin(t * 0.31);
  float camX = carX * 0.45;
  float hy = -0.075 + 0.005 * sin(barA + 1.2) + 0.003 * sin(t * 0.47);   // horizon: 42.5% from the bottom
  float zoom = 1.0 + 0.045 * uBass;
  vec2 p = vec2(uv.x, uv.y - hy) * zoom;
  float px = zoom / uResolution.y;

  // travelled distance is accumulated time, never time * audio: the bass
  // makes the road go faster through its own integral (uBassTime)
  float S = t * 9.0 + uBassTime * 12.0;       // grid lines passed
  gScroll = S / GF;                            // the same, in world units
  gCarX = carX;
  gHill = 0.05 * wavefreq;
  // the kick's ring leaves the car on the beat and runs out to the horizon
  float kick = clamp(uEnergy * 2.0, 0.0, 1.0) * (0.35 + 0.65 * uBass);
  gRing = kick * (1.0 - uBeatPhase) * (1.0 - uBeatPhase);
  gRingR = 0.8 + 24.0 * pow(uBeatPhase, 0.8);
  gRingW = 0.45 + 1.8 * uBeatPhase;

  // ---- palette roles ----
  vec3 cLine = uColor2;                          // the grid
  vec3 cAcc = mix(uColor1, uColor3, 0.3);        // road edges, ring, underglow
  vec3 cDeep = mix(uColor3, uColor2, 0.3);       // night
  vec3 sunLow = sunRamp(0.1), sunHot = sunRamp(0.8);
  vec3 hazeC = mix(uColor2, uColor3, 0.25);
  float pulse = 1.0 + 0.9 * uBassHit + 0.4 * uBeat;

  vec3 col;
  if (p.y > 0.0) {
    // ---- sky: deep indigo down to a purple-pink horizon ----
    float sy = clamp(p.y / 0.58, 0.0, 1.0);
    col = mix(hazeC * 0.42, mix(uColor3, uColor2, 0.42) * 0.27, smoothstep(0.0, 0.3, sy));
    col = mix(col, uColor3 * 0.10 + vec3(0.010, 0.0, 0.035), smoothstep(0.18, 1.0, sy));

    float sd = length(p - SUN_C) - SUN_R;

    // stars: one in ten cells, hi-hats make them sparkle
    vec2 sg = p * 44.0, si = floor(sg);
    float sh = hash2(si);
    if (sh > 0.90 && sd > 0.012) {
      float big = fract(sh * 61.0);
      float sr = length(sg - si - 0.25 - 0.5 * vec2(hash2(si + 3.7), hash2(si + 9.1)));
      float rad = 0.04 + 0.05 * big, a = 44.0 * px;
      float tw = 0.55 + 0.45 * sin(t * (1.0 + 2.5 * big) + sh * 80.0)
               + uHighHit * (0.4 + 1.6 * step(0.6, fract(sh * 37.0))) + 0.6 * uHigh * big;
      col += mix(vec3(1.0), cAcc, 0.25) * (1.0 - smoothstep(rad - a, rad + a, sr)) * tw * smoothstep(0.03, 0.3, sy) * 0.8;
    }

    // ---- the sun: halo, disc with a hint of chroma fringe on its edge, and
    // the slits, sliding down and widening toward the horizon ----
    float gl = max(sd, 0.0);
    col += sunLow * (0.16 * exp(-gl * 6.0) + 0.24 * exp(-gl * 20.0)) * (1.0 + 0.5 * uMidHit + 0.25 * uBeat);
    if (sd < 3.0 * px) {
      float ca = 1.6 * px;
      vec3 disc = smoothstep(px, -px, vec3(length(p - SUN_C - vec2(ca, 0.0)), sd + SUN_R, length(p - SUN_C + vec2(ca, 0.0))) - SUN_R);
      float y1 = SUN_C.y + 0.03;
      float s = (y1 - p.y) / y1;                 // 0 at the first slit, 1 on the horizon
      float lit = 1.0;
      if (s > 0.0) {
        float aa = 6.0 / y1 * px;
        lit = smoothstep(aa, -aa, abs(fract(s * 6.0 - t * 0.1) - 0.5) - 0.5 * (1.0 - 0.66 * pow(s, 0.8)));
        lit = mix(1.0, lit, smoothstep(0.0, 0.06, s));
      }
      vec3 sc = sunRamp(clamp(p.y / (SUN_C.y + SUN_R), 0.0, 1.0)) * (0.92 + 0.3 * uMidHit + 0.1 * uBeat);
      col = mix(col, sc, disc * lit);
    }

    // ---- mountains, two ranges; the snare flashes their rim ----
    if (p.y < 0.3) {
      float rim = (0.25 + 0.75 * exp(-abs(p.x) * 2.4)) * (1.0 + 1.2 * uMidHit);
      vec3 wire = mix(uColor3, uColor2, 0.5);
      vec4 m1 = mtnRange(vec2(p.x + camX * 0.010 + 0.04, p.y), 0.13, 0.27, 1.0, px, cDeep * 0.16 + hazeC * 0.10, wire * 0.55, sunLow, rim);
      col = mix(col, m1.rgb, m1.a);
      vec4 m2 = mtnRange(vec2(p.x + camX * 0.028, p.y), 0.085, 0.15, 2.0, px, cDeep * 0.07, wire, sunLow, rim);
      col = mix(col, m2.rgb, m2.a);
    }
  } else {
    // ---- floor ----
    float dy = max(-p.y, 1e-4);
    float z = CAM_H / dy, ring = 0.0, rel = 0.0;
    // two steps of the fixed point z = (CAM_H - relief(z)) / dy
    for (int i = 0; i < 2; i++) {
      rel = relief(vec2(p.x * z + camX, z), ring);
      z = (CAM_H - rel) / dy;
    }
    float x = p.x * z + camX, xr = p.x * z / CAM_H;
    // one pixel, in world units, across and along the road
    float fx = px * z * sqrt(1.0 + xr * xr), fz = px * z * z / CAM_H;
    float pw = 0.55 + 1.1 * uLineBoost;          // least half width of a line, pixels
    float gfd = GF * density;
    float fog = exp(-z * fogamt * 0.28);
    float ax = abs(x) - ROAD, onRoad = smoothstep(0.02, -0.02, ax);

    // grid cells are counted outward from the road edge, so the road keeps
    // its width at any density and its edge is always a line
    float uu = ax * gfd;
    float lx = gline(uu, 0.022, fx * gfd * pw) * smoothstep(-0.6, -0.4, uu);
    float lz = gline(z * gfd + S, 0.022, fz * gfd * pw) * (1.0 - 0.6 * onRoad);
    float fuse = max(smoothstep(0.1, 0.35, fx * gfd) * step(lz, lx), smoothstep(0.1, 0.35, fz * gfd));
    float halo = mix(max(exp(-abs(fract(uu + 0.5) - 0.5) * 9.0) * step(-0.5, uu),
                         exp(-abs(fract(z * gfd + S + 0.5) - 0.5) * 9.0) * (1.0 - 0.6 * onRoad)), 0.2, fuse);

    // underglow, in world space so it lies on the road and lights its lines
    vec2 uc = vec2(x - carX, z - CAR_Z - 0.9);
    float under = exp(-(uc.x * uc.x * 1.1 + uc.y * uc.y * 0.45)) * (0.5 + 1.3 * uBass);
    float wave = gRing * ring;

    col = cDeep * (0.035 - 0.015 * onRoad) + cDeep * rel * 0.5;
    // the sun lying on the road
    col += sunLow * exp(-abs(p.x) * 4.0) * exp(-dy * 5.5) * (0.16 + 0.12 * onRoad);
    vec3 lc = mix(cLine, cAcc, clamp(wave * 1.2 + under * 0.5, 0.0, 1.0));
    col += lc * (max(lx, lz) * 1.5 + halo * 0.22) * fog * pulse * (1.0 + 2.5 * wave + 1.6 * under);
    col += mix(lc, vec3(1.0), 0.5) * lx * lz * fog * 1.2;
    col += cAcc * (under * 0.10 + wave * 0.10 * fog);
    // soft knee above the idle line level (asymptote 1.6): the kick still lifts the secondary channels toward white
    float mxl = max(col.r, max(col.g, col.b));
    if (mxl > 1.0) col *= (1.0 + 0.6 * (1.0 - exp(-(mxl - 1.0) * 1.5))) / mxl;

    // road: glowing edges and a dashed centre line rushing past
    float we = max(0.03, fx * pw);
    col += mix(cAcc, vec3(1.0), 0.25) * (1.0 - smoothstep(we - fx, we + fx, abs(ax))) * (0.03 / we) * fog * (1.3 + 0.6 * uBassHit);
    float af = fz / 2.4, wd = max(0.045, fx * pw);
    float dash = mix(smoothstep(af, -af, abs(fract((z + gScroll) / 2.4) - 0.5) - 0.24), 0.48, smoothstep(0.12, 0.4, af));
    col += mix(vec3(1.0), sunHot, 0.35) * dash * (1.0 - smoothstep(wd - fx, wd + fx, abs(x))) * (0.045 / wd) * fog * 0.9;

    // speed streaks: dashes of light overtaking the grid on the outer lanes
    if (ax > 0.0) {
      float ls = ax * 1.1, id = floor(ls) + 31.0 * step(0.0, x);
      if (hash1(id) > 0.3) {
        float zq = fract((z + gScroll) * 0.09 + t * 1.2 + hash1(id + 5.0) * 3.0);
        float ws = max(0.03, fx * pw), qf = fz * 0.09;
        float st = smoothstep(0.0, qf + 0.004, zq) * step(zq, 0.25) * (1.0 - zq / 0.25);
        col += mix(cAcc, vec3(1.0), 0.45) * st * st * (1.0 - smoothstep(ws - fx, ws + fx, abs(fract(ls) - 0.5) / 1.1))
             * (0.03 / ws) * (1.0 - smoothstep(0.02, 0.07, qf)) * (0.7 + 1.8 * uBass);
      }
    }
    // tail lights on the road behind the car
    col += vec3(1.0, 0.06, 0.10) * exp(-uc.x * uc.x * 1.6) * smoothstep(CAR_Z + 0.1, CAR_Z - 0.6, z) * exp(min(z - CAR_Z, 0.0) * 0.9) * (0.10 + 0.14 * uBassHit);
  }

  // ---- horizon: a hot line where floor meets sky, in a band of haze ----
  float hd = abs(p.y);
  col += mix(hazeC, vec3(1.0), 0.45) * (1.0 - smoothstep(0.0, px * (1.5 + 2.0 * uLineBoost), hd)) * (0.7 + 0.5 * uBassHit);
  col += hazeC * (exp(-hd * 16.0) * (0.10 + 0.9 * fogamt + 0.12 * uEnergy) + exp(-hd * 90.0) * 0.30) * pulse;

  // ---- the car: a low wedge coupe seen from behind ----
  vec2 cc = (p - vec2((carX - camX) / CAR_Z, -CAM_H / CAR_Z)) / CAR_A;   // x -1..1, y 0 on the road
  if (abs(cc.x) < 2.2 && cc.y > -0.8 && cc.y < 1.8) {
    float aa = px / CAR_A;
    float flare = uBassHit + 0.3 * uBeat;
    // the body squats on the kick and leans into the sway; the wheels stay down
    float roll = 0.035 * cos(barA) * min(1.0, uEnergy * 3.0);
    vec2 cb = vec2(cc.x + roll * (cc.y - 0.2), cc.y - roll * cc.x + 0.035 * uBassHit);
    vec3 paint = vec3(0.010, 0.008, 0.018) + uColor3 * 0.018;

    // the lit road seen under the body, between the tyres
    col += cAcc * smoothstep(0.62, 0.42, abs(cc.x)) * smoothstep(-0.05, 0.02, cc.y) * smoothstep(0.24, 0.1, cc.y) * (0.5 + 1.5 * uBass);

    // tyres: their rear faces, tread rolling up
    float dTy = sdBox(vec2(abs(cc.x) - 0.77, cc.y - 0.2), vec2(0.185, 0.2), 0.06);
    vec3 ty = vec3(0.004) + 0.014 * (0.5 + 0.5 * sin(cc.y * 34.0 - S * 0.9))
            + cAcc * 0.10 * smoothstep(0.22, 0.0, cc.y) * (0.5 + uBass);
    col = mix(col, ty, smoothstep(aa, -aa, dTy));

    // cabin, rear window with the sun in it, roof seen from just above
    float wC = mix(0.66, 0.47, (cb.y - 0.68) / 0.32);
    float dCab = sdTrap(cb, 0.68, 1.0, 0.66, 0.47);
    vec3 cab = paint * 0.8 + sunHot * 0.55 * smoothstep(0.035, 0.0, (wC - abs(cb.x)) * 0.86);
    float dWin = sdTrap(cb, 0.725, 0.955, 0.585, 0.45);
    vec2 rq = (cb - vec2(0.0, 0.95)) / vec2(0.30, 0.13);
    vec3 glass = cDeep * (0.03 + 0.12 * (cb.y - 0.72))
               + sunHot * 0.2 * smoothstep(1.0, 0.2, length(rq)) * (0.55 + 0.45 * smoothstep(-0.2, 0.2, sin(cb.y * 80.0)));
    cab = mix(cab, glass, smoothstep(aa, -aa, dWin));
    col = mix(col, cab, smoothstep(aa, -aa, dCab));
    float dRoof = sdTrap(cb, 0.985, 1.04, 0.478, 0.44);
    col = mix(col, sunHot * (1.25 + 1.2 * uMidHit) * (1.0 - 0.45 * abs(cb.x) / 0.47), smoothstep(aa, -aa, dRoof));

    // rear deck (its top face catches the sun) and the wing over it
    float dDeck = sdTrap(cb, 0.58, 0.70, 0.955, 0.87);
    float dk = smoothstep(0.6, 0.7, cb.y);
    col = mix(col, paint * 1.6 + sunHot * 0.5 * dk * dk * (1.0 + uMidHit), smoothstep(aa, -aa, dDeck));
    float dWing = min(sdBox(cb - vec2(0.0, 0.80), vec2(0.94, 0.024), 0.01),
                      sdBox(vec2(abs(cb.x) - 0.905, cb.y - 0.70), vec2(0.03, 0.115), 0.01));
    col = mix(col, paint + sunHot * 0.9 * smoothstep(0.016, 0.0, 0.824 - cb.y), smoothstep(aa, -aa, dWing));

    // rear fascia: dark, edge-lit from below by the underglow and from above by the sun
    float dLow = sdBox(vec2(cb.x * (1.0 + 0.14 * (0.6 - cb.y)), cb.y - 0.385), vec2(0.985, 0.215), 0.08);
    vec3 low = paint * (0.7 + 0.8 * smoothstep(0.3, 0.6, cb.y))
             + mix(cAcc * (0.35 + 0.9 * uBass), sunHot * 0.45, smoothstep(0.25, 0.5, cb.y)) * smoothstep(0.035, 0.0, -dLow);
    // twin exhausts
    float dEx = length(vec2(abs(cb.x) - 0.33, cb.y - 0.255)) - 0.05;
    low = mix(low, vec3(0.0), smoothstep(aa, -aa, dEx)) + sunLow * 0.35 * (1.0 - smoothstep(0.0, 0.012 + aa, abs(dEx)));

    // tail-light bar: three slats, brighter toward the corners, flaring on the kick
    float dBar = sdBox(cb - vec2(0.0, 0.445), vec2(0.86, 0.058), 0.035);
    float outer = 0.4 + 0.6 * smoothstep(0.2, 0.42, abs(cb.x));
    vec3 red = mix(vec3(1.0, 0.05, 0.10), uColor2, 0.08);
    vec3 lamp = (red * 1.1 + vec3(0.5, 0.35, 0.25) * smoothstep(0.03, 0.0, abs(cb.y - 0.445)))
              * outer * (0.8 + 0.9 * flare) * (0.35 + 0.65 * smoothstep(0.004, 0.012, abs(abs(cb.y - 0.445) - 0.027)));
    low = mix(low, lamp, smoothstep(aa, -aa, dBar));
    col = mix(col, low, smoothstep(aa, -aa, dLow));

    // bloom of the lamps over the body and the road
    float bg = max(dBar, 0.0);
    col += red * (0.20 * exp(-bg * 7.0) + 0.40 * exp(-bg * 22.0)) * outer * (0.6 + 1.3 * flare);
  }

  // ---- VHS: scanlines (the hi-hats shimmer them), a slow tracking band, vignette ----
  // pitch follows the frame height: visible at 4K, stable when dynamic resolution steps
  float sl = max(3.0, floor(uResolution.y / 360.0));
  col *= 1.0 - (0.07 + 0.06 * uHighHit) * step(mod(gl_FragCoord.y, sl), sl / 3.0);
  float band = fract(uv.y * 0.6 - t * 0.05) - 0.5;
  col *= 1.0 + 0.05 * exp(-band * band * 180.0);
  col *= 1.0 - 0.28 * dot(uv, uv);

  col += (hash2(gl_FragCoord.xy) - 0.5) / 255.0;   // dither: 8-bit target bands the sky
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}

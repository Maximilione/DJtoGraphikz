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
uniform float uBeatPhase;
uniform float uBarPhase;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float pace;      // orbit speed: not "speed", that is the engine clock param and applyParams skips it
uniform float density;
uniform float sun;
uniform float radius;

// Ringworld: we fly along the axis of a colossal cylindrical habitat. The
// ground never drops to a horizon, it climbs on both sides and closes over our
// heads as a sky of lit districts, canals and fields. The surface is never
// marched: the ray meets the inside of an infinite cylinder with one
// quadratic, and the hit point's (theta, z) coordinates drive a 2.5D city
// (cell grid, hashed windows, streets, fbm terrain, canal mask). Building
// relief is faked with a short parallax walk along the tangent-plane
// projection of the view ray. The sun is a closed-form glow of the ray's
// closest approach to the axis; shadow bands are plain stripes in z. On the
// kick a ring of light leaves the camera along +z and switches on the windows
// it crosses (position and decay both come from the uBassHit impulse itself).
// All noise lives on a torus (theta/2pi, z/400), so the world is seamless in
// theta and across the 400-unit wrap of the flight offset.

const float TAU = 6.2831853;
const float PERIOD = 400.0;       // z period of the whole world
const float CZ = 0.625;           // cell size along z (PERIOD / CZ = 640 cells)
const float NCZ = 640.0;
const float CS = 0.62;            // target cell size around the circumference
const float HMAX = 1.0;           // tallest building

float gNC;                        // cells around the circumference
float gDens;

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(12.37, 78.91))) * 24634.63);
}

float rampDown(float lo, float hi, float x) {
  // 1 at x<=lo, 0 at x>=hi (smoothstep with safe edge order)
  return 1.0 - smoothstep(lo, hi, x);
}

// value noise, periodic on a torus with integer lattice frequency f
float vnT(vec2 t, vec2 f) {
  vec2 p = t * f;
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  vec2 i0 = mod(i, f);
  vec2 i1 = mod(i + 1.0, f);
  float a = h21(i0);
  float b = h21(vec2(i1.x, i0.y));
  float c = h21(vec2(i0.x, i1.y));
  float d = h21(i1);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm3(vec2 t, vec2 f) {
  return 0.5 * vnT(t, f) + 0.3 * vnT(t, f * 2.0) + 0.2 * vnT(t, f * 4.0);
}

float riverAt(vec2 t) {
  float warp = vnT(t, vec2(5.0, 10.0));
  float s = abs(sin(t.x * TAU * 6.0 + 4.0 * warp));
  return rampDown(0.0, 0.25, s);
}

// 1 if the (wrapped) cell is part of a district
float cityAt(vec2 cell) {
  vec2 t = vec2((cell.x + 0.5) / gNC, (cell.y + 0.5) / NCZ);
  float m = 0.65 * vnT(t, vec2(7.0, 14.0)) + 0.35 * vnT(t, vec2(14.0, 28.0));
  m = clamp((m - 0.5) * 2.2 + 0.5, 0.0, 1.0);
  float c = step(1.0 - gDens, m);
  return c * step(riverAt(t), 0.15);
}

float heightAt(vec2 cell) {
  float h = h21(cell + vec2(3.1, 7.7));
  return h > 0.6 ? 0.4 + (h - 0.6) * 2.5 * (HMAX - 0.4)
                 : mix(0.08, 0.4, h / 0.6);
}

vec3 palK(float k, float hd) {
  k = mod(k, 3.0);
  if (k < 0.5) return mix(uColor1, uColor2, hd);
  if (k < 1.5) return mix(uColor2, uColor3, hd);
  return mix(uColor3, uColor1, hd);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float spd = clamp(pace, 0.0, 3.0);
  float sunI = clamp(sun, 0.0, 2.0);
  float R = 6.0 * clamp(radius, 0.5, 2.0);
  gDens = clamp(density, 0.2, 1.0);
  gNC = max(floor(TAU * R / CS), 8.0);

  // world moves, camera stays: keeps float precision flat in z
  float zOff = mod(t * spd * 1.5 + uBassTime * 0.6 * spd, PERIOD);
  float roll = mod(t * 0.02 + uBassTime * 0.05, TAU);
  roll += 0.04 * sin(t * 0.21) * (0.5 + uBass);

  vec3 ro = vec3(0.35 * sin(t * 0.13), -0.0375 * R, 0.0);
  vec3 rd = normalize(vec3(p, 1.1 - 0.08 * kick));
  float pc = 0.12 * sin(t * 0.07), ps = sin(pc);
  pc = cos(pc);
  rd.yz = vec2(rd.y * pc - rd.z * ps, rd.y * ps + rd.z * pc);
  float yw = 0.25 * sin(t * 0.05), ys = sin(yw);
  float yc = cos(yw);
  rd.xz = vec2(rd.x * yc + rd.z * ys, -rd.x * ys + rd.z * yc);

  // analytic hit with the inside of the cylinder (c < 0 always): stable form
  // of the + root, -c/(b+sq), never divides by ~0 since sq >= |b|
  float a = max(dot(rd.xy, rd.xy), 1e-8);
  float b = dot(ro.xy, rd.xy);
  float c = dot(ro.xy, ro.xy) - R * R;
  float sq = sqrt(max(b * b - a * c, 0.0));
  float tHit = min(-c / max(b + sq, 1e-4), 2000.0);

  vec3 sunC = mix(vec3(1.0, 0.93, 0.8), uColor3, 0.2);
  // haze: dark and coloured, a little warmer with the sun; never milky
  vec3 hazeCol = mix(uColor2 * 0.10, sunC * 0.16, 0.35 + 0.2 * sunI) + uColor1 * 0.02;
  vec3 col = hazeCol;

  // closest approach of the ray to the axis (closed form) -> sun filament
  float tStar = clamp(-b / a, 0.0, 1500.0);
  float dAx = length(ro.xy + rd.xy * tStar);
  float zf = rd.z * tStar + zOff;

  // shadow bands: period 100 divides the 400 world period; they slide 15
  // units every 8 beats with an eased step
  float shPos = floor(uBeatClock / 8.0) * 15.0 +
                15.0 * smoothstep(0.0, 0.18, fract(uBeatClock / 8.0));

  float haze = 1.0 - exp(-tHit * 0.016);

  if (tHit < 450.0) {
    vec3 hit = ro + rd * tHit;
    float theta = atan(hit.y, hit.x) + roll;
    vec2 tt = vec2(fract(theta / TAU), 0.0);
    float v = hit.z + zOff;
    tt.y = fract(v / PERIOD);

    // cell-space position (x: around, y: along)
    float sx = TAU * R / gNC;
    vec2 cp = vec2(tt.x * gNC, v / CZ);

    // view direction projected on the tangent plane, for the parallax walk
    vec3 nIn = vec3(-hit.xy / R, 0.0);
    vec3 eT = vec3(-hit.y, hit.x, 0.0) / R;
    float dn = max(abs(dot(rd, nIn)), 0.08);
    vec2 rdT = vec2(dot(rd, eT), rd.z) / dn;
    rdT = clamp(rdT, vec2(-3.0), vec2(3.0));

    // pixel footprint on the surface, in cells: drives the far-field blur so
    // windows and lamps fade to their average instead of shimmering
    float pxW = tHit / (uResolution.y * 1.1 * dn);
    float blur = smoothstep(0.25, 1.0, pxW * 3.0 / min(sx, CZ));
    float det = 1.0 - blur;

    // kick wave
    float dz = hit.z - (1.0 - kick) * 120.0;
    float wv = exp(-abs(dz) * 0.15) * kick;
    float front = exp(-abs(dz) * 0.7) * kick;

    // shadow at this z
    float sh = rampDown(12.0, 20.0, abs(mod(v - shPos, 100.0) - 50.0));
    float lit = 1.0 - 0.75 * sh;
    float day = (1.0 - sh) * (0.4 + 0.6 * min(sunI, 1.5));

    // parallax walk: first (highest) level whose footprint is solid. The one
    // hash of heightAt is checked before cityAt (3 noises), so most samples
    // above the low roofs cost almost nothing.
    int top = tHit < 140.0 ? 6 : 0;
    vec2 pos = cp;
    vec2 cell = vec2(mod(floor(pos.x), gNC), mod(floor(pos.y), NCZ));
    float hb = 0.0, hl = 0.0;
    bool bld = false;
    for (int i = 6; i >= 0; i--) {
      if (i > top) continue;
      float hi = HMAX * float(i) / 6.0;
      vec2 ps2 = cp - rdT * hi / vec2(sx, CZ);
      vec2 f = fract(ps2);
      if (f.x < 0.12 || f.x > 0.88 || f.y < 0.12 || f.y > 0.88) continue;
      vec2 cc = vec2(mod(floor(ps2.x), gNC), mod(floor(ps2.y), NCZ));
      float hh = heightAt(cc);
      if (hh < hi) continue;
      if (cityAt(cc) > 0.5) {
        bld = true;
        pos = ps2;
        cell = cc;
        hb = hh;
        hl = hi;
        break;
      }
    }

    vec2 gp = bld ? pos : cp;
    vec2 gc = bld ? cell : vec2(mod(floor(cp.x), gNC), mod(floor(cp.y), NCZ));
    vec2 fr = fract(gp);

    // district tint with a per-bar wave travelling around theta
    vec2 did = floor(gc / 4.0);
    float hd = h21(did + vec2(5.3, 1.7));
    float ndist = ceil(gNC / 4.0);
    float key = fract(did.x / ndist + hd * 0.1);
    float bar = floor(uBeatClock / 4.0);
    float sw = smoothstep(key * 0.9, key * 0.9 + 0.1, uBarPhase);
    vec3 tint = mix(palK(bar - 1.0, hd), palK(bar, hd), sw);

    vec3 surf;

    if (bld) {
      // facade: window rows follow the parallax level, columns the footprint
      float isRoof = step(hb - hl, HMAX / 6.0 - 0.01);
      vec2 sub = vec2(fr.x * 3.0, isRoof > 0.5 ? fr.y * 3.0 : hl * 9.0 + fr.y);
      vec2 wid = floor(sub);
      vec2 wf = fract(sub);
      float wm = step(0.18, wf.x) * step(wf.x, 0.82) * step(0.22, wf.y) * step(wf.y, 0.78);
      wm = mix(wm, 0.25, blur);
      float r = h21(gc * 7.0 + wid * 1.31 + 2.7);
      float on = step(0.55 - 0.4 * gDens, r);
      on = mix(on, 0.45 + 0.4 * gDens, blur);
      on = max(on, step(0.05, wv));
      // high band: sparkle on a hash-chosen subset of windows
      float sub2 = step(0.8, h21(gc + wid * 0.37 + 11.0));
      float spark = sub2 * step(0.5, fract(r * 13.0 + uBeatClock * 0.5)) * uHigh * 2.0;
      vec3 wcol = mix(vec3(1.0, 0.8, 0.5), tint, 0.35 + 0.35 * r);
      // windows light up harder in the night bands: that is the money shot
      float wb = (0.5 + 0.8 * r) * (0.55 + 2.2 * sh) + wv * 2.5 + spark;
      // daylight washes the facades, the night bands leave only the windows
      vec3 wall = tint * (0.03 + 0.03 * hl / HMAX) + mix(tint, sunC, 0.5) * day * 0.13;
      wall += 0.006;
      float winMask = wm * (1.0 - 0.75 * isRoof);
      vec3 winC = wcol * wb * on * winMask;
      winC = max(winC, wcol * 0.12 * winMask);
      surf = wall + winC;
      // roof rim catches the sun, facades stay dark
      float rim = isRoof * rampDown(0.0, 0.14, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)) - 0.1);
      surf += sunC * rim * 0.18 * lit * det;
    } else {
      // terrain: fields + canals, only where nothing stands
      float n = fbm3(tt, vec2(6.0, 12.0));
      float stripe = 0.5 + 0.5 * sin(tt.x * TAU * 5.0 + n * 3.0);
      float river = riverAt(tt);
      vec3 fieldA = mix(uColor2, uColor1, 0.5 + 0.5 * n) * 0.15;
      vec3 fieldB = mix(uColor3, uColor2, n) * 0.08;
      vec3 ground = mix(fieldB, fieldA, stripe) + 0.01;
      ground *= 0.7 + 0.6 * vnT(tt, vec2(40.0, 80.0));
      ground = mix(ground, uColor3 * 0.02, river);
      // canals: dark and glossy, they mirror the sun
      float canalGlow = river * 0.16 * sunI * (1.0 - 0.85 * sh) * (0.6 + 0.4 * det);
      surf = ground * lit + mix(uColor3, sunC, 0.4) * canalGlow;
      if (cityAt(gc) > 0.5) {
        // streets and plazas inside a district, amber lamp dots
        float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
        float lamp = rampDown(0.03, 0.07, edge) * step(0.6, fract((gp.x + gp.y) * 2.0));
        lamp = mix(lamp, 0.12, blur);
        float lamp2 = rampDown(0.08, 0.13, edge) * 0.2;
        surf = tint * 0.03 + mix(tint, sunC, 0.5) * day * 0.06 + 0.006;
        surf += uColor2 * (lamp * 1.2 + lamp2 * 0.5) * (1.0 + 1.2 * sh);
        surf += uColor3 * canalGlow * 0.3;
      }
    }

    // structural ribs every 80 units: dark band with a thread of light
    float rd2 = abs(mod(v, 80.0) - 40.0);
    float rib = rampDown(0.25, 0.7, rd2);
    float ribEdge = rampDown(0.0, 0.1, abs(rd2 - 0.75));
    surf *= 1.0 - 0.85 * rib;
    surf += uColor3 * ribEdge * (0.5 + 0.5 * uMid) * (0.4 + 0.6 * lit);

    // the light ring of the kick itself
    surf += mix(uColor1, vec3(1.0), 0.25) * front * 1.4;

    // sun light: diffuse term is ~1 everywhere, shadows are what matters
    surf *= (0.8 + 0.35 * sunI);

    // the haze itself is darker inside a night band, so the band reads from afar
    col = mix(surf, hazeCol * (1.0 - 0.55 * sh), haze);
  }

  // axial sun: a thin hot filament with a soft halo, dimmed in the shadow
  // bands. dAx <= |ro.xy| (>= 0.22), so both terms are bounded.
  float rs = length(p);
  float shAx = rampDown(12.0, 20.0, abs(mod(zf - shPos, 100.0) - 50.0));
  float fil = 0.0006 / (dAx * dAx + 0.0003) + 0.002 / (dAx * dAx + 0.012);
  fil *= 0.7 + 1.3 * kick + 0.3 * uBass;
  fil *= 0.3 + 0.7 * exp(-rs * 1.5);
  fil *= 1.0 - 0.7 * shAx;
  col += sunC * fil * (0.12 + sunI) * 0.5;
  // soft core where the axis vanishes
  col += sunC * (0.12 + sunI) * (0.1 + 0.3 * kick + 0.12 * uBass) / (1.0 + pow(rs * 8.0, 2.0)) * (1.0 - 0.5 * shAx);

  // minimum floor so silence is never dead
  col += uColor2 * 0.01;

  col = col / (1.0 + 0.6 * col);
  col *= clamp(1.2 - dot(p, p) * 0.7, 0.45, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

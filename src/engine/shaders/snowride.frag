precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

uniform float pistewidth;
uniform float curviness;
uniform float gates;
uniform float uLineBoost;
uniform float uBeatClock;

// Big-air night run v4: a floodlit festival course seen from the board.
// Foreground: groomed piste, neon ropes, boost pads, spray. Midground: truss
// gates with banners and spots, LED boards, pines, floodlight masts, a rail,
// the kicker. Background: valley haze, three alpine ranges, moon, searchlights.
//
// Bass = throttle (distance, streaks, field of view). Kick and snare = hops.
// Hats = spray, flakes, flicker. Once every 16 beats a line of kickers comes
// up: launch on the bar's downbeat, three beats of hang time with fireworks,
// landing on beat 4. Nothing here keeps state, so every envelope is a pure
// function of the bar phase and the beat clock.

const float F = 0.85;    // focal length, in screen heights
const float SL = 6.0;    // trackside slot: one LED board and one pine (or a mast) per side
const float KL = 5.0;    // kicker ramp length
// shortcut: the shader has no BPM, so the kicker closes KU units per beat (right at ~15 u/s and
// 150 BPM) and slides a little over the snow at other speeds; pass a speed uniform to fix it
const float KU = 6.0;
const float FOG = 0.012;
const float GS = 10.0;   // gate grid: a gate can stand every GS units

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tri(float x) { return abs(fract(x) - 0.5) * 2.0; }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 pal3(float k) { k = mod(k, 3.0); return k < 1.0 ? uColor1 : (k < 2.0 ? uColor2 : uColor3); }

float curveAt(float z) {
  return sin(z * 0.05) * curviness * 3.0 + sin(z * 0.021 + 1.7) * curviness * 5.0;
}

// Which grid slots hold a gate. The `gates` param fills them in bit-reversed order, so the
// spacing halves evenly (80, 40, 20, 10 units) and a mapped or moving param fades single
// gates in and out: it never slides the whole course (a spacing = f(param) did, by miles).
float gateAt(float gi) {
  float r = mod(gi, 2.0) * 4.0 + mod(floor(gi * 0.5), 2.0) * 2.0 + mod(floor(gi * 0.25), 2.0);
  return clamp((gates * (8.0 / 11.0) - r - 0.4) / 0.15, 0.0, 1.0);
}

// how big the kicker at the downbeat `bc` is: one line of jumps every 16 beats.
// Smooth in bc, so a tracker that re-phases mid bar bends the jump, never pops it.
float airWin(float bc) { return smoothstep(0.55, 0.95, 0.5 + 0.5 * cos(bc * (TAU / 16.0))); }

// alpine skyline: triangle waves at three scales, the big one squared so summits stay pointed
float crest(float x, float s) {
  float a = tri(x * 0.83 + s);
  return a * a * 0.62 + tri(x * 2.31 + s * 1.7 + a * 0.3) * 0.27 + tri(x * 6.7 + s * 3.1) * 0.09;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  float px = 1.0 / uResolution.y;
  float lw = 1.0 + 2.5 * uLineBoost;
  vec2 p = (gl_FragCoord.xy / uResolution - 0.5) * vec2(aspect, 1.0);
  float vig = dot(p, p);

  // ---- the ride: per frame, the same for every pixel ----
  float T = uTime * 9.0 + uBassTime * 12.0;
  float hw = pistewidth * 1.6;
  float cT = curveAt(T);

  float b = uBarPhase * 4.0;                       // beats into the bar
  float bc0 = uBeatClock - b;                      // the beat clock at this bar's downbeat
  float G = smoothstep(0.12, 0.5, uEnergy);        // no music, no kickers
  float jumpNow = G * airWin(bc0);                 // the jump this bar launched
  float jumpNext = G * airWin(bc0 + 4.0);          // the kicker waiting at the next downbeat
  float u = clamp(b / 3.0, 0.0, 1.0);
  float q2 = 2.0 * u - 1.0; q2 *= q2;
  float air = jumpNow * (1.0 - q2 * q2);           // fast up, long hang, fast down
  float lx = max(b - 3.0, 0.0) * 6.0;              // time since touchdown
  float land = jumpNow * step(3.0, b) * exp(-lx * 0.6);
  float squash = jumpNow * lx * exp(1.0 - lx);     // knees take the landing
  float zk1 = (4.0 - b) * KU;                      // distance to the next lip
  float zk0 = zk1 - KL;
  float lip = jumpNext * clamp(-zk0 / KL, 0.0, 1.0) + jumpNow * clamp(1.0 - b / 0.4, 0.0, 1.0);
  float hop = (uBassHit * uBassHit * 0.45 + uMidHit * uMidHit * 0.25) * (1.0 - air);
  float camH = 1.0 + air * 5.2 + lip * 1.5 + hop - squash * 0.3;
  float hY = -0.03 + air * 0.15 - lip * 0.06 + squash * 0.03;

  float carve = sin(uBarPhase * TAU) * smoothstep(0.05, 0.3, uEnergy) * (1.0 - air);
  float camOff = (carve * 0.32 + sin(uTime * 0.31) * 0.12) * hw;
  float hd = (curveAt(T + 12.0) - cT - camOff) / 12.0;             // heading: look where the piste goes
  float turn = (curveAt(T + 30.0) - curveAt(T + 12.0)) / 18.0 - hd;
  float camRoll = -clamp(turn * 1.5, -0.3, 0.3) + carve * 0.10
                + sin(bc0 * (TAU / 8.0) + 0.6) * 0.30 * sin(PI * u) * jumpNow   // tweak it in the air
                + sin(uTime * 0.23) * 0.015;
  float zoom = 1.0 + 0.05 * uBass + 0.16 * land - 0.04 * lip;
  p = rot(camRoll) * p * zoom;
  float pxz = px * zoom;
  float sx = p.x + hd * F;                         // bearing: what is far away pans with the heading
  float d = hY - p.y;
  float e = -d;

  // afterglow along the horizon: colour 3, leaning to colour 1 on the left and colour 2 on the right
  vec3 dusk = mix(uColor3, mix(uColor1, uColor2, smoothstep(-0.9, 0.9, sx)), 0.35);
  vec3 hazeC = dusk * 0.30 + vec3(0.012, 0.018, 0.04);
  vec3 moonC = mix(vec3(0.84, 0.90, 1.0), uColor3, 0.22);
  float flick = 0.75 + 0.6 * uHighHit;
  vec3 color;

  if (d < 0.0) {
    // ---- sky ----
    color = mix(hazeC * 1.5, vec3(0.003, 0.006, 0.018) + uColor3 * 0.015, pow(clamp(e / 0.5, 0.0, 1.0), 0.45));
    vec2 sg = vec2(sx, e) * 64.0;
    vec2 si = floor(sg);
    float sh = hash(si);
    if (sh > 0.90) {
      vec2 sf = fract(sg) - 0.5 - (vec2(hash(si + 1.7), hash(si + 5.3)) - 0.5) * 0.7;
      color += moonC * smoothstep(0.11, 0.0, length(sf)) * fract(sh * 57.0) * 1.3
             * (0.55 + 0.45 * sin(uTime * 2.0 + sh * 200.0)) * smoothstep(0.08, 0.3, e);
    }
    float md = length(vec2(sx - 0.50, e - 0.41));
    color += moonC * (smoothstep(0.040, 0.036, md) * (0.7 + 0.3 * smoothstep(0.055, 0.0, length(vec2(sx - 0.515, e - 0.422))))
                      + 0.010 / (md + 0.06));

    // three ranges, far to near. Ridge lines fall away down-left from every summit:
    // the faces right of them catch the moon, the others stay in blue shadow.
    for (int m = 0; m < 3; m++) {
      float fm = float(m);
      float mx = sx * (0.60 + fm * 0.35) + fm * 3.7 + 0.25;
      float amp = 0.36 - fm * 0.13;
      float sd0 = fm * 1.9;
      float hgt = 0.085 - fm * 0.035 + amp * crest(mx, sd0);
      float dep = hgt - e;
      if (dep > 0.0) {
        float fx = mx + dep * 0.55;
        float face = smoothstep(0.003, -0.003, crest(fx + 0.012, sd0) - crest(fx - 0.012, sd0));
        float spur = step(0.5, fract(fx * 3.35 + sd0 * 1.55 - dep * 5.0));          // smaller facets across the big ones
        vec3 mc = mix((vec3(0.018, 0.028, 0.07) + dusk * 0.035) * (0.7 + 0.6 * spur),
                      moonC * (0.52 - fm * 0.14) * (0.72 + 0.28 * spur), face);
        mc *= 1.0 - 0.4 * smoothstep(0.0, amp, dep);
        mc = mix(mc, vec3(0.005, 0.011, 0.02), step(1.5, fm) * 0.9);                 // nearest: a wooded ridge
        mc += dusk * smoothstep(0.009, 0.0, dep) * (0.5 - fm * 0.12);                // rim along the ridge line
        mc = mix(mc, hazeC * (1.25 - fm * 0.25), smoothstep(amp * 0.2, amp * 1.05, dep) * (0.88 - fm * 0.25));
        if (m == 2) {
          // the resort below: a few windows and lifts on the near ridge
          vec2 lg = vec2(mx * 46.0, dep * 90.0);
          float lh = hash(floor(lg) + 9.1);
          if (lh > 0.80 && dep > 0.008 && dep < 0.06) {
            mc += mix(vec3(1.0, 0.8, 0.5), pal3(floor(lh * 90.0)), 0.5) * smoothstep(0.35, 0.0, length(fract(lg) - 0.5))
                * (0.5 + 0.5 * sin(uTime * 3.0 + lh * 80.0)) * 0.9;
          }
        }
        color = mc;
      }
    }
    color += hazeC * exp(-e * 16.0) * 0.9;

    // searchlights from the finish area, sweeping on the phrase
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      vec2 v = vec2(sx + 0.78 - fk * 0.52, e - 0.02);
      float an = sin(uBeatClock * (PI / 8.0) * (1.0 + 0.25 * fk) + fk * 2.1) * 0.8;
      vec2 dir = vec2(sin(an), cos(an));
      float al = dot(v, dir);
      float pe = abs(v.x * dir.y - v.y * dir.x);
      color += pal3(fk) * smoothstep(0.012 + al * 0.07, 0.0, pe) * step(0.0, al) * exp(-al * 2.4)
             * (0.16 + 0.45 * uMid + 0.25 * uBeat);
    }

    // fireworks while we hang: three shells, one per palette colour
    if (jumpNow > 0.02) {
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float age = (b - 0.2 - fk * 0.5) / 2.2;
        if (age > 0.0 && age < 1.0) {
          vec2 v = vec2(p.x - (fk - 1.0) * 0.50 - 0.12 * sin(bc0 * 1.3 + fk * 2.0),
                        e - 0.25 - 0.06 * sin(bc0 * 0.7 + fk * 2.4));
          float ia = 1.0 - age;
          float R = (0.27 + 0.05 * fk) * (1.0 - ia * ia * ia) * (0.6 + 0.4 * jumpNow);
          float r = length(v);
          if (r < R * 1.1 + 0.03) {
            v.y += age * age * 0.09 * min(r / R, 1.2);                 // the sparks sag as they burn out
            r = length(v);
            float aa = atan(v.y, v.x) / TAU;
            float fade = ia * ia * 2.2 * jumpNow;
            vec3 fc = pal3(fk);
            for (int q = 0; q < 2; q++) {                              // an outer shell and a smaller one inside it
              float fq = float(q);
              float n = 38.0 - fq * 16.0;
              float a = aa * n + fq * 0.5;
              float ri = floor(a);
              float rr = R * (1.0 - fq * 0.42) * (0.70 + 0.30 * hash(vec2(ri, fk + fq * 3.0)));
              float arc = abs(fract(a) - 0.5) * r * (TAU / n);
              float along = r / rr;
              float trail = smoothstep(0.0018 * lw, 0.0, arc) * smoothstep(0.45, 1.0, along) * step(along, 1.0);
              float head = smoothstep(0.006, 0.0, length(vec2(arc, r - rr)));
              color += (fc * trail * 0.9 + mix(fc, vec3(1.0), 0.6) * head * 2.0) * fade * (0.6 + 0.4 * sin(uTime * 37.0 + ri * 5.0));
            }
            color += fc * (exp(-r * r / (R * R * 0.5 + 1e-4)) * 0.14 * ia + exp(-r * 22.0) * max(1.0 - age * 6.0, 0.0) * 1.5);
          }
        }
      }
    }
  } else {
    // ---- snow ----
    float z = camH * F / max(d, 1e-4);
    float zw = T + z;
    float lat = p.x * z / F + camOff + z * hd;
    float pl = lat - (curveAt(zw) - cT);            // position across the piste
    float ap = abs(pl);
    float wpx = z * pxz / F;                        // world width of a pixel here
    float wz = wpx * z / (camH * F);                // and its length down the hill
    float fog = exp(-z * FOG);

    float dune = sin(zw * 0.31 + sin(pl * 0.5) * 1.2) * sin(pl * 0.37 + zw * 0.07 + 1.0);
    vec3 shade = vec3(0.014, 0.022, 0.055) + uColor3 * 0.025;
    vec3 lit = moonC * 0.46;
    float onP = smoothstep(hw + max(0.10, wpx * 2.0), hw, ap);
    vec3 snow = mix(shade, lit * 0.6, smoothstep(-0.1, 0.8, dune));                // powder off the piste
    vec3 ec = pl < 0.0 ? uColor1 : uColor2;         // the side we are on: colour 1 left, colour 2 right
    snow += mix(moonC, ec, 0.55) * 0.46 * (0.30 * smoothstep(hw + 1.6, hw + 0.1, ap) + 0.22 * exp(-max(ap - hw, 0.0) * 0.22));   // berm, spill of the lights
    if (ap > hw + 3.0) {
      // woods further out: patches of crowns, moonlit on one side
      float wood = smoothstep(0.42, 0.58, vnoise(vec2(pl * 0.11, zw * 0.07))) * smoothstep(hw + 3.0, hw + 5.5, ap);
      vec2 tg = vec2(pl * 0.9, zw * 0.3);
      vec2 ti = floor(tg);
      vec2 tf = fract(tg) - 0.5 - (vec2(hash(ti), hash(ti + 4.7)) - 0.5) * 0.6;
      float crown = smoothstep(0.40, 0.18, length(tf));
      snow = mix(snow, mix(vec3(0.005, 0.012, 0.02), lit * 0.55, crown * smoothstep(-0.05, 0.25, tf.x - tf.y * 0.5)), wood);
    }
    float cord = sin(pl * 55.0) * clamp(1.0 - wpx * 28.0, 0.0, 1.0);               // corduroy
    vec3 piste = mix(shade * 2.0, lit, 0.72 + 0.14 * dune) * (1.0 + 0.10 * cord);
    // two old lines carved down the fall line
    float tw = max(0.03, wpx * 1.5);
    float cut = smoothstep(tw, tw * 0.3, abs(pl - sin(zw * 0.21) * hw * 0.5))
              + smoothstep(tw, tw * 0.3, abs(pl + sin(zw * 0.17 + 2.0) * hw * 0.55));
    piste *= 1.0 - 0.28 * cut * clamp(1.0 - wpx * 12.0, 0.0, 1.0);
    snow = mix(snow, piste, onP);

    // each gate floods the snow under it with its colour
    float gi = floor(zw / GS + 0.5);
    float gdz = abs(zw - gi * GS);
    float gex = gateAt(gi);
    float gw = 1.0 - 2.0 * gdz / GS;
    float pool = gex * gw * gw * exp(-pl * pl / (hw * hw * 1.6 + 1.0));
    snow += mix(pal3(gi), vec3(1.0), 0.2) * pool * (0.30 + 0.5 * uBassHit + 0.16 * uBeat);

    // a lift line through the woods on the left: one lamp per pylon
    vec2 lp = vec2(pl + hw + 12.0, mod(zw, 7.0) - 3.5);
    snow += vec3(1.0, 0.9, 0.75) * 0.5 / (1.0 + dot(lp, lp) * 4.0);

    // the crowd at each gate, behind the boards: phones and camera flashes, no faces
    float crowd = gex * smoothstep(4.0, 2.0, gdz) * smoothstep(hw + 1.1, hw + 1.6, ap) * smoothstep(hw + 5.0, hw + 3.5, ap);
    if (crowd > 0.0) {
      vec2 cg = vec2(pl, zw) * 4.5;
      float chh = hash(floor(cg));
      cg += (vec2(fract(chh * 13.0), fract(chh * 7.0)) - 0.5) * 0.6;
      float fl = smoothstep(0.90, 1.0, fract(chh * 31.0 + uHighTime * 1.3 + uTime * 0.35));
      snow += mix(pal3(floor(chh * 60.0)), vec3(1.0), 0.3 + 0.7 * fl) * crowd * step(0.5, chh)
            * smoothstep(0.38, 0.1, length(fract(cg) - 0.5)) * (0.22 + 1.6 * fl);
    }

    // boost pad every 40 units, between two gate slots: chevrons running down the hill, lit by the bass
    float pv = (zw - (floor((zw - 5.0) / 40.0) + 0.5) * 40.0 - 5.0) / 2.4;
    float pu = pl / (hw * 0.42);
    if (abs(pv) < 1.0 && abs(pu) < 1.0) {
      float ch = fract((pv + abs(pu) * 0.45) * 2.0 - uTime * 1.3);
      float chev = smoothstep(0.30, 0.24, ch) * smoothstep(0.0, 0.05, ch);
      chev = mix(0.27, chev, clamp(1.0 - wz * 2.0, 0.0, 1.0));
      float padE = smoothstep(1.0, 0.85, max(abs(pv), abs(pu)));
      snow += uColor1 * padE * (0.05 + chev * (0.55 + 2.0 * uBass + 0.8 * uBassHit));
    }

    // neon ropes: colour 1 on the left edge, colour 2 on the right
    float sd = step(0.0, pl);
    float ed = abs(ap - hw);
    float dash = mix(0.72, 0.45 + 0.55 * step(0.5, fract(zw * 0.25 + sd * 0.5)), clamp(1.0 - wz * 0.6, 0.0, 1.0));
    float ew = max(0.03, wpx * 1.1) * lw;
    snow += ec * exp(-ed * 2.4) * 0.26 * dash * (0.7 + 0.9 * uBassHit);
    snow = mix(snow, ec * 1.7 + 0.25, smoothstep(ew, ew * 0.35, ed) * dash);

    // glints on the hats
    vec2 gg = vec2(pl * 24.0, zw * 8.0);
    float gh = hash(floor(gg));
    if (gh > 0.985) {
      snow += moonC * smoothstep(0.4, 0.0, length(fract(gg) - 0.5)) * (0.3 + 1.6 * uHigh + 1.0 * uHighHit)
            * clamp(1.0 - wpx * 14.0, 0.0, 1.0) * (0.5 + 0.5 * sin(uTime * 5.0 + gh * 900.0));
    }

    // grind rail: a neon tube a little above the snow, and its glow under it
    float rh = hash(vec2(floor(zw / 46.0), 4.2));
    float rf = fract(zw / 46.0);
    if (rh > 0.4 && rf > 0.2 && rf < 0.7) snow += uColor3 * exp(-abs(pl - (rh > 0.7 ? 0.5 : -0.5) * hw) * 4.5) * 0.32;
    if (camH > 0.6) {
      float z2 = (camH - 0.45) * F / max(d, 1e-4);
      float zw2 = T + z2;
      float rh2 = hash(vec2(floor(zw2 / 46.0), 4.2));
      float rf2 = fract(zw2 / 46.0);
      if (rh2 > 0.4 && rf2 > 0.2 && rf2 < 0.7) {
        float pr = p.x * z2 / F + camOff + z2 * hd - (curveAt(zw2) - cT) - (rh2 > 0.7 ? 0.5 : -0.5) * hw;
        float rw = max(0.03, z2 * pxz / F * 1.3) * lw;
        snow = mix(snow, uColor3 * 1.6 + 0.35, smoothstep(rw, rw * 0.3, abs(pr)));
      }
    }

    // touchdown: a ring runs out over the snow from where we landed
    if (land > 0.01) {
      float ring = abs(length(vec2(lat - camOff, z)) - lx * 2.6);
      snow += mix(uColor1, uColor3, 0.5) * smoothstep(0.9, 0.0, ring) * land * 1.4;
    }

    color = mix(hazeC * 1.1, snow, fog);
    // the valley floor where the piste runs out: the lights of the village
    if (d < 0.05) {
      vec2 vg = vec2(sx * 120.0, d * 500.0);
      float vh = hash(floor(vg) + 2.3);
      if (vh > 0.82) {
        color += mix(vec3(1.0, 0.85, 0.6), pal3(floor(vh * 70.0)), 0.6) * smoothstep(0.4, 0.0, length(fract(vg) - 0.5))
               * smoothstep(0.05, 0.03, d) * smoothstep(0.002, 0.008, d) * (0.45 + 0.4 * sin(uTime * 2.5 + vh * 300.0));
      }
    }
  }
  color += hazeC * exp(-abs(d) * 45.0) * 0.35;

  // ---- trackside, far to near: pines, floodlight masts, LED boards ----
  float slot0 = floor(T / SL);
  float tall = max(12.0 - camH, 0.0);
  for (int i = 11; i >= 0; i--) {
    float sid = slot0 + float(i);
    float zr = sid * SL - T;                        // slot start, (-SL, 0] + i * SL ahead of us
    float zn = max(zr + 0.5, 0.2);
    // rows this slot can touch: skip the rest before any hash or curve
    if (p.y < hY - camH * F / zn - 0.01 || p.y > hY + tall * F / zn) continue;
    for (int k = 0; k < 2; k++) {
      float side = k == 0 ? -1.0 : 1.0;
      float h1 = hash(vec2(sid, side * 7.3));
      vec3 sc = k == 0 ? uColor1 : uColor2;

      // the pine or the mast stands behind the board of its slot: draw it first
      float zt = zr + 5.1;
      if (zt > 0.5) {
        float s = F / zt;
        float cz = curveAt(T + zt) - cT - camOff - zt * hd;
        float yg = hY - camH * s;
        float vis = smoothstep(72.0, 62.0, zt) * smoothstep(1.3, 0.6, (camH - 3.0) / zt);   // billboards: gone when seen from above
        float fo = exp(-zt * FOG);
        if (mod(sid, 4.0) < 0.5 && (mod(sid, 8.0) < 0.5) == (k == 0)) {
          vec2 lq = vec2(p.x - (side * (hw + 1.5) + cz) * s, p.y - yg) / s;          // world units in the mast's plane
          if (abs(lq.x) < max(0.07, pxz / s) && lq.y > 0.0 && lq.y < 8.0) color = mix(color, mix(hazeC, vec3(0.012, 0.016, 0.026), fo), vis);
          lq.y -= 8.0;
          vec3 lc = mix(vec3(1.0, 0.96, 0.88), sc, 0.3);
          float lens = step(abs(lq.x), 0.75) * step(abs(lq.y), 0.30) * step(0.2, fract(lq.x * 2.0 + 0.5)) * step(0.14, abs(lq.y));
          color = mix(color, lc * 2.6, lens * fo * vis);
          color += lc * fo * vis * flick * 0.55 / (1.0 + dot(lq, lq) * 6.0);          // glare
          vec2 dir = normalize(vec2(-side * (1.5 + hw * 0.4), -8.0));                // the flood aims at the piste
          float al = dot(lq, dir);
          color += lc * fo * vis * 0.13 * smoothstep(0.3 + al * 0.32, 0.0, abs(lq.x * dir.y - lq.y * dir.x))
                 * step(0.0, al) * smoothstep(8.5, 1.0, al);
        } else {
          float th = fract(h1 * 13.7);
          float Hw = 2.6 + th * 1.9;
          float dx = p.x - (side * (hw + 1.9 + th * 3.2) + cz) * s;
          float ty = (p.y - yg) / (Hw * s);
          float bw = 0.28 * Hw * s;
          if (ty > 0.0 && ty < 1.0 && abs(dx) < bw) {
            float tier = fract(ty * 4.5);
            float hwid = bw * (ty < 0.07 ? 0.09 : (1.0 - ty) * (0.45 + 0.55 * (1.0 - tier)));
            if (abs(dx) < hwid) {
              float rim = -side * dx / hwid;                                         // +1 on the edge facing the piste
              vec3 pc = vec3(0.007, 0.02, 0.03) + uColor3 * 0.012;
              pc = mix(pc, moonC * 0.40, smoothstep(0.5, 0.95, tier) * step(0.07, ty) * smoothstep(-0.9, 0.4, rim * side));   // snow on the boughs, moon side
              pc += sc * smoothstep(0.35, 1.0, rim) * 0.34;                          // lit by its rope
              color = mix(color, mix(hazeC, pc, fo), vis);
            }
          }
        }
      }

      // LED board along the edge, seen in perspective: 1/z is linear across it
      float zB = zr + 4.0;
      if (h1 > 0.3 && zB > 0.6) {
        float eL = side * (hw + 0.6) - cT - camOff;
        float xa = F * (eL + curveAt(T + zn) - zn * hd) / zn;
        float xb = F * (eL + curveAt(T + zB) - zB * hd) / zB;
        float tt = (p.x - xa) / (xb - xa);
        if (tt > 0.0 && tt < 1.0) {
          float iz = mix(1.0 / zn, 1.0 / zB, tt);
          float v = (p.y - hY + (camH - 0.25) * F * iz) / (F * iz);
          if (v > 0.0 && v < 1.0) {
            float uu = (1.0 / iz - zr - 0.5) / 3.5;
            float st = floor(h1 * 40.0);
            float kind = mod(st, 4.0);
            float m = kind < 1.0 ? step(0.5, fract(uu * 3.0 + v * 0.8))
                    : kind < 2.0 ? step(0.5, fract(uu * 2.5 - abs(v - 0.5) * 1.3 - uTime * 0.6))
                    : kind < 3.0 ? step(abs(v - 0.5), 0.24)
                    : mod(floor(uu * 7.0) + floor(v * 2.0), 2.0);
            vec3 art = mix(pal3(st) * 0.12, pal3(st + 1.0) * 1.05, m) * (0.7 + 0.6 * uHighHit * step(0.5, fract(h1 * 91.0)));
            art *= 0.8 + 0.2 * step(0.5, fract(v * 14.0));                             // LED rows
            art = mix(art, vec3(0.01), step(0.90, max(abs(v - 0.5) * 2.0, abs(uu - 0.5) * 2.0)));
            color = mix(color, mix(hazeC, art, exp(-FOG / iz)), smoothstep(1.4, 0.7, (camH - 1.2) * iz));
          }
        }
      }
    }
  }

  // ---- gates, far to near: truss arch, LED strip, banner, spots ----
  if (gates >= 0.5) {
    float g0 = floor(T / GS);
    for (int j = 7; j >= 0; j--) {
      float gi = g0 + float(j) + 1.0;
      float gex = gateAt(gi);
      if (gex <= 0.0) continue;
      float zr = gi * GS - T;
      float s = F / zr;
      float yg = hY - camH * s;
      const float Hg = 4.4;
      if (p.y < yg - 0.01 || p.y > yg + (Hg + 1.2) * s) continue;
      vec2 g = vec2(p.x - (curveAt(gi * GS) - cT - camOff - zr * hd) * s, p.y - yg) / s;   // world units in the gate's plane
      float gx = abs(g.x);
      float legIn = hw + 0.3;
      if (gx > legIn + 1.5) continue;
      vec3 gc = pal3(gi);
      float fg = exp(-zr * FOG);
      float pw = pxz / s;
      float under = Hg - 0.5;
      float gvis = gex * smoothstep(0.9, 0.4, (camH - 2.2) / zr);
      vec3 gcol = vec3(0.0);
      float galpha = 0.0;
      // structure: two truss legs and the beam
      float leg = step(abs(gx - legIn - 0.15), max(0.15, pw)) * step(0.0, g.y) * step(g.y, Hg);
      float beam = step(gx, legIn + 0.30) * step(under, g.y) * step(g.y, Hg);
      if (leg + beam > 0.0) {
        float lattice = max(step(0.76, tri((g.x + g.y) * 1.7)), step(0.76, tri((g.x - g.y) * 1.7)));
        gcol = vec3(0.015, 0.02, 0.032) + (moonC * 0.20 + gc * 0.12) * lattice;
        galpha = 1.0;
      }
      // banner hanging under the beam, pennant-cut along the bottom
      float bu = g.x / (hw * 0.55);
      float bv = (under - g.y) / (0.85 + 0.14 * tri(bu * 1.5 + 0.25));
      if (abs(bu) < 1.0 && bv > 0.0 && bv < 1.0) {
        float slash = step(0.5, fract(bu * 2.5 + bv * 0.5)) * step(0.28, bv) * step(bv, 0.72);
        gcol = mix(gc * 0.55, mix(gc, vec3(1.0), 0.6) * 0.85, slash) * (0.8 + 0.3 * uBeat);
        galpha = 1.0;
      }
      // LED strip under the beam and down the inside of the legs
      float lwd = max(0.028, pw * 1.2) * lw;
      float led = min(step(gx, legIn) * smoothstep(lwd, lwd * 0.3, abs(g.y - under))
                + step(g.y, under) * step(0.0, g.y) * smoothstep(lwd, lwd * 0.3, abs(gx - legIn)), 1.0);
      gcol = mix(gcol, gc * 1.8 + 0.25, led);
      galpha = max(galpha, led);
      color = mix(color, mix(hazeC, gcol, fg), galpha * gvis);
      // four spots under the beam: glare, and their shafts in the haze
      vec2 l1 = vec2(gx - hw * 0.28, g.y - under), l2 = vec2(gx - hw * 0.80, g.y - under);
      float glare = 0.030 / (dot(l1, l1) + 0.03) + 0.030 / (dot(l2, l2) + 0.03);
      float shaft = (smoothstep(0.10 - l1.y * 0.16, 0.0, abs(l1.x)) + smoothstep(0.10 - l2.y * 0.16, 0.0, abs(l2.x)))
                  * step(l1.y, 0.0) * smoothstep(-under, -0.3, l1.y);
      color += mix(gc, vec3(1.0), 0.35) * (glare * flick + shaft * 0.10) * fg * gvis;
    }
  }

  // ---- the kicker of the next downbeat: ray against the ramp face ----
  if (jumpNext > 0.03 && zk1 > 0.4) {
    float ks = jumpNext * 1.5 / KL;
    float den = ks + d / F;
    if (den > 1e-3) {
      float zr = (camH + ks * zk0) / den;
      if (zr > max(zk0, 0.3) && zr < zk1) {
        float pk = p.x * zr / F + camOff + zr * hd - (curveAt(T + zr) - cT);
        float kw = hw * 0.82;
        if (abs(pk) < kw) {
          float v = (zr - zk0) / KL;                 // 0 at the foot, 1 at the lip
          float ku = pk / kw;
          float kpx = zr * pxz / F;
          vec3 kc = moonC * (0.40 + 0.26 * v) * (1.0 + 0.09 * sin(pk * 55.0) * clamp(1.0 - kpx * 28.0, 0.0, 1.0));
          vec3 kn = mix(uColor1, uColor2, step(0.0, ku));
          float ch = fract(v * 3.0 - abs(ku) * 0.6 - uBeatClock * 0.5);
          kc += kn * smoothstep(0.22, 0.16, ch) * smoothstep(0.0, 0.05, ch) * step(abs(ku), 0.72) * 1.1;   // chevrons up the face
          float kl = max(0.035, kpx * 1.2) * lw / kw;
          kc = mix(kc, kn * 1.7 + 0.25, smoothstep(kl, kl * 0.3, abs(abs(ku) - 0.86)));                 // ropes up both edges
          kc = mix(kc, uColor3 * 1.6 + 0.5, smoothstep(0.91, 0.94, v));                                 // the lip, lit
          kc = mix(kc, vec3(0.015, 0.025, 0.045), smoothstep(0.93, 1.0, abs(ku)) * 0.8);                // cheeks
          color = mix(hazeC * 1.1, kc, exp(-zr * FOG));
        }
      }
    }
  }

  // ---- flakes and boost streaks out of the vanishing point (log-polar: a cell is a flake at every distance) ----
  vec2 vq = vec2(p.x, e);
  float vr = length(vq) + 1e-4;
  float va = atan(vq.y, vq.x) / TAU;
  float lr = log(vr);
  float Ts = uTime * 1.2 + uBassTime * 2.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float na = 26.0 + fl * 22.0;
    vec2 g = vec2(va * na, lr * (2.0 + fl * 0.8) - Ts * (0.8 + fl * 0.35));
    vec2 id = floor(g);
    float h = hash(id + fl * 17.3);
    if (h > 0.76) {
      vec2 f = fract(g) - 0.5;
      f.x -= (hash(id + 3.1) - 0.5) * 0.6;
      float wc = (0.0016 + 0.0032 * vr) * na / (TAU * vr);          // the same few pixels wide at every distance
      float fk = smoothstep(wc, 0.0, abs(f.x)) * smoothstep(0.05 + 0.22 * uBass + 0.2 * land, 0.0, abs(f.y));
      color += moonC * fk * (0.25 + 0.8 * uHigh + 0.5 * uHighHit) * smoothstep(0.03, 0.3, vr) * (1.0 - 0.5 * air);
    }
  }
  float boost = smoothstep(0.35, 0.9, uBass) * 0.5 + land * 1.3;
  if (boost > 0.03 && vr > 0.36) {
    float ga = va * 110.0;
    float h = hash(vec2(floor(ga), 2.7));
    float run = smoothstep(0.5, 0.0, abs(fract(lr * 1.1 - Ts * 1.3 + h * 7.0) - 0.5));
    color += pal3(floor(ga)) * step(0.70, h) * smoothstep(0.08 * lw, 0.0, abs(fract(ga) - 0.5)) * run
           * boost * smoothstep(0.42, 1.0, vr) * 1.1;
  }

  // ---- spray: a tail off the carving edge, a puff on every kick, a wall on touchdown ----
  // a soft cloud plus sparse flecks, each a short dash thrown outward (polar cells, one in four filled)
  if (p.y < hY + 0.30) {
    float sprayT = uTime * 2.0 + uHighTime * 5.0;
    for (int k = 0; k < 2; k++) {
      float side = k == 0 ? -1.0 : 1.0;
      float amt = (0.25 + 0.9 * max(side * carve, 0.0)) * (1.0 - air) * (0.3 + 0.9 * uHigh + 0.6 * uHighHit + 0.4 * uBass);
      vec2 v = p - vec2(side * 0.46, -0.60);
      v.x *= side;
      float r = length(v);
      float a = atan(v.x, v.y);
      float env = smoothstep(0.80, 0.10, abs(a - 0.40)) * exp(-r * 4.6) * amt;
      if (env > 0.004) {
        float cloud = vnoise(v * 9.0 - vec2(0.5, 1.0) * sprayT);
        vec2 g = vec2(a * 30.0, r * 13.0 - sprayT * 2.5);
        vec2 id = floor(g);
        float h = hash(id + side * 31.0);
        vec2 fq = fract(g) - 0.5 - vec2(fract(h * 17.0) - 0.5, fract(h * 29.0) - 0.5) * 0.7;
        float fleck = step(0.74, h) * smoothstep(0.16, 0.0, abs(fq.x)) * smoothstep(0.22, 0.0, abs(fq.y));
        color += mix(moonC, k == 0 ? uColor1 : uColor2, 0.35) * env * (cloud * cloud * 2.2 + fleck * 5.0);
      }
    }
    float burst = (uBassHit * uBassHit * 0.9 + uMidHit * uMidHit * 0.4) * (1.0 - air) + land * 1.6;
    if (burst > 0.01) {
      vec2 v = p - vec2(0.0, -0.70);
      float r = length(v);
      float a = atan(v.x, v.y);
      float front = 0.34 + 0.5 * (1.0 - exp(-lx * 0.7));
      float env = smoothstep(1.35, 0.2, abs(a)) * smoothstep(front + 0.20, front - 0.30, r) * burst;
      if (env > 0.004) {
        float cloud = vnoise(vec2(v.x * 6.0, v.y * 6.0 - sprayT * 0.6 - lx));
        vec2 g = vec2(a * 36.0, r * 12.0 - sprayT * 1.5 - lx * 2.0);
        float h = hash(floor(g) + 5.5);
        vec2 fq = fract(g) - 0.5 - vec2(fract(h * 17.0) - 0.5, fract(h * 29.0) - 0.5) * 0.7;
        float fleck = step(0.74, h) * smoothstep(0.16, 0.0, abs(fq.x)) * smoothstep(0.22, 0.0, abs(fq.y));
        color += moonC * env * (cloud * cloud * 1.5 + fleck * 3.0);
      }
    }
  }
  color += moonC * land * 0.08;                     // the flash of the impact

  color *= 1.0 - 0.30 * vig;
  color = color / (1.0 + 0.12 * color);             // soft shoulder: the neon stays coloured on the peaks
  gl_FragColor = vec4(color, 1.0);
}

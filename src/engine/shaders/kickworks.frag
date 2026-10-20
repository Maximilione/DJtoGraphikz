precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float gravity;
uniform float burst;
uniform float trail;

// Kickworks: stateless fireworks locked to the beat clock. Every beat index
// is a shell; its seed, place and type come from hash(index), so both windows
// draw the same sky. A shell has one age s (beats since the burst), so all its
// sparks share gravity and drag: the pixel is moved into the burst frame
// (a translation plus one scale) and only the angular sector it falls in, and
// the two neighbours, are tested. No loop over sparks. Written from the
// maths, palette is ours (colours 1/2/3 by hue, hot white at the birth).

const float TAU = 6.2831853;

float hash11(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sh(float idx, float n) { return hash11(mod(idx + n * 31.0, 997.0)); }

float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// distance to segment ab and the position along it (0 at a, 1 at b)
vec2 seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}

vec3 palette(float hue) {
  return hue < 0.66 ? mix(uColor1, uColor2, hue / 0.66) : uColor3;
}

// angular sector of a burst-frame offset w (ring shells are un-squashed first)
float sectorOf(vec2 w, float sq, float tilt, float N) {
  vec2 q = rot(w, -tilt);
  q.y /= sq;
  return floor(atan(q.y, q.x + 1e-6) / TAU * N);
}

// type: 1 peony, 2 chrysanthemum, 3 ring, 4 willow
float sparks(vec2 p, vec2 c, float s, float idx, float type, float Rmax,
             float L, float sq, float tilt) {
  bool willow = type > 3.5;
  float drag = willow ? 1.4 : 1.8;
  float gk = 0.05 * gravity * (willow ? 2.2 : 1.0);
  float D = Rmax * (1.0 - exp(-drag * s));
  float G = gk * s * s;

  float dt = (willow ? 0.5 : 0.3) * trail;
  float s1 = max(s - dt, 0.0), s2 = max(s - 2.0 * dt, 0.0);
  float D1 = Rmax * (1.0 - exp(-drag * s1)), G1 = gk * s1 * s1;
  float D2 = Rmax * (1.0 - exp(-drag * s2)), G2 = gk * s2 * s2;
  float GT = willow ? G2 : G1;

  // every head, tail point and glow lies in this circle (heads in the frame
  // dropped by G, tail ends in the frame dropped by GT, glow reach <= 0.045)
  vec2 w = p - c + vec2(0.0, G);
  vec2 wT = p - c + vec2(0.0, GT);
  if (length(p - c + vec2(0.0, 0.5 * (G + GT))) > D + 0.5 * (G - GT) + 0.05) return 0.0;

  float life = clamp(s / L, 0.0, 1.0);
  float f = pow(max(1.0 - life, 0.0), 1.3) * smoothstep(0.0, 0.04, s);
  float tw = smoothstep(0.4, 0.8, life) * (0.5 + 0.5 * uHigh);
  float tick = floor(uTime * (18.0 + 20.0 * uHigh));
  float crT = mod(floor(uTime * 25.0), 997.0);

  float N = max(floor(density), 8.0);
  // Only the pixel's sector and its two neighbours are tested, in the head
  // frame and (when gravity has bent the tail into other sectors) in the tail
  // frame too. Every glow is windowed to zero within rw, the distance below
  // which no untested spark can be, so sector edges never show as seams.
  float secA = sectorOf(w, sq, tilt, N);
  float secT = sectorOf(wT, sq, tilt, N);
  float secAm = mod(secA, N);
  float rw = clamp(0.8 * min(length(w), length(wT)) * TAU / N * sq, 0.003, 0.045);

  float acc = 0.0;
  for (int i = 0; i < 6; i++) {
    float k;
    if (i < 3) k = mod(secA + float(i - 1), N);
    else {
      k = mod(secT + float(i - 4), N);
      if (mod(k - secAm + 1.0, N) < 2.5) continue;   // already tested
    }
    float hk = hash11(mod(k + idx * 7.0, 997.0));
    float ak = (k + 0.5 + 0.35 * (hk - 0.5)) / N * TAU;
    vec2 dir = rot(vec2(cos(ak), sin(ak) * sq), tilt);
    float twinkle = mix(1.0, step(0.45, hash11(mod(k * 13.1 + tick, 997.0))), tw);
    float bri = (0.6 + 0.8 * hk) * f * twinkle;

    for (int m = 0; m < 2; m++) {
      float v;
      if (type < 1.5) v = 0.8 + 0.2 * hk;
      else if (type < 2.5) {
        // sphere shell seen from the side: most sparks pile up on the rim
        v = sqrt(max(1.0 - hk * hk, 0.0));
        if (m == 1) v *= 0.55;
      } else if (type < 3.5) v = 1.0;
      else v = 0.7 + 0.3 * hk;
      if (m == 1 && (type < 1.5 || type > 2.5)) break;

      vec2 A = c + dir * v * D - vec2(0.0, G);
      // the comet tail is the glowing trace left behind: at least a fixed
      // share of the radius, shrinking as the star burns out, so the corolla
      // reads as streaks even after drag has stopped the expansion
      float rB = willow ? D1 : min(D1, D * (1.0 - 0.32 * trail * (1.0 - 0.5 * life)));
      vec2 B = c + dir * v * rB - vec2(0.0, G1);
      vec2 dh = p - A;
      float dA = length(dh);
      vec2 sg = seg(p, A, B);
      // heads: small and uneven, so the corolla reads as sparks, not beads
      float sp = 0.00006 * (0.5 + hk) / (dA * dA + 0.000008) * (1.0 - smoothstep(0.35 * rw, rw, dA));
      float tailEnd = willow ? 0.4 : 0.1;
      sp += 0.0006 / (sg.x + 0.001) * mix(1.0, tailEnd, sg.y)
          * (1.0 - smoothstep(0.35 * rw, rw, sg.x));
      if (willow) {
        vec2 C = c + dir * v * D2 - vec2(0.0, G2);
        vec2 sg2 = seg(p, B, C);
        sp += 0.0005 / (sg2.x + 0.001) * mix(0.4, 0.05, sg2.y)
            * (1.0 - smoothstep(0.35 * rw, rw, sg2.x));
      }
      acc += sp * bri;

      if (m == 0 && life > 0.55 && uHigh > 0.2) {
        float cr = step(0.8, hash11(mod(crT + k + idx, 997.0)));
        vec2 off = 0.012 * vec2(hash11(k + 3.1) - 0.5, hash11(k + 7.7) - 0.5) * 2.0;
        float de = length(p - (A + off));
        acc += cr * 0.00010 / (de * de + 0.00002) * f * uHigh
             * (1.0 - smoothstep(0.35 * rw, rw, de));
      }
    }
  }
  return acc;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float aspect = uResolution.x / uResolution.y;

  // night sky: gradient plus a few fixed stars
  vec3 col = vec3(0.005, 0.006, 0.015) + vec3(0.01, 0.0, 0.02) * (1.0 - uv.y);
  float st = step(0.997, hash21(floor(gl_FragCoord.xy / 2.0)));
  col += st * 0.15 * (0.7 + 0.3 * uHigh) * mix(vec3(1.0), uColor3, 0.3);

  float bc = uBeatClock;
  float lowE = 1.0 - smoothstep(0.08, 0.2, uEnergy);
  float fl = floor(bc);
  int forcedBurst = int(floor(burst + 0.5));

  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    float idx = fl - fj;
    float s = bc - idx;
    // low energy: even shells fade out (never pop), the sky keeps half the rate
    float gate = mix(1.0, step(0.5, mod(idx, 2.0)), lowE);
    if (gate < 0.01) continue;

    float h1 = sh(idx, 1.0), h2 = sh(idx, 2.0), h3 = sh(idx, 3.0), h4 = sh(idx, 4.0);
    float h5 = sh(idx, 5.0), h6 = sh(idx, 6.0), h7 = sh(idx, 7.0);
    vec2 c = vec2((h1 - 0.5) * aspect * 0.75, 0.05 + 0.3 * h2);
    float type = forcedBurst > 0 ? float(clamp(forcedBurst, 1, 4)) : floor(h4 * 4.0) + 1.0;
    float finale = mod(idx, 16.0) < 0.5 ? 1.0 : 0.0;
    float Rmax = (0.16 + 0.12 * h5) * (1.0 + 0.4 * finale);
    // the kick swells the newest shell; eased out so the corolla never jumps
    float young = j == 0 ? 1.0 - smoothstep(0.2, 0.35, s) : 0.0;
    Rmax *= 1.0 + 0.25 * uBassHit * young;
    float bright = 1.0 + 1.5 * uBassHit * young;
    bright *= (1.0 + 0.1 * uBass + 0.3 * uBassHit) * gate;
    // life in beats, capped under the 5 slots so a shell never pops out
    // while still visible: 4 shells of different ages stay on screen
    float L = min(3.2 + 2.0 * gravity * (type > 3.5 ? 1.0 : 0.5), 4.9);
    if (s > L) continue;

    vec3 base = palette(h3);
    float life = s / L;
    float sq = 1.0, tilt = 0.0;
    if (type > 2.5 && type < 3.5) { sq = 0.35 + 0.3 * h6; tilt = (h7 - 0.5) * 1.2; }

    // smoke (always, even outside the spark bounding circle)
    float dc = length(p - c);
    float smoke = vn2((p - c) * 6.0 + vec2(0.0, s * 0.3) + idx)
                * exp(-dc / (Rmax * 1.3)) * smoothstep(0.0, 0.5, s)
                * (1.0 - life) * 0.12 * (0.6 + uBass);
    col += base * 0.6 * smoke * 3.0 * gate;

    float sp = sparks(p, c, s, idx, type, Rmax, L, sq, tilt);
    if (finale > 0.5) {
      sp += 0.8 * sparks(p, c, s, idx + 5.0, 3.0, Rmax * 0.65, L,
                         0.4 + 0.3 * h6, (h6 - 0.5) * 2.0);
    }
    vec3 colS = mix(vec3(1.0, 0.95, 0.85), base, smoothstep(0.0, 0.3, life));
    col += colS * sp * bright;

    if (j == 0) {
      float D = Rmax * (1.0 - exp(-4.0 * s));
      if (s < 0.6) {
        float ring = exp(-abs(dc - D * 1.05) * 120.0) * (1.0 - s / 0.6) * (0.3 + 0.7 * uBassHit);
        col += base * ring * 0.9 * gate;
      }
      if (s < 0.25) col += base * 0.10 * (1.0 - s / 0.25) * (0.5 + uBassHit) * gate;
      // white-hot core of the break, gone within a quarter beat
      col += vec3(1.0, 0.92, 0.8) * 0.0012 / (dc * dc + 0.0006) * exp(-s * 12.0)
           * (0.6 + 0.8 * uBassHit) * gate;
    }
  }

  // rocket climbing toward the next shell, which bursts on the coming beat
  {
    float idxR = fl + 1.0;
    float u = bc - fl;
    float gate = mix(1.0, step(0.5, mod(idxR, 2.0)), lowE);
    float h1 = sh(idxR, 1.0), h2 = sh(idxR, 2.0), hR = sh(idxR, 8.0);
    vec2 c = vec2((h1 - 0.5) * aspect * 0.75, 0.05 + 0.3 * h2);
    float yR = mix(-0.55, c.y, 1.0 - pow(1.0 - u, 2.2));
    float x = c.x + 0.05 * (hR - 0.5) + 0.006 * sin(u * 40.0 + idxR);
    vec2 head = vec2(x, yR);
    vec2 e = p - head;
    vec3 gold = vec3(1.0, 0.7, 0.3);
    float tR = mod(floor(uTime * 30.0), 997.0);
    float flick = 0.8 + 0.4 * hash11(mod(floor(uTime * 40.0), 997.0));
    float r = 0.0004 / (dot(e, e) + 0.00005) * flick;
    vec2 tail = vec2(x, yR - 0.08 * (1.0 - u) - 0.02);
    r += 0.4 * 0.0006 / (seg(p, head, tail).x + 0.002);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float on = step(0.85, hash11(mod(tR + fi * 17.0 + idxR, 997.0)));
      vec2 sp = head - vec2(0.012 * (hash11(fi + 5.0 + tR) - 0.5),
                            0.02 + 0.07 * hash11(fi + 9.0 + tR));
      vec2 d2 = p - sp;
      r += on * 0.00006 / (dot(d2, d2) + 0.00003);
    }
    col += gold * r * gate * smoothstep(0.0, 0.05, u) * (1.0 - 0.8 * smoothstep(0.92, 1.0, u));
  }

  col = 1.0 - exp(-col * 1.2);
  col = max(col, vec3(0.0));
  gl_FragColor = vec4(col, 1.0);
}

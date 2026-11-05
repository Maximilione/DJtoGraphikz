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
uniform sampler2D uPipes;   // the pipework, see engine/pipesWalk.ts

varying vec2 vUv;

uniform float speed;
uniform float density;
uniform float glow;

// Pipes: the Windows "3D Pipes" screensaver, as it actually looked — a fixed
// camera on black, a handful of glossy solid-colour pipes growing cell by
// cell through an invisible 3D grid, a ball joint at every 90° turn, and the
// whole box wiped and restarted once it has filled up.
//
// The pipework itself — a random walk per pipe, hashed from (epoch, pipe,
// run) — is a pure function of the effect clock, so both windows draw the
// same picture from uTime alone with nothing to sync. It used to be walked
// again in every pixel: 7 x 22 runs of hashes and branches plus a capsule
// test each, ~45 ms a frame at 1080p, which crashed the engine's adaptive
// render scale to 30% and put a blurry, chunky picture on the projector.
// Now the engine walks it once a frame (pipesWalk.ts) into a small float
// texture: per pipe, 6 chunk headers (bounding box of 4 runs) then the 24
// runs. A ray tests a chunk's box first — skipped outright when it is
// behind the nearest hit so far — and only pays for the capsules of chunks
// it enters; pixels off the whole box skip everything. Each straight run is
// an axis-aligned capsule (its rounded cap is the growing tip), each
// finished run ends in a ball joint.
//
// `density` sets how many pipes grow per screen (2..7). The engine reads it
// once per screen (pipesCount) and writes only those pipes into the texture,
// so a moving density never pops grown pipes in or out mid-screen.

const int NPIPE = 7;
const int NCHUNK = 6;         // 6 chunks x 4 runs = 24 runs per pipe
const int PIPE_TEXELS = 2 * NCHUNK + 4 * NCHUNK;
const float TEX_W = float(NPIPE * PIPE_TEXELS);
const float R = 0.2;          // pipe radius, grid cell = 1
const float JR = R * 1.32;    // ball joint radius
const vec3 BOX = vec3(7.0, 4.0, 4.0);
const float EPOCH = 26.0;     // uTime seconds per screen, fade included
const float FADE = 1.2;

vec4 texel(int i) {
  return texture2D(uPipes, vec2((float(i) + 0.5) / TEX_W, 0.5));
}

// Dave Hoskins' hash13: no trig, good enough for a handful of dice rolls
float hash(float a, float b, float c) {
  vec3 p = fract(vec3(a, b, c) * vec3(0.1031, 0.1030, 0.0973) + vec3(0.17, 0.41, 0.73));
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// ray vs an axis-aligned capsule: from p along unit axis d for `len`, radius
// r. The cylinder part is a circle test in the plane perpendicular to d.
// Returns the distance (or -1) and the normal at the hit.
float capsuleA(vec3 ro, vec3 rd, vec3 p, vec3 d, float len, float r, out vec3 n) {
  vec3 oc = ro - p;
  vec3 m = 1.0 - abs(d);
  vec3 rdm = rd * m, ocm = oc * m;
  float a = max(dot(rdm, rdm), 1e-7);
  float b = dot(ocm, rdm);
  float c = dot(ocm, ocm) - r * r;
  float h = b * b - a * c;
  if (h < 0.0) return -1.0;             // the caps sit inside the infinite cylinder: miss
  float t = (-b - sqrt(h)) / a;
  float y = dot(oc, d) + t * dot(rd, d);
  if (y > 0.0 && y < len) { n = (ocm + rdm * t) / r; return t; }
  vec3 cc = (y <= 0.0) ? oc : oc - d * len;
  b = dot(rd, cc);
  c = dot(cc, cc) - r * r;
  h = b * b - c;
  if (h > 0.0) { t = -b - sqrt(h); n = (cc + rd * t) / r; return t; }
  return -1.0;
}

float sphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  return h < 0.0 ? -1.0 : -b - sqrt(h);
}

// does the ray enter the box [bmin,bmax] before `tMax`?
bool hitsBox(vec3 ro, vec3 ird, vec3 bmin, vec3 bmax, float tMax) {
  vec3 t0 = (bmin - ro) * ird, t1 = (bmax - ro) * ird;
  vec3 tn = min(t0, t1), tx = max(t0, t1);
  float tin = max(max(tn.x, tn.y), tn.z);
  float tout = min(min(tx.x, tx.y), tx.z);
  return tout > max(tin, 0.0) && tin < tMax;
}

vec3 pipeColor(int i, float ep) {
  float fi = float(i);
  float k = mod(fi + floor(hash(ep, 7.0, 3.0) * 3.0), 3.0);
  vec3 a = k < 0.5 ? uColor1 : k < 1.5 ? uColor2 : uColor3;
  vec3 b = k < 0.5 ? uColor2 : k < 1.5 ? uColor3 : uColor1;
  vec3 c = mix(a, b, hash(ep, fi, 11.0) * 0.4);
  // solid, saturated plastic: widen the chroma, then push the brightest
  // channel to 1 — palettes are often pastel, the original never was
  c = max(mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.7), 0.0);
  return c / max(max(c.r, c.g), max(c.b, 0.05));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);

  float ep = floor(uTime / EPOCH);
  float local = uTime - ep * EPOCH;

  // fixed screensaver camera, only a slow sway so the screen is never frozen.
  // Long lens from far back: the same framing as a wide lens up close, but
  // joints at the frame edges stay round instead of stretching.
  float yaw = 0.18 * sin(uTime * 0.04 + ep * 2.0);
  float pitch = 0.12 + 0.06 * sin(uTime * 0.03);
  vec3 ro = vec3(sin(yaw), sin(pitch), -cos(yaw)) * 25.0;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 2.17 * fw);
  vec3 ird = 1.0 / rd;

  float tBest = 1e9;
  vec3 nBest = vec3(0.0);
  int iBest = -1;

  if (hitsBox(ro, ird, -BOX - JR, BOX + JR, tBest)) {
    for (int i = 0; i < NPIPE; i++) {
      int base = i * PIPE_TEXELS;
      // two pipes sharing a grid line would z-fight; a hair of radius apart
      // lets the fatter one win cleanly
      float pr = R * (1.0 + 0.04 * float(i));
      float pj = JR * (1.0 + 0.04 * float(i));

      vec4 first = texel(base);
      if (first.w < 0.5) break;        // not started yet (nor any later pipe)
      vec3 p0 = texel(base + 2 * NCHUNK).xyz;
      float ts = sphere(ro, rd, p0, pj);
      if (ts > 0.0 && ts < tBest) { tBest = ts; nBest = normalize(ro + rd * ts - p0); iBest = i; }

      for (int c = 0; c < NCHUNK; c++) {
        vec4 hmin = texel(base + 2 * c);
        if (hmin.w < 0.5) break;
        vec3 hmax = texel(base + 2 * c + 1).xyz;
        if (!hitsBox(ro, ird, hmin.xyz, hmax, tBest)) continue;
        for (int k = 0; k < 4; k++) {
          if (float(k) >= hmin.w) break;
          vec4 s = texel(base + 2 * NCHUNK + 4 * c + k);
          float code = floor(s.w * 0.125);
          float seg = s.w - code * 8.0;
          float full = step(5.5, code);
          code -= full * 6.0;
          float axis = floor(code * 0.5);
          float sgn = (code - axis * 2.0) * 2.0 - 1.0;
          vec3 d = (axis < 0.5 ? vec3(1.0, 0.0, 0.0) : axis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)) * sgn;
          vec3 nn;
          float tc = capsuleA(ro, rd, s.xyz, d, seg, pr, nn);
          if (tc > 0.0 && tc < tBest) { tBest = tc; nBest = nn; iBest = i; }
          if (full > 0.5) {
            vec3 q = s.xyz + d * seg;
            float tj = sphere(ro, rd, q, pj);
            if (tj > 0.0 && tj < tBest) { tBest = tj; nBest = normalize(ro + rd * tj - q); iBest = i; }
          }
        }
      }
    }
  }

  vec3 col = uColor2 * 0.015;
  if (iBest >= 0) {
    vec3 base = pipeColor(iBest, ep);
    vec3 n = nBest;
    vec3 v = -rd;
    vec3 L1 = normalize(vec3(-0.5, 0.8, -0.6));
    vec3 L2 = normalize(vec3(0.7, -0.2, -0.4));
    float dif = max(dot(n, L1), 0.0) + 0.35 * max(dot(n, L2), 0.0);
    float spec = pow(max(dot(reflect(-L1, n), v), 0.0), 48.0);
    float spec2 = pow(max(dot(reflect(-L2, n), v), 0.0), 24.0) * 0.3;
    float g = clamp(glow, 0.3, 2.0);
    col = base * (0.16 + 1.0 * dif);
    col += vec3(1.0) * (spec + spec2) * (0.55 + 0.35 * g);
    col += base * kick * 0.3 * g;
    // far pipes a touch darker, like the original's depth cue
    col *= mix(1.0, 0.6, smoothstep(20.0, 31.0, tBest));
  }

  col *= 1.0 - smoothstep(EPOCH - FADE, EPOCH, local);
  col = col / (1.0 + 0.15 * col);
  gl_FragColor = vec4(col, 1.0);
}

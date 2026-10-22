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

uniform float speed;
uniform float density;
uniform float glow;

// Pipes: the Windows "3D Pipes" screensaver, as it actually looked — a fixed
// camera on black, a handful of glossy solid-colour pipes growing cell by
// cell through an invisible 3D grid, a ball joint at every 90° turn, and the
// whole box wiped and restarted once it has filled up.
//
// Stateless on purpose: every pipe is a random walk hashed from (epoch, pipe,
// run), recomputed per pixel, so both windows draw the same pipework from
// uTime alone with nothing to sync. uTime already integrates `speed`, so it
// is the growth clock directly (scaling it again would make the tips jump).
// Each straight run is ray-traced analytically as a capsule — its rounded
// cap is the growing tip, no extra geometry needed. No collision avoidance
// between pipes (the original had it; a stateless walk can't know where the
// others went) — runs bounce off the box walls instead, which keeps the
// tangle inside the frame.
//
// `density` sets how many pipes grow per screen (2..7). Being stateless it
// is read live, so lowering it drops the newest pipes at once: map it to
// something slow, never to an LFO or a fast audio band.

const int NPIPE = 7;
const int NRUN = 22;
const float R = 0.2;          // pipe radius, grid cell = 1
const float JR = R * 1.32;    // ball joint radius
const vec3 BOX = vec3(7.0, 4.0, 4.0);
const float GROW = 4.5;       // cells per uTime second
const float STAGGER = 1.4;    // seconds between pipe starts
const float EPOCH = 26.0;     // uTime seconds per screen, fade included
const float FADE = 1.2;

float hash(float a, float b, float c) {
  return fract(sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453);
}

vec3 axisDir(float axis, float sgn) {
  return (axis < 0.5 ? vec3(1.0, 0.0, 0.0) : axis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)) * sgn;
}

// iq's ray/capsule intersection: distance along the ray or -1
float capsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa, oa = ro - pa;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa);
  float rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - r * r;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}

float sphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  return h < 0.0 ? -1.0 : -b - sqrt(h);
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
  float nPipe = clamp(floor(2.0 + 2.6 * clamp(density, 0.3, 2.0) + hash(ep, 1.0, 1.0)), 2.0, float(NPIPE));

  // fixed screensaver camera, only a slow sway so the screen is never frozen
  float yaw = 0.18 * sin(uTime * 0.04 + ep * 2.0);
  float pitch = 0.12 + 0.06 * sin(uTime * 0.03);
  vec3 ro = vec3(sin(yaw), sin(pitch), -cos(yaw)) * 19.0;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.65 * fw);

  float tBest = 1e9;
  vec3 nBest = vec3(0.0);
  int iBest = -1;

  for (int i = 0; i < NPIPE; i++) {
    if (float(i) >= nPipe) break;
    float fi = float(i);
    float grown = (local - fi * STAGGER) * GROW;
    if (grown <= 0.0) break;

    vec3 p = floor(vec3(hash(ep, fi, 1.0), hash(ep, fi, 2.0), hash(ep, fi, 3.0)) * (2.0 * BOX - 1.0)) - BOX + 1.0;
    float axis = floor(hash(ep, fi, 4.0) * 3.0);
    float acc = 0.0;
    // two pipes sharing a grid line would z-fight; a hair of radius apart
    // lets the fatter one win cleanly
    float pr = R * (1.0 + 0.04 * fi);
    float pj = JR * (1.0 + 0.04 * fi);

    float ts = sphere(ro, rd, p, pj);
    if (ts > 0.0 && ts < tBest) { tBest = ts; nBest = normalize(ro + rd * ts - p); iBest = i; }

    for (int k = 0; k < NRUN; k++) {
      float fk = float(k);
      float hk = hash(ep * 3.1 + fi, fk, 5.0);
      if (k > 0) axis = mod(axis + 1.0 + floor(hk * 2.0), 3.0);
      float sgn = hash(ep * 3.1 + fi, fk, 6.0) < 0.5 ? -1.0 : 1.0;
      float pos = axis < 0.5 ? p.x : axis < 1.5 ? p.y : p.z;
      float lim = axis < 0.5 ? BOX.x : axis < 1.5 ? BOX.y : BOX.z;
      float room = lim - pos * sgn;
      if (room < 1.0) { sgn = -sgn; room = lim - pos * sgn; }
      float len = min(1.0 + floor(hash(ep * 3.1 + fi, fk, 7.0) * 5.0), room);

      float seg = min(len, grown - acc);
      if (seg <= 0.0) break;
      vec3 d = axisDir(axis, sgn);
      vec3 q = p + d * seg;
      float tc = capsule(ro, rd, p, q, pr);
      if (tc > 0.0 && tc < tBest) {
        vec3 hp = ro + rd * tc;
        vec3 ba = q - p;
        float h = clamp(dot(hp - p, ba) / dot(ba, ba), 0.0, 1.0);
        tBest = tc; nBest = (hp - p - h * ba) / pr; iBest = i;
      }
      if (seg >= len) {
        float tj = sphere(ro, rd, q, pj);
        if (tj > 0.0 && tj < tBest) { tBest = tj; nBest = normalize(ro + rd * tj - q); iBest = i; }
      }
      acc += len;
      p += d * len;
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
    col *= mix(1.0, 0.6, smoothstep(14.0, 25.0, tBest));
  }

  col *= 1.0 - smoothstep(EPOCH - FADE, EPOCH, local);
  col = col / (1.0 + 0.15 * col);
  gl_FragColor = vec4(col, 1.0);
}

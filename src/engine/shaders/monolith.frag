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

uniform float pulse;
uniform float haze;
uniform float width;

// Monolith: a hall with a mirror floor, a colossal ring standing in the fog at
// the far end and, in its centre, a vertical slit of light that opens on every
// kick. Two rows of pylons run down the sides. Raymarched in 64 steps (40 for
// the hall, 24 for its reflection in the floor, which is an analytic plane:
// the ray is reflected there and marched again). The fog is a glow integrated
// along the march, brightest around the slit; the kick widens the slit and
// floods the fog, the bass breathes it. The ring and the pylons are dark metal
// lit only by the slit and a cold rim, so the light is the picture.

const float TAU = 6.2831853;
const float FLOOR = -1.2;
const vec3 RING_C = vec3(0.0, 0.6, -8.0);

float gKick;
float gGlow;     // fog glow accumulated by march()
float gSlitW;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float sdTorusXY(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xy) - R, p.z);
  return length(q) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float slitSdf(vec3 p) {
  vec3 q = p - RING_C;
  return sdBox(q, vec3(gSlitW, 2.2, 0.05));
}

float pylons(vec3 p) {
  float sp = 7.0;
  float zc = floor(p.z / sp + 0.5);
  float zl = p.z - zc * sp;
  float h = hash11(zc);
  vec3 q = vec3(abs(p.x) - 5.0 - 0.8 * h, p.y - 1.5, zl);
  return sdBox(q, vec3(0.45, 3.2 + 1.8 * h, 0.7)) * 0.9;
}

float map(vec3 p) {
  float ring = sdTorusXY(p - RING_C, 3.1, 0.42);
  float d = min(ring, pylons(p));
  return d;
}

// marches the hall; returns the hit distance or -1.0. The fog glow collects
// around the slit on the way, weighted by the step so it does not depend on
// how many steps the surfaces took.
float march(vec3 ro, vec3 rd, float tmax, int steps) {
  float t = 0.05;
  for (int i = 0; i < 40; i++) {
    if (i >= steps || t > tmax) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    float ds = slitSdf(p);
    float st = clamp(d, 0.04, 0.6);
    gGlow += st * 0.06 / (0.12 + ds * ds * 0.35);
    if (d < 0.004) return t;
    t += d;
  }
  return -1.0;
}

vec3 slitColor() {
  return mix(uColor3, vec3(1.0), 0.55);
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.004;
  vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                     k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
  // light from the slit and a cold rim from the camera side
  vec3 lp = RING_C + vec3(0.0, clamp(p.y - RING_C.y, -2.0, 2.0), 0.3);
  vec3 L = lp - p;
  float dist = length(L);
  L /= dist;
  float lit = max(dot(n, L), 0.0) / (1.0 + 0.04 * dist * dist);
  float kickL = 0.55 + 0.5 * pulse * (gKick + 0.4 * uBass);
  vec3 c = slitColor() * lit * 2.2 * kickL;
  c += uColor1 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.45;
  c += uColor2 * 0.06;
  // ring: panel lines (angular segments) carrying a thread of light
  vec3 q = p - RING_C;
  float seg = abs(sin(atan(q.y, q.x) * 24.0));
  float line = smoothstep(0.96, 1.0, seg);
  float isRing = step(sdTorusXY(q, 3.1, 0.42), pylons(p));
  c += uColor1 * line * isRing * (0.3 + 1.0 * gKick * pulse + 0.4 * uMid);
  // pylons: a cold edge line on the vertical edges
  float vert = smoothstep(0.93, 1.0, abs(sin(p.y * 3.0 - uBassTime)));
  c += uColor2 * vert * (1.0 - isRing) * 0.35 * (0.4 + uEnergy);
  return c;
}

vec3 scene(vec3 ro, vec3 rd, float tmax, int steps) {
  float t = march(ro, rd, tmax, steps);
  vec3 c = vec3(0.0);
  if (t > 0.0) {
    c = shade(ro, rd, t);
    c = mix(uColor2 * 0.05, c, exp(-t * 0.045));
  }
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gSlitW = (0.07 + 0.25 * gKick * pulse + 0.05 * uBass) * width;
  gGlow = 0.0;

  float drift = 0.6 * sin(uTime * 0.17 + uBassTime * 0.05);
  vec3 ro = vec3(0.5 * drift, 0.1, 1.5 + 1.2 * drift);
  vec3 rd = normalize(vec3(uv, -1.15));
  rd.xz = vec2(rd.x * cos(0.06 * drift) - rd.z * sin(0.06 * drift), rd.x * sin(0.06 * drift) + rd.z * cos(0.06 * drift));

  // the floor: a plane at FLOOR, a mirror that eats half of the light
  float tf = rd.y < -0.001 ? (FLOOR - ro.y) / rd.y : 1e5;
  vec3 col;
  float tmax = min(tf, 60.0);
  float th = march(ro, rd, tmax, 40);
  if (th > 0.0) {
    col = shade(ro, rd, th);
    col = mix(uColor2 * 0.05, col, exp(-th * 0.045));
  } else if (tf < 60.0) {
    vec3 pf = ro + rd * tf;
    vec3 rr = vec3(rd.x, -rd.y, rd.z);
    float g0 = gGlow;
    col = scene(pf + vec3(0.0, 0.01, 0.0), rr, 60.0, 24);
    // the reflection collects its own fog; keep it, dimmed (the mirror loses light)
    gGlow = g0 + (gGlow - g0) * 0.6;
    float fres = 0.35 + 0.4 * pow(1.0 - abs(rd.y), 2.0);
    // floor: dark, with a few tile lines that run to the portal
    vec2 gp = pf.xz * 0.5;
    vec2 gl = abs(fract(gp) - 0.5);
    float grid = smoothstep(0.47, 0.5, max(gl.x, gl.y));
    col = col * fres + uColor1 * grid * 0.06 * exp(-tf * 0.06) + uColor2 * 0.03;
  } else {
    col = uColor2 * 0.03 + uColor1 * 0.02 * (0.5 - uv.y);
  }

  // fog: the glow collected on the way, tinted by the palette
  float hz = haze * (0.8 + 0.5 * uBass + 0.5 * gKick * pulse);
  vec3 fogC = mix(uColor1, slitColor(), 0.35 + 0.4 * gKick);
  col += fogC * gGlow * 0.03 * hz;
  col += uColor2 * 0.03 * exp(-length(uv) * 2.0);

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.9, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

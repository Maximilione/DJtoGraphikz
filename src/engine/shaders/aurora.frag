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

uniform float curtains;
uniform float height;
uniform float flow;
uniform float shimmer;

// Aurora: polar lights over a still lake. Three planes of depth: a black
// ridge of pines in front, the water that mirrors everything in the middle,
// the sky behind. The curtains are real sheets in space, not a 2D gradient:
// the view ray is sampled at a stack of altitudes and at each one a folded
// ribbon footprint (parallel lines bent by slow sines and noise) says whether
// it is inside a curtain. Each curtain has a hard lower hem and long rays that
// fade upward, so the colour runs colour 1 at the hem, colour 2 in the body,
// colour 3 in the high fringe. The kick lights the hem and sends a brightness
// surge along the folds; the lake repeats the sky with fewer samples and a
// ripple that the bass stirs.

const float TAU = 6.2831853;
const int SKY_STEPS = 22;
const int LAKE_STEPS = 14;

float gCurt, gH, gFlow, gShim, gKick;

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }

float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}

float vn1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h11(i), h11(i + 1.0), f);
}

// curtain footprint on the horizontal plane: x = strength, y = ray striation
vec2 foot(vec2 q, float tt, float ws, float az) {
  // fold the plane: lines of constant w are the curtains
  float w = q.y * 0.3 * gCurt
          + 0.9 * sin(q.x * 0.21 + tt * 0.13)
          + 0.45 * sin(q.x * 0.57 - tt * 0.21 + 1.7)
          + 0.6 * vn(q * 0.23 + vec2(tt * 0.05, 0.0));
  float id = floor(w);
  float d = abs(fract(w) - 0.5);
  // each curtain breaks up along its length, and the kick surges through it
  float along = q.x * 0.16 + id * 3.7;
  float life = vn1(along - tt * 0.12) * vn1(along * 0.37 + 9.0 + tt * 0.05);
  float sg = fract(along * 0.25 - uBeatClock * 0.25) - 0.5;
  float surge = exp(-sg * sg * 40.0) * gKick;
  float amp = smoothstep(0.12, 0.5, life + 0.35 * surge) * (0.55 + 0.9 * h11(id + 4.0));
  if (amp <= 0.0) return vec2(0.0);       // exact: f.x scales everything
  // ws = how far w moves between two altitude samples: the sheet is widened to
  // that (and dimmed to keep its energy) so a thin curtain is never missed
  float s2 = 0.0038 + ws * ws * 0.6;
  float core = sqrt(0.0038 / s2) * exp(-d * d / s2) + 0.2 * exp(-d * d * 22.0);
  // rays: keyed on the azimuth of the view ray, so they are the same at every
  // altitude sample (no moire) and converge overhead the way real ones do
  float stri = vn1(az * 150.0 + id * 13.0 + tt * 0.9) * 0.7 + vn1(az * 47.0 - id * 5.0 - tt * 0.4) * 0.3;
  stri = mix(1.0, 0.25 + 1.6 * stri * stri, clamp(gShim, 0.0, 1.0));
  return vec2(core * amp, stri);
}

vec3 stars(vec3 d) {
  vec2 s = vec2(atan(d.x, d.z), d.y) * 70.0;
  vec2 id = floor(s), f = fract(s) - 0.5;
  float r = h21(id);
  vec2 o = (vec2(h21(id + 5.0), h21(id + 9.0)) - 0.5) * 0.7;
  float tw = 0.65 + 0.35 * sin(uTime * (1.0 + 4.0 * r) + r * 50.0) + uHigh * step(0.93, r);
  return vec3(0.85, 0.9, 1.0) * step(0.88, r) * exp(-dot(f - o, f - o) * 420.0) * tw * (0.2 + 9.0 * (r - 0.88));
}

// the whole sky for a direction with d.y > 0
vec3 sky(vec3 d, int steps) {
  float tt = uTime * gFlow + uBassTime * 0.3 * gFlow;
  vec3 col = mix(uColor3 * 0.05, vec3(0.002, 0.004, 0.012), smoothstep(0.0, 0.5, d.y));
  col += stars(d) * smoothstep(0.02, 0.2, d.y);
  float dy = max(d.y, 0.03);
  vec3 acc = vec3(0.0);
  float base = 2.0, top = 2.0 + 3.2 * gH;
  float n = float(steps);
  float az = atan(d.x, d.z);
  float ws = 0.3 * gCurt * abs(d.z) * (top - base) / (n * dy);
  // exp(-k*2.1) and exp(-k*14) run incrementally: k steps by 1/n
  float e1 = exp(-1.05 / n), e2 = exp(-7.0 / n), p1 = e1, p2 = e2;
  e1 *= e1; e2 *= e2;
  if (d.y > 0.03) for (int i = 0; i < SKY_STEPS; i++) {
    if (i >= steps) break;
    float k = (float(i) + 0.5) / n;
    float alt = mix(base, top, k);
    vec2 q = d.xz * (alt / dy);
    q.y += 3.0;
    vec2 f = foot(q, tt, ws, az);
    // hard hem, long fade: the profile every photograph of an aurora shows
    float prof = smoothstep(0.0, 0.07, k) * p1;
    float hem = p2;
    p1 *= e1; p2 *= e2;
    vec3 c = mix(uColor1, uColor2, smoothstep(0.05, 0.45, k));
    c = mix(c, uColor3 * 1.6, smoothstep(0.3, 0.8, k));
    c += vec3(1.0) * hem * (0.15 + 0.6 * gKick);
    float st = mix(f.y, 1.0, hem * 0.5);
    acc += c * f.x * prof * st * (1.0 + 1.6 * gKick * hem + 0.35 * gKick + 0.6 * uBass);
  }
  // distance fade: far curtains sink into the haze at the horizon
  float fade = smoothstep(0.03, 0.24, d.y);
  col += acc * (11.0 / n) * fade * (0.8 + 0.3 * uEnergy + 0.25 * uMid);
  // horizon glow, tinted by the lights above it
  col += mix(uColor1, uColor3, 0.5) * 0.05 * exp(-d.y * 9.0) * (1.0 + uBass);
  return col;
}

// ridge line (screen y) at screen x for a layer
float ridge(float x, float seed, float amp, float freq) {
  float h = vn1(x * freq + seed) * 0.6 + vn1(x * freq * 2.3 + seed * 1.7) * 0.28
          + vn1(x * freq * 5.1 + seed * 2.9) * 0.12;
  return amp * (h - 0.35);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gCurt = clamp(curtains, 0.4, 2.0);
  gH = clamp(height, 0.5, 2.0) * (1.0 + 0.15 * uBass);
  gFlow = clamp(flow, 0.0, 3.0);
  gShim = clamp(shimmer, 0.0, 2.0);

  float hor = -0.1;                       // horizon line on screen
  float yaw = 0.25 * sin(t * 0.021) + t * 0.004;
  float y = p.y - hor;
  bool water = y < 0.0;

  // ripples bend the mirrored ray; stronger near the shore in front
  float depth = clamp(-y / 0.3, 0.0, 1.0);
  vec2 rp = vec2(p.x / max(-y, 0.004), 1.0 / max(-y, 0.004));
  float rip = (vn(rp * vec2(0.9, 0.35) + vec2(t * 0.3, t * 0.5)) - 0.5)
            + 0.5 * (vn(rp * vec2(2.3, 0.9) - vec2(t * 0.4, 0.0)) - 0.5);
  rip *= (0.012 + 0.03 * depth) * (1.0 + 1.5 * uBass + 1.2 * gKick);
  float ym = water ? -y + rip : y;
  float xm = p.x + (water ? rip * 0.6 : 0.0);

  vec3 d = normalize(vec3(xm, ym * 1.05 + 0.02, 1.15));
  float cy = cos(yaw), sy = sin(yaw);
  d.xz = vec2(d.x * cy + d.z * sy, -d.x * sy + d.z * cy);

  // far range: hazy, takes the colour of the horizon glow
  float px = xm + yaw * 0.9;
  float r1 = 0.035 + ridge(px, 3.0, 0.11, 2.1);
  float m1 = 1.0 - smoothstep(r1 - 0.003, r1 + 0.003, ym);

  // near shore: black spit of land with pines, only above the waterline
  float nx = p.x + yaw * 1.6;
  float land = -0.44 + ridge(nx, 11.0, 0.1, 1.3) + 0.09 * smoothstep(0.25, 0.9, abs(p.x));
  float tx = nx * 13.0;
  float tid = floor(tx);
  float th = step(0.35, h11(tid + 2.0)) * (0.07 + 0.13 * h11(tid + 7.0)) * (0.45 + vn1(nx * 3.0 + 5.0));
  float tf = abs(fract(tx) - 0.5) * 2.0;
  // a pine is a stack of tiers: saw-tooth silhouette tapering to the tip
  float hy = (p.y - land) / max(th, 1e-3);
  float tier = fract(hy * 7.0);
  // one screen pixel in tf units, so the teeth are antialiased
  float e = 26.0 / uResolution.y;
  float wdt = (1.0 - hy) * (0.55 + 0.45 * (1.0 - tier));
  float pine = (1.0 - smoothstep(-e, e, tf - wdt)) * step(0.0, hy) * step(hy, 1.0);
  float ground = 1.0 - smoothstep(land - 0.002, land + 0.002, p.y);
  float fg = max(ground, pine * step(1e-3, th));

  // the sky march only where the ridge and the shore leave it visible
  vec3 col = vec3(0.0);
  if (m1 < 1.0 && fg < 1.0) col = water ? sky(d, LAKE_STEPS) : sky(d, SKY_STEPS);
  col = mix(col, uColor3 * 0.035 + vec3(0.004, 0.006, 0.012), m1);

  if (water) {
    // the lake: darker than the sky, a sheen where ripples catch the light
    col *= 0.7 - 0.35 * depth;
    col += mix(uColor1, uColor2, 0.5 + 0.5 * sin(rp.y * 0.02)) * max(rip, 0.0) * 1.6 * (1.0 - depth * 0.5);
    col += uColor3 * 0.008;
    // shore line mist
    col += mix(uColor1, uColor3, 0.6) * 0.035 * exp(y * 60.0);
  }

  // rim of light on the silhouette, so the foreground is cut out and not a hole
  float rim = smoothstep(land - 0.012, land, p.y) * ground;
  col = mix(col, vec3(0.0015, 0.002, 0.004) + uColor1 * 0.03 * rim * (0.5 + gKick), fg);

  col += uColor3 * 0.004;                 // floor on silence
  col = col / (1.0 + 0.45 * col);
  col *= clamp(1.15 - dot(p, p) * 0.5, 0.5, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;   // dither: 8-bit target bands the sky
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

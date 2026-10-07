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

uniform float bolts;
uniform float branches;
uniform float fog;

// Storm: forked lightning over a dark wet horizon. Every bolt is a jagged
// path (three octaves of value noise bending a vertical line) with side
// branches that peel off it, and each branch carries one smaller fork of its
// own. The bolts are re-rolled as the bass advances (a new strike every few
// kicks) and flare on every kick; the whole sky is lit by them, the clouds
// pick up the flash, and the horizon mirrors the strike in the wet ground.
// A strike also starts by itself every ~2 s on uTime, so a silent room still
// gets lightning; between strikes the bolts stay as thin live filaments, the
// clouds glow and far flashes flicker inside them, so the frame is never a
// flat dark sky.

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f) - 0.5;
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// lateral offset of a jagged path at distance s along it
float jag(float s, float seed, float amp) {
  return amp * (vnoise(s * 3.0 + seed) * 0.55 + vnoise(s * 9.0 + seed * 1.7) * 0.28
              + vnoise(s * 24.0 + seed * 2.3 + uTime * 2.0) * 0.07);
}

// glow of one arc: starts at (x0, y0), runs down at lateral slope `slope`
float arc(vec2 p, float x0, float y0, float slope, float seed, float amp, float len) {
  float s = y0 - p.y;
  if (s < 0.0 || s > len) return 0.0;
  float x = x0 + slope * s + jag(s, seed, amp);
  float d = abs(p.x - x);
  float fade = 1.0 - smoothstep(len * 0.5, len, s);
  return fade * (0.0042 / (d + 0.0045) + 0.55 * exp(-d * d * 90000.0));
}

float forks(vec2 p, float x0, float seed, float len, float nb) {
  const float TOP = 0.6;
  float g = arc(p, x0, TOP, 0.0, seed, 0.5, 1.2);
  for (int b = 0; b < 4; b++) {
    if (float(b) >= nb) break;
    float fb = float(b);
    float hb = hash(seed * 3.1 + fb * 7.7);
    float yb = mix(0.4, -0.1, (fb + hb) / 4.0);
    float sb = TOP - yb;
    float xb = x0 + jag(sb, seed, 0.5);
    float side = hb > 0.5 ? 1.0 : -1.0;
    float sl = side * (0.35 + 0.5 * hash(seed + fb));
    float bl = len * (0.35 + 0.35 * hb);
    float bs = seed + 11.0 * (fb + 1.0);
    g += 0.6 * arc(p, xb, yb, sl, bs, 0.18, bl);
    // the fork of the branch
    float ys = yb - bl * 0.4;
    float xs = xb + sl * bl * 0.4 + jag(bl * 0.4, bs, 0.18);
    g += 0.32 * arc(p, xs, ys, -side * 0.5, seed + 5.0 * fb + 3.0, 0.1, bl * 0.5);
  }
  return g;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  const float H = -0.26; // horizon

  float nb = clamp(branches, 0.0, 2.0) * 2.0;
  float nbolts = floor(clamp(bolts, 1.0, 4.0) + 0.5);
  float flash0 = 0.8 + 0.5 * uEnergy + 1.5 * kick;

  vec2 p = uv;
  bool below = uv.y < H;
  if (below) p = vec2(uv.x + 0.012 * sin(uv.y * 90.0 + uTime * 2.0), 2.0 * H - uv.y);

  float g = 0.0;
  float lamp = 0.0;
  float pulse = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= nbolts) break;
    float fi = float(i);
    // new strike on the bass or, with no bass, every ~2 s on the clock
    float tt = uTime * 0.5 + fi * 0.37;
    float seed = (floor(uBassTime * 1.2 + fi * 5.3) + floor(tt)) * 1.37 + fi * 9.1;
    float pl = exp(-fract(tt) * 3.5);
    pulse = max(pulse, pl);
    float x0 = (hash(seed + 0.5) - 0.5) * 1.1;
    float w = i == 0 ? 1.0 : 0.55;
    g += w * forks(p, x0, seed, 1.1, nb);
    lamp += w * exp(-abs(uv.x - x0) * 2.2) * (1.0 + pl);
  }
  float flash = flash0 + 1.2 * pulse;
  g = min(g, 6.0) * flash * (below ? 0.32 : 1.0);

  // storm clouds, lit from within by the strikes
  float cl = vn2(uv * vec2(2.2, 4.0) + vec2(uTime * 0.04, 0.0)) * 0.6 + vn2(uv * vec2(5.0, 9.0) - uTime * 0.07) * 0.4;
  cl = smoothstep(0.15, 0.9, cl) * smoothstep(H - 0.05, 0.4, uv.y);
  float haze = clamp(fog, 0.3, 2.0);
  vec3 sky = mix(uColor2 * 0.40, uColor1 * 0.40, smoothstep(H, 0.5, uv.y));
  sky += uColor2 * cl * (0.8 + 0.28 * lamp * flash * haze) + uColor1 * cl * 0.05;
  // far flashes: a distant strike lights a patch of cloud now and then
  float tf = uTime * 0.37 + 0.2;
  float fx = (hash(floor(tf)) - 0.5) * 1.6;
  float far = exp(-fract(tf) * 4.0) * exp(-((uv.x - fx) * (uv.x - fx) * 3.0 + (uv.y - 0.15) * (uv.y - 0.15) * 8.0));
  sky += mix(uColor2, uColor3, 0.5) * far * (0.3 + cl) * 2.0;
  sky += uColor3 * 0.15 * smoothstep(H, 0.55, uv.y) * (0.4 + cl);
  // wet ground: dark gradient with a sheen at the horizon
  vec3 ground = mix(uColor1 * 0.30, uColor2 * 0.18, smoothstep(H, -0.6, uv.y));
  ground += uColor3 * 0.8 * smoothstep(0.1, 0.0, abs(uv.y - H)) * (0.5 + kick);
  // puddles mirroring the glow of the sky
  ground += uColor2 * 0.9 * exp(-(H - uv.y) * 5.0) * (0.4 + 0.6 * vn2(vec2(uv.x * 3.0 + uTime * 0.1, uv.y * 30.0)));
  vec3 col = below ? ground : sky;

  vec3 bolt = mix(uColor3, vec3(1.0), 0.55) * g + uColor1 * g * g * 0.05;
  col += bolt + uColor1 * g * 0.18;
  col += uColor2 * exp(-abs(uv.y - H) * 14.0) * 0.5 * haze;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.6, 0.5, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

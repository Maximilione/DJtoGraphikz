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
uniform float uBarPhase;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float streak;
uniform float wind;

// Storm over a city at night. Layered: coloured fog, two skylines, four depth
// layers of rain (near = fat and slow, far = fine and quick), a wet street
// with a mirrored skyline and rings on every kick. The kick is lightning that
// lights the buildings; every bar the gust flips and the skyline is redrawn.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// factors keep P * speed * k integral so the wrap of the clock is seamless
float layer(vec2 uv, float cols, float speed, float len, float w, float fall, float core) {
  uv.x += (uv.y - 0.5) * w * 0.4;
  float col = floor(uv.x * cols);
  float f = fract(uv.x * cols);
  float seed = hash(vec2(col, floor(cols)));
  float k = 0.8 + 0.2 * floor(seed * 3.0);
  float y = fract(uv.y * 1.2 + seed * 7.0 + fall * speed * k);
  float drop = smoothstep(0.0, len, y) * smoothstep(len * 1.15, len * 0.98, y);
  // core width bounded on screen: never a fat blob, never sub-pixel shimmer
  float hw = clamp(core / cols, 1.0 / uResolution.x, 0.008) * cols;
  float ax = abs(f - 0.5);
  float thin = smoothstep(hw, 0.0, ax) + smoothstep(hw * 2.67, 0.0, ax) * 0.35;
  float on = step(0.35, hash(vec2(col, floor(y + seed) + floor(cols))));
  return drop * thin * on;
}

// skyline height at x (units of frame height), two bars worth of variety
float skyline(float x, float scale, float seed, float h0, float hv) {
  float c = floor(x * scale);
  return h0 + hv * hash(vec2(c, seed)) * (0.4 + 0.6 * hash(vec2(c * 1.7, seed + 3.0)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float asp = uResolution.x / uResolution.y;
  float px = 1.0 / uResolution.y;
  float fall = mod(uBassTime * 0.9 + uTime * 0.6, 50.0);
  float bar = mod(floor(uBeatClock / 4.0), 64.0);
  float bc = mod(uBeatClock, 512.0);
  float kick = clamp(uBassHit, 0.0, 1.0);
  float bolt = pow(kick, 6.0);
  float sw = 1.0 + 0.5 * floor(hash(vec2(bar, 5.0)) * 3.0); // bar-to-bar variety

  // gust: wind flips with the bar and swells on the beat
  float gust = wind + (hash(vec2(bar, 9.0)) - 0.5) * 0.5 + 0.25 * uBeat * sign(wind + 0.001);
  gust = clamp(gust, -1.6, 1.6);

  float hz = 0.2 + 0.03 * sin(6.2831853 * mod(uBeatClock, 64.0) / 64.0); // horizon (street starts below)
  float x = (uv.x - 0.5) * asp;                  // frame-height units
  // bar seed moves the skyline: a new city every 4 bars
  float sd = bar * 7.0;
  bool street = uv.y < hz;
  float vy = street ? (2.0 * hz - uv.y) : uv.y;    // mirrored y for the reflection

  // --- sky + coloured fog
  float sky = smoothstep(hz, 1.0, vy);
  vec3 col = mix(uColor2 * 0.10, uColor1 * 0.16, sky);
  float fg = vnoise(vec2(x * 1.6 + uBassTime * 0.05, vy * 3.0 - uTime * 0.04)) * 0.7
           + vnoise(vec2(x * 3.7 - uTime * 0.07, vy * 6.0)) * 0.3;
  col += mix(uColor3, uColor1, vy) * fg * fg * (0.09 + 0.12 * uBass) * (1.0 - 0.7 * sky);
  col += uColor3 * 0.22 * exp(-abs(vy - hz) * 9.0) * (0.5 + 0.5 * uBass); // haze on the horizon

  // --- skylines: far (lit by the flash, dim windows) and near (black)
  float aa = 1.5 * px;
  float hFar = hz + skyline(x + 3.1, 9.0 * sw, sd, 0.03, 0.17);
  float hNear = hz + skyline(x, 5.0 * sw, sd + 1.0, 0.0, 0.12);
  float mFar = smoothstep(aa, -aa, vy - hFar);
  float mNear = smoothstep(aa, -aa, vy - hNear);
  vec2 wc = vec2(x * 9.0 * sw * 4.0, (vy - hz) * 40.0);
  float win = step(0.78, hash(floor(wc) + sd)) * step(0.15, fract(wc.x)) * step(0.15, fract(wc.y)) * step(0.0, hFar - vy - 0.01);
  vec3 far = uColor1 * 0.05 + uColor3 * 0.5 * bolt + uColor1 * 0.2 * kick;
  far += mix(uColor2, uColor3, hash(floor(wc))) * win * (0.15 + 0.9 * uHigh + 1.5 * bolt);
  col = mix(col, far, mFar);
  col = mix(col, vec3(0.0) + uColor2 * 0.4 * bolt * bolt, mNear);
  // rim of the near roofs under lightning
  col += uColor3 * bolt * 0.8 * exp(-abs(vy - hNear) * 220.0) * step(hz, vy);

  // --- rain, four depths, all sheared by the same gust
  float n = max(8.0, density);
  float l = clamp(streak, 0.03, 0.6);
  vec2 ruv = vec2(uv.x * (1.0 + 0.0), uv.y);
  float r4 = layer(ruv + 0.13, n * 0.45, 1.0, l * 1.3, gust, fall * 1.4, 0.18) * 0.9;     // near, fat
  float r1 = layer(ruv, n, 1.6, l, gust, fall, 0.15);
  float r2 = layer(ruv + 0.37, n * 1.7, 1.1, l * 0.7, gust, fall, 0.15) * 0.6;
  float r3 = layer(ruv + 0.71, n * 2.8, 0.7, l * 0.5, gust, fall, 0.15) * 0.35;
  float r = r1 + r2 + r3;
  vec3 rainCol = mix(vec3(1.0), uColor1, 0.35);
  float fogA = 0.5 + 0.8 * fg;
  col += rainCol * (r * fogA + r4 * 0.9) * (0.9 + 0.5 * uMid) * (street ? 0.0 : 1.0);
  // near drops glow
  col += uColor3 * r4 * 0.35 * (0.5 + uBass);
  // the flash shows every streak, and washes the sky coloured (never white)
  col += (uColor3 * 0.2 + rainCol * (r + r4) * 0.9) * bolt * (street ? 0.0 : 1.0);

  // --- wet street: mirrored sky/skyline, streaks of light, rings on the kick
  if (street) {
    float d = (hz - uv.y) / hz;                 // 0 at the curb, 1 at the bottom
    vec3 refl = col;                            // already evaluated at the mirrored y
    float wob = vnoise(vec2(x * 30.0, d * 80.0 - uTime * 0.5));
    refl *= (0.55 - 0.3 * d) * (0.7 + 0.6 * wob);
    // stretched light of the windows and the horizon glow
    refl += uColor2 * exp(-d * 6.0) * 0.18 * (0.5 + 0.5 * uBass);
    vec3 g = vec3(0.02) + uColor2 * 0.05 * (1.0 - d);
    // rings: centres hop with the kick, expand over its decay
    float ring = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float ph = fract(bc * 0.5 + fi * 0.333);
      float cell = floor(bc * 0.5 + fi * 0.333);
      vec2 c = vec2((hash(vec2(cell, fi + sd)) - 0.5) * asp * 0.9, hz * (0.15 + 0.7 * hash(vec2(fi, cell))));
      vec2 q = vec2(x - c.x, (uv.y - c.y) * 3.2);   // street is foreshortened
      float rad = ph * 0.22;
      float dd = abs(length(q) - rad);
      ring += smoothstep(3.0 * px + 0.004, 0.0, dd) * (1.0 - ph) * (1.0 - ph);
    }
    float rainSplash = (r1 + r2) * 0.0;
    g += mix(uColor1, uColor3, 0.5) * ring * (0.5 + 1.8 * kick);
    // sparks bouncing off the pavement on the kick
    float sp = step(0.985, hash(floor(vec2(x * 90.0, uv.y * 200.0)) + floor(bc * 4.0))) * kick;
    g += rainCol * sp * 1.2;
    col = refl + g + uColor3 * bolt * 0.15 * (1.0 - d);
    // curb line
    col += uColor3 * 0.3 * exp(-abs(uv.y - hz) * 120.0) * (0.4 + bolt * 2.0);
  }

  // vignette in frame units, not uv: same bite on strip and portrait
  vec2 vq = (uv - 0.5) * vec2(min(asp, 1.8), 1.0);
  col *= clamp(1.15 - dot(vq, vq) * 0.9, 0.35, 1.0);
  // idle floor so a muted frame still shows the city
  col += uColor1 * 0.015;
  gl_FragColor = vec4(col, 1.0);
}

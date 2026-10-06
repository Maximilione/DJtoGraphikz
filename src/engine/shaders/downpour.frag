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
uniform float uLineBoost;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float streak;
uniform float wind;

// Storm over a city at night. Five depths of long glowing rain streaks in
// parallax (near = fat, fast, long), fog with lamp beams the rain lights up
// inside, blurred city lights that stretch into the wet street, ripples and
// splashes where drops land. Kick = lightning in the clouds and on the rain;
// mids lean the rain into the wind; energy sets how much rain falls.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// One depth of rain. x in frame-height units, y in 0..1. Each column carries a
// streak per cycle: sharp bright head (lower end), long fading tail above it.
float rain(float x, float y, float cols, float speed, float len, float wpx,
           float shear, float seed, float dens, float fall) {
  float xs = x + (y - 0.5) * shear;
  float cx = xs * cols;
  float col = floor(cx);
  float f = fract(cx);
  float h = hash(vec2(col, seed));
  float k = 0.8 + 0.2 * floor(hash(vec2(col, seed + 2.0)) * 3.0); // P*speed*k integral: seamless wrap
  float ph = y + h * 7.0 + fall * speed * k;
  float cyc = floor(ph);
  float yy = fract(ph);
  float on = step(hash(vec2(col + cyc * 13.0, seed + 1.0)), dens);
  float head = smoothstep(0.0, 0.01, yy);
  float tail = pow(1.0 - clamp(yy / len, 0.0, 1.0), 1.6);
  float hw = min(wpx * cols / uResolution.y, 0.28);
  float cen = 0.5 + (hash(vec2(col, seed + 5.0)) - 0.5) * 0.3;
  float thin = smoothstep(hw, hw * 0.2, abs(f - cen));
  return on * head * tail * thin;
}

// blurred city light in the cell of q.x, sitting just above the horizon
vec3 bokeh(vec2 q, float scale, float seed, float kick) {
  float cell = floor(q.x * scale);
  float h = hash(vec2(cell, seed));
  float h2 = hash(vec2(cell + 9.1, seed));
  float h3 = hash(vec2(cell, seed + 4.0));
  vec2 c = vec2((cell + 0.3 + 0.4 * h) / scale, 0.012 + 0.05 * h2);
  float r = 0.008 + 0.008 * h3;
  float v = smoothstep(r, r * 0.25, length(q - c)) * step(0.3, h3);
  vec3 cc = mix(mix(uColor1, uColor2, h), uColor3, h2);
  return cc * v * (0.35 + 0.9 * uHigh * h + 0.9 * kick * h2);
}

float skyline(float x, float scale, float seed, float h0, float hv) {
  float c = floor(x * scale);
  return h0 + hv * hash(vec2(c, seed)) * (0.4 + 0.6 * hash(vec2(c * 1.7, seed + 3.0)));
}

// ripples + splash on the ground, in perspective world coordinates
float ripples(vec2 P, float s, float T, float dens, float px, float dd) {
  vec2 p = P * s;
  vec2 cell = floor(p);
  float h = hash(cell + s);
  float t = T * (0.8 + 0.2 * s) + h;
  float cyc = floor(t);
  float ph = fract(t);
  vec2 c = cell + 0.35 + 0.3 * vec2(hash(cell + cyc * 3.1), hash(cell.yx + cyc * 5.7));
  float act = step(hash(cell * 1.3 + cyc + s), dens);
  float dist = length(p - c);
  float w = 0.03 + 4.0 * px * s / dd;
  float ring = smoothstep(w, 0.0, abs(dist - ph * 0.3)) * (1.0 - ph) * (1.0 - ph);
  float splash = smoothstep(0.09, 0.0, dist) * smoothstep(0.22, 0.0, ph);
  return act * (ring + 1.6 * splash);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float asp = uResolution.x / uResolution.y;
  float px = 1.0 / uResolution.y;
  float fall = mod(uBassTime * 0.9 + uTime * 0.6, 50.0);
  float bar = mod(floor(uBeatClock / 4.0), 64.0);
  float bc = mod(uBeatClock, 512.0);
  float kick = clamp(uBassHit, 0.0, 1.0);
  float bolt = pow(kick, 4.0);
  float en = clamp(uEnergy, 0.0, 1.0);
  float dens = 0.35 + 0.6 * clamp(en * 1.3 + uBass * 0.3, 0.0, 1.0); // rain amount follows the music

  // wind: the param sets the lean, mids push it, the bar flips the gust a little
  float sg = wind < 0.0 ? -1.0 : 1.0;
  float gust = clamp(wind + sg * 0.6 * uMid + (hash(vec2(bar, 9.0)) - 0.5) * 0.3, -1.6, 1.6);

  float hz = 0.2 + 0.03 * sin(6.2831853 * mod(uBeatClock, 64.0) / 64.0);
  float x = (uv.x - 0.5) * asp;
  float sd = bar * 7.0;
  bool street = uv.y < hz;
  float vy = street ? (2.0 * hz - uv.y) : uv.y;
  float d = clamp((hz - uv.y) / hz, 0.0, 1.0);        // 0 at the curb, 1 at the bottom
  float wob = vnoise(vec2(x * 30.0, d * 60.0 - uTime * 0.6));
  float xr = street ? x + (wob - 0.5) * 0.05 * (0.3 + d) : x; // wet-street distortion

  // --- sky: dark gradient + clouds lit by the lightning
  float sky = smoothstep(hz, 1.0, vy);
  vec3 col = mix(uColor2 * 0.10, uColor1 * 0.16, sky);
  float cl = vnoise(vec2(xr * 1.3 - uTime * 0.03 * (1.0 + gust), vy * 2.6)) * 0.6
           + vnoise(vec2(xr * 3.1 + uTime * 0.05, vy * 6.0 - uTime * 0.02)) * 0.4;
  float lightX = (hash(vec2(floor(uBeatClock), 3.0)) - 0.5) * asp;
  float loc = 0.45 + 0.55 * exp(-abs(xr - lightX) * 1.3);
  col += mix(uColor1, uColor3, 0.4) * cl * cl * (0.05 + 1.1 * bolt * loc) * smoothstep(hz, hz + 0.25, vy);
  col += uColor3 * 0.25 * bolt * loc * sky;

  // --- fog, thicker at the horizon, tinted by the palette
  float fg = vnoise(vec2(xr * 1.6 + uBassTime * 0.05, vy * 3.0 - uTime * 0.04)) * 0.7
           + vnoise(vec2(xr * 3.7 - uTime * 0.07, vy * 6.0)) * 0.3;
  float fogD = (0.25 + 0.75 * fg) * (0.25 + 0.75 * exp(-abs(vy - hz) * 5.0));
  col += mix(uColor3, uColor1, vy) * fogD * (0.16 + 0.12 * uBass + 0.12 * kick);

  // --- skylines: far (lit windows) and near (black), city lights over them
  float aa = 1.5 * px;
  float sw = 1.0 + 0.5 * floor(hash(vec2(bar, 5.0)) * 3.0);
  float hFar = hz + skyline(xr + 3.1, 9.0 * sw, sd, 0.03, 0.17);
  float hNear = hz + skyline(xr, 5.0 * sw, sd + 1.0, 0.0, 0.12);
  float mFar = smoothstep(aa, -aa, vy - hFar);
  float mNear = smoothstep(aa, -aa, vy - hNear);
  vec2 wc = vec2(xr * 9.0 * sw * 4.0, (vy - hz) * 40.0);
  float win = step(0.78, hash(floor(wc) + sd)) * step(0.15, fract(wc.x)) * step(0.15, fract(wc.y)) * step(0.0, hFar - vy - 0.01);
  vec3 fcol = uColor1 * 0.05 + uColor3 * 0.4 * bolt + uColor1 * 0.15 * kick;
  fcol += mix(uColor2, uColor3, hash(floor(wc))) * win * (0.15 + 0.9 * uHigh + 1.2 * bolt);
  col = mix(col, fcol, mFar);
  col = mix(col, uColor2 * 0.3 * bolt * bolt, mNear);
  col += uColor3 * bolt * 0.7 * exp(-abs(vy - hNear) * 220.0) * step(hz, vy);

  float qy = (vy - hz) * (street ? 0.3 : 1.0);       // lights stretch down into the street
  vec3 lights = bokeh(vec2(xr, qy), 11.0, sd, kick) + bokeh(vec2(xr + 0.2, qy), 17.0, sd + 3.0, kick) * 0.7;
  col += lights * (street ? (1.0 - 0.6 * d) * (0.7 + 0.8 * wob) * 1.6 : 1.3);

  // --- wet street: darker mirror, ripples and splashes landing
  if (street) {
    col *= (0.6 - 0.3 * d) * (0.7 + 0.6 * wob);
    col += uColor2 * 0.05 * (1.0 - d);
    float dd = d + 0.1;
    vec2 P = vec2(x / dd, 1.0 / dd) * 0.5;
    float T = bc * 0.5;
    float rp = ripples(P, 2.0, T, dens, px, dd) + ripples(P + 7.3, 3.7, bc * 0.75, dens, px, dd) * 0.7;
    col += mix(uColor1, uColor3, 0.5 + 0.4 * wob) * rp * (0.5 + 1.5 * kick) * (0.35 + 0.65 * (1.0 - d * 0.5));
    col += uColor3 * 0.3 * exp(-abs(uv.y - hz) * 120.0) * (0.4 + bolt * 2.0);
    col += uColor3 * bolt * 0.12 * (1.0 - d);
  }

  // --- lamp beams through the fog (screen space, in front of the scene)
  float beams = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float xl = (hash(vec2(fi, bar + 11.0)) - 0.5) * asp * 0.9;
    float hy = hz + 0.3 + 0.1 * hash(vec2(fi + 4.0, bar));
    float t = clamp((hy - uv.y) / hy, 0.0, 1.0);
    float dx = x - xl - gust * 0.08 * t;
    float hwb = 0.012 + 0.17 * t;
    float b = smoothstep(hwb, 0.0, abs(dx)) * (1.0 - t * 0.6) * step(uv.y, hy);
    vec3 bc3 = mix(uColor3, uColor1, hash(vec2(fi, 2.0)));
    col += bc3 * b * (0.10 + 0.14 * fg) * (0.8 + 0.6 * uBeat + 0.5 * uBass);
    col += bc3 * exp(-length(vec2(dx, uv.y - hy)) * 55.0) * (0.6 + 0.6 * uBeat); // lamp head
    float pool = exp(-(dx * dx / 0.05 + (uv.y - hz * 0.45) * (uv.y - hz * 0.45) / 0.004));
    col += bc3 * pool * 0.25 * (0.6 + 0.8 * uBass);
    beams += b * (0.4 + 0.6 * fg);
  }

  // --- rain, five depths in parallax, all leaning with the same gust
  float lb = 1.0 + 1.5 * uLineBoost;
  float n = max(8.0, density);
  float l = clamp(streak, 0.03, 0.6);
  float r = rain(x, uv.y, n * 2.6, 0.8, l * 0.45 * 1.6, 1.2, gust * 0.6, 1.0, dens, fall) * 0.28
          + rain(x + 0.31, uv.y, n * 1.6, 1.1, l * 0.6 * 1.6, 1.5 * lb, gust * 0.8, 2.0, dens, fall) * 0.45
          + rain(x + 0.67, uv.y, n * 0.95, 1.5, l * 0.8 * 1.6, 2.0 * lb, gust, 3.0, dens, fall) * 0.7
          + rain(x + 0.12, uv.y, n * 0.5, 2.0, l * 1.2 * 1.6, 2.8 * lb, gust * 1.25, 4.0, dens, fall) * 0.9;
  float rn = rain(x + 0.49, uv.y, n * 0.2, 2.6, l * 1.7 * 1.6, 5.0 * lb, gust * 1.5, 5.0, dens, fall);
  vec3 rainCol = mix(vec3(0.85), uColor1, 0.3);
  float lit = 1.0 + 2.5 * beams + 2.0 * bolt;         // beams and lightning make the streaks blaze
  col += rainCol * r * (0.8 + 0.4 * uMid) * lit;
  col += mix(rainCol, uColor3, 0.5) * rn * (0.9 + 0.5 * uBass) * (1.0 + 1.5 * beams + 1.5 * bolt);

  // vignette in frame units, same bite on strip and portrait
  vec2 vq = (uv - 0.5) * vec2(min(asp, 1.8), 1.0);
  col *= clamp(1.15 - dot(vq, vq) * 0.9, 0.35, 1.0);
  col += uColor1 * 0.02;
  col = 1.0 - exp(-col * 1.5);                         // soft tone-map: flashes never clip to flat white
  gl_FragColor = vec4(col, 1.0);
}

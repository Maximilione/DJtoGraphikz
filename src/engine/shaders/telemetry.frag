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
uniform sampler2D uSpectrum;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float detail;
uniform float sweep;
uniform float glitch;
uniform float land;
uniform float uLineBoost;

// Telemetry: the control room of the night, drawn as one instrument panel.
// Centre: a wireframe globe (an orthographic sphere, both hemispheres, with
// dot-matrix land that lights when the radar sweep crosses it) inside a ring
// of spectrum bars read from the live FFT and two counter-rotating tick
// bezels. Left: four segmented meters for sub/bass/mid/high. Right: the
// oscilloscope trace and a column of scrolling machine words. Top: the bar
// position as 16 cells and a seven-segment beat counter. Everything is line
// work on black, so the palette is the picture: colour 1 for the instrument,
// colour 2 for what is live, colour 3 for the structure behind. The kick
// tears horizontal slices and splits the layers, like a feed losing sync.

const float TAU = 6.2831853;

float gPx;                 // one pixel in layout units
float gLb;                 // global line-thickness factor, 1 at the default

float h11(float x) { return fract(sin(x * 113.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(33.71, 67.13))) * 43758.5453); }

float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}

// antialiased line of half-width w around d = 0
float ln(float d, float w) { w *= gLb; return 1.0 - smoothstep(w, w + gPx * 1.5, abs(d)); }
// filled region d < 0
float fl(float d) { return 1.0 - smoothstep(0.0, gPx * 1.5, d); }

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float spec(float u) { return texture2D(uSpectrum, vec2(clamp(u, 0.0, 1.0), 0.5)).r; }
float wave(float u) { return texture2D(uSpectrum, vec2(clamp(u, 0.0, 1.0), 0.5)).g - 0.5; }

// seven-segment digit in a box of half-size (0.5, 1.0) * s
float seg7(vec2 p, float n, float s) {
  p /= s;
  // segment table as bits: a b c d e f g
  float m = n < 0.5 ? 63.0 : n < 1.5 ? 6.0 : n < 2.5 ? 91.0 : n < 3.5 ? 79.0 : n < 4.5 ? 102.0
          : n < 5.5 ? 109.0 : n < 6.5 ? 125.0 : n < 7.5 ? 7.0 : n < 8.5 ? 127.0 : 111.0;
  float d = 1e5;
  vec2 hb = vec2(0.3, 0.07), vb = vec2(0.07, 0.36);
  if (mod(m, 2.0) >= 1.0) d = min(d, sdBox(p - vec2(0.0, 0.9), hb));
  if (mod(floor(m / 2.0), 2.0) >= 1.0) d = min(d, sdBox(p - vec2(0.42, 0.45), vb));
  if (mod(floor(m / 4.0), 2.0) >= 1.0) d = min(d, sdBox(p - vec2(0.42, -0.45), vb));
  if (mod(floor(m / 8.0), 2.0) >= 1.0) d = min(d, sdBox(p - vec2(0.0, -0.9), hb));
  if (mod(floor(m / 16.0), 2.0) >= 1.0) d = min(d, sdBox(p - vec2(-0.42, -0.45), vb));
  if (mod(floor(m / 32.0), 2.0) >= 1.0) d = min(d, sdBox(p - vec2(-0.42, 0.45), vb));
  if (mod(floor(m / 64.0), 2.0) >= 1.0) d = min(d, sdBox(p, hb));
  return fl(d * s);
}

// a line of machine words: 3x5 dot glyphs from a hash, some cells left blank
float glyphRow(vec2 p, float seed) {
  vec2 c = floor(p);
  vec2 f = fract(p);
  if (c.y != 0.0 || c.x < 0.0) return 0.0;
  float word = h11(floor(c.x / 5.0) + seed * 7.0);
  if (mod(c.x, 5.0) > 3.5 || word < 0.25) return 0.0;
  vec2 g = floor(f * vec2(4.0, 6.0));
  if (g.x > 2.5 || g.y > 4.5) return 0.0;
  return step(0.45, h21(g + c.x * 17.0 + seed * 31.0));
}

// everything drawn, as three layers: x = instrument, y = live, z = structure
vec3 panel(vec2 p, float asp) {
  vec3 L = vec3(0.0);
  float t = uTime;
  float bc = uBeatClock;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float det = clamp(detail, 0.3, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  // ---- structure: dot grid, cross hairs, corner brackets
  vec2 gq = fract(p * 24.0) - 0.5;
  L.z += fl(length(gq) / 24.0 - 0.0012) * 0.5 * step(0.52, r);
  vec2 gq2 = abs(fract(p * 3.0) - 0.5);
  L.z += ln((0.5 - max(gq2.x, gq2.y)) / 3.0, 0.0004) * 0.22 * step(0.52, r);
  vec2 cb = abs(p) - vec2(asp * 0.5 - 0.02, 0.48);
  float br = ln(sdBox(p, vec2(asp * 0.5 - 0.02, 0.48)), 0.001);
  L.x += br * step(-0.07, max(cb.x, cb.y) - 0.0) * step(-0.07, min(cb.x, cb.y)) * 0.9;

  // ---- globe: orthographic sphere of radius R, front and back
  float R = 0.2 * (1.0 + 0.03 * kick);
  float rotA = t * 0.12 + uBassTime * 0.1;
  float sw = bc * 0.25 * clamp(sweep, 0.0, 3.0) * TAU / 2.0;   // sweep meridian
  if (r < R) {
    float z = sqrt(R * R - r * r);
    for (int s = 0; s < 2; s++) {
      vec3 n = vec3(p, s == 0 ? z : -z) / R;
      // tilt the axis, then spin
      float ct = cos(0.41), st = sin(0.41);
      n.yz = vec2(n.y * ct - n.z * st, n.y * st + n.z * ct);
      float lon = atan(n.x, n.z) + rotA;
      float lat = asin(clamp(n.y, -1.0, 1.0));
      float face = s == 0 ? 1.0 : 0.2;
      float cl = cos(lat);
      // graticule every 15 degrees; line width in angle grows where the sphere turns away
      float wpx = gPx / R / max(abs(n.z) * 0.6 + 0.2, 0.2);
      float gl = 1.0 - smoothstep(wpx, wpx * 2.5, (0.5 - abs(fract(lon / TAU * 24.0) - 0.5)) * TAU / 24.0 * cl);
      float gt = 1.0 - smoothstep(wpx, wpx * 2.5, (0.5 - abs(fract(lat / TAU * 24.0) - 0.5)) * TAU / 24.0);
      L.z += max(gl, gt) * 0.6 * face;
      // land: dot matrix where a noise field is above sea level
      vec2 dm = vec2(lon / TAU * 72.0, lat / TAU * 72.0);
      vec2 dc = floor(dm);
      vec2 cc = (dc + 0.5) / 72.0 * TAU;
      float nz = vn(vec2(cos(cc.x), sin(cc.x)) * 2.2 * cos(cc.y) + cc.y * 2.0 + 4.0) * 0.65
               + vn(vec2(cc.x * 3.0, cc.y * 5.0)) * 0.35;
      float isLand = step(0.66 - 0.22 * clamp(land, 0.0, 1.0), nz);
      float dot_ = fl((length(fract(dm) - 0.5) - 0.24) * TAU / 72.0 * R) * step(wpx * 72.0 / TAU, 0.55);
      // the radar meridian passes: cells light and decay behind it
      float dl = mod(sw - cc.x, TAU) / TAU;
      float lit = exp(-dl * 7.0);
      L.x += dot_ * isLand * (0.28 + 0.2 * uMid) * face;
      L.y += dot_ * isLand * lit * 1.6 * face;
      L.y += (1.0 - smoothstep(wpx, wpx * 3.0, min(dl, 1.0 - dl) * TAU * cl)) * 0.9 * face;
    }
    // limb shading: a thin atmosphere so the ball reads as a volume
    L.x += pow(r / R, 6.0) * 0.35;
  }
  L.x += ln(r - R, 0.0012) * 1.0;

  // ---- bezels and the spectrum ring
  float R1 = R + 0.022;
  float tick = fract((a + t * 0.05) / TAU * 180.0);
  float major = step(fract((a + t * 0.05) / TAU * 36.0), 0.2);
  float tl = step(tick, 0.3) * fl(abs(r - R1 - 0.006 - 0.005 * major) - 0.004 - 0.005 * major);
  L.x += tl * 0.7;
  // spectrum: 96 bars, mirrored left/right so the bass sits at the bottom
  float su = abs(a + TAU * 0.25);
  su = su > TAU * 0.5 ? TAU - su : su;
  su /= TAU * 0.5;
  float nb = 48.0;
  float bi = floor(su * nb);
  float bf = fract(su * nb);
  float lvl = spec(0.02 + 0.8 * (bi + 0.5) / nb);
  float R2 = R + 0.055;
  float len = 0.012 + 0.13 * lvl * (0.6 + 0.6 * uEnergy);
  float bar = step(0.18, bf) * step(bf, 0.82) * step(R2, r) * fl(r - R2 - len);
  L.y += bar * (0.6 + 0.8 * lvl);
  L.x += step(0.18, bf) * step(bf, 0.82) * ln(r - R2 - len, 0.0015) * 0.9;
  // outer bezel: arcs that step a notch per beat, opposite direction
  float R3 = R + 0.215;
  float ao = a - floor(bc) * TAU / 16.0 - TAU / 16.0 * (1.0 - pow(1.0 - fract(bc), 5.0));
  float arcs = step(fract(ao / TAU * 4.0), 0.36 + 0.3 * det);
  L.z += ln(r - R3, 0.0035) * arcs * 1.4;
  L.x += ln(r - R3 - 0.014, 0.0008) * 0.6;
  L.x += ln(r - R3 - 0.02, 0.004) * step(fract(ao / TAU * 64.0), 0.25) * step(0.5, det) * 0.6;
  // kick ring leaving the globe
  float kr = R + (1.0 - kick) * 0.6;
  L.y += ln(r - kr, 0.003) * kick * 1.2 * step(R, r);

  // ---- left column: four meters
  float xl = -asp * 0.5 + 0.075;
  // gate: the meters, their labels and baselines live in this box only
  if (p.x > xl - 0.005 && p.x < xl + 0.205 && p.y > -0.145 && p.y < 0.295)
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 q = p - vec2(xl, 0.24 - fi * 0.115);
    float v = i == 0 ? uBass : i == 1 ? uMid : i == 2 ? uHigh : uEnergy;
    v = clamp(v, 0.0, 1.0);
    float W = 0.2;
    if (q.x > 0.0 && q.x < W && abs(q.y) < 0.022) {
      float c = floor(q.x / W * 20.0);
      float cf = fract(q.x / W * 20.0);
      float on = step(c / 20.0, v);
      float cell = step(0.18, cf) * step(abs(q.y), 0.016);
      L.y += cell * on * (0.7 + 0.5 * step(15.5, c));
      L.z += cell * (1.0 - on) * 0.45;
    }
    L.x += glyphRow((q - vec2(0.0, 0.03)) / vec2(0.011, 0.018), fi + 1.0) * step(q.x, 0.11) * 0.8;
    L.x += ln(q.y + 0.03, 0.0006) * step(0.0, q.x) * step(q.x, W) * 0.5;
  }
  // big seven-segment beat counter under the meters: bar . beat
  {
    vec2 q = p - vec2(xl + 0.03, -0.3);
    // gate: the digits span q.x -0.022..0.172, |q.y| < 0.044
    if (q.x > -0.03 && q.x < 0.18 && abs(q.y) < 0.05) {
    float barN = mod(floor(bc / 4.0), 100.0);
    float beatN = mod(floor(bc), 4.0) + 1.0;
    float d = seg7(q, floor(barN / 10.0), 0.045) + seg7(q - vec2(0.062, 0.0), mod(barN, 10.0), 0.045);
    L.x += d;
    L.y += seg7(q - vec2(0.15, 0.0), beatN, 0.045) * (0.6 + 0.8 * kick);
    L.x += fl(length(q - vec2(0.105, -0.036)) - 0.006);
    }
  }

  // ---- right column: oscilloscope and scrolling words
  float xr = asp * 0.5 - 0.075 - 0.24;
  {
    vec2 q = p - vec2(xr + 0.12, 0.2);
    float bx = sdBox(q, vec2(0.12, 0.075));
    L.x += ln(bx, 0.0008) * 0.8;
    if (bx < 0.0) {
      float u = (q.x + 0.12) / 0.24;
      float w0 = wave(u) * 0.14 * (0.6 + uEnergy);
      float w1 = wave(u + gPx * 6.0) * 0.14 * (0.6 + uEnergy);
      // distance to the trace, slope-compensated so steep parts keep their weight
      float sl = (w1 - w0) / (gPx * 6.0 * 0.24);
      L.y += ln((q.y - w0) / sqrt(1.0 + sl * sl * 0.04), 0.0016) * 1.3;
      L.z += ln(q.y, 0.0005) * 0.6 + ln(fract(u * 8.0) - 0.5, 0.004) * 0.25;
    }
  }
  if (det > 0.45) {
    vec2 q = p - vec2(xr, 0.09);
    float rows = 13.0;
    float rowH = 0.027;
    float scroll = floor(bc * 2.0);
    float ry = floor(-q.y / rowH);
    if (ry >= 0.0 && ry < rows && q.x > 0.0 && q.x < 0.24) {
      vec2 g = vec2(q.x / 0.011, fract(-q.y / rowH) * 1.5);
      float seed = ry + scroll;
      float hot = step(0.86, h11(seed * 3.3));
      float row = glyphRow(g, seed) * step(q.x, 0.06 + 0.18 * h11(seed + 0.5));
      L.x += row * (1.0 - hot) * (0.75 - 0.04 * ry);
      L.y += row * hot;
    }
  }

  // ---- top: bar position as 16 cells; bottom: a time ruler that scrolls
  {
    vec2 q = p - vec2(0.0, 0.452);
    float W = 0.5;
    if (abs(q.x) < W * 0.5 && abs(q.y) < 0.009) {
      float c = floor((q.x / W + 0.5) * 16.0);
      float cf = fract((q.x / W + 0.5) * 16.0);
      float pos = floor(uBarPhase * 16.0);
      float cell = step(0.12, cf);
      L.y += cell * step(abs(c - pos), 0.5) * 1.4;
      L.x += cell * step(c, pos - 0.5) * 0.55;
      L.z += cell * step(pos + 0.5, c) * 0.5;
    }
    vec2 q2 = p - vec2(0.0, -0.452);
    float ru = q2.x * 60.0 + bc * 4.0;
    float tall = step(fract(ru / 4.0), 0.25);
    L.x += step(fract(ru), 0.14) * fl(abs(q2.y) - 0.004 - 0.008 * tall) * step(abs(q2.x), asp * 0.5 - 0.12) * 0.7;
    L.y += fl(abs(q2.x) - 0.0015) * fl(abs(q2.y) - 0.02);
  }
  return L;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float asp = uResolution.x / uResolution.y;
  gPx = 1.0 / uResolution.y;
  gLb = (1.0 + 2.5 * uLineBoost) / 2.25;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float gl = clamp(glitch, 0.0, 1.0);

  // sync loss on the kick: slices slide sideways, a new pattern every beat
  float band = floor((p.y + 0.5) * 22.0);
  float hr = h21(vec2(band, floor(uBeatClock)));
  float slip = step(0.72, hr) * (hr - 0.86) * 0.5 * gl * kick * kick;
  vec2 q = p + vec2(slip, 0.0);
  // tiny breathing zoom so nothing is ever frozen
  q *= 1.0 - 0.012 * kick + 0.004 * sin(uTime * 0.5);

  float split = (0.0015 + 0.012 * gl * kick) ;
  vec3 A = panel(q, asp);
  vec3 B = panel(q + vec2(split, 0.0), asp);

  vec3 c1 = uColor1, c2 = uColor2, c3 = uColor3;
  // the live layer is hot: palette colour pushed toward white where it stacks
  vec3 col = c1 * A.x * 0.9 + mix(c2, vec3(1.0), 0.25) * A.y * 1.25 + c3 * A.z * 0.85;
  // ghost of the shifted copy in the structure colour: depth, and the tear
  col += c3 * (B.x + B.y) * 0.35 + c2 * B.z * 0.12;

  // scan beam and phosphor texture
  // scanlines scaled with the resolution: visible at 4K, no moire when upscaled
  float sl = max(1.0, floor(uResolution.y / 540.0));
  float scan = 0.82 + 0.18 * step(0.5, fract(gl_FragCoord.y / (2.0 * sl)));
  // square by multiplication: pow() of a negative base is undefined in GLSL ES
  float bx = (fract(p.y * 0.5 + 0.5 - uTime * 0.07) - 0.5) * 9.0;
  float beam = exp(-bx * bx);
  col *= scan * (1.0 + 0.5 * beam);
  // glow of the tube behind the lines
  float r = length(p);
  col += mix(c3, c1, 0.3) * (0.022 + 0.03 * kick) * exp(-r * r * 5.0);
  col += c3 * 0.006;

  col *= 1.0 + 0.35 * kick;
  col = col / (1.0 + 0.3 * col);
  col *= clamp(1.2 - dot(p, p) * 0.55, 0.5, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

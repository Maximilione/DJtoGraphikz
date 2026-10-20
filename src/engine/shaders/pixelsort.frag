precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float threshold;
uniform float streak;
uniform float dir;
uniform float steps;

// Pixel Sort Cascade: a true pixel sort needs a sorted buffer, a fragment
// shader has none. So each pixel estimates its own run analytically: along the
// sort axis it walks up to N steps upstream and N downstream while the source
// luminance stays above a threshold, collecting the run's brightest and
// darkest values. Inside the run the normalised position s indexes the sorted
// ramp, L' = mix(Lmax, Lmin, s), quantised into bands. Runs are also capped
// by sliding max-interval chunks, and the run edges are bisected so s is
// continuous and the head is a thin bright line, not a whole step band.
// Columns are a few px wide with hashed length and threshold: that is the
// ragged drip front.
// The kick drops the threshold and stretches the runs. Own maths, own palette.

#ifdef LOWQ
#define N 8
#else
#define N 12
#endif

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float seedG;

// cheap source: Mondrian-like cells, sine bands, two blobs. rgb + luminance
vec4 src(vec2 q) {
  vec2 g = floor(q * vec2(5.0, 3.0) + vec2(0.0, mod(uBassTime * 0.15, 64.0)));
  float h = hash21(g + seedG);
  float h2 = hash21(g * 1.7 + 11.3 + seedG);
  vec3 c;
  // 15% black cells: enough contrast for the drips to read, not a quarter of
  // the wall left dark
  if (h < 0.15) c = vec3(0.0);
  else if (h < 0.4) c = uColor1;
  else if (h < 0.62) c = uColor2;
  else if (h < 0.82) c = uColor3;
  else c = vec3(1.0);
  if (h >= 0.15) c *= 0.25 + 0.75 * h2;
  float k = 0.5 + 0.5 * sin(q.y * 9.0 + q.x * 3.0 + mod(uBassTime * 0.8, 62.8318));
  c *= mix(0.55, 1.15, k);
  float t = uTime * 0.1;
  vec2 c1 = vec2(0.5 + 0.35 * sin(t * 3.1), 0.5 + 0.3 * sin(t * 4.3 + 1.0));
  vec2 c2 = vec2(0.5 + 0.38 * sin(t * 2.3 + 2.0), 0.5 + 0.32 * sin(t * 3.7 + 4.0));
  float bl = smoothstep(0.22, 0.0, length(q - c1)) + smoothstep(0.22, 0.0, length(q - c2));
  c += vec3(1.0, 0.9, 0.75) * bl * 0.8;
  c = min(c, vec3(1.5));
  return vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}

void main() {
  vec2 res = uResolution;
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / res;
  float sc = res.y / 1080.0;

  float d = floor(dir + 0.5);
  bool horiz = d > 0.5 && d < 1.5;
  if (d > 1.5) horiz = mod(floor(uBeatClock / 8.0), 2.0) > 0.5;
  bool flip = d > 1.5 && mod(floor(uBeatClock / 4.0), 2.0) > 0.5;

  float colw = max(3.0 * sc, 1.0);
  float seed = mod(floor(uBeatClock / 8.0), 64.0);
  seedG = seed * 0.37;

  float b = horiz ? px.y : px.x;
  float a = horiz ? uv.x : 1.0 - uv.y;
  float col = floor(b / colw);
  float bC = (col + 0.5) * colw;
  float bn = bC / (horiz ? res.y : res.x);

  float hc = hash11(col * 0.137 + seed * 7.3);
  float lenMul = mix(0.35, 1.6, hc * hc);
  float thrOff = (hash11(col + seed * 3.1) - 0.5) * 0.18
               + (hash11(col + floor(uTime * 20.0) * 1.3) - 0.5) * 0.12 * uHigh;
  float thr = clamp(threshold + thrOff - 0.35 * uBassHit, 0.02, 0.98);
  float L = clamp(streak * lenMul * (1.0 + uBassHit), 0.02, 1.5);
  float st = L / float(N);
  float ares = horiz ? res.x : res.y; // pixels along the sort axis

  float aa = flip ? 1.0 - a : a;
  // a in sort space -> screen uv
  vec2 q0 = horiz ? vec2(aa, bn) : vec2(bn, 1.0 - aa);

  vec4 s0 = src(q0);
  vec3 rgb;
  float nsteps = clamp(floor(steps + 0.5), 3.0, 24.0);

  if (s0.a < thr) {
    rgb = s0.rgb * 0.8;
  } else {
    // Max-interval chunks of length L per column, staggered by a hashed offset
    // and sliding forward with time: every run is bounded, so even a fully
    // bright region gets sorted into drips, and the moving chunk heads are the
    // cascade. A pixel is at most L from both chunk edges, so the two walks
    // together take at most N+1 samples.
    float off = fract(hash11(col * 0.71 + seed) + mod(uTime * 0.08 + uBassTime * 0.15, 64.0) * (0.5 + 0.5 * lenMul)) * L;
    float cs = floor((aa - off) / L) * L + off;
    float ce = cs + L;
    cs = max(cs, 0.0);
    ce = min(ce, 1.0);

    float Lmax = s0.a, Lmin = s0.a;
    vec3 cMax = s0.rgb, cMin = s0.rgb;
    float aS = cs, aE = ce;

    // upstream (towards the head)
    float lastIn = aa;
    for (int i = 1; i <= N; i++) {
      float qa = aa - float(i) * st;
      if (qa <= cs) break; // chunk edge reached: aS stays cs
      vec4 v = src(horiz ? vec2(qa, bn) : vec2(bn, 1.0 - qa));
      if (v.a < thr) {
        // bisect the threshold crossing between qa (out) and lastIn (in)
        float lo = qa, hi = lastIn;
        for (int j = 0; j < 3; j++) {
          float m = 0.5 * (lo + hi);
          if (src(horiz ? vec2(m, bn) : vec2(bn, 1.0 - m)).a < thr) lo = m; else hi = m;
        }
        aS = hi;
        break;
      }
      lastIn = qa;
      if (v.a > Lmax) { Lmax = v.a; cMax = v.rgb; }
      if (v.a < Lmin) { Lmin = v.a; cMin = v.rgb; }
    }
    // downstream (towards the tail)
    lastIn = aa;
    for (int i = 1; i <= N; i++) {
      float qa = aa + float(i) * st;
      if (qa >= ce) break;
      vec4 v = src(horiz ? vec2(qa, bn) : vec2(bn, 1.0 - qa));
      if (v.a < thr) {
        float lo = lastIn, hi = qa;
        for (int j = 0; j < 3; j++) {
          float m = 0.5 * (lo + hi);
          if (src(horiz ? vec2(m, bn) : vec2(bn, 1.0 - m)).a < thr) hi = m; else lo = m;
        }
        aE = lo;
        break;
      }
      lastIn = qa;
      if (v.a > Lmax) { Lmax = v.a; cMax = v.rgb; }
      if (v.a < Lmin) { Lmin = v.a; cMin = v.rgb; }
    }

    // continuous position in the run: 0 at the head, 1 at the tail
    float s = clamp((aa - aS) / max(aE - aS, 1e-4), 0.0, 1.0);
    float sq = floor(s * nsteps) / nsteps;
    float Ls = mix(Lmax, Lmin, sq);
    Ls = floor(Ls * nsteps) / nsteps;
    vec3 tint = mix(cMax, cMin, sq);
    float tl = dot(tint, vec3(0.299, 0.587, 0.114));
    rgb = tint / max(tl, 0.05) * max(Ls, 0.08);
    rgb = mix(rgb, uColor1 * 1.2, (1.0 - sq) * 0.25);
    // bright head line, a couple of px thick: the signature of the sort
    float headPx = (aa - aS) * ares;
    float head = 1.0 - smoothstep(0.0, 2.0 * sc + 1.0, headPx);
    rgb += vec3(0.35 + 0.65 * uHighHit) * head;
    // dark seam at the tail so stacked runs read as separate drips
    float tailPx = (aE - aa) * ares;
    rgb *= 0.55 + 0.45 * smoothstep(0.0, 1.5 * sc + 1.0, tailPx);
    if (s > 0.9 && uHigh > 0.3) {
      vec3 tr = mix(uColor2, uColor3, 0.5);
      float k = clamp((uHigh - 0.3) * 1.5, 0.0, 1.0);
      rgb.r = mix(rgb.r, rgb.r * 0.6 + tr.r * 0.5, k * step(0.5, hash11(col + 5.0)));
      rgb.b = mix(rgb.b, rgb.b * 0.6 + tr.b * 0.5, k * step(0.5, hash11(col + 9.0)));
    }
  }

  rgb *= 0.94 + 0.06 * hash21(px + floor(uTime * 24.0));
  if (horiz) rgb *= 0.96 + 0.04 * sin(px.y * 3.14159265);
  rgb = clamp(rgb, 0.0, 1.0);
  gl_FragColor = vec4(rgb, 1.0);
}

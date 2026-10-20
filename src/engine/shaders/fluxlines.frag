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

uniform float poles;
uniform float density;
uniform float flow;
uniform float glow;

// Flux Lines: a full-screen magnetic field. 2-5 invisible poles orbit on slow
// Lissajous paths; the field lines are the iso-lines of the stream function
// psi = sum q_i * atan2(p - p_i), with q_i exactly +-1 and the line count K an
// integer, so the branch cuts of atan cancel in fract(psi*K/TAU). The gradient
// of psi is closed-form, so the line width is constant in pixels and there is
// no fwidth anywhere. The orthogonal potential phi = sum q_i * log|p - p_i|
// gives a coordinate along the lines: light pulses travel along it on the beat
// clock. Every 2 beats one pole flips polarity, but never by interpolating q:
// inside an expanding ring the new sign is used, outside the old one, and the
// ring edge is drawn as the bright shockwave that hides the seam.

const float TAU = 6.2831853;
const int MAXP = 5;

float hash11(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

// Lissajous position of pole fi for pattern index pat, before constellation rotation.
vec2 orbit(float fi, float pat, float w) {
  // integer ratios: w wraps at TAU*12, so a fractional ratio would jump the pole
  float ai = 1.0 + floor(hash11(fi + pat) * 3.0);
  float bi = 1.0 + floor(hash11(fi * 3.1 + pat) * 3.0);
  float ro = (0.22 + 0.12 * uBass) * (0.6 + 0.4 * hash11(fi + 7.0));
  return ro * vec2(1.6 * sin(ai * w + fi * 2.1), cos(bi * w + fi * 1.3));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float px = 1.0 / uResolution.y;

  float hit = clamp(uBassHit, 0.0, 1.0);
  int N = int(clamp(floor(poles + 0.5), 2.0, 5.0));
  float fN = float(N);
  float K = floor(clamp(density, 8.0, 40.0));
  float K2 = 2.0 * K;

  // beat-clock structure
  float pat = floor(uBeatClock / 16.0);
  float xf = smoothstep(0.0, 4.0, mod(uBeatClock, 16.0));
  float w = mod(uTime * 0.12, TAU * 12.0);
  float bar = floor(uBeatClock / 4.0);
  float barFrac = fract(uBeatClock / 4.0) * 4.0;
  float rotA = (TAU / 16.0) * (bar - 1.0 + smoothstep(0.0, 1.0, barFrac));
  float cr = cos(rotA), sr = sin(rotA);
  mat2 R = mat2(cr, sr, -sr, cr);

  // flip counter and ring. uBassTime is a continuous bass-weighted clock, not a
  // kick counter, and uBassHit is not reset in step with it, so a counter on
  // uBassTime flipped at arbitrary moments with the ring elsewhere (or already
  // gone, rw = inf): a full-screen hard cut. The flip is instead locked to the
  // beat clock, one every 2 beats, and the ring's own timer is the beat phase:
  // it starts at radius 0 on the flip and is past every screen corner (2.6)
  // one beat later, so the old/new seam is always under the moving front.
  // The kick only sets how bright the front is.
  float bc = max(uBeatClock, 0.0);
  float kc = floor(bc * 0.5);
  float fl = mod(kc, fN);
  float tr = clamp(bc - kc * 2.0, 0.0, 1.0);
  float rw = tr >= 1.0 ? 1e5 : 2.6 * (1.0 - (1.0 - tr) * (1.0 - tr));
  float front = (1.0 - tr) * (0.35 + 0.25 * uBass) + hit;

  float psi = 0.0;
  float phi = 0.0;
  vec2 g = vec2(0.0);
  float core = 0.0;
  float nearD = 1e5;
  float polW = 0.0;
  float polS = 1e-6;
  vec2 pFl = vec2(0.0);

  for (int i = 0; i < MAXP; i++) {
    if (i >= N) break;
    float fi = float(i);
    vec2 a = orbit(fi, pat - 1.0, w);
    vec2 b = orbit(fi, pat, w);
    vec2 pi = R * mix(a, b, xf);

    float qbase = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float nf = kc >= fi ? floor((kc - fi) / fN) + 1.0 : 0.0;
    float qNew = qbase * (mod(nf, 2.0) < 0.5 ? 1.0 : -1.0);
    float q = qNew;
    bool isFl = (abs(fi - fl) < 0.5);
    vec2 d = p - pi;
    if (isFl) {
      float qOld = -qNew;
      q = length(d) < rw ? qNew : qOld;
      pFl = pi;
    }

    float r2 = dot(d, d) + 1e-5;
    psi += q * atan(d.y, d.x);
    phi += q * 0.5 * log(r2);
    g += q * vec2(-d.y, d.x) / r2;
    float rr = sqrt(r2);
    core += exp(-rr * 28.0) * (0.6 + 1.2 * hit * (isFl ? 1.0 : 0.4));
    nearD = min(nearD, rr);
    // soft polarity: inverse-square weighted sign, continuous between poles
    // (the nearest-pole sign drew a hard Voronoi seam in colour)
    float wq = 1.0 / (r2 + 0.004);
    polW += q * wq;
    polS += wq;
  }

  float gpsi = length(g) + 1e-3;

  // primary family
  float f = psi * K / TAU;
  float dist1 = abs(fract(f + 0.5) - 0.5) / (gpsi * K / TAU);
  float lineId = floor(f + 0.5);
  // psi jumps by +-TAU across each atan cut, so lineId jumps by +-K there:
  // index lines mod K or the per-line phase/shimmer breaks along a ray per pole
  float lk = mod(lineId, K);
  float lh = hash11(lk);
  float shim = hash11(lk * 1.7 + floor(uTime * 12.0));
  float wd = px * (1.2 + 0.8 * uHigh * shim);
  float cor = smoothstep(wd * 1.5, 0.0, dist1);
  float halo = exp(-dist1 / (px * 6.0 * glow + 1e-4)) * 0.35 * glow;
  float sp = TAU / (K * gpsi) / px;
  float avg = 0.25 + 0.15 * glow;
  float lineAA = mix(avg, cor + halo, smoothstep(1.5, 4.0, sp));

  // secondary family (highs and kick spike): twice as many, thinner lines
  float f2 = psi * K2 / TAU;
  float dist2 = abs(fract(f2 + 0.5) - 0.5) / (gpsi * K2 / TAU);
  float sp2 = sp * 0.5;
  float w2 = 0.3 * uHigh + 0.35 * smoothstep(0.3, 0.9, hit);
  float line2 = smoothstep(wd * 0.9, 0.0, dist2) * smoothstep(2.5, 4.5, sp2) * w2;

  // travelling pulses along the lines: one wave per beat
  float ph = phi * 1.2 - uBeatClock * flow + lh * 0.3;
  float pulse = pow(0.5 + 0.5 * cos(TAU * ph), 8.0);
  // |grad phi| == |grad psi|: near the poles the pulses get denser than a pixel,
  // fade them to their mean (0.196) there
  pulse = mix(0.196, pulse, smoothstep(0.4, 0.15, gpsi * 1.2 * px));
  float bl = (0.35 + 1.1 * pulse) * lineAA + (0.4 + 0.8 * pulse) * line2;

  // shockwave ring from the flipping pole
  float dr = abs(length(p - pFl) - rw);
  float sw = exp(-dr / (px * 3.0)) * front * 1.2 + exp(-dr * 18.0) * front * 0.25;
  bl *= 1.0 + 3.0 * exp(-dr * 25.0) * front;
  bl *= 0.75 + 0.5 * uEnergy;

  // colour: polarity of the nearest pole, slow hue drift on the beat clock
  float pol = polW / polS;
  vec3 lc = mix(uColor2, uColor1, 0.5 + 0.5 * pol);
  float drift = 0.2 * (0.5 + 0.5 * cos(TAU * uBeatClock / 32.0));
  lc = mix(lc, uColor3, drift);

  vec3 col = lc * bl;
  col += mix(uColor3, vec3(1.0), 0.6) * core * (0.8 + 0.6 * uBass);
  col += vec3(1.0) * smoothstep(0.6, 1.0, bl * cor) * 0.5;
  col += uColor3 * sw;

  // background and soft vignette
  col += vec3(0.006, 0.006, 0.012);
  col += lc * 0.03 * uBass * exp(-nearD * 3.0);
  col *= clamp(1.2 - dot(p, p) * 0.7, 0.45, 1.0);

  col = max(col, vec3(0.0));
  col = 1.0 - exp(-col * 1.4);
  gl_FragColor = vec4(col, 1.0);
}

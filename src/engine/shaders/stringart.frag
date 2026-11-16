precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;

varying vec2 vUv;

uniform float nodes;
uniform float multiplier;
uniform float linew;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

#define TAU 6.28318530718

// Times-table string art: node i is joined to node (i * m) mod N. As m drifts
// the chords sweep through cardioid, nephroid and on — the envelope of the
// chords is the shape, no curve is ever drawn.

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  // on a vertical frame the circle must fit the width, not the height
  vec2 p = (uvp - 0.5) * vec2(aspect, 1.0) * 1.95 * max(1.0, 1.0 / aspect);

  float lkb = 1.0 + 2.5 * uLineBoost;
  float lminPx = 3.0 + 4.0 * uLineBoost;
  // p spans 1.95 units over the short side: one pixel in p units
  float pxP = 1.95 * max(1.0, 1.0 / aspect) / uResolution.y;
  float n = clamp(floor(nodes), 8.0, 120.0);
  // m and m + n draw the same chords, so the drift wraps at n: exact, and the
  // product fi * m never grows past float precision over a long night
  float m = multiplier + mod(uBeatClock * 0.035, n) + uBass * 0.6;
  float r = 0.85 + 0.08 * uBeat;

  float w0 = linew * 0.0016 * (1.0 + 1.5 * uBass);
  // ink half-width ~ 2w: floor it at lminPx pixels
  float w = max(w0 * lkb, lminPx * pxP * 0.5);
  float acc = 0.0, near = 1e9, idx = 0.0;
  // no far-field chord skipping: even/odd chords are different families when
  // fract(m/n) ~ 0.5, so a strided sum left a hard ring in the glow

  // The chord ends are two arithmetic progressions of angles (a0 = i*TAU/n,
  // a1 = TAU*fract(i*m/n) == i*TAU*fract(m/n) mod TAU), so they are walked
  // with a rotation recurrence: 4 cos/sin per pixel instead of 4 per chord.
  // The fp32 drift after 120 steps is ~1e-5, a pixel is ~2e-3 in p units.
  float sa = TAU / n;
  float sb = TAU * fract(m / n);
  vec2 rA = vec2(cos(sa), sin(sa));
  vec2 rB = vec2(cos(sb), sin(sb));
  vec2 A = vec2(r, 0.0);
  vec2 B = vec2(r, 0.0);
  for (int i = 0; i < 120; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float d = segDist(p, A, B);
    if (d < near) { near = d; idx = fi; }
    acc += w0 / (d + w0 * 1.4);      // every chord adds a little light
    A = vec2(A.x * rA.x - A.y * rA.y, A.x * rA.y + A.y * rA.x);
    B = vec2(B.x * rB.x - B.y * rB.y, B.x * rB.y + B.y * rB.x);
  }

  float line = 1.0 - smoothstep(w, w * 2.6, near);
  // the palette goes round the circle, turning slowly. By distance to the
  // nearest chord (mix(c2, c1, near * 3)) every line itself was colour 2.
  vec3 tint = pal3(atan(p.y, p.x) / TAU + uTime * 0.02);

  // line art is mostly black by construction, so the ink and the accumulated
  // chord glow both have to carry more than they would in a filled effect
  // a light runs round the chords on the beat; highs sparkle single chords
  float chase = 0.55 + 0.45 * smoothstep(0.25, 0.0, abs(fract(idx / n - uBeatClock * 0.25) - 0.5));
  float spark = 1.0 + 0.4 * uHigh * step(0.5, fract(idx * 0.618 + floor(uTime * 12.0) * 0.37));
  vec3 c = tint * line * (1.6 + 0.9 * uBeat) * chase * spark;
  c += mix(uColor1, uColor3, 0.5) * acc * (0.09 + 0.06 * uEnergy);
  c += uColor3 * 0.03 * smoothstep(1.3, 0.6, length(p));   // floor only on the disc
  c = 1.0 - exp(-c * 1.3);   // hot core, coloured edges, no flat clip

  gl_FragColor = vec4(c, 1.0);
}

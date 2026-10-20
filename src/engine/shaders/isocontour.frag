precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uHighHit;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uBassTime;
uniform float uLineBoost;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float shapes;
uniform float morph;
// 'pace', not 'speed': the engine owns a param called speed (it scales uTime
// for every effect) and never uploads a same-named shader uniform
uniform float pace;

// Isocontour: a laser-etched topographic map of an invisible object. A few
// polygon signed-distance fields (circle, triangle, box, hexagon) orbit,
// rotate and melt into each other through a polynomial smooth-min; the space
// around them is drawn only as thin evenly spaced level sets of the combined
// distance, every 5th one hotter, with a white-hot line on the zero contour.
// Pure 2D, no raymarching. The primitives are the standard edge-projection /
// abs-fold distance maths, written out here from the geometry. Line width is
// held in pixels by dividing by the screen-space derivative of the contour
// coordinate. The kick fuses the shapes (smin k jumps) and launches a band of
// new lines outward; bass swells scale and orbit; highs heat the zero edge.

float sdCircle(vec2 q, float r) { return length(q) - r; }

float sdBox(vec2 q, float r) {
  vec2 d = abs(q) - vec2(r * 0.9);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTri(vec2 q, float r) {
  float k = 1.7320508;
  q.x = abs(q.x) - r;
  q.y = q.y + r / k;
  if (q.x + k * q.y > 0.0) q = vec2(q.x - k * q.y, -k * q.x - q.y) * 0.5;
  q.x -= clamp(q.x, -2.0 * r, 0.0);
  return -length(q) * sign(q.y);
}

float sdHex(vec2 q, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
  q = abs(q);
  q -= 2.0 * min(dot(k.xy, q), 0.0) * k.xy;
  q -= vec2(clamp(q.x, -k.z * r, k.z * r), r);
  return length(q) * sign(q.y);
}

float shapeSdf(int id, vec2 q, float r) {
  float c = sdCircle(q, r);
  float s;
  if (id == 0) s = c;
  else if (id == 1) s = sdTri(q, r * 0.95);
  else if (id == 2) s = sdBox(q, r);
  else s = sdHex(q, r);
  return mix(c, s, morph);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

vec3 palette(int i) {
  if (i == 0) return uColor1;
  if (i == 1) return uColor2;
  return uColor3;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float beat = mod(uBeatClock, 256.0);
  // no mod() wrap: highp keeps sin/cos accurate for hours, and a wrap would
  // teleport every shape once every few minutes
  float t = uBassTime * pace + 0.15 * uTime * pace;

  float nSh = floor(clamp(shapes, 2.0, 4.0) + 0.5);
  // orbit direction reverses every 16 beats WITHOUT a position jump: a
  // beat-locked triangle wave (continuous, kink on the downbeat) dominates the
  // slow free-running drift. beat wraps at 256 = 8 periods of 32, so no seam.
  float tri = abs(fract(beat / 32.0) - 0.5) * 2.0;
  float orb = t * 0.12 + tri * 3.2 * (0.4 + 0.6 * pace);
  float grp = floor(beat / 4.0);
  float f = smoothstep(0.75, 1.0, fract(beat / 4.0));
  float k = 0.05 + 0.25 * uBassHit + 0.08 * uBass;

  float d = 1e3;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    if (fi >= nSh) break;
    float ang = fi * 1.5707963;
    vec2 c = (0.32 + 0.12 * uBass) * vec2(cos(orb + ang), sin(orb * 1.325 + ang) * 0.8);
    float r = (0.16 + 0.05 * sin(fi * 2.3 + t * 0.7)) * (1.0 + 0.25 * uBass);
    float sgn = (mod(fi, 2.0) > 0.5) ? -1.0 : 1.0;
    vec2 q = rot(t * 0.3 * sgn + fi) * (p - c);
    float stp = grp + fi;
    int idA = int(mod(stp, 4.0));
    int idB = int(mod(stp + 1.0, 4.0));
    float di = mix(shapeSdf(idA, q, r), shapeSdf(idB, q, r), f);
    d = (i == 0) ? di : smin(d, di, k);
  }

  // contours
  float dens = density * (1.0 + 0.04 * uHigh * sin(uTime * 30.0));
  float rr = (d - 0.6 * (1.0 - uBassHit)) * 10.0;
  float ring = exp(-rr * rr) * uBassHit;
  float ph = t * 0.8 + ring * 0.5;
  float v = d * dens - ph;

  // derivatives in uniform control flow
  float wpx = clamp(fwidth(v), 1e-4, 0.5);
  float wd = max(fwidth(d), 1e-5);

  float fv = abs(fract(v + 0.5) - 0.5); // 0 on the line (integers of v)
  float idx = floor(v + 0.5);
  float major = (mod(idx, 5.0) < 0.5) ? 1.0 : 0.0;

  float lw = (0.9 + 1.2 * uLineBoost + 1.5 * uBassHit) * wpx;
  float hw = 0.5 * lw * mix(1.0, 1.8, major);
  float line = 1.0 - smoothstep(hw, hw + wpx, fv);
  // when lines get denser than ~2px apart, fade to an average instead of aliasing
  line *= 1.0 - smoothstep(0.25, 0.5, wpx);

  // colour, rotated every 16 beats with a one-beat cross-fade
  // own 768-beat wrap (48 cycles, multiple of 3) so the 256 wrap of 'beat'
  // never cross-fades from the wrong colour
  float cb = mod(uBeatClock, 768.0);
  float cyc = floor(cb / 16.0);
  float into = fract(cb / 16.0) * 16.0;
  vec3 cPrev = palette(int(mod(cyc + 2.0, 3.0)));
  vec3 cCur = palette(int(mod(cyc, 3.0)));
  vec3 lineCol = mix(cPrev, cCur, smoothstep(0.0, 1.0, into));
  vec3 lc = mix(lineCol, vec3(1.0), 0.35 * major);

  float fade = exp(-max(d, 0.0) * 1.8);
  float inside = d < 0.0 ? 0.35 : 1.0;
  float bright = (0.8 + 0.5 * uBeat) * (1.0 + 0.6 * major);

  vec3 col = lc * line * fade * inside * bright;
  col += uColor2 * 0.06 * (1.0 - step(0.0, d));

  // white-hot zero contour
  float edge = 1.0 - smoothstep(0.0, wd * 2.0, abs(d));
  col += vec3(1.0) * edge * (0.8 + 0.8 * uHigh + 0.6 * uHighHit);

  // shockwave band
  col += ring * mix(lineCol, vec3(1.0), 0.6) * 0.6;

  // faint glow around the shapes
  col += lineCol * (0.035 + 0.06 * uEnergy) * exp(-abs(d) * 6.0);

  col *= 1.0 / (1.0 + 0.3 * dot(p, p));
  col = 1.0 - exp(-col * 1.5);
  gl_FragColor = vec4(col, 1.0);
}

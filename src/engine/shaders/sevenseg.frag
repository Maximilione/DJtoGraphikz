precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uHighHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float digits;
uniform float ghost;
uniform float jitter;

// A seven-segment counter of the bars played, sized to the wall. Segments are
// the mitred hexagons of a real display, lit ones bloom warm, unlit ones stay
// as a ghost so it reads as hardware. The dot blinks the beat; the hats nudge
// the whole display sideways and it glides back.

float bit(float m, float i) { return mod(floor(m / exp2(i)), 2.0); }

float mask(float d) {
  // gfedcba
  if (d < 0.5) return 63.0;
  if (d < 1.5) return 6.0;
  if (d < 2.5) return 91.0;
  if (d < 3.5) return 79.0;
  if (d < 4.5) return 102.0;
  if (d < 5.5) return 109.0;
  if (d < 6.5) return 125.0;
  if (d < 7.5) return 7.0;
  if (d < 8.5) return 127.0;
  return 111.0;
}

// one segment: a bar of half-length len and half-thickness th with 45° ends
float sdSeg(vec2 p, float len, float th) {
  p = abs(p);
  return max(p.y - th, (p.x + p.y - len - th) * 0.7071);
}

// the bloom around it comes off a true box distance: the mitre's max() is
// no distance in the corners and would throw rays out of every tip
float sdGlow(vec2 p, float len, float th) {
  vec2 q = abs(p) - vec2(len + th * 0.5, th);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// p in digit space: x -0.5..0.5, y -1..1. Returns (lit, ghost, glow) coverage.
vec3 digit(vec2 p, float d, float aa) {
  float m = mask(d);
  float th = 0.085;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    vec2 q; float len;
    if (i == 0)      { q = p - vec2(0.0, 0.9);          len = 0.315; }   // a
    else if (i == 1) { q = (p - vec2(0.42, 0.45)).yx;   len = 0.345; }   // b
    else if (i == 2) { q = (p - vec2(0.42, -0.45)).yx;  len = 0.345; }   // c
    else if (i == 3) { q = p - vec2(0.0, -0.9);         len = 0.315; }   // d
    else if (i == 4) { q = (p - vec2(-0.42, -0.45)).yx; len = 0.345; }   // e
    else if (i == 5) { q = (p - vec2(-0.42, 0.45)).yx;  len = 0.345; }   // f
    else             { q = p;                           len = 0.315; }   // g
    float sd = sdSeg(q, len, th);
    float cov = 1.0 - smoothstep(-aa, aa, sd);
    if (bit(m, float(i)) > 0.5) {
      acc.x += cov;
      acc.z += exp(-max(sdGlow(q, len, th), 0.0) * 7.0);
    } else {
      acc.y += cov;
    }
  }
  return acc;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float nd = clamp(floor(digits), 1.0, 4.0);
  float count = floor(uBeatClock / 4.0);

  // fit: digits are 1 wide and 2 tall on a 1.25 pitch, a dot after the last,
  // 0.2 of slant; fill 90 % of the width or 78 % of the height, whichever binds
  float pitch = 1.25;
  float W = nd * pitch + 0.3;
  float s = min(aspect * 0.9 / W, 0.39);
  s *= 1.0 + 0.03 * uBassHit;
  vec2 q = p / s;
  // the hat knock: the display slides as one and eases back as the hit decays
  float side = mod(count, 2.0) * 2.0 - 1.0;
  q.x -= uHighHit * jitter * 0.3 * side;
  float x0 = -W * 0.5 + 0.1;
  float aa = 1.5 / (uResolution.y * s);

  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    if (float(j) >= nd) break;
    vec2 dp = q - vec2(x0 + 0.5 + float(j) * pitch, 0.0);
    dp.x -= dp.y * 0.1;   // italic
    float place = nd - 1.0 - float(j);
    float d = mod(floor(count / pow(10.0, place)), 10.0);
    acc += digit(dp, d, aa);
  }

  // the beat dot, bottom right, on for the first half of the beat
  vec2 dotc = vec2(x0 + (nd - 1.0) * pitch + 0.5 + 0.22 - 0.088, -0.88);
  float sdDot = length(q - dotc) - 0.11;
  float dotCov = 1.0 - smoothstep(-aa, aa, sdDot);
  float blink = (1.0 - smoothstep(0.4, 0.5, uBeatPhase)) * (0.7 + 0.5 * pow(1.0 - uBeatPhase, 3.0));

  vec3 hot = mix(uColor1, vec3(1.0), 0.3);
  vec3 warm = mix(uColor1, vec3(1.0, 0.75, 0.45), 0.35);
  float lit = min(acc.x, 1.0);
  vec3 col = hot * lit * (0.9 + 0.3 * uBeat);
  col += uColor1 * min(acc.y, 1.0) * ghost;
  col += warm * acc.z * 0.28 * (0.8 + 0.4 * uBass);
  col += hot * dotCov * blink;
  col += warm * exp(-max(sdDot, 0.0) * 7.0) * 0.28 * blink;
  col += vec3(1.0) * lit * uBassHit * 0.2;
  gl_FragColor = vec4(col, 1.0);
}

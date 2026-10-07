precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;

varying vec2 vUv;

uniform float size;
uniform float thickness;
uniform float spin;

// Two wireframe cubes, one inside the other, turning against each other in
// the dark. Nothing is filled: the raymarch only accumulates how close each
// ray passes to an edge, so the edges glow and the rest stays black.

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdBoxFrame(vec3 p, vec3 b, float e) {
  p = abs(p) - b;
  vec3 q = abs(p + e) - e;
  return min(min(
    length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
    length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
    length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}

vec2 map(vec3 p) {
  // breathes slowly in silence, swells with the bass, snaps on the kick
  float s = size * (1.0 + 0.04 * sin(uTime * 0.8) + 0.12 * uBass + 0.12 * uBassHit);
  // bar half-thickness: widened, floored at ~lminPx pixels (world units per pixel at the cube's depth)
  float pxW = 2.25 / (min(uResolution.x / uResolution.y, 1.0) * uResolution.y);
  float e = max(0.012 * thickness * (1.0 + 2.5 * uLineBoost) * (1.0 + 0.7 * uBassHit), 0.5 * (3.0 + 4.0 * uLineBoost) * pxW);
  // every rotation rate below is a multiple of 1/20 turn, so wrapping on
  // 20 turns is seamless and keeps the angle small after hours
  float t = mod(uBeatClock * 0.25 * spin + uTime * 0.2, 125.6637);
  // the mids twist the structure along its height (positional, never jumps)
  float tw = (0.5 * uMid + 0.15 * sin(uTime * 0.4)) * p.y;
  p.xz = rot(tw) * p.xz;
  vec3 a = p;
  a.xz = rot(t) * a.xz;
  a.xy = rot(t * 0.7) * a.xy;
  float outer = sdBoxFrame(a, vec3(s), e);
  vec3 b = p;
  b.xy = rot(-t * 1.3) * b.xy;
  b.yz = rot(t * 0.9) * b.yz;
  float inner = sdBoxFrame(b, vec3(s * (0.55 - 0.1 * uBassHit)), e * 0.8);
  return vec2(outer, inner);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) / min(aspect, 1.0);
  // the camera pushes in on every kick
  vec3 ro = vec3(0.0, 0.0, -3.6 + 0.7 * uBassHit + 0.15 * uBeat);
  vec3 rd = normalize(vec3(p, 1.6));

  float t = 0.0;
  float gOuter = 0.0, gInner = 0.0;
  // sharp edge glow plus a wide soft haze: the haze is the idle floor that
  // keeps the cubes readable in silence, and it steps back as the music comes in
  float fall = 38.0 / (1.0 + uLineBoost);   // wider halo with the boost
  float haze = 0.012 * (1.0 - 0.7 * uEnergy);
  for (int i = 0; i < 64; i++) {
    vec3 pos = ro + rd * t;
    vec2 d = map(pos);
    float m = min(d.x, d.y);
    // weighted by the step so the glow is an integral along the ray, not a
    // count of how many tiny steps a grazing ray happened to take
    float dt = max(m * 0.7, 0.012);
    gOuter += (exp(-d.x * fall) * 2.5 + exp(-d.x * 9.0) * haze * 14.0) * dt;
    gInner += (exp(-d.y * fall) * 2.5 + exp(-d.y * 9.0) * haze * 14.0) * dt;
    if (m < 0.001) {
      // on the bar itself: a solid core under the halo
      gOuter += step(d.x, 0.001) * 0.3;
      gInner += step(d.y, 0.001) * 0.3;
      break;
    }
    if (t > 8.0) break;
    t += dt;
  }
  vec3 col = uColor1 * gOuter + uColor2 * gInner;
  // the hit whitens the edges
  col += vec3(1.0) * (gOuter + gInner) * uBassHit * 0.5;
  col *= 1.0 + 0.3 * uBeat;
  // highs make the edges glitter
  col *= 1.0 + 1.6 * uHigh * (hash21(gl_FragCoord.xy + fract(uTime) * 57.0) - 0.35);
  // faint ambient so the cage never sits on pure black
  col += uColor3 * 0.04 * (1.0 - length(p) * 0.6);
  // soft shoulder, no flat white
  col = 1.0 - exp(-col * 1.3);
  gl_FragColor = vec4(col, 1.0);
}

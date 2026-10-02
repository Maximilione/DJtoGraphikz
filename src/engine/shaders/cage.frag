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

varying vec2 vUv;

uniform float size;
uniform float thickness;
uniform float spin;

// Two wireframe cubes, one inside the other, turning against each other in
// the dark. Nothing is filled: the raymarch only accumulates how close each
// ray passes to an edge, so the edges glow and the rest stays black.

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
  float s = size * (1.0 + 0.15 * uBass);
  float e = 0.012 * thickness;
  float t = uBeatClock * 0.25 * spin + uTime * 0.2;
  vec3 a = p;
  a.xz = rot(t) * a.xz;
  a.xy = rot(t * 0.7) * a.xy;
  float outer = sdBoxFrame(a, vec3(s), e);
  vec3 b = p;
  b.xy = rot(-t * 1.3) * b.xy;
  b.yz = rot(t * 0.9) * b.yz;
  float inner = sdBoxFrame(b, vec3(s * 0.55), e * 0.8);
  return vec2(outer, inner);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  vec3 ro = vec3(0.0, 0.0, -3.6);
  vec3 rd = normalize(vec3(p, 1.6));

  float t = 0.0;
  float gOuter = 0.0, gInner = 0.0;
  // sharp edge glow plus a wide soft haze: the haze is the idle floor that
  // keeps the cubes readable in silence, and it steps back as the music comes in
  float haze = 0.012 * (1.0 - 0.7 * uEnergy);
  for (int i = 0; i < 72; i++) {
    vec3 pos = ro + rd * t;
    vec2 d = map(pos);
    float m = min(d.x, d.y);
    gOuter += exp(-d.x * 38.0) * 0.06 + exp(-d.x * 9.0) * haze;
    gInner += exp(-d.y * 38.0) * 0.06 + exp(-d.y * 9.0) * haze;
    if (m < 0.001 || t > 8.0) break;
    t += max(m * 0.8, 0.01);
  }
  vec3 col = uColor1 * gOuter + uColor2 * gInner;
  // the hit whitens the edges
  col += vec3(1.0) * (gOuter + gInner) * uBassHit * 0.5;
  col *= 1.0 + 0.3 * uBeat;
  gl_FragColor = vec4(col, 1.0);
}

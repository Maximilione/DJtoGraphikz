precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float shards;
uniform float burst;
uniform float edgeglow;

// Shattered glass: voronoi shards, each catching light on its own; the kick
// blows the shards apart from the center and they settle back.
vec2 voro(vec2 p, out vec2 cellId, out float edgeD) {
  vec2 n = floor(p), f = fract(p);
  float md = 8.0; vec2 mo, mc;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash(n + g), hash(n + g + 19.1));
    o = 0.5 + 0.4 * sin(uTime * 0.35 + o * TAU);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mo = r; mc = n + g; }
  }
  // second pass: distance to the nearest edge
  edgeD = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash(n + g), hash(n + g + 19.1));
    o = 0.5 + 0.4 * sin(uTime * 0.35 + o * TAU);
    vec2 r = g + o - f;
    if (dot(mo - r, mo - r) > 1e-5) {
      edgeD = min(edgeD, dot(0.5 * (mo + r), normalize(r - mo)));
    }
  }
  cellId = mc;
  return mo;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // kick blast: shards displace radially, amount decays with uBassHit
  float blast = uBassHit * burst * 0.16;
  vec2 dir = normalize(uv + 1e-4);

  vec2 cellId; float edgeD;
  vec2 p = (uv - dir * blast) * shards * 0.45;
  voro(p, cellId, edgeD);

  float h = hash(cellId);
  float h2 = hash(cellId + 3.3);

  // each shard tints and glints on its own clock; kick relights them
  float glint = 0.5 + 0.5 * sin(t * (0.4 + h * 1.2) + h * TAU + uBass * 2.0);
  vec3 base = mix(uColor1, uColor2, h);
  base = mix(base, uColor3, h2 * 0.5);
  vec3 color = base * (0.14 + glint * 0.25 + uBassHit * h * 0.9);

  // cracks: bright edges
  float crack = smoothstep(0.05, 0.0, edgeD);
  color += mix(uColor3, vec3(1.0), 0.3) * crack * (0.35 + edgeglow * 0.6 + uHighHit * 0.8);

  // vignette to keep the frame
  color *= smoothstep(1.3, 0.5, length(uv));
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

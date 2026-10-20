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
uniform float spreadv;
uniform float heightk;
uniform float sheen;

// Liquid surface: the kick drops a stone in the center, hats rain at the
// edges — expanding rings interfere like real water, lit from above.
// birth is a floor of `now`, so age >= 0 always (and the smoothstep is 0 at
// age <= 0 anyway); the two decays share one exp
float ripple(vec2 uv, vec2 c, float birth, float now, float speed) {
  float age = now - birth;
  float r = length(uv - c);
  return sin((r - age * speed) * 30.0) * exp(-r * 2.2 - age * 1.4) * smoothstep(0.0, 0.08, age);
}

void main() {
  // short side: rings keep their size on a portrait output instead of being
  // cropped to a slice of one ring
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y);
  float t = uTime;
  float speed = spreadv * 0.4;

  // height field: kick ripples from center-ish points (last 4 kicks emulated
  // via the gated bass clock), hat ripples at random spots
  float hgt = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float birth = floor(uBassTime * 1.5 - fi) / 1.5;
    vec2 c = (vec2(hash(vec2(birth, 1.0)), hash(vec2(birth, 7.0))) - 0.5) * 0.7;
    hgt += ripple(uv, c, birth / 1.0, uBassTime, speed) * (1.0 + uBass);
  }
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float birth = floor(uHighTime * 3.0 - fi) / 3.0;
    vec2 c = (vec2(hash(vec2(birth, 13.0)), hash(vec2(birth, 29.0))) - 0.5) * vec2(1.6, 1.0);
    hgt += ripple(uv, c, birth, uHighTime, speed * 1.6) * 0.4;
  }
  hgt *= heightk;

  // ambient swell so still water still breathes
  hgt += sin(uv.x * 3.0 + t * 0.7) * sin(uv.y * 2.5 - t * 0.5) * 0.05 * (0.3 + uEnergy);

  // screen-space normal from the height field
  vec2 grad = vec2(dFdx(hgt), dFdy(hgt)) * uResolution.y;
  vec3 nrm = normalize(vec3(-grad * 0.6, 1.0));

  // lighting: deep base, wavelength tint by height, specular sheen
  // normalize(vec3(0.4, 0.6, 0.8)); the specular only needs reflect(-L, n).z
  // = 2 (n.L) n.z - L.z, raised to 24 by squaring
  const vec3 L = vec3(0.37139068, 0.55708601, 0.74278135);
  float nl = dot(nrm, L);
  float diff = max(nl, 0.0);
  float rz = max(2.0 * nl * nrm.z - L.z, 0.0);
  float r2 = rz * rz, r4 = r2 * r2, r8 = r4 * r4;
  float spec = r8 * r8 * r8;

  vec3 deep = uColor3 * 0.2;
  vec3 color = mix(deep, uColor1, clamp(hgt * 2.0 + 0.35, 0.0, 1.0));
  color = mix(color, uColor2, clamp(-hgt * 2.5, 0.0, 1.0) * 0.8);
  color *= 0.5 + diff * 0.7;
  // the kick flashes the sheen: the rings alone read nearly the same in a
  // quiet room and on a loud track
  color += vec3(1.0) * spec * sheen * (0.7 + uBeat * 0.5);

  // vignette in frame space, bounded on any aspect (a 6:1 strip was black
  // past |uv.x| > 1.5)
  color *= smoothstep(1.5, 0.6, length((vUv - 0.5) * vec2(1.78, 1.0)));
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

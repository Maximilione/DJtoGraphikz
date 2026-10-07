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

uniform float folds;
uniform float glow;
uniform float drift;

// Space Ghost: a glowing nebula made of a folded fractal (the "kali" fold,
// p -> |p| / p.p - c, then a complex square on two axes), accumulated along
// a short ray with a soft exponential glow so it reads as gas, not as a
// surface. Written from the maths, not from the CC BY-NC-SA versions around
// (this app is neither non-commercial nor share-alike). The palette is ours:
// colour 1 on the dense filaments, colour 2 on the haze, colour 3 on the far
// glow. Bass thickens the gas, the kick lights it.

mat3 orbit(float a, float b) {
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  return mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca) * mat3(1.0, 0.0, 0.0, 0.0, cb, -sb, 0.0, sb, cb);
}

float field(vec3 p, int n, float k) {
  vec3 c = p;
  float res = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    p = abs(p) / dot(p, p) - 0.68;
    p.yz = vec2(p.y * p.y - p.z * p.z, 2.0 * p.y * p.z);
    res += exp(-k * abs(dot(p, c)));
  }
  return res * 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = vec2((uv.x - 0.5) * uResolution.x / uResolution.y, uv.y - 0.5);

  // slow orbit; angles are periodic, so half an hour in is as good as minute one
  float a = mod(uBeatClock * 0.02 * drift + uTime * 0.03 * drift, 6.2831853);
  float b = 0.35 + 0.25 * sin(mod(uBeatClock * 0.013 * drift, 6.2831853));
  // the kick pushes the camera into the gas
  vec3 ro = orbit(a, b) * vec3(0.0, 0.0, 3.2 * (1.0 - 0.1 * uBassHit));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(p.x * rt + p.y * up + fw * 1.3);

  int n = int(clamp(floor(folds), 2.0, 6.0));
  // tighter glow with the parameter, looser on the bass: the gas thickens
  float k = (80.0 - glow) * (1.0 - 0.25 * uBass);
  float t = 1.6;
  float c = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    t += exp(-c * 2.0) * (0.14 + 0.06 * uBass);
    c = field(ro + rd * t, n, k);
    float cc = c * c;
    vec3 layer = uColor1 * cc * 2.6 + uColor2 * cc * c * 1.6 + uColor3 * c * 0.45;
    col = layer * 0.3 + col * 0.95;
  }
  // log compresses the hot cores into glow instead of white; the floor keeps
  // a dim nebula in a silent room
  // 1/(1+k r^2): the linear falloff went negative on wide frames (LED strip, ultrawide)
  float vig = 1.0 / (1.0 + 0.9 * dot(p, p));
  col = log(col * (1.0 + 1.4 * uBassHit + 0.5 * uBeat) + 1.0) * 0.75 * vig;
  col += mix(uColor3, uColor2, 0.4) * (0.035 + 0.05 * exp(-dot(p, p) * 3.0)) * (0.7 + 0.6 * uEnergy);
  gl_FragColor = vec4(col, 1.0);
}

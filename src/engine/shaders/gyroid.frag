precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float cells;
uniform float shell;
uniform float travel;

// Raymarched gyroid: the minimal surface sin(x)cos(y)+sin(y)cos(z)+sin(z)cos(x).
// Shelled to a thin wall it becomes an endless woven lattice the camera flies
// through — different from the box lattice in `raymarch`, which is straight lines.

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec2 path(float z) { return vec2(sin(z * 0.21) * 0.7, cos(z * 0.17) * 0.7); }

float map(vec3 p, float k, float th) {
  vec3 q = p * k;
  float g = dot(sin(q), cos(q.yzx));
  // the bare function is not a distance; scaling by 1/k keeps the march stable
  float shell = (abs(g) - th) / (k * 1.7);
  // Carve a tube along the camera path. The gyroid fills all of space, so a
  // free-flying camera spends most of its time INSIDE the wall and the frame
  // washes out to one flat colour — the same trap the lattice effect had.
  float tube = 0.34 - length(p.xy - path(p.z));
  return max(shell, tube);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  vec2 uv = (uvp - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) * 2.0;

  float k = 1.0 + cells * 1.6;
  // The gyroid function spans about ±1.5, so a thick shell leaves the camera
  // permanently INSIDE the solid and the frame washes out. Thin wall only.
  float th = 0.04 + shell * 0.30 + uBass * 0.12;

  float z = uTime * (0.35 + travel * 0.9) + uBassTime * 0.6;
  vec3 ro = vec3(path(z), z);
  vec3 rd = normalize(vec3(uv, 1.5));
  rd.xy *= rot(sin(uTime * 0.13) * 0.5);

  float t = 0.0, d = 0.0, glow = 0.0;
  for (int i = 0; i < 72; i++) {
    vec3 p = ro + rd * t;
    d = map(p, k, th);
    glow += 0.006 / (0.12 + abs(d));
    if (d < 0.002 || t > 14.0) break;
    t += max(d * 0.75, 0.01);
  }

  vec3 c = vec3(0.0);
  if (t <= 14.0) {
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.004, 0.0);
    vec3 nrm = normalize(vec3(
      map(p + e.xyy, k, th) - map(p - e.xyy, k, th),
      map(p + e.yxy, k, th) - map(p - e.yxy, k, th),
      map(p + e.yyx, k, th) - map(p - e.yyx, k, th)));
    vec3 l = normalize(vec3(0.5, 0.8, -0.4));
    float dif = max(0.0, dot(nrm, l));
    float fres = pow(1.0 - max(0.0, dot(nrm, -rd)), 3.0);
    float fog = exp(-t * 0.22);
    c = mix(uColor1, uColor2, dif) * (0.18 + 0.9 * dif) * fog;
    c += uColor3 * fres * (0.5 + 1.2 * uHigh) * fog;
  }
  c += mix(uColor2, uColor3, 0.5) * glow * (0.04 + 0.08 * uEnergy + 0.10 * uBeat);

  gl_FragColor = vec4(c, 1.0);
}

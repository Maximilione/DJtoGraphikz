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
uniform float repscale;
uniform float glowk;
uniform float camfov;

// Endless structure: raymarched lattice of rounded boxes repeated in space,
// camera flying forward, kick punches the FOV, bar rolls the camera.
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
  float rep = 2.2 / max(repscale, 0.3);
  vec3 q = mod(p, rep) - rep * 0.5;
  float s = 0.28 + uBass * 0.10;
  float box = sdBox(q, vec3(s)) - 0.04;
  // carve a cross so it reads as a lattice, not solid walls
  float cross1 = sdBox(q, vec3(rep, s * 0.42, s * 0.42));
  float cross2 = sdBox(q, vec3(s * 0.42, rep, s * 0.42));
  return max(box, -min(cross1, cross2));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  vec3 ro = vec3(0.35 * sin(t * 0.22), 0.3 * cos(t * 0.17), t * (0.9 + uBass * 0.6) + uBassTime * 0.3);
  float fov = camfov * (1.0 - uBassHit * 0.18);
  vec3 rd = normalize(vec3(uv * rot(uBarPhase * TAU * 0.12 + t * 0.05), fov));

  float dist = 0.0;
  float glow = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 44; i++) {
    vec3 p = ro + rd * dist;
    float d = map(p);
    glow += 0.02 / (abs(d) + 0.08);
    if (d < 0.002) { hit = dist; break; }
    dist += d * 0.85;
    if (dist > 14.0) break;
  }

  vec3 color = vec3(0.0);
  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec2 e = vec2(0.004, 0.0);
    vec3 nrm = normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                              map(p + e.yxy) - map(p - e.yxy),
                              map(p + e.yyx) - map(p - e.yyx)));
    float diff = max(dot(nrm, normalize(vec3(0.5, 0.8, -0.4))), 0.0);
    float fog = exp(-hit * 0.22);
    float cellH = hash(floor((p.zz + 0.0) / (2.2 / max(repscale, 0.3))));
    vec3 base = mix(uColor1, uColor2, cellH);
    color = base * (0.15 + diff * 0.85) * fog;
    // emissive edges: where the normal turns, light leaks
    float edge = pow(1.0 - abs(dot(nrm, -rd)), 2.0);
    color += uColor3 * edge * fog * (0.5 + uHigh);
  }
  color += mix(uColor2, uColor3, uBarPhase) * glow * 0.05 * glowk * (0.6 + uEnergy);

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

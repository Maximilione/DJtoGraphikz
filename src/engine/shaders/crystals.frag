precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float facets;
uniform float dispersion;
uniform float size;

// Crystal tunnel: the camera flies down the axis of a ring of faceted
// crystals (stretched octahedra, one per sector and slice, each with its own
// size). Raymarched once, 56 steps; at the hit the ray is refracted three
// times with a slightly different index of refraction, once per palette
// colour, and each refracted direction reads a bright studio of light bands.
// Because the three directions diverge, the bands split into the three palette
// colours along every facet: dispersion, without three marches. The facet
// edges catch a bright line, the kick swells the crystals, the bass
// brightens the far light. Per-slice variety is hashed on the slice number
// modulo 64, so the travel clock wraps without a pop.

const float TAU = 6.2831853;
const float PZ = 2.4;
const float SLICES = 64.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float gT;
float gKick;
float gN;

float map(vec3 p) {
  float zc = floor(p.z / PZ + 0.5);
  float zl = p.z - zc * PZ;
  float sec = TAU / gN;
  float ang = atan(p.y, p.x);
  float si = floor(ang / sec + 0.5);
  float a = ang - si * sec;
  float rad = length(p.xy);
  float h = hash(vec2(mod(si + gN, gN), mod(zc, SLICES)));
  float s = min(size * (0.34 + 0.34 * h) * (1.0 + 0.4 * gKick * h), 0.74);
  float R = 1.95 + 0.3 * h;
  vec3 q = vec3((rad * cos(a) - R) * 0.55, rad * sin(a), zl);
  // tilt every crystal differently around the radial axis
  float tw = h * TAU;
  float c = cos(tw), sn = sin(tw);
  q.yz = vec2(q.y * c - q.z * sn, q.y * sn + q.z * c);
  return (abs(q.x) + abs(q.y) + abs(q.z) - s) * 0.577 * 0.55 * 0.8;
}

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.002;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// scalar studio: bands of light, a lamp at the end of the tunnel, a key light
float studio(vec3 r) {
  float s = 0.5 + 0.5 * sin(dot(r, vec3(2.3, 1.7, 3.1)) * 3.2 + gT * 0.4);
  s = pow(smoothstep(0.35, 1.0, s), 2.0);
  s += 0.9 * pow(max(r.z, 0.0), 8.0) * (0.7 + 0.8 * gKick + 0.5 * uBass);
  s += 1.8 * pow(max(dot(r, normalize(vec3(0.6, 0.7, 0.3))), 0.0), 28.0);
  return s;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gT = uBassTime * 0.5 + uTime * 0.25;
  gN = floor(clamp(facets, 5.0, 12.0) + 0.5);

  float T = mod(uBassTime * 1.5 + uTime * 0.9, PZ * SLICES);
  vec3 ro = vec3(0.3 * sin(gT * 0.7), 0.3 * cos(gT * 0.5), T);
  vec3 rd = normalize(vec3(uv, 1.25 - 0.2 * gKick));
  float roll = gT * 0.12 + 0.25 * sin(mod(uBeatClock * 0.1, TAU));
  float cr = cos(roll), sr = sin(roll);
  rd.xy = vec2(rd.x * cr - rd.y * sr, rd.x * sr + rd.y * cr);

  // empty space between the crystals: dark palette haze, spokes of light
  // radiating from the vanishing point, and the lamp at the end
  float rr = length(uv);
  float spokes = pow(abs(sin(atan(uv.y, uv.x) * gN * 0.5 + gT * 0.3)), 24.0);
  vec3 col = uColor2 * 0.05 * (1.0 + rr)
           + uColor1 * spokes * exp(-rr * 2.4) * (0.12 + 0.25 * uBass)
           + uColor3 * exp(-rr * 7.0) * (0.35 + 0.5 * gKick);

  float t = hash(gl_FragCoord.xy) * 0.05;
  bool hit = false;
  for (int i = 0; i < 56; i++) {
    float d = map(ro + rd * t);
    if (d < 0.003) { hit = true; break; }
    t += d;
    if (t > 40.0) break;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    // three indices of refraction, one per palette colour
    float disp = 0.07 * dispersion;
    vec3 rA = refract(rd, n, 1.0 / (1.42 - disp));
    vec3 rB = refract(rd, n, 1.0 / 1.45);
    vec3 rC = refract(rd, n, 1.0 / (1.48 + disp));
    // total internal reflection gives a zero vector: fall back to the mirror
    vec3 mir = reflect(rd, n);
    if (dot(rA, rA) < 0.5) rA = mir;
    if (dot(rB, rB) < 0.5) rB = mir;
    if (dot(rC, rC) < 0.5) rC = mir;
    vec3 trans = uColor1 * studio(rA) + uColor2 * studio(rB) + uColor3 * studio(rC);

    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 refl = mix(uColor3, vec3(1.0), 0.35) * studio(mir) * fres;

    // facet edges: the normal turns quickly across a small step
    vec3 tg = normalize(cross(n, vec3(0.3, 1.0, 0.2)));
    float edge = 1.0 - smoothstep(0.9, 0.995, dot(n, normalAt(p + tg * 0.035)));

    vec3 surf = trans * 0.85 + refl * 1.3
              + uColor3 * edge * (0.7 + 0.8 * uHigh + 0.6 * gKick);
    float fogK = exp(-t * 0.055);
    col = mix(col, surf, fogK);
  }

  col = col / (1.0 + 0.5 * col) + uColor1 * 0.012;
  col *= clamp(1.2 - dot(uv, uv) * 0.7, 0.45, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

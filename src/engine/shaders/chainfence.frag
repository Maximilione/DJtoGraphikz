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

uniform float rotSpeed;
uniform float beamIntensity;
uniform float haze;

// Chainfence: a cyclone-fence tube wrapped around the camera's own axis, the
// diamond wire mesh turning slowly against it (a warehouse rave backdrop).
// The tube is a single analytic cylinder (no raymarch needed for a surface
// that is rotationally symmetric by construction) carrying a procedural
// diamond-lattice distance field for the wire. What IS marched is the empty
// air between the camera and that wall: four torch beams, each a 3D line the
// camera flies past, lit as a volumetric shaft (same point-to-line integral
// warehouse.frag uses for its lamp shafts) and dust in them. One beam is
// always on at low intensity (silence is never black); the kick brightens
// all of them and fires a fifth, freshly-aimed beam that only exists on the
// hit, dying with uBassHit the instant it decays.

const float TAU = 6.2831853;
const float R = 2.1;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// distance field to a diamond (chain-link) lattice tiling the uv plane
float cellWire(vec2 uv) {
  vec2 g = fract(uv) - 0.5;
  return abs(abs(g.x) + abs(g.y) - 0.5);
}

// shortest distance from p to the infinite line through a, direction d (unit)
float lineDist2(vec3 p, vec3 a, vec3 d) {
  vec3 q = p - a;
  vec3 perp = q - d * dot(q, d);
  return dot(perp, perp);
}

// one torch beam's 3D axis: slowly swinging line crossing the tube, picked by index
void beamAxis(float i, float extra, out vec3 a, out vec3 d) {
  float ph = hash21(vec2(i, 1.7)) * TAU;
  float sp = 0.12 + 0.1 * hash21(vec2(i, 4.2));
  float ang = ph + uTime * sp + extra;
  float tilt = 0.5 * sin(uTime * 0.17 + ph) + extra * 1.3;
  a = vec3(cos(ang) * R, sin(ang) * R, hash21(vec2(i, 8.8)) * 40.0);
  d = normalize(vec3(-cos(ang) * 0.6 + tilt, -sin(ang) * 0.6 + tilt * 0.7, 0.5));
}

// Beam axes, weights and colours depend only on uniforms: built once per pixel
// in main() (was 27x per pixel inside the march).
vec3 gA[5];
vec3 gD[5];
float gW[5];
float gK[5];
vec3 gC[5];

void setupBeams(float kick) {
  vec3 c1 = mix(uColor1, vec3(1.0), 0.35);
  vec3 c2 = mix(uColor2, vec3(1.0), 0.35);
  for (int i = 0; i < 4; i++) {
    beamAxis(float(i), 0.0, gA[i], gD[i]);
    float base = (i == 0) ? 0.35 : 0.2; // beam 0: the one that never turns off
    float react = 0.5 * uMid + 0.4 * uHigh * hash21(vec2(float(i), floor(uTime * 3.0)));
    gW[i] = (base + react) * (1.0 + 1.6 * kick);
    gK[i] = 10.0;
    gC[i] = (i == 1 || i == 3) ? c2 : c1;
  }
  // the fifth beam: a fresh, randomly aimed shaft that exists only on the hit
  float bucket = floor(uBeatClock);
  beamAxis(4.0 + mod(bucket, 7.0), hash21(vec2(bucket, 2.3)) * TAU, gA[4], gD[4]);
  gW[4] = kick * 2.2;
  gK[4] = 12.0;
  gC[4] = mix(uColor3, vec3(1.0), 0.6);
}

// coloured beam density at a point (used on the wall)
vec3 beamsAt(vec3 p) {
  vec3 d = vec3(0.0);
  for (int i = 0; i < 5; i++) d += gC[i] * exp(-lineDist2(p, gA[i], gD[i]) * gK[i]) * gW[i];
  return d;
}

float erfApprox(float x) {
  float x2 = x * x;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732 + 0.14 * x2) / (1.0 + 0.14 * x2)));
}

// exact integral of every beam's gaussian density along the ray over [0.1, tEnd]
// (replaces a 26-step march that beaded beams crossing the tube axis)
vec3 beamsAlongRay(vec3 ro, vec3 rd, float tEnd) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 q = ro - gA[i];
    float rdd = dot(rd, gD[i]);
    float qd = dot(q, gD[i]);
    float A = max(1.0 - rdd * rdd, 1e-3);
    float B = dot(q, rd) - qd * rdd;
    float C = dot(q, q) - qd * qd;
    float k = gK[i];
    float s = sqrt(k * A);
    float m = B / A;
    float I = exp(-k * max(C - B * m, 0.0)) * 0.5 * sqrt(3.14159 / (k * A))
            * (erfApprox(s * (tEnd + m)) - erfApprox(s * (0.1 + m)));
    // dust motes: sparkle sampled where the ray passes closest to the beam
    vec3 p = ro + rd * clamp(-m, 0.1, tEnd);
    float dust = 0.8 + 0.4 * sin(p.z * 3.1 + p.x * 5.0 + uTime * 0.6);
    acc += gC[i] * I * gW[i] * dust;
  }
  return acc;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);

  float z0 = mod(uTime * 0.5, 400.0);
  vec3 ro = vec3(0.06 * sin(uTime * 0.21), 0.05 * cos(uTime * 0.17), z0);
  vec3 rd = normalize(vec3(uv, 1.2));

  // ray vs. the cylinder |xy - ro.xy| = R, camera inside: take the forward root
  float a2 = dot(rd.xy, rd.xy);
  float b2 = 2.0 * dot(ro.xy, rd.xy);
  float c2 = dot(ro.xy, ro.xy) - R * R;
  float disc = b2 * b2 - 4.0 * a2 * c2;
  float tWall = 60.0;
  if (disc > 0.0 && a2 > 1e-5) {
    float sq = sqrt(disc);
    float t1 = (-b2 + sq) / (2.0 * a2);
    tWall = (t1 > 0.0) ? t1 : 60.0;
  }
  tWall = min(tWall, 60.0);

  // the open air: beams and their dust, integrated in closed form
  setupBeams(kick);
  float hz = haze * (0.5 + 0.5 * uBass);
  vec3 vol = beamsAlongRay(ro, rd, tWall) * beamIntensity * hz * 0.55;

  vec3 col = vol;
  if (tWall < 59.0) {
    vec3 p = ro + rd * tWall;
    float theta = atan(p.y, p.x) + uTime * rotSpeed * 0.2;
    // integer cell count per turn: no lattice seam at atan = +-pi
    vec2 wuv = vec2(theta * (34.0 / TAU), p.z * 2.6);
    float wd = cellWire(wuv);
    float thickness = 0.05 + 0.015 * uHigh;
    // pixel footprint in lattice units; fade to mean coverage where the mesh is sub-pixel
    float px = 2.6 * tWall / (1.2 * uResolution.y);
    float wire = 1.0 - smoothstep(max(thickness - px, 0.0), thickness + px, wd);
    wire = mix(wire, 2.0 * thickness, smoothstep(0.12, 0.4, px));
    vec3 lit = beamsAt(p) * beamIntensity;
    vec3 metal = mix(vec3(0.03, 0.032, 0.035), uColor2 * 0.06, 0.5);
    vec3 wireCol = mix(uColor1, vec3(1.0), 0.4);
    vec3 surf = metal * wire * 0.3 + wireCol * wire * 0.15 + lit * wire * 1.1;
    // kick ripple travelling down the fence
    float rip = exp(-abs(p.z - ro.z - (1.0 - kick) * 18.0) * 0.9) * kick;
    surf += mix(uColor3, vec3(1.0), 0.4) * wire * rip * 0.9;
    // rim: the fence catches a cold edge even outside any beam, so it never vanishes
    surf += uColor3 * wire * 0.05;
    float fog = exp(-tWall * 0.028);
    col += surf * fog;
  } else {
    col += uColor2 * 0.01;
  }

  // ambient floor so a frame with every beam decayed is still a lit room, not black
  col += mix(uColor1, uColor2, 0.5) * 0.015;
  col = col / (1.0 + 0.6 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.8, 0.45, 1.0);
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither: dark haze bands on 8-bit
  gl_FragColor = vec4(col, 1.0);
}

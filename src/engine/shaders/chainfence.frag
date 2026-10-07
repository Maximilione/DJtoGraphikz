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

// density contributed by all beams at sample p, integrated with the step weight
float beamsAt(vec3 p, float kick) {
  float d = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 a, dir;
    beamAxis(float(i), 0.0, a, dir);
    float base = (i == 0) ? 0.35 : 0.2; // beam 0: the one that never turns off
    float react = 0.5 * uMid + 0.4 * uHigh * hash21(vec2(float(i), floor(uTime * 3.0)));
    float k2 = lineDist2(p, a, dir);
    d += exp(-k2 * 10.0) * (base + react) * (1.0 + 1.6 * kick);
  }
  // the fifth beam: a fresh, randomly aimed shaft that exists only on the hit
  float bucket = floor(uBeatClock);
  vec3 a5, d5;
  beamAxis(4.0 + mod(bucket, 7.0), hash21(vec2(bucket, 2.3)) * TAU, a5, d5);
  d += exp(-lineDist2(p, a5, d5) * 12.0) * kick * 2.2;
  return d;
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

  // march the open air for the beams and their dust
  vec3 vol = vec3(0.0);
  float hz = haze * (0.5 + 0.5 * uBass);
  float t = 0.1;
  int steps = 26;
  float dt = tWall / float(steps);
  for (int i = 0; i < 26; i++) {
    vec3 p = ro + rd * t;
    float bd = beamsAt(p, kick) * beamIntensity;
    vec3 beamCol = mix(uColor1, vec3(1.0), 0.5);
    // dust motes: cheap per-sample sparkle riding the beam density
    float dust = 0.8 + 0.4 * sin(p.z * 3.1 + p.x * 5.0 + uTime * 0.6);
    vol += beamCol * bd * hz * dust * dt * 0.55;
    t += dt;
  }

  vec3 col = vol;
  if (tWall < 59.0) {
    vec3 p = ro + rd * tWall;
    float theta = atan(p.y, p.x) + uTime * rotSpeed * 0.2;
    vec2 wuv = vec2(theta * R * 2.6, p.z * 2.6);
    float wd = cellWire(wuv);
    float thickness = 0.05 + 0.015 * uHigh;
    float wire = smoothstep(thickness, 0.0, wd);
    float lit = beamsAt(p, kick) * beamIntensity;
    vec3 metal = mix(vec3(0.03, 0.032, 0.035), uColor2 * 0.06, 0.5);
    vec3 wireCol = mix(uColor1, vec3(1.0), 0.4);
    vec3 surf = metal * wire * 0.3 + wireCol * wire * (0.15 + 1.1 * lit);
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
  gl_FragColor = vec4(col, 1.0);
}

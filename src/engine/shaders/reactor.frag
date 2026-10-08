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

uniform float speed;
uniform float rings;
uniform float glow;

// Reactor: the camera looks down the shaft of an imaginary reactor core,
// raymarched. Concentric metal rings (tori, radial symmetry) repeat along the
// shaft's depth like stator frames; radial conduits run from a glowing
// central rod to the rim of each frame. A soft, always-on "flow" brightens
// the rings over time so the chamber is never dead in silence. On the kick a
// hot band is born at the camera and races away down the shaft along the
// rings (the shockwave): its position comes directly from the kick impulse's
// own decay (1-uBassHit), so it needs no separate timer, and it fades as the
// impulse fades.

const float TAU = 6.2831853;
const float CELL = 6.0;
const float HUB_R = 0.35;
const float OUT_R = 3.2;
const int SPOKES = 8;

float gKick;
float gRings;
float gShockZ;
float gGlow;

float sdTorusZ(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xy) - R, p.z);
  return length(q) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float cellZ(float z) {
  return z - CELL * floor(z / CELL + 0.5);
}

float ringsField(vec3 p) {
  float zc = cellZ(p.z);
  float d = 1e5;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= gRings) break;
    float R = 0.9 + float(i) * (OUT_R - 0.9) / max(gRings - 1.0, 1.0);
    d = min(d, sdTorusZ(vec3(p.xy, zc), R, 0.07));
  }
  return d;
}

float spokesField(vec3 p) {
  float zc = cellZ(p.z);
  float r = length(p.xy);
  float ang = atan(p.y, p.x);
  float sector = TAU / float(SPOKES);
  float a2 = mod(ang + sector * 0.5, sector) - sector * 0.5;
  float arc = r * a2;
  vec3 bp = vec3(r - (HUB_R + OUT_R) * 0.5, arc, zc);
  return sdBox(bp, vec3((OUT_R - HUB_R) * 0.5, 0.04, 0.05));
}

float hub(vec3 p) {
  // capped just ahead of the camera (z <= 0.5): an infinite rod sitting right
  // where the camera lives would blow up into a huge near-field wedge instead
  // of reading as the tunnel's distant core
  return max(length(p.xy) - HUB_R, p.z - 0.5);
}

float map(vec3 p) {
  return min(hub(p), min(ringsField(p), spokesField(p)));
}

// marches the shaft; gGlow collects fog brightness along the way, boosted
// near the travelling shockwave so the haze itself flashes outward too.
float march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.1;
  for (int i = 0; i < 100; i++) {
    if (t > tmax) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    // the gaussian is negligible past ~3.5 units from the front — skip the
    // transcendentals on the 100-step march for every step that isn't near it
    float dz = p.z - gShockZ;
    float shock = abs(dz) < 3.5 ? exp(-pow(dz / 1.1, 2.0)) : 0.0;
    float st = clamp(d, 0.03, 0.6);
    gGlow += st * 0.05 * (0.4 + 2.2 * shock);
    if (d < 0.003) return t;
    t += d * 0.9;
  }
  return -1.0;
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.004;
  vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                     k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));

  float r = length(p.xy);
  // idle flow: an always-on travelling brightness so the rings read as alive
  // in total silence, not just lit by the kick
  float flow = 0.5 + 0.5 * sin(r * 2.2 - uTime * 0.8 * clamp(speed, 0.2, 3.0) - uBassTime * 0.3);
  vec3 base = mix(uColor2, uColor1, flow) * 0.5;
  vec3 c = base * (0.3 + 0.5 * uEnergy);

  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  c += uColor1 * rim * 0.25;

  float shock = exp(-pow((p.z - gShockZ) / 1.1, 2.0));
  float isHub = step(hub(p), min(ringsField(p), spokesField(p)));
  vec3 shockCol = mix(vec3(1.0), uColor3, 0.25);
  c += shockCol * shock * gKick * clamp(glow, 0.3, 2.0) * 2.6;
  c += shockCol * isHub * (0.4 + shock * gKick * 2.0) * 0.8;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gRings = floor(clamp(rings, 3.0, 8.0) + 0.5);
  // the shock is born at the camera (z=0) on the kick and races away as the
  // kick impulse itself decays — one uniform drives both position and fade
  gShockZ = -(1.0 - gKick) * 14.0;
  gGlow = 0.0;

  // the camera sits on the shaft's axis (the hub is capped behind it, see
  // hub(), so it is never embedded in solid geometry) and looks straight down
  // it with a slow roll, which keeps every off-centre ray diverging away from
  // the thin central rod instead of grazing alongside it
  float camZ = 2.4 + 0.4 * sin(uTime * 0.07);
  vec3 ro = vec3(0.0, 0.0, camZ);
  float drift = 0.15 * sin(uTime * 0.08);
  float cs = cos(drift), sn = sin(drift);
  vec3 rd = normalize(vec3(uv, -1.6));
  rd.xy = mat2(cs, -sn, sn, cs) * rd.xy;

  float t = march(ro, rd, 40.0);
  vec3 col;
  if (t > 0.0) {
    col = shade(ro, rd, t);
    col = mix(uColor2 * 0.04, col, exp(-t * 0.035));
  } else {
    col = uColor2 * 0.03 + uColor1 * 0.015 * (0.5 - uv.y);
  }

  float hz = clamp(glow, 0.3, 2.0) * (0.7 + 0.5 * uBass + 0.6 * gKick);
  vec3 fogC = mix(uColor1, mix(vec3(1.0), uColor3, 0.3), 0.3 + 0.4 * gKick);
  col += fogC * gGlow * 0.03 * hz;
  col += uColor2 * 0.03 * exp(-length(uv) * 2.0);

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.85, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

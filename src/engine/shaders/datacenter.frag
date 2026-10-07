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
uniform float alarm;
uniform float density;

// Datacenter: an infinite corridor of server racks in central perspective,
// raymarched (domain repetition along z, same trick as the pylons in
// monolith.frag / the piers in cathedral.frag), camera dollying forward
// forever via a wrapped z so the float stays small. Low ceiling with cable
// trays and a fluorescent strip running the whole corridor (the baseline
// light: the corridor is never dark in silence). Mirror floor, a second
// march of the reflected ray with fewer steps, dirtied with grime so it
// never reads as glass. Each rack carries a grid of LEDs, white/cold-green
// at rest, blinking by a hash of rack/row/time. On the kick an alarm wave
// sweeps down both rows (the kick's own decay IS the travel clock: the
// wavefront distance grows as uBassHit falls from 1 to 0, same shape as the
// expanding ring in faces.frag) turning every LED red in sequence, paired
// with a fast-flickering beacon glowing in the fog near the ceiling.

const float TAU = 6.2831853;
const float CEIL_Y = 1.25;
const float FLOOR_Y = -1.15;
const float RACK_X = 1.4;
const float RACK_CY = (CEIL_Y + FLOOR_Y) * 0.5;
const float RACK_HH = (CEIL_Y - FLOOR_Y) * 0.46;
const float MAX_WAVE = 34.0;
const vec3 ALARM = vec3(1.0, 0.05, 0.03);

float gKick;
float gPeriod;
float gRoZ;
float gAlarm;
float gBeaconZ;
float gBeaconGlow;
float gFog;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float dCeil(vec3 p) {
  float cp = mod(p.z, gPeriod) - gPeriod * 0.5;
  float slab = CEIL_Y - p.y;
  float conduit = sdBox(vec3(p.x, p.y - (CEIL_Y - 0.20), cp), vec3(2.1, 0.055, 0.09));
  vec3 cq = vec3(abs(p.x) - 0.95, p.y - (CEIL_Y - 0.46), cp);
  float cable = sdBox(cq, vec3(0.045, 0.22, 0.045));
  return min(slab, min(conduit, cable));
}

float dRack(vec3 p) {
  float zc = floor(p.z / gPeriod + 0.5);
  float zl = p.z - zc * gPeriod;
  vec3 q = vec3(abs(p.x) - RACK_X, p.y - RACK_CY, zl);
  return sdBox(q, vec3(0.5, RACK_HH, gPeriod * 0.5 - 0.12));
}

float map(vec3 p) { return min(dCeil(p), dRack(p)); }

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.004;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// LED grid on a rack's inner (aisle-facing) panel: small inset dots (not
// flat colour bands — a panel is mostly dark steel between them), a
// pseudo-random colour and blink rate per rack/row/column, overridden by the
// alarm wave travelling down the corridor from the camera.
vec4 ledPanel(vec3 p) {
  float zc = floor(p.z / gPeriod + 0.5);
  float zl = p.z - zc * gPeriod;
  float side = sign(p.x);
  float rowF = (p.y - RACK_CY + RACK_HH) / (2.0 * RACK_HH) * 14.0;
  float colF = (zl + gPeriod * 0.5 - 0.12) / (gPeriod - 0.24) * 3.0;
  vec2 cellF = vec2(fract(colF), fract(rowF)) - 0.5;
  vec2 seed = vec2(zc * 31.0 + floor(colF) * 7.0 + side * 101.0, floor(rowF) * 17.0);
  float dot = smoothstep(0.24, 0.1, length(cellF));
  float green = step(0.5, hash21(seed + 3.3));
  float rate = mix(2.0, 9.0, hash21(seed + 7.7));
  float bucket = floor(uTime * rate);
  float on = step(0.4, hash21(vec2(bucket, seed.x + seed.y * 13.0)));
  vec3 rest = mix(vec3(1.0, 1.0, 0.95), vec3(0.6, 1.0, 0.78), green) * (0.25 + 0.75 * on);

  float dz = zc * gPeriod - gRoZ;
  float front = MAX_WAVE * (1.0 - gKick);
  float w = exp(-pow((dz - front) * 0.35, 2.0)) * sqrt(gKick) * gAlarm;
  vec3 col = mix(rest, ALARM * 2.4, clamp(w * 2.0, 0.0, 1.0));
  return vec4(col, dot);
}

vec3 bgCol(vec3 rd) {
  vec3 tube = mix(vec3(1.0), uColor3, 0.3);
  vec3 c = tube * pow(max(rd.z, 0.0), 44.0) * 0.6;
  c += uColor2 * 0.03 + uColor1 * 0.015;
  return c;
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec3 n = normalAt(p);
  bool isRack = dRack(p) < dCeil(p);
  vec3 surf;
  if (isRack) {
    float side = sign(p.x);
    float faceFront = smoothstep(0.25, 0.7, -n.x * side);
    vec3 steel = mix(vec3(0.05, 0.055, 0.06), uColor2 * 0.08, 0.5);
    float topEdge = smoothstep(0.5, 0.95, n.y);
    surf = steel * (0.5 + 0.5 * max(n.y, 0.0));
    surf += uColor1 * topEdge * 0.12;
    surf += uColor1 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.1;
    vec4 led = ledPanel(p);
    surf += led.rgb * led.a * faceFront * (1.4 + 1.0 * gKick * gAlarm);
  } else {
    // ceiling: dark metal panel, the fluorescent strip (always on, the
    // corridor's baseline light) and the cable conduit as a duller band.
    vec3 metal = mix(vec3(0.04, 0.045, 0.05), uColor2 * 0.05, 0.5);
    float strip = smoothstep(0.14, 0.0, abs(p.y - (CEIL_Y - 0.04)));
    vec3 tube = mix(vec3(1.0), uColor3, 0.25);
    surf = metal * 0.6 + tube * strip * 1.6;
    surf += uColor1 * 0.03;
  }
  // the beacon's wash on anything nearby
  vec3 db = p - vec3(0.0, CEIL_Y - 0.05, gBeaconZ);
  float beaconHit = 1.0 / (1.0 + dot(db, db) * 2.2);
  float flick = 0.5 + 0.5 * sin(uTime * 17.0);
  surf += ALARM * beaconHit * gKick * gAlarm * flick * 1.2;
  return surf;
}

float march(vec3 ro, vec3 rd, float tmax, int maxSteps) {
  float t = 0.05;
  for (int i = 0; i < 70; i++) {
    if (i >= maxSteps || t > tmax) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    float st = clamp(d, 0.03, 0.55);
    vec3 db = p - vec3(0.0, CEIL_Y - 0.05, gBeaconZ);
    gBeaconGlow += st * 0.4 / (0.3 + dot(db, db) * 3.5);
    gFog += st * 0.02;
    if (d < 0.003) return t;
    t += d;
  }
  return -1.0;
}

vec3 scene(vec3 ro, vec3 rd, float tmax, int steps) {
  float t = march(ro, rd, tmax, steps);
  vec3 c = (t > 0.0) ? shade(ro, rd, t) : bgCol(rd);
  return mix(bgCol(rd), c, exp(-max(t, 0.0) * 0.05));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gAlarm = alarm;
  gPeriod = clamp(2.8 / max(density, 0.1), 1.0, 4.5);

  float adv = speed * (1.0 + 0.35 * uBass + 0.25 * uEnergy);
  float z0 = mod(uBassTime * 2.0 * adv + uTime * 0.55 * adv, gPeriod * 48.0);
  gRoZ = z0;
  gBeaconZ = z0 + 2.6;

  vec3 ro = vec3(0.08 * sin(uTime * 0.23), 0.02 * sin(uTime * 0.37), z0);
  vec3 rd = normalize(vec3(uv, 1.35));

  gBeaconGlow = 0.0;
  gFog = 0.0;

  float tf = rd.y < -0.001 ? (FLOOR_Y - ro.y) / rd.y : 1e5;
  float tmax = min(tf, 42.0);
  float t = march(ro, rd, tmax, 70);

  vec3 col;
  if (t > 0.0) {
    col = shade(ro, rd, t);
    col = mix(bgCol(rd), col, exp(-t * 0.05));
  } else if (tf < 42.0) {
    vec3 pf = ro + rd * tf;
    vec3 rr = vec3(rd.x, -rd.y, rd.z);
    float g0 = gBeaconGlow;
    vec3 refl = scene(pf + vec3(0.0, 0.01, 0.0), rr, 42.0, 40);
    gBeaconGlow = g0 + (gBeaconGlow - g0) * 0.6;
    float fres = 0.3 + 0.45 * pow(1.0 - abs(rd.y), 2.0);
    float grime = hash21(floor(pf.xz * 3.1)) * 0.05;
    vec2 gl = abs(fract(pf.xz * 0.6) - 0.5);
    float scratch = smoothstep(0.485, 0.5, max(gl.x, gl.y)) * 0.05;
    col = refl * fres + uColor2 * 0.02 + grime + uColor1 * scratch;
  } else {
    col = bgCol(rd);
  }

  // fog: a faint, always-on haze plus the beacon's glow caught in it
  col += mix(uColor1, uColor3, 0.3) * gFog * 0.025;
  col += ALARM * gBeaconGlow * gKick * gAlarm * (0.5 + 0.5 * sin(uTime * 17.0)) * 0.05;
  col += uColor2 * 0.015;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.85, 0.45, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

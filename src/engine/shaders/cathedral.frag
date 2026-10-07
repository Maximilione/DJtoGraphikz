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

uniform float density;
uniform float rays;
uniform float sway;

// Cathedral of light: a nave of gothic ribs the camera glides down, raymarched
// (60 steps) while a volumetric fog is integrated along the same ray. The
// light comes in through the vault in slanted bands: for every point of the
// fog we follow the light back up to the roof plane and ask whether it
// crossed a window there, so the shafts are real god rays that sweep over
// the stone as the camera moves. The kick floods the nave; bass thickens
// the fog. Everything repeats every 4 units of z, so the clock can wrap.

const float PERIOD = 4.0;
const float TAU = 6.2831853;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float map(vec3 p) {
  float dFloor = p.y;
  float dWall = 5.2 - abs(p.x);
  float zl = mod(p.z + 0.5 * PERIOD, PERIOD) - 0.5 * PERIOD;
  // half ring above y=3.5, plain vertical lines below it: ribs and piers in one
  float r = length(vec2(p.x, max(p.y - 3.5, 0.0))) - 2.7;
  float rib = length(vec2(r, zl)) - 0.2;
  float ridge = length(vec2(p.x, p.y - 6.2)) - 0.14;
  return min(min(dFloor, dWall), min(rib, ridge));
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.02, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}

// how much light reaches p: trace back along the light to the roof plane and
// test the window pattern there. 0..1
float lit(vec3 p, vec3 L, float phase) {
  float s = (7.0 - p.y) / L.y;
  vec3 h = p + L * s;
  float wz = abs(fract(h.z / PERIOD + phase) - 0.5);
  float stripe = smoothstep(0.26, 0.14, wz);
  float wx = smoothstep(4.8, 3.0, abs(h.x));
  return stripe * wx;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);

  float T = mod(uBassTime * 1.1 + uTime * 0.7, 256.0);
  float ph = mod(uBeatClock, 64.0) * (TAU / 64.0);
  vec3 ro = vec3(0.7 * sway * sin(ph), 1.7 + 0.3 * sway * sin(ph * 2.0 + 1.0), T);

  vec3 rd = normalize(vec3(uv.x, uv.y + 0.1, 1.15 - 0.25 * kick));
  float yaw = 0.14 * sway * sin(ph);
  float cy = cos(yaw), sy = sin(yaw);
  rd.xz = vec2(rd.x * cy + rd.z * sy, -rd.x * sy + rd.z * cy);

  // the light slants and swings slowly with the bar
  vec3 L = normalize(vec3(0.45 + 0.2 * sin(ph), -1.0, 0.3));
  float lphase = 0.1 * sin(ph * 0.5);

  float dens = density * (0.8 + 0.5 * uBass);
  float beam = rays * (0.9 + 0.8 * kick + 0.3 * uEnergy);
  vec3 beamCol = mix(uColor3, uColor1, 0.25);

  float t = hash(gl_FragCoord.xy) * 0.2; // dither hides the step bands
  vec3 acc = vec3(0.0);
  bool hit = false;
  for (int i = 0; i < 60; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    float dt = clamp(d * 0.7, 0.1, 0.9);
    float dust = 0.75 + 0.25 * sin(p.z * (TAU / PERIOD) * 3.0 + p.x * 2.0) * sin(p.y * 1.7 + uTime * 0.2);
    float fog = 0.14 * dens * dust * exp(-p.y * 0.1) * exp(-t * 0.02);
    acc += beamCol * lit(p, L, lphase) * fog * dt * beam;
    // ambient haze so the hall reads even where no shaft falls
    acc += uColor1 * 0.012 * dens * dt * exp(-p.y * 0.2);
    if (d < 0.012) { hit = true; break; }
    t += dt;
    if (t > 46.0) break;
  }

  vec3 col = acc;
  vec3 p = ro + rd * t;
  if (hit) {
    vec3 n = normalAt(p);
    float diff = max(dot(n, -L), 0.0);
    float l = lit(p, L, lphase);
    vec3 stone = uColor2 * 0.12 + uColor1 * 0.03;
    float tiles = 0.0;
    if (p.y < 0.05) {
      vec2 g = abs(fract(p.xz * 0.5) - 0.5);
      tiles = smoothstep(0.47, 0.5, max(g.x, g.y));
    }
    vec3 surf = stone * (0.6 + 0.4 * l);
    surf += beamCol * l * (0.35 + 0.65 * diff) * 1.4 * beam;
    surf += uColor2 * tiles * 0.1 * (0.5 + l);
    // slender rim light on the ribs: the kick makes the stone itself glow
    surf += uColor3 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * (0.04 + 0.25 * kick) * (1.0 - float(p.y < 0.05));
    col += surf * exp(-t * 0.045 / max(density, 0.2) * 0.6);
  } else {
    // the far end of the nave: a door of light
    float core = pow(max(rd.z, 0.0), 30.0);
    col += uColor3 * core * (0.5 + 0.6 * kick) * 0.7 + uColor1 * pow(max(rd.z, 0.0), 6.0) * 0.12;
    col += uColor2 * 0.04 * smoothstep(-0.2, 0.8, rd.y);
  }

  // soft shoulder instead of a clip, and a floor so silence is still a cathedral
  col = col / (1.0 + 0.55 * col) + uColor1 * 0.012;
  vec2 q = uv * vec2(0.9, 1.0);
  col *= clamp(1.2 - dot(q, q) * 0.9, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

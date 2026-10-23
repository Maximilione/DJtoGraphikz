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

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

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

// tetrahedron normal: 4 map taps instead of 6, same 0.02 tap radius
vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.0115;
  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) +
                   k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
}

// how much light reaches p: trace back along the light to the roof plane and
// test the window pattern there. 0..1. Lk = L.xz / L.y, so the roof point is
// p.xz + Lk*(7 - p.y) without a division per sample
float lit(vec3 p, vec2 Lk, float phase) {
  vec2 h = p.xz + Lk * (7.0 - p.y);
  float wz = abs(fract(h.y * (1.0 / PERIOD) + phase) - 0.5);
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
  vec2 Lk = L.xz / L.y;   // L.y = -1/len, never 0
  float lphase = 0.1 * sin(ph * 0.5);

  float dens = density * (0.8 + 0.5 * uBass);
  float beam = rays * (0.9 + 0.8 * kick + 0.3 * uEnergy);
  // the shafts are most of the frame: colour by view direction, so the hall
  // fans across the palette (was colour 3 alone; colour 2 only on the stone).
  // Still constant along the ray, which the integration below relies on.
  // ph / TAU: one turn of the loop per 64 beats, seamless at the wrap
  vec3 beamCol = pal3(rd.x * 0.45 + rd.y * 0.2 + ph / TAU);

  float t = hash(gl_FragCoord.xy) * 0.2; // dither hides the step bands
  // the two fog colours are constant along the ray: integrate two scalars
  // (shaft light, ambient haze) and apply the colours once after the loop
  float accB = 0.0, accH = 0.0;
  bool hit = false;
  for (int i = 0; i < 60; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    float dt = clamp(d * 0.7, 0.1, 0.9);
    float dust = 0.75 + 0.25 * sin(p.z * (TAU / PERIOD) * 3.0 + p.x * 2.0) * sin(p.y * 1.7 + uTime * 0.2);
    float ey = exp(-p.y * 0.1);
    accB += lit(p, Lk, lphase) * dust * ey * exp(-t * 0.02) * dt;
    // ambient haze so the hall reads even where no shaft falls (exp(-0.2 y) = ey^2)
    accH += ey * ey * dt;
    if (d < 0.012) { hit = true; break; }
    t += dt;
    if (t > 46.0) break;
  }

  vec3 col = beamCol * (accB * 0.14 * dens * beam) + uColor1 * (accH * 0.012 * dens);
  vec3 p = ro + rd * t;
  if (hit) {
    vec3 n = normalAt(p);
    float diff = max(dot(n, -L), 0.0);
    float l = lit(p, Lk, lphase);
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
    float fr = 1.0 - max(dot(n, -rd), 0.0);
    surf += uColor3 * (fr * fr * fr) * (0.04 + 0.25 * kick) * (1.0 - float(p.y < 0.05));
    col += surf * exp(-t * 0.045 / max(density, 0.2) * 0.6);
  } else {
    // the far end of the nave: a door of light (z^30 and z^6 by squaring)
    float z = max(rd.z, 0.0);
    float z2 = z * z;
    float z6 = z2 * z2 * z2;
    float core = z6 * z6 * z6 * z6 * z6;
    col += uColor3 * core * (0.5 + 0.6 * kick) * 0.7 + uColor1 * z6 * 0.12;
    col += uColor2 * 0.04 * smoothstep(-0.2, 0.8, rd.y);
  }

  // soft shoulder instead of a clip, and a floor so silence is still a cathedral
  col = col / (1.0 + 0.55 * col) + uColor1 * 0.012;
  vec2 q = uv * vec2(0.9, 1.0);
  col *= clamp(1.2 - dot(q, q) * 0.9, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

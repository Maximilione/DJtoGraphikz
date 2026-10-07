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
uniform float haze;
uniform float stagger;

// Pistons: a corridor of hydraulic presses, two rows flanking the camera,
// stamping down one after another — a compression wave running down the
// line (stagger), not a single slam in unison. uBeatClock drives the cycle
// so it always stays on the beat; the kick adds a sharp extra snap and, the
// instant a ram bottoms out near a kick, a spark flares at its foot (an
// emissive point accumulated during the march, the same trick monolith uses
// for its fog). Low haze clings to the floor, hazard paint stripes the
// skirting, emergency lights blink along the ceiling on their own clock so
// the corridor is never dark even in silence. Dark wet steel, lit only by
// the sparks and the red/white service lights — the light is the image.

const float SP = 3.2;      // spacing between presses along the corridor
const float ROWX = 2.1;    // row offset from the centreline
const float TOPY = 2.6;    // ram retracted height
const float FLOORY = -1.0;
const float STROKE = 3.1;  // how far the ram travels: bottoms out flush with the floor

float gSpark;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// sharp slam down (0..0.18), a short dwell at the bottom, then a slower
// rise back up (0.3..1.0) — 0 = retracted, 1 = bottomed out
float cycle(float ph) {
  float s = fract(ph);
  return clamp(smoothstep(0.0, 0.18, s) - smoothstep(0.3, 1.0, s), 0.0, 1.0);
}

// ram bottom-of-stroke height for the press at index zc, at time t
float ramY(float zc, float t) {
  float ph = t * speed * 0.5 - zc * stagger * 0.25;
  float c = cycle(ph);
  float snap = uBassHit * 0.25;
  return TOPY - STROKE * clamp(c + snap, 0.0, 1.05);
}

float press(vec3 p, float side, float t) {
  float zc = floor(p.z / SP + 0.5);
  float zl = p.z - zc * SP;
  float h = 0.75 + 0.25 * hash11(zc * 3.1 + side * 7.0);
  float ry = ramY(zc, t);
  // an H-frame gantry: two static rail posts and a cap, open in between so
  // the ram sliding through the gap is actually visible from the front
  vec3 q = vec3(p.x - side * ROWX, p.y, zl);
  float gap = 0.75 * h;
  float postW = 0.16 * h;
  float postL = sdBox(q - vec3(-gap, 0.9, 0.0), vec3(postW, 1.9, 0.4 * h));
  float postR = sdBox(q - vec3(gap, 0.9, 0.0), vec3(postW, 1.9, 0.4 * h));
  float cap = sdBox(q - vec3(0.0, 2.75, 0.0), vec3(gap + postW, 0.12, 0.4 * h));
  float ram = sdBox(q - vec3(0.0, ry, 0.0), vec3(gap - 0.08, 0.45, 0.42 * h));
  float d = min(min(postL, postR), min(cap, ram));
  // spark at the ram's foot, brightest right as it bottoms and a kick lands
  float bottomed = 1.0 - smoothstep(0.0, 0.35, abs(ry - (FLOORY + 0.5)));
  gSpark += bottomed * (0.15 + 0.85 * uBassHit) / (1.0 + 20.0 * (zl * zl + q.x * q.x));
  return d;
}

float map(vec3 p, float t) {
  float floor_ = p.y - FLOORY;
  float d = min(press(p, 1.0, t), press(p, -1.0, t));
  d = min(d, floor_);
  float ceil_ = TOPY + 1.3 - p.y;
  d = min(d, ceil_);
  return d;
}

float march(vec3 ro, vec3 rd, float tmax, float t) {
  float dist = 0.05;
  for (int i = 0; i < 80; i++) {
    if (dist > tmax) break;
    vec3 p = ro + rd * dist;
    float d = map(p, t);
    if (d < 0.004) return dist;
    dist += d * 0.85;
  }
  return -1.0;
}

vec3 normalAt(vec3 p, float t) {
  const float e = 0.005;
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e, t) + k.yyx * map(p + k.yyx * e, t) +
                    k.yxy * map(p + k.yxy * e, t) + k.xxx * map(p + k.xxx * e, t));
}

vec3 shade(vec3 p, vec3 rd, float t) {
  vec3 n = normalAt(p, t);
  float onFloor = step(abs(p.y - FLOORY), 0.02);

  // service lights: a row along the ceiling, each on its own blink clock
  float zc = floor(p.z / SP + 0.5);
  float blink = step(0.5, fract(uTime * 0.9 + hash11(zc * 5.3)));
  vec3 lampPos = vec3(0.0, TOPY + 1.2, zc * SP);
  vec3 L = normalize(lampPos - p);
  float lamp = max(dot(n, L), 0.0) / (1.0 + 0.05 * dot(lampPos - p, lampPos - p));
  vec3 col = mix(uColor1, uColor3, 0.5) * lamp * (0.25 + 0.5 * blink + 0.3 * uBeat);

  // dark wet steel base + cold rim
  col += uColor2 * 0.05;
  col += uColor1 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.3;

  // hazard stripes on the floor skirting close to each row
  float stripeMask = smoothstep(1.4, 1.1, abs(abs(p.x) - ROWX));
  float stripe = step(0.5, fract((p.x + p.z) * 1.1));
  col += onFloor * stripeMask * mix(vec3(0.0), uColor3 * 0.45, stripe) * 0.5;
  // faint standing floor grid elsewhere
  col += onFloor * uColor2 * 0.03;

  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uBeatClock;
  gSpark = 0.0;

  vec3 ro = vec3(0.0, 0.3, 4.5);
  vec3 rd = normalize(vec3(uv, -1.4));

  float tmax = 26.0;
  float dist = march(ro, rd, tmax, t);
  vec3 col;
  if (dist > 0.0) {
    vec3 p = ro + rd * dist;
    col = shade(p, rd, t);
    col = mix(uColor2 * 0.04, col, exp(-dist * 0.05));
  } else {
    col = uColor2 * 0.03 + uColor1 * 0.02 * (0.5 - uv.y);
  }

  // sparks: hot core tinted by the palette, flaring on the kick
  vec3 sparkCol = mix(uColor1, vec3(1.0), 0.6);
  col += sparkCol * gSpark * 0.4;

  // low mist clinging to the floor, never fully absent
  float mist = haze * (0.5 + 0.6 * uBass) * exp(-max(dist, 0.0) * 0.06);
  col += mix(uColor2, uColor3, 0.3) * mist * clamp(1.0 - uv.y * 1.2, 0.0, 1.0) * 0.12;

  // emergency floor glow: a constant floor so the room never reads as black
  col += uColor1 * 0.015 + uColor2 * 0.01;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.7, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

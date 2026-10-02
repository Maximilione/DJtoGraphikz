precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float count;
uniform float burst;
uniform float gravity;

// Confetti cannon. Every two beats a burst leaves the bottom, every piece
// with its own velocity and spin, and falls under gravity measured in beats,
// so the arc is the same at any tempo. Two bursts overlap, so the air is
// never empty.

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 hash2(float n) { return vec2(hash(n), hash(n + 57.3)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 burstLayer(vec2 p, float burstIndex, float age, float n, float aspect) {
  vec3 col = vec3(0.0);
  float life = 2.0;                 // beats
  if (age < 0.0 || age > life) return col;
  float fade = 1.0 - smoothstep(life * 0.7, life, age);
  for (int i = 0; i < 160; i++) {
    if (float(i) >= n) break;
    float seed = burstIndex * 311.7 + float(i) * 7.13;
    vec2 h = hash2(seed);
    // a fan of velocities out of the bottom centre, wider with the burst
    float ang = 1.5708 + (h.x - 0.5) * 2.2 * burst;
    float speed = (0.7 + 0.8 * h.y) * burst * 0.5;
    vec2 v = vec2(cos(ang), sin(ang)) * speed;
    vec2 pos = vec2(0.0, -0.55) + v * age - vec2(0.0, 0.5 * gravity * 0.35 * age * age);
    pos.x += 0.03 * sin(age * 6.0 + seed);      // flutter
    vec2 d = rot(age * 8.0 * (h.x - 0.5)) * (p - pos);
    float sz = 0.022 + 0.012 * hash(seed + 3.0);
    float piece = step(abs(d.x), sz) * step(abs(d.y), sz * 0.55);
    float k = hash(seed + 9.0);
    vec3 tint = k < 0.33 ? uColor1 : k < 0.66 ? uColor2 : uColor3;
    col += tint * piece * fade;
  }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float n = clamp(floor(count), 8.0, 160.0);
  // bursts every two beats; the current and the previous one are in the air
  float b = floor(uBeatClock / 2.0);
  float age = uBeatClock - b * 2.0;
  vec3 col = burstLayer(p, b, age, n, aspect) + burstLayer(p, b - 1.0, age + 2.0, n, aspect);
  // the cannon flash
  col += mix(uColor1, vec3(1.0), 0.6) * exp(-length(p - vec2(0.0, -0.55)) * 10.0) * exp(-age * 5.0) * 0.8;
  col *= 0.9 + 0.3 * uBeat;
  gl_FragColor = vec4(col, 1.0);
}

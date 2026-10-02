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

uniform float lanes;
uniform float pump;
uniform float drift;

// The rolling bassline of bounce techno, drawn: lanes of dark blocks sliding
// past each other, every block swelling on the offbeat — where the bass sits
// — and shrinking on the kick. One lane carries the accent and the accent
// walks down a lane per beat. Grey on black; the palette is one colour.

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float n = clamp(floor(lanes), 2.0, 12.0);
  float lane = floor(uv.y * n);
  float fy = fract(uv.y * n) - 0.5;
  float dir = mod(lane, 2.0) * 2.0 - 1.0;

  // blocks slide a quarter block per beat, alternate lanes opposite ways
  float speed = 0.25 * drift * (0.8 + 0.4 * hash(lane));
  float x = uv.x * aspect * 3.0 + uBeatClock * speed * dir + hash(lane * 3.1) * 7.0;
  float cell = floor(x);
  float fx = fract(x) - 0.5;

  // offbeat swell, kick duck: the sidechain upside down
  float ph = fract(uBeatClock);
  float env = 1.0 - pump * 0.45 * exp(-ph * 7.0) + pump * 0.3 * exp(-abs(ph - 0.5) * 7.0) * (0.6 + 0.8 * uBass);
  float w = 0.36 * env * (0.7 + 0.6 * hash(cell * 1.7 + lane));
  float h = 0.32 * env;
  float inside = step(abs(fx), w) * step(abs(fy), h);
  float edge = inside * (1.0 - step(abs(fx), w - 0.03) * step(abs(fy), h - 0.05));

  // accent lane walks one lane per beat
  float accentLane = mod(floor(uBeatClock), n);
  float accent = step(abs(lane - accentLane), 0.1);
  // and one block per lane is the bright one
  float hot = step(0.85, hash(cell * 5.3 + lane * 2.9 + floor(uBeatClock / 4.0)));

  vec3 grey = vec3(0.16 + 0.1 * hash(cell + lane * 0.37));
  vec3 col = grey * inside * (0.8 + 0.5 * uEnergy);
  col += uColor1 * edge * 0.6;
  col += uColor1 * inside * hot * (0.5 + 0.8 * uBassHit);
  col = mix(col, uColor1 * inside * (0.9 + 0.4 * uBeat), accent * 0.7);
  // lane separators
  col += vec3(0.05) * exp(-abs(fy + 0.5) * 60.0);
  gl_FragColor = vec4(col, 1.0);
}

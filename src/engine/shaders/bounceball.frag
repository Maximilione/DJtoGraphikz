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

uniform float balls;
uniform float bounce;
uniform float squash;

// Bouncing balls, one bounce per beat each, staggered so the floor is never
// quiet. The arc is a parabola on the beat clock, the ball squashes on the
// floor and stretches at the top — the cartoon rule, which is what reads as
// bounce from the back of the room.

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float n = clamp(floor(balls), 1.0, 8.0);
  float floorY = -0.32;

  vec3 col = vec3(0.0);
  // the floor: a line that flashes on the kick
  col += mix(uColor3, vec3(1.0), 0.5) * exp(-abs(p.y - floorY) * 120.0) * (0.25 + 0.75 * uBassHit);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float fi = float(i);
    float phase = fract(uBeatClock + fi / n);
    // parabola: 0 on the floor, 1 at the top, back to 0 — one bounce a beat
    float h = 1.0 - (2.0 * phase - 1.0) * (2.0 * phase - 1.0);
    float height = h * 0.5 * bounce * (0.8 + 0.4 * uBass);
    float x = (fi + 0.5) / n - 0.5;
    x *= aspect * 0.9;
    x += 0.04 * sin(uTime * 0.7 + fi);
    float r = 0.09 + 0.03 * uEnergy;
    // squash on the floor, stretch in the air
    float onFloor = exp(-height * 30.0);
    float sx = 1.0 + squash * (0.5 * onFloor - 0.2 * h);
    float sy = 1.0 - squash * (0.4 * onFloor - 0.25 * h);
    vec2 c = vec2(x, floorY + r * sy + height);
    vec2 d = (p - c) / vec2(sx, sy);
    float dist = length(d);
    float ball = 1.0 - smoothstep(r, r + 0.004, dist);
    float glow = exp(-max(0.0, dist - r) * 18.0);
    vec3 tint = i % 3 == 0 ? uColor1 : i % 3 == 1 ? uColor2 : uColor3;
    // highlight top-left
    float hi = exp(-length(d - vec2(-0.3, 0.35) * r) * 25.0);
    col += tint * ball * (0.85 + 0.3 * uBeat) + vec3(1.0) * hi * ball * 0.6 + tint * glow * 0.25;
    // shadow on the floor, smaller when high
    float sh = exp(-length((p - vec2(x, floorY)) / vec2(1.6 * (1.0 - 0.5 * h), 0.25)) * 25.0);
    col *= 1.0 - sh * 0.35 * (1.0 - h) * step(p.y, floorY + 0.01);
  }
  gl_FragColor = vec4(col, 1.0);
}

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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float n = clamp(floor(balls), 1.0, 8.0);
  float floorY = -0.32;

  // haze lit from the floor line, so the balls hang in a room and not in a void
  vec3 col = mix(uColor3, uColor1, uv.x) * 0.035 * exp(-abs(p.y - floorY) * 3.5) * (0.6 + 0.8 * uEnergy);
  // the floor: a line that flashes on the kick
  col += mix(uColor3, vec3(1.0), 0.5) * exp(-abs(p.y - floorY) * 120.0) * (0.25 + 0.75 * uBassHit);
  // mirror floor: below the line the balls are seen reflected, fading with depth
  float below = step(p.y, floorY);
  vec2 pr = vec2(p.x, below > 0.5 ? 2.0 * floorY - p.y : p.y);
  float refl = mix(1.0, 0.6 * exp(-(floorY - p.y) * 3.5), below);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float fi = float(i);
    float phase = fract(uBeatClock + fi / n);
    // parabola: 0 on the floor, 1 at the top, back to 0 — one bounce a beat
    float h = 1.0 - (2.0 * phase - 1.0) * (2.0 * phase - 1.0);
    // apex clamped inside the frame: at full bounce the balls left the screen
    float height = h * min(0.5 * bounce * (0.8 + 0.4 * uBass), 0.5 - floorY - 0.31);
    float x = (fi + 0.5) / n - 0.5;
    x *= aspect * 0.9;
    x += 0.04 * sin(uTime * 0.7 + fi);
    // radius capped by the lane width, so eight balls (or a portrait frame)
    // do not overlap into one blob
    float r = min(0.11 + 0.03 * uEnergy, 0.38 * aspect * 0.9 / n);
    // squash on the floor, stretch where it moves fastest (not at the apex:
    // a ball at the top of its arc is round, a stretched one there reads as an egg)
    float onFloor = exp(-height * 30.0);
    float vel = abs(2.0 * phase - 1.0) * (1.0 - onFloor);
    float sx = 1.0 + squash * (0.5 * onFloor - 0.15 * vel);
    float sy = 1.0 - squash * (0.4 * onFloor - 0.25 * vel);
    vec2 c = vec2(x, floorY + r * sy + height);
    vec2 d = (pr - c) / vec2(sx, sy);
    float dist = length(d);
    float over = dist - r;
    vec3 tint = i % 3 == 0 ? uColor1 : i % 3 == 1 ? uColor2 : uColor3;
    if (over < 0.4) col += tint * exp(-max(0.0, over) * 18.0) * (0.25 + 0.3 * uMid) * refl;   // glow (< 1/255 beyond 0.4)
    // speed streak behind the ball: a still frame of a parabola says nothing
    // about which way it is going, the streak does
    float back = (c.y - pr.y) * (phase < 0.5 ? 1.0 : -1.0);
    float side = (pr.x - c.x) / (0.8 * r);
    if (back > 0.0 && abs(side) < 2.5) col += tint * exp(-back * 3.5 / max(vel, 0.05) - side * side) * smoothstep(0.0, r, back) * vel * 0.55 * refl;
    // and the wide spill each ball throws into the haze: three discs on black
    // left most of the frame empty
    col += tint * (0.07 + 0.08 * uBass) / (1.0 + 30.0 * max(over, 0.0) * max(over, 0.0)) * refl;
    if (over < 0.004) {   // disc and highlight: only on the ball itself
      float ball = 1.0 - smoothstep(r, r + 0.004, dist);
      // highlight top-left
      float hi = exp(-length(d - vec2(-0.3, 0.35) * r) * 25.0);
      // shaded as a sphere: dark rim, lit centre
      float nz = sqrt(max(1.0 - dist * dist / (r * r), 0.0));
      col += (tint * ball * (0.30 + 0.70 * nz) * (0.85 + 0.3 * uBeat) + vec3(1.0) * hi * ball * (0.5 + 0.7 * uHigh)) * refl;
    }
    // each landing strikes the floor on its own beat offset
    float imp = exp(-min(phase, 1.0 - phase) * 12.0);
    col += tint * imp * exp(-abs(p.x - x) * 10.0) * exp(-abs(p.y - floorY) * 90.0) * 0.8;
    if (below > 0.5) {
      vec2 fp = p - vec2(x, floorY);
      // the ball lights the floor under it, more the closer it is
      col += tint * exp(-abs(fp.x) * 5.0 + fp.y * 5.0 - height * 4.0) * 0.16;
      // each landing sends a ripple over the floor, flattened by the grazing view
      float rip = (length(fp * vec2(1.0, 4.0)) - 0.04 - 0.6 * phase) * 40.0;
      col += mix(tint, vec3(1.0), 0.3) * exp(-rip * rip - phase * 6.0) * 0.6;
    }
    // shadow on the floor, smaller when high: only below the floor line
    if (p.y <= floorY + 0.01) {
      float sh = exp(-length((p - vec2(x, floorY)) / vec2(1.6 * (1.0 - 0.5 * h), 0.25)) * 25.0);
      col *= 1.0 - sh * 0.35 * (1.0 - h);
    }
  }
  // soft knee: stacked glows roll off instead of clipping flat
  vec3 k = max(col - 0.8, 0.0);
  col = min(col, 0.8) + 0.2 * (1.0 - exp(-k * 2.5));
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // dither the glows into black
  gl_FragColor = vec4(col, 1.0);
}

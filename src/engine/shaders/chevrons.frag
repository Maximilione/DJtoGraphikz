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
uniform float thickness;
uniform float drift;

// Hazard chevrons. Vertical lanes of arrow stripes streaming up or down,
// neighbouring lanes opposite ways, the stripes snapping forward one notch on
// every beat. Alternate lanes carry the palette, the others plain white.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float n = max(1.0, floor(lanes));
  float lane = floor(uv.x * n);
  float fx = fract(uv.x * n);
  float dir = mod(lane, 2.0) * 2.0 - 1.0;

  // the arrow: fold the lane around its centre
  float v = abs(fx - 0.5) * 0.9;
  // beat snap: one stripe per beat, with a short glide
  float beat = floor(uBeatClock);
  float glide = smoothstep(0.0, 0.2, uBeatClock - beat);
  // folded to one period: an hour in, fract() of a big float crawls
  float travel = mod((beat + glide) * 0.5 + uTime * 0.2 * drift, 1.0);
  float y = uv.y * 4.0 + v + travel * dir;

  // stripe edges one pixel soft: the diagonals are what the eye reads
  float th = clamp(thickness, 0.1, 0.95);
  float fy = fract(y);
  float ay = fwidth(y);
  float stripe = smoothstep(1.0 - th - ay, 1.0 - th, fy) * (1.0 - smoothstep(1.0 - ay, 1.0, fy));
  // lane gutters
  float ax = n / uResolution.x;
  float gutter = smoothstep(0.03 - ax, 0.03, fx) * (1.0 - smoothstep(0.97, 0.97 + ax, fx));
  // tinted lanes: every other one
  float tinted = mod(lane, 2.0);
  vec3 ink = mix(vec3(1.0), uColor1, tinted);
  // one random lane flashes on the kick
  float hot = step(0.999, hash(vec2(lane, mod(beat, 512.0))) + uBassHit * 0.1);
  float bright = 0.55 + 0.4 * uBass + hot * 0.6;
  // dim the lanes away from the centre so the wall has a middle
  bright *= 1.0 - 0.5 * abs(uv.x - 0.5) * 2.0 * (1.0 - uEnergy);
  vec3 col = ink * stripe * gutter * bright;
  gl_FragColor = vec4(col, 1.0);
}

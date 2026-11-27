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
uniform float uLineBoost;

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
  // stripe thickness in lane-period units: widened, floored at lminPx pixels (one period = uResolution.y / 4 px)
  float lminPx = 3.0 + 4.0 * uLineBoost;
  float th = clamp(max(thickness * (1.0 + 0.8 * uLineBoost), lminPx * 4.0 / uResolution.y), 0.1, 0.95);
  float fy = fract(y);
  float ay = fwidth(y);
  float stripe = smoothstep(1.0 - th - ay, 1.0 - th, fy) * (1.0 - smoothstep(1.0 - ay, 1.0, fy));
  // leading-edge gradient: the stripe reads as moving, not a flat slab
  stripe *= 0.55 + 0.45 * smoothstep(1.0 - th, 1.0, fy);
  // the highs light the leading edge: hats get their own mark, apart from the kick's lane
  float lead = smoothstep(1.0 - 0.18 * th, 1.0, fy) * stripe * clamp(uHigh, 0.0, 1.0);
  // lane gutters
  float ax = n / uResolution.x;
  float gutter = smoothstep(0.03 - ax, 0.03, fx) * (1.0 - smoothstep(0.97, 0.97 + ax, fx));
  // tinted lanes: every other one
  float tinted = mod(lane, 2.0);
  // the tinted lanes walk the palette: with colour 1 alone two thirds of it never showed
  float pick = mod(floor(lane * 0.5), 3.0);
  vec3 ink = mix(vec3(1.0), pick < 0.5 ? uColor1 : pick < 1.5 ? uColor2 : uColor3, tinted);
  // exactly one lane per beat flashes on the kick, decaying with the hit
  float hotLane = floor(hash(vec2(mod(beat, 512.0), 3.0)) * n);
  float hot = (1.0 - step(0.5, abs(lane - hotLane))) * clamp(uBassHit, 0.0, 1.0);
  // the hot lane goes towards white: a tinted overdrive clips per channel on 8-bit
  ink = mix(ink, vec3(1.0), hot * 0.5);
  float bright = 0.55 + 0.4 * uBass + hot * 0.6;
  // dim the lanes away from the centre so the wall has a middle
  bright *= 1.0 - 0.5 * abs(uv.x - 0.5) * 2.0 * (1.0 - uEnergy);
  bright = min(bright, 1.0);
  vec3 col = (ink * stripe * bright + mix(ink, vec3(1.0), 0.6) * lead * 0.7) * gutter;
  gl_FragColor = vec4(col, 1.0);
}

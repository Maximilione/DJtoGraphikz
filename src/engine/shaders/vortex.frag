precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

uniform float arms;
uniform float twist;
uniform float pull;

varying vec2 vUv;

#define TAU 6.28318530718

// Vortex: log-spiral arms streaming into a black hole in the middle.
//
// What the previous version got wrong, for the record:
//  - `arms` is a continuous slider and went straight into the phase: any
//    non-integer value left a hard radial seam across the frame at the ±π cut
//  - the field was turned by uBarPhase, which wraps: the whole picture snapped
//    back a quarter turn at every bar
//  - fwidth() on the wrapped phase spiked on the cut and smeared a line
//  - a bright white core where a funnel wants a hole

// band around the arm centre (0.5 in the fractional phase), antialiased with
// the analytic gradient handed in by the caller
float arm(float phase, float halfWidth, float aa) {
  float band = abs(fract(phase) - 0.5);
  return smoothstep(halfWidth + aa, max(halfWidth - aa, 0.0), band);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  float side = min(uResolution.x, uResolution.y);
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / side;
  // half extent of the visible frame in these units: the funnel reaches the
  // corners on a 6:1 strip and a portrait wall alike
  float rmax = length(vec2(max(aspect, 1.0), max(1.0 / aspect, 1.0)) * 0.5);
  float px = 1.0 / side;

  float r = max(length(uv), 1e-4);
  float nArms = floor(arms + 0.5);            // integer, or the ±π cut shows
  // slow continuous spin: uBeatClock counts beats and never wraps
  float a = atan(uv.y, uv.x) + uBeatClock * 0.08;

  // inflow: a constant phase line drifts to smaller r as flow grows. The bass
  // clock adds drive while the track plays, the kick yanks the spiral one
  // step inward and lets it relax — visible, additive, never multiplicative.
  float suck = uBassHit * 0.35 * (0.5 + pull);
  float flow = uTime * (0.5 + pull * 0.6) + uBassTime * 0.5 + suck;

  float tw = twist + uMid * 0.3;
  float lr = log(r);
  float phase = nArms * a / TAU + tw * lr + flow;
  // |∇phase| in pixels: tangential nArms/(2πr), radial tw/r — seam-free
  float aa = length(vec2(nArms / TAU, tw)) / r * px * 1.5;
  float armA = arm(phase, 0.13 + uBass * 0.05, aa);
  float haloA = exp(-abs(fract(phase) - 0.5) * 6.0);

  // counter-rotating secondary arms, thinner and dimmer: parallax
  float n2 = max(nArms - 1.0, 1.0);
  float phase2 = -n2 * a / TAU + tw * 0.6 * lr + flow * 0.45;
  float aa2 = length(vec2(n2 / TAU, tw * 0.6)) / r * px * 1.5;
  float armB = arm(phase2, 0.07, aa2);

  // funnel: black hole in the middle with a lit rim, dark towards the frame
  float hole = smoothstep(0.04, 0.16, r);
  float rim = exp(-abs(r - 0.11) * 30.0);
  float depth = smoothstep(rmax * 1.1, 0.12, r);
  float bright = depth * hole * (0.55 + 0.45 * smoothstep(0.9, 0.15, r));

  vec3 armCol = mix(uColor1, uColor2, smoothstep(0.7, 0.1, r));
  vec3 color = vec3(0.0);
  color += armCol * armA * bright * (0.9 + uBass * 0.4);
  color += uColor2 * haloA * 0.18 * bright;
  color += uColor3 * armB * 0.35 * bright;
  color += mix(uColor1, uColor2, 0.5) * rim * (0.5 + uBassHit * 0.5 + uBeat * 0.2);

  // a ring falls into the hole every beat
  float ring = abs(r - (1.0 - uBeatPhase) * rmax);
  color += mix(uColor2, uColor3, 0.5) * smoothstep(0.03, 0.0, ring) * uBeat * 0.45 * hole;

  color = min(color, vec3(1.5));
  gl_FragColor = vec4(color, 1.0);
}

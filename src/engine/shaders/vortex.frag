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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

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
  // gas streaming along the arms: filaments in the spiral's own coordinates,
  // so they follow the flow. Flat ribbons on black had no depth at all.
  float fp = fract(phase);
  float grain = vnoise(vec2(fp * 9.0, lr * 5.0 + flow * 1.7));
  float fil = 0.5 + 0.5 * cos(fp * TAU * 4.0 + grain * 5.0);
  // the filaments are 4x finer than the arm: let them go before they alias
  float filK = clamp(1.0 - aa * 14.0, 0.0, 1.0);
  float gas = mix(1.0, 0.18 + 1.1 * fil * fil, filK) * (0.7 + 0.6 * grain);

  vec3 color = vec3(0.0);
  color += armCol * armA * gas * bright * (0.9 + uBass * 0.4);
  color += uColor2 * haloA * 0.18 * bright;
  color += uColor3 * armB * 0.35 * bright * (0.6 + 0.8 * grain);
  // thin gas between the arms, so the funnel is a volume and not a cut-out
  color += mix(uColor3, armCol, 0.35) * (0.05 + 0.10 * haloA) * (0.4 + grain) * bright * (0.6 + 0.8 * uEnergy);
  // hot filament down the middle of each arm, flaring on the kick: a tube profile
  float cw = (fp - 0.5) / 0.05;
  float core = exp(-cw * cw);
  color += mix(armCol, vec3(1.0), 0.6) * core * bright * (0.25 + 0.75 * uBassHit);
  color += mix(uColor1, uColor2, 0.5) * rim * (0.5 + uBassHit * 0.5 + uBeat * 0.2);

  // debris spiralling in: one streak per cell of a log-polar grid that moves
  // with the flow, on the arms' own pitch. 48 cells round the circle, an
  // integer, so no seam.
  vec2 sg = vec2(fract(a / TAU + tw * lr / nArms) * 48.0, lr * 5.0 + flow * 1.6);
  vec2 sid = floor(sg);
  float sh = hash(vec2(sid.x, mod(sid.y, 251.0)));
  vec2 sf = fract(sg) - vec2(0.2 + 0.6 * sh, 0.5);
  float star = step(0.6, sh) * exp(-(sf.x * sf.x * 260.0 + sf.y * sf.y * 7.0));
  color += mix(armCol, vec3(1.0), 0.35) * star * bright * (0.3 + 1.2 * uHigh);

  // a ring falls into the hole every beat
  float ring = (r - (1.0 - uBeatPhase) * rmax) / 0.035;
  color += mix(uColor2, uColor3, 0.5) * exp(-ring * ring) * uBeat * 0.4 * hole * depth;

  // hue-keeping rolloff: a per-channel clip shifts hue on 8-bit targets
  float mx = max(max(color.r, color.g), max(color.b, 1.0));
  color = mix(color / mx, vec3(1.0), clamp((mx - 1.0) * 0.35, 0.0, 0.6));
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // the gas gradients band on 8 bit
  gl_FragColor = vec4(color, 1.0);
}

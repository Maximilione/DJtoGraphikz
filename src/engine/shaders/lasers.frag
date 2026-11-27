precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float beams;
uniform float spread;
uniform float sweep;

// value noise for the haze: beams are only visible where there is smoke
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Club lasers: fans of beams from two emitters, sweeping with the music
// through drifting haze over a glossy floor, hard strobes on the kick.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  float lkb = 1.0 + 2.5 * uLineBoost;
  float lminW = (3.0 + 4.0 * uLineBoost) / uResolution.y;
  vec3 color = vec3(0.0);
  // more beams, each a little dimmer: twelve at full haze washed the frame
  float dimB = sqrt(6.0 / max(beams, 6.0));

  // glossy floor: below it the room is drawn mirrored and dimmer, so the
  // beams land somewhere instead of running off a flat black card
  const float FLOOR = -0.33;
  float below = max(FLOOR - uv.y, 0.0);
  uv.y = FLOOR + abs(uv.y - FLOOR);
  uv.x += below * 0.02 * sin(uv.x * 40.0 + t * 1.5);

  // drifting smoke, one field for every beam
  float smokeN = vnoise(uv * vec2(2.4, 3.6) + vec2(t * 0.11, -t * 0.05)) * 0.65
               + vnoise(uv * vec2(6.5, 9.0) - vec2(t * 0.17, t * 0.08)) * 0.35;
  float smoke = 0.35 + 1.1 * smokeN;

  for (int e = 0; e < 2; e++) {
    float fe = float(e);
    // emitters at the top corners of THIS frame (a 6:1 strip used to have
    // them in the middle, a portrait frame outside it)
    float halfW = uResolution.x / uResolution.y * 0.5 - 0.04;
    vec2 origin = vec2((fe * 2.0 - 1.0) * halfW, 0.62);
    vec2 p = uv - origin;
    float baseA = atan(p.y, p.x);
    float d = length(p);

    float fan = (0.35 + spread * 0.5);
    float halfFan = fan * 0.5 * (1.0 + uMid * 0.4);
    // the fan sweeps inside the down-inward quadrant only: the old sweep
    // pointed one emitter above the horizon half the time and it vanished
    float lo = -1.45 + halfFan, hi = -0.10 - halfFan;
    float mid = (lo + hi) * 0.5, amp = max(hi - lo, 0.0) * 0.5;
    float sweepA = sin(t * (0.7 + sweep) + fe * PI + uBassTime * 0.5) * amp;
    float aim0 = mid + sweepA;
    float aim = fe == 0.0 ? aim0 : PI - aim0;   // mirror for the right emitter

    // per-emitter invariants, out of the ray loop (its dynamic break keeps
    // some drivers from hoisting them)
    // pixel floor: beam half-width ~ lminW at any distance
    float w = max((0.0016 + uHigh * 0.002) * lkb * lkb, 8.0 * lminW * lminW / max(d, 0.05));
    float d8 = d * 8.0;
    // light falls off along the throw: near the emitter hot, the far end soft
    float fall = 1.0 / (0.55 + d * 0.9);
    float hazeD = 0.03 * fall * smoke;
    float invN = 1.0 / max(beams - 1.0, 1.0);
    float fanK = 2.0 * halfFan * (1.0 - fe * 2.0);

    // the scanned sheet between the beams: a fan is a volume, not a comb
    float rel = (mod(baseA - aim + PI, TAU) - PI) / max(halfFan, 1e-3);
    float sheet = smoothstep(1.25, 0.85, abs(rel)) * fall * smoke;
    color += mix(uColor1, uColor2, 0.5 + 0.5 * rel * (1.0 - fe * 2.0)) * sheet * (0.035 + 0.05 * uEnergy + 0.10 * uBassHit);

    for (float i = 0.0; i < 12.0; i++) {
      if (i >= beams) break;
      float k = i * invN - 0.5;
      float beamA = aim + k * fanK;
      // angular distance from the beam
      float da = abs(mod(baseA - beamA + PI, TAU) - PI);
      float core = w / (da * da * d8 + w);
      float haze = hazeD / (da * 12.0 + 0.25);
      // two palette colours in blocks, not their grey average
      vec3 c = mix(uColor1, uColor2, smoothstep(0.35, 0.65, fract(i * 0.37 + fe * 0.5 + uBarPhase)));
      float strobe = 0.45 + 0.55 * step(0.5, fract(i * 0.5 + uHighTime * 2.0));
      // uneven power per beam: equal beams read as a drawing of a fan
      float pw = 0.55 + 0.45 * fract(i * 0.618 + fe * 0.31);
      float c2 = core * core;
      // coloured body breathing with the smoke, white only in the very centre
      color += (c * (core * (0.5 + 0.45 * smoke) * (0.6 + 1.2 * fall) + haze) + vec3(1.0) * c2 * c2 * 0.3) * strobe * pw * dimB;
    }
  }

  // kick: all beams flash + floor wash
  color *= 1.0 + uBassHit * 0.9;
  // the mirror image is dimmer and dies away from the floor line
  color *= below > 0.0 ? 0.45 * exp(-below * 3.5) : 1.0;
  float fl = abs(uv.y - FLOOR) + below;
  color += uColor3 * (0.012 + 0.02 * uEnergy + 0.07 * uBassHit) / (fl * 6.0 + 0.12) * (0.6 + 0.6 * smokeN);

  // soft knee: the 8-bit target clips at 1.0, roll off instead of a flat wash
  vec3 kn = max(color - 0.8, 0.0);
  color = min(color, 0.8) + 0.2 * (1.0 - exp(-kn * 2.0));
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // the haze gradients band on 8 bit
  gl_FragColor = vec4(color, 1.0);
}

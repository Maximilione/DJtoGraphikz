precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;
uniform float freqa;
uniform float freqb;
uniform float size;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Squared distance to a segment: sampling the curve as POINTS left visible
// gaps at higher frequencies (it looked like scattered dots, not a curve).
// Squared because only the minimum is needed: one sqrt after the loop
// instead of one per segment.
float segDist2(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  vec2 q = pa - ba * h;
  return dot(q, q);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  float lkb = 1.0 + 2.5 * uLineBoost;
  float lminW = (3.0 + 4.0 * uLineBoost) / uResolution.y;
  vec3 color = vec3(0.0);
  // portrait output: shrink the figure so it stays inside the frame
  float fit = min(1.0, uResolution.x / uResolution.y * 0.85);

  // Multiple Lissajous curves with audio-reactive parameters
  for (int curve = 0; curve < 3; curve++) {
    float fc = float(curve);
    float freqA = freqa + fc + uBass * 2.0;
    float freqB = freqb + fc * 0.7 + uMid;
    float phase = t * (0.3 + fc * 0.1) + uHigh * fc;
    float amplitude = (size + fc * 0.02 + uBeat * 0.05) * fit;

    // Walk the curve as a polyline and measure the distance to each segment
    float minD2 = 1e4;
    float closestI = 0.0;
    // segments follow the frequency: a fixed 72 showed its corners at the
    // high end, and burned them on the slow default curves for nothing
    float segs = clamp(ceil(max(freqA, freqB) * 20.0), 48.0, 160.0);
    // the vertices are sin(f*s + ph) on a uniform s grid, so they are walked
    // with the angle-addition recurrence: 4 trig per curve instead of 2 per
    // segment (fp32 drift over 160 steps ~1e-5)
    float ds = TAU / segs;
    vec2 sn = sin(vec2(phase, phase * 0.7));
    vec2 cs = cos(vec2(phase, phase * 0.7));
    vec2 sd = sin(vec2(freqA, freqB) * ds);
    vec2 cd = cos(vec2(freqA, freqB) * ds);
    vec2 prev = sn * amplitude;
    for (int i = 1; i <= 160; i++) {
      if (float(i) > segs) break;
      vec2 sn2 = sn * cd + cs * sd;
      cs = cs * cd - sn * sd;
      sn = sn2;
      vec2 cur = sn * amplitude;
      float d2 = segDist2(uv, prev, cur);
      if (d2 < minD2) {
        minD2 = d2;
        closestI = float(i);
      }
      prev = cur;
    }
    float minDist = sqrt(minD2);
    float closestT = closestI / segs;

    // Glow around the curve
    float glow = 0.004 * (1.0 + uLineBoost) / (minDist + 0.002);
    glow = pow(glow, 1.4);
    glow = min(glow, 3.0);

    // Line
    float line = smoothstep(max(max(0.005 * lkb, lminW), fwidth(minDist) * 1.5), 0.0, minDist);

    // Color varies along curve parameter
    vec3 cColor = curve == 0 ? uColor1 : (curve == 1 ? uColor2 : uColor3);

    // Add rainbow shift along curve
    float hueShift = closestT + t * 0.1;
    cColor = mix(cColor, uColor3, sin(hueShift * TAU) * 0.3 + 0.3);

    float opacity = 1.0 - fc * 0.15;
    color += cColor * (glow * 0.2 + line) * opacity;
  }

  // Central dot
  float centerDot = 0.005 / (length(uv) + 0.005);
  color += mix(uColor1, uColor2, 0.5) * centerDot * 0.3;

  // Beat flash
  color *= 1.0 + uBeat * 0.5;

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

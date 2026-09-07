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
uniform float freqa;
uniform float freqb;
uniform float size;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Distance to a segment: sampling the curve as POINTS left visible gaps at
// higher frequencies (it looked like scattered dots, not a curve).
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

vec2 lissa(float s, float fa, float fb, float phase, float amp) {
  return vec2(sin(fa * s + phase) * amp, sin(fb * s + phase * 0.7) * amp);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Multiple Lissajous curves with audio-reactive parameters
  for (int curve = 0; curve < 3; curve++) {
    float fc = float(curve);
    float freqA = freqa + fc + uBass * 2.0;
    float freqB = freqb + fc * 0.7 + uMid;
    float phase = t * (0.3 + fc * 0.1) + uHigh * fc;
    float amplitude = size + fc * 0.02 + uBeat * 0.05;

    // Walk the curve as a polyline and measure the distance to each segment
    float minDist = 100.0;
    float closestT = 0.0;
    vec2 prev = lissa(0.0, freqA, freqB, phase, amplitude);
    for (int i = 1; i <= 72; i++) {
      float s = float(i) / 72.0 * TAU;
      vec2 cur = lissa(s, freqA, freqB, phase, amplitude);
      float d = segDist(uv, prev, cur);
      if (d < minDist) {
        minDist = d;
        closestT = s / TAU;
      }
      prev = cur;
    }

    // Glow around the curve
    float glow = 0.004 / (minDist + 0.002);
    glow = pow(glow, 1.4);
    glow = min(glow, 3.0);

    // Line
    float line = smoothstep(max(0.005, fwidth(minDist) * 1.5), 0.0, minDist);

    // Color varies along curve parameter
    vec3 cColor;
    if (curve == 0 || curve == 3) cColor = uColor1;
    else if (curve == 1 || curve == 4) cColor = uColor2;
    else cColor = uColor3;

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

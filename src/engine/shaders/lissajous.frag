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

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Multiple Lissajous curves with audio-reactive parameters
  for (int curve = 0; curve < 3; curve++) {
    float fc = float(curve);
    float freqA = 2.0 + fc + uBass * 2.0;
    float freqB = 3.0 + fc * 0.7 + uMid;
    float phase = t * (0.3 + fc * 0.1) + uHigh * fc;
    float amplitude = 0.35 + fc * 0.02 + uBeat * 0.05;

    // Sample many points along the curve and find closest distance
    float minDist = 100.0;
    float closestT = 0.0;

    for (int i = 0; i < 64; i++) {
      float s = float(i) / 64.0 * TAU;

      vec2 curvePos = vec2(
        sin(freqA * s + phase) * amplitude,
        sin(freqB * s + phase * 0.7) * amplitude
      );

      float d = length(uv - curvePos);
      if (d < minDist) {
        minDist = d;
        closestT = s / TAU;
      }
    }

    // Glow around the curve
    float glow = 0.004 / (minDist + 0.002);
    glow = pow(glow, 1.4);
    glow = min(glow, 3.0);

    // Line
    float line = smoothstep(0.004, 0.0, minDist);

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

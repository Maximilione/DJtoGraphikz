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
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float ringcount;
uniform float spacing;
uniform float gapfreq;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Multiple concentric ring systems
  for (int sys = 0; sys < 3; sys++) {
    float fs = float(sys);
    vec2 center = vec2(
      sin(t * 0.3 + fs * TAU / 3.0) * 0.15,
      cos(t * 0.4 + fs * TAU / 3.0) * 0.15
    );

    vec2 p = uv - center;
    p *= rot(t * 0.1 * (1.0 + fs * 0.3));

    float r = length(p);
    float a = atan(p.y, p.x);

    // Expanding rings from center
    float ringSpeed = 1.5 + uBass * 2.0;
    float ringSpacing = spacing + uMid * 0.04;

    // Constant loop bound (= param max), dynamic break on the actual count
    for (float i = 0.0; i < 16.0; i++) {
      if (i >= ringcount) break;
      float ringR = mod(i * ringSpacing + t * ringSpeed * 0.1, 1.0);

      // Ring thickness varies with angle
      float thickness = 0.004 + sin(a * 4.0 + t + i * 2.0) * 0.002;

      // Broken ring — gaps
      float gap = sin(a * (gapfreq + fs * 2.0) + t * (0.5 + i * 0.1) + i);
      float gapMask = smoothstep(0.0, 0.3, gap);

      float rd = abs(r - ringR);
      float ring = smoothstep(max(thickness, fwidth(rd) * 1.5), 0.0, rd) * gapMask;

      // Fade with expansion
      float fade = 1.0 - ringR;

      vec3 ringColor;
      if (sys == 0) ringColor = uColor1;
      else if (sys == 1) ringColor = uColor2;
      else ringColor = uColor3;

      // Color shift along ring
      ringColor = mix(ringColor, uColor3, sin(a * 2.0 + t) * 0.3 + 0.3);

      color += ringColor * ring * fade * 0.7;
    }
  }

  // Ring burst rides the beat phase, so it expands in time with the music
  {
    float bp = 1.0 - uBeatPhase;
    float preR = uBeatPhase * 0.9;
    float pre = smoothstep(0.012, 0.0, abs(length(uv) - preR)) * bp * 0.6;
    color += mix(uColor2, uColor3, uBarPhase) * pre;
  }
  if (uBeat > 0.1) {
    float burstR = uBeat * 0.8;
    float burst = smoothstep(0.01, 0.0, abs(length(uv) - burstR));
    color += mix(uColor1, uColor2, 0.5) * burst * 3.0 * uBeat;
  }

  // Connecting lines between ring systems
  float linePattern = sin(uv.x * 50.0 + t * 2.0) * sin(uv.y * 50.0 - t * 1.5);
  linePattern = smoothstep(0.95, 1.0, linePattern);
  color += uColor3 * linePattern * 0.2 * uEnergy;

  color *= 1.0 + uBeat * 0.3;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

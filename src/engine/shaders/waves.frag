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

  // Stack of audio-reactive sine waves
  float numWaves = 20.0;
  for (float i = 0.0; i < 20.0; i++) {
    float fi = i / numWaves;

    // Y position for this wave — spread across screen
    float baseY = (fi - 0.5) * 1.5;

    // Wave equation — multiple frequencies
    float freq1 = 3.0 + i * 0.5;
    float freq2 = 5.0 + i * 0.3;
    float amp1 = 0.03 + uBass * 0.05;
    float amp2 = 0.02 + uMid * 0.03;

    float wave = baseY
      + sin(uv.x * freq1 + t * (1.0 + fi) + i) * amp1
      + sin(uv.x * freq2 - t * 0.7 + i * 2.0) * amp2
      + sin(uv.x * 1.5 + t * 0.3) * uBeat * 0.05;

    // Distance from wave line
    float d = abs(uv.y - wave);

    // Glow
    float glow = 0.003 / (d + 0.003);
    glow = pow(glow, 1.3);
    glow = min(glow, 2.0);

    // Sharp line
    float line = smoothstep(0.003, 0.0, d);

    // Color gradient based on wave index
    vec3 wColor = mix(uColor1, uColor2, fi);
    wColor = mix(wColor, uColor3, sin(fi * PI + t * 0.2) * 0.5 + 0.5);

    // Opacity fades for outer waves
    float fade = 1.0 - abs(fi - 0.5) * 1.5;
    fade = max(fade, 0.2);

    color += wColor * (glow * 0.15 + line * 0.8) * fade;
  }

  // Horizontal energy bars at extreme positions
  float energyBar = smoothstep(0.002, 0.0, abs(uv.y - 0.75 * sign(uv.y))) * uEnergy;
  color += uColor2 * energyBar;

  // Beat pulse
  color *= 1.0 + uBeat * 0.4;

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

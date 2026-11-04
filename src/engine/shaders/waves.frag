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
uniform float count;
uniform float amp;
uniform float freq;
uniform float uLineBoost;

varying vec2 vUv;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

#define PI 3.14159265359
#define TAU 6.28318530718

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Stack of audio-reactive sine waves
  float numWaves = count;
  // loop invariants, lifted by hand: with the dynamic break below drivers do
  // not always hoist them, and the beat wobble was one of 3 sin per wave
  float beatWob = sin(uv.x * 1.5 + t * 0.3) * uBeat * 0.05;
  float amp1 = amp + uBass * 0.05;
  float amp2 = 0.02 + uMid * 0.03;
  float gA = 0.004 * (1.0 + 1.5 * uLineBoost);
  float lineW = 0.003 * (1.0 + 2.5 * uLineBoost);
  float fwK = 3.0 + 4.0 * uLineBoost;
  float lum = 0.9 + 0.5 * uEnergy;
  float invN = 1.0 / max(numWaves, 1.0);
  // Constant loop bound (= param max), dynamic break on the actual count
  for (float i = 0.0; i < 40.0; i++) {
    if (i >= numWaves) break;
    float fi = i * invN;

    // Y position for this wave — spread across screen
    float baseY = (fi - 0.5) * 1.5;

    // Wave equation — multiple frequencies
    float freq1 = freq + i * 0.5;
    float freq2 = 5.0 + i * 0.3;

    float wave = baseY
      + sin(uv.x * freq1 + t * (1.0 + fi) + i) * amp1
      + sin(uv.x * freq2 - t * 0.7 + i * 2.0) * amp2
      + beatWob;

    // Distance from wave line
    float d = abs(uv.y - wave);

    // Glow (gA / (d + gA) is already in (0, 1]: no clamp needed)
    float glow = pow(gA / (d + gA), 1.3);

    // Sharp line
    float line = smoothstep(max(lineW, fwidth(d) * fwK), 0.0, d);

    // Colour by wave index, the whole palette across the stack, drifting.
    // It was mix(mix(c1, c2, fi), c3, sin(fi*PI…)*0.5+0.5): that weight never
    // drops below ~0.5, so colour 3 painted most of every wave.
    vec3 wColor = pal3(fi + t * 0.03);

    // Opacity fades for outer waves
    float fade = 1.0 - abs(fi - 0.5) * 1.5;
    fade = max(fade, 0.2);

    color += wColor * (glow * 0.4 + line) * fade * lum;
  }

  // Horizontal energy bars at extreme positions
  float energyBar = smoothstep(0.002 * (1.0 + 2.5 * uLineBoost), 0.0, abs(uv.y - 0.46 * sign(uv.y))) * uEnergy;
  color += uColor2 * energyBar;

  // faint tinted haze so the wall is never black between the lines
  color += mix(uColor1, uColor3, uv.y * 0.5 + 0.5) * 0.06;

  // Beat pulse
  color *= 1.0 + uBeat * 0.4;

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

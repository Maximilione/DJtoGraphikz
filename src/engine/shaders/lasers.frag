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

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float beams;
uniform float spread;
uniform float sweep;

// Club lasers: fans of beams from two emitters, sweeping with the music,
// haze glow, hard strobes on the kick.
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  for (int e = 0; e < 2; e++) {
    float fe = float(e);
    // emitters at the top corners
    vec2 origin = vec2(fe * 2.0 - 1.0, 0.62) * vec2(0.85, 1.0);
    vec2 p = uv - origin;
    float baseA = atan(p.y, p.x);
    float d = length(p);

    float fan = (0.35 + spread * 0.5);
    float sweepA = sin(t * (0.7 + sweep) + fe * PI + uBassTime * 0.5) * fan;
    // aim roughly down-inward
    float aim = (fe == 0.0 ? -0.45 : PI + 0.45) + sweepA * (1.0 - fe * 2.0);

    for (float i = 0.0; i < 12.0; i++) {
      if (i >= beams) break;
      float k = i / max(beams - 1.0, 1.0) - 0.5;
      float beamA = aim + k * fan * (1.0 + uMid * 0.4);
      // angular distance from the beam
      float da = abs(mod(baseA - beamA + PI, TAU) - PI);
      float w = 0.0016 + uHigh * 0.002;
      float core = w / (da * da * d * 8.0 + w) ;
      float haze = 0.02 / (da * 12.0 + 0.25) / (d * 2.0 + 0.4);
      vec3 c = mix(uColor1, uColor2, fract(i * 0.37 + fe * 0.5 + uBarPhase));
      float strobe = 0.55 + 0.45 * step(0.5, fract(i * 0.5 + uHighTime * 2.0));
      color += c * (core * 0.9 + haze) * strobe;
    }
  }

  // kick: all beams flash + floor wash
  color *= 1.0 + uBassHit * 1.4;
  color += uColor3 * smoothstep(-0.1, -0.6, uv.y) * uBassHit * 0.25;
  // smoke floor gradient
  color += uColor3 * 0.03 / (abs(uv.y + 0.45) + 0.15) * uEnergy;

  color = min(color, vec3(2.2));
  gl_FragColor = vec4(color, 1.0);
}

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

uniform float arms;
uniform float twist;
uniform float pull;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Hypnotic vortex: log-spiral arms drawn as THIN bands flowing into the
// center. The kick sends a pulse down the spiral, the bar slowly rotates the
// whole field.
//
// The band is measured as distance from the arm centre (0.5 in the fractional
// phase): anything wider than a fraction of the period fills the screen and
// the effect turns into a flat wash.
float spiralArm(float phase, float halfWidth, out float glow) {
  float band = abs(fract(phase) - 0.5);
  float aa = clamp(fwidth(phase), 0.001, 0.35);
  glow = smoothstep(0.5, 0.0, band);
  return smoothstep(halfWidth + aa, max(halfWidth - aa, 0.0), band);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  float r = length(uv) + 1e-4;
  float a = atan(uv.y, uv.x) + uBarPhase * TAU * 0.25;

  // depth: bright core, dark rim — this is what reads as a funnel
  float depth = smoothstep(1.15, 0.05, r);

  // main arms
  float flow = t * (0.5 + pull * 0.7 + uBass * 0.7);
  float phase = a * arms / TAU + log(r) * (twist + uMid * 0.3) - flow;
  float glowA;
  float arm = spiralArm(phase, 0.125, glowA);

  // counter-rotating secondary arms, thinner and dimmer (parallax)
  float phase2 = -a * max(arms - 1.0, 1.0) / TAU + log(r) * (twist * 0.7) - flow * 0.45;
  float glowB;
  float arm2 = spiralArm(phase2, 0.07, glowB);

  vec3 color = vec3(0.0);
  color += uColor1 * arm * depth;
  color += uColor2 * glowA * glowA * 0.30 * depth;
  color += uColor3 * arm2 * 0.45 * depth;

  // pulse travelling inward on the beat phase
  float ring = abs(fract(r * 2.2 + uBeatPhase) - 0.5);
  color += mix(uColor2, uColor3, 0.5) * smoothstep(0.06, 0.0, ring) * uBeat * 0.5 * depth;

  // core: bright but bounded, breathing with the kick
  float core = 0.012 / (r * r + 0.012);
  color += mix(uColor1, vec3(1.0), 0.35) * min(core, 3.0) * (0.35 + uBass * 0.5 + uBassHit * 0.4);

  color *= 1.0 + uBassHit * 0.35;
  color = min(color, vec3(1.6));
  gl_FragColor = vec4(color, 1.0);
}

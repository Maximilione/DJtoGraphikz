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
uniform float size;
uniform float threshold;

varying vec2 vUv;

#define PI 3.14159265359

float hash1(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  // short-side normalisation: balls keep their size on a portrait output.
  // ext = half extent of the visible frame in these units; the orbits are
  // stretched to it so a 6:1 strip is not a cluster in the middle of black
  // and a portrait wall does not lose half the balls past the edges
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y);
  vec2 ext = vec2(max(aspect, 1.0), max(1.0 / aspect, 1.0)) * 0.5;
  float t = uTime;

  float field = 0.0;
  vec3 colorWeight = vec3(0.0);
  float totalWeight = 0.0;
  vec2 grad = vec2(0.0);   // -0.5 * grad(field): outward slope for fake 3D shading

  // 8 metaballs with audio-reactive movement
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= count) break;
    float speed = 0.5 + hash1(fi * 7.0) * 0.5;
    float phase = hash1(fi * 13.0) * PI * 2.0;

    // Orbit with audio influence, in units of the half frame: orbit + wobble
    // never pass 1, so no ball leaves the picture (the old radii reached
    // 0.9 on a half height of 0.5 and the loud frames were mostly empty)
    float orbitR = 0.3 + hash1(fi * 17.0) * 0.45 + uBass * 0.15;
    float angle = t * speed + phase + uMid * sin(t + fi);

    vec2 pos = vec2(
      cos(angle) * orbitR + sin(t * 0.3 + fi) * 0.1,
      sin(angle * 1.3 + phase) * orbitR + cos(t * 0.4 + fi) * 0.1
    );

    // Beat: balls expand outward
    pos *= (0.88 + uBeat * 0.08) * ext;

    // Ball radius varies with audio
    float radius = size + hash1(fi * 23.0) * 0.04 + uEnergy * 0.03;

    float d = length(uv - pos);
    float contribution = radius * radius / (d * d + 0.001);
    field += contribution;
    grad += contribution * contribution / (radius * radius) * (uv - pos);

    // Track which color each ball contributes
    vec3 ballColor;
    int ci = int(mod(fi, 3.0));
    if (ci == 0) ballColor = uColor1;
    else if (ci == 1) ballColor = uColor2;
    else ballColor = uColor3;

    // squared weight: the nearest ball owns the colour (linear mixing went grey)
    float cw = contribution * contribution;
    colorWeight += ballColor * cw;
    totalWeight += cw;
  }

  // Threshold for metaball surface comes from the uniform
  vec3 color = vec3(0.0);

  if (totalWeight > 0.0) {
    vec3 baseColor = colorWeight / totalWeight;

    // Sharp metaball edge
    float edge = smoothstep(threshold - 0.1, threshold + 0.1, field);

    // Neon glow around the edge
    // halo outside, thin rim inside
    float glow = exp(-abs(field - threshold) * (field > threshold ? 14.0 : 5.0));

    // Interior pattern on log(field): the field grows as 1/d², a linear phase
    // in it packs rings ever tighter towards the centre and shimmers (aliasing)
    float interior = sin(log(1.0 + field) * 6.0 - t * 2.0) * 0.5 + 0.5;

    // dome height h = f/(1+f): slope grad/(1+f)^2 stays bounded at the ball
    // centres (raw 1/d^2 gradient pinched a spike there)
    vec3 n = normalize(vec3(grad * 0.5 / ((1.0 + field) * (1.0 + field)), 1.0));
    float dif = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
    float spec = pow(max(dot(n, normalize(vec3(-0.3, 0.45, 0.85))), 0.0), 40.0);
    float fres = pow(1.0 - n.z, 2.0);

    color = baseColor * edge * dif * (0.6 + interior * 0.4)
          + vec3(1.0) * spec * edge * (0.5 + uHigh)
          + baseColor * fres * edge * 0.8;
    color += baseColor * glow * 1.25;
    // wide aura of the nearest ball's colour: the space between them is lit, not void
    color += baseColor * min(field / threshold, 1.0) * 0.16 * (1.0 - edge);

    // Extra brightness on beat
    color *= 1.0 + uBeat * 0.6;
  }

  // Background glow
  color += mix(uColor1, uColor3, 0.5) * 0.02 * uEnergy;

  color = 1.0 - exp(-color * 1.4);
  color += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // dither: the halos do not band
  gl_FragColor = vec4(color, 1.0);
}

precision highp float;

// Crossfader between deck A and deck B: five blend modes, or a mask that
// carves B into A. With a mask the crossfader is the POSITION of the edge
// (0 = all A, 1 = all B), not the amount; uMaskSoft widens the edge.
uniform sampler2D tDeckA;
uniform sampler2D tDeckB;
uniform float uMix;        // 0 = full A, 1 = full B
uniform int uBlend;        // 0 mix, 1 add, 2 screen, 3 multiply, 4 difference
uniform int uMaskMode;     // 0 none, 1 split-v, 2 split-h, 3 radial, 4 luma, 5 audio
uniform float uMaskSoft;   // 0 hard edge .. 1 very soft
uniform vec2 uResolution;  // aspect for the radial masks
uniform float uBass;
uniform float uBeat;
varying vec2 vUv;

// B where `x` < `pos` (soft edge of half-width `w`); pos is remapped over
// [-w, 1+w] so a soft edge still reaches "all A" at 0 and "all B" at 1.
float edge(float x, float pos, float w) {
  float e = mix(-w, 1.0 + w, pos);
  return 1.0 - smoothstep(e - w, e + w, x);
}

void main() {
  vec3 a = texture2D(tDeckA, vUv).rgb;
  vec3 b = texture2D(tDeckB, vUv).rgb;

  vec3 blended;
  if (uBlend == 1) {
    blended = a + b;
  } else if (uBlend == 2) {
    blended = 1.0 - (1.0 - a) * (1.0 - b);
  } else if (uBlend == 3) {
    blended = a * b;
  } else if (uBlend == 4) {
    blended = abs(a - b);
  } else {
    blended = b;
  }

  float m = uMix;
  if (uMaskMode != 0) {
    float w = mix(0.003, 0.35, uMaskSoft);
    if (uMaskMode == 1) {
      m = edge(1.0 - vUv.x, uMix, w);                 // B enters from the right
    } else if (uMaskMode == 2) {
      m = edge(vUv.y, uMix, w);                       // B enters from the bottom
    } else if (uMaskMode == 4) {
      // luma-key: B shows where A is dark; the fader is the threshold
      float l = dot(a, vec3(0.299, 0.587, 0.114));
      m = edge(clamp(l, 0.0, 1.0), uMix, w);
    } else {
      // radial: circle from the centre, aspect-correct, normalised to the corner
      vec2 h = vec2(max(uResolution.x / max(uResolution.y, 1.0), 0.01), 1.0) * 0.5;
      float d = length((vUv - 0.5) * 2.0 * h) / length(h);
      float r = uMix;
      // audio: the circle breathes with the bass and jumps on the beat
      if (uMaskMode == 5) r = clamp(uMix * (0.7 + 0.6 * uBass) + 0.25 * uBeat, 0.0, 1.0);
      m = edge(d, r, w);
    }
  }

  gl_FragColor = vec4(mix(a, blended, m), 1.0);
}

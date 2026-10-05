precision highp float;

// Cinematic grade: S-curve, split-toning from the palette (shadows colour 3,
// highlights colour 1) and a vignette capped so corners never go black.
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor3;
varying vec2 vUv;

vec3 tintOf(vec3 c) { return c / (max(c.r, max(c.g, c.b)) + 0.05); }

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec3 c = clamp(base, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.8);               // S-curve
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 sh = tintOf(uColor3), hi = tintOf(uColor1);
  c = mix(c, c * (0.55 + sh * 0.9), (1.0 - smoothstep(0.0, 0.55, l)) * 0.7);
  c = mix(c, c * (0.6 + hi * 0.8), smoothstep(0.45, 1.0, l) * 0.6);
  vec2 d = vUv - 0.5;
  float v = 1.0 - smoothstep(0.25, 0.85, length(d * vec2(1.0, 1.15))) * (0.55 - uBeat * 0.1);
  c *= v;
  gl_FragColor = vec4(mix(base, c, uWet), 1.0);
}

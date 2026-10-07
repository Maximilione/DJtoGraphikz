precision highp float;

// Anamorphic flare: the horizontally smeared highlights (see Engine.renderBloomPost)
// tinted blue / palette and screened over the image. uWet 0 = identity.
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uWet;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor2;
varying vec2 vUv;

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec3 streak = texture2D(tBloom, vUv).rgb;
  float l = dot(streak, vec3(0.333));
  vec3 tint = mix(vec3(0.25, 0.55, 1.0), uColor2 / (max(uColor2.r, max(uColor2.g, uColor2.b)) + 0.05), 0.5);
  vec3 flare = tint * l * 3.2 * (1.0 + uEnergy * 0.4 + uBeat * 0.5) + streak * 0.5;
  vec3 wet = 1.0 - (1.0 - base) * (1.0 - clamp(flare, 0.0, 1.0));
  gl_FragColor = vec4(mix(base, wet, uWet), 1.0);
}

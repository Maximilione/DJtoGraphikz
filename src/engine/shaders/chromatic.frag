precision highp float;

uniform sampler2D tDiffuse;
uniform float uStrength;
uniform float uBass;
uniform float uBeat;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5);
  vec2 dir = vUv - center;
  float dist = length(dir);

  float strength = uStrength * (1.0 + uBass * 2.0 + uBeat * 1.5);
  vec2 offset = dir * dist * strength;

  float r = texture2D(tDiffuse, vUv + offset * 1.0).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv - offset * 1.0).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}

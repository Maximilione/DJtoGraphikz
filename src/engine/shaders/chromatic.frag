precision highp float;

uniform sampler2D tDiffuse;
uniform float uWet;
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

  // one fetch of the centre sample: it is both the green channel and the dry image
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float r = texture2D(tDiffuse, vUv + offset).r;
  float b = texture2D(tDiffuse, vUv - offset).b;
  gl_FragColor = vec4(mix(c, vec3(r, c.g, b), uWet), 1.0);
}

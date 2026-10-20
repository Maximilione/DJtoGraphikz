precision highp float;

uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uAmount;
uniform float uAngle;
uniform float uBass;
uniform float uBeat;
varying vec2 vUv;

void main() {
  float amount = uAmount * (1.0 + uBass * 3.0 + uBeat * 2.0);
  vec2 offset = vec2(cos(uAngle), sin(uAngle)) * amount;

  // one fetch of the centre sample: it is both the green channel and the dry image
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  float r = texture2D(tDiffuse, vUv + offset).r;
  float b = texture2D(tDiffuse, vUv - offset).b;
  gl_FragColor = vec4(mix(base, vec3(r, base.g, b), uWet), 1.0);
}

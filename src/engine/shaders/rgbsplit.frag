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

  float r = texture2D(tDiffuse, vUv + offset).r;
  float g = texture2D(tDiffuse, vUv).g;
  float b = texture2D(tDiffuse, vUv - offset).b;

  vec3 wet = vec3(r, g, b);
  gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, wet, uWet), 1.0);
}

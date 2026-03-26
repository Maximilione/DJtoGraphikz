precision highp float;

uniform sampler2D tDiffuse;
uniform sampler2D tPrevFrame;
uniform float uDecay;
uniform float uZoom;
uniform float uRotation;
uniform float uBass;
varying vec2 vUv;

#define PI 3.14159265359

void main() {
  vec4 current = texture2D(tDiffuse, vUv);

  // Zoom and rotate the previous frame for trail effect
  vec2 uv = vUv - 0.5;
  float zoom = 1.0 - uZoom * (1.0 + uBass * 0.02);
  float rot = uRotation * 0.01 * (1.0 + uBass);
  float c = cos(rot), s = sin(rot);
  uv = mat2(c, -s, s, c) * uv;
  uv *= zoom;
  uv += 0.5;

  vec4 prev = texture2D(tPrevFrame, uv);

  // Mix with decay
  float decay = uDecay;
  gl_FragColor = max(current, prev * decay);
}

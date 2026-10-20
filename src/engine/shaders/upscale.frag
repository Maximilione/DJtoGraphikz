precision highp float;

uniform sampler2D tBufferM;
uniform vec2 uBufferMSize;

varying vec2 vUv;

// Visible pass of an effect drawn at reduced resolution (see mandelbulb in
// EFFECT_SHADERS): the bilinear upscale of buffer M. The buffer wraps
// (REPEAT, like every simulation buffer), so the lookup stays half a texel
// inside the edges or the opposite border bleeds in.
void main() {
  vec2 h = 0.5 / uBufferMSize;
  gl_FragColor = vec4(texture2D(tBufferM, clamp(vUv, h, 1.0 - h)).rgb, 1.0);
}

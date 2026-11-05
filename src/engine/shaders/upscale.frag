precision highp float;

uniform sampler2D tBufferM;
uniform vec2 uBufferMSize;

varying vec2 vUv;

// Visible pass of an effect drawn at reduced resolution (see mandelbulb in
// EFFECT_SHADERS): the bilinear upscale of buffer M, with a light unsharp
// mask so a half-size buffer does not read as out of focus. The buffer wraps
// (REPEAT, like every simulation buffer), so every lookup stays half a texel
// inside the edges or the opposite border bleeds in.
void main() {
  vec2 h = 0.5 / uBufferMSize;
  vec2 px = 1.0 / uBufferMSize;
  vec2 uv = clamp(vUv, h, 1.0 - h);
  vec3 c = texture2D(tBufferM, uv).rgb;
  vec3 n = texture2D(tBufferM, clamp(uv + vec2(px.x, 0.0), h, 1.0 - h)).rgb
         + texture2D(tBufferM, clamp(uv - vec2(px.x, 0.0), h, 1.0 - h)).rgb
         + texture2D(tBufferM, clamp(uv + vec2(0.0, px.y), h, 1.0 - h)).rgb
         + texture2D(tBufferM, clamp(uv - vec2(0.0, px.y), h, 1.0 - h)).rgb;
  c += (c - 0.25 * n) * 0.3;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}

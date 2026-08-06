precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tOverlay;
uniform float uOpacity;
uniform vec2 uOverlayScale;
uniform vec2 uOverlayOffset;
uniform float uDisplace;   // >0: use overlay luminance as a displacement map
uniform int uFlipY;        // video textures come in flipped
varying vec2 vUv;

void main() {
  // Map UV to overlay space with scale and offset
  vec2 overlayUv = (vUv - 0.5 - uOverlayOffset) / uOverlayScale + 0.5;
  if (uFlipY == 1) overlayUv.y = 1.0 - overlayUv.y;

  bool inside = overlayUv.x >= 0.0 && overlayUv.x <= 1.0 && overlayUv.y >= 0.0 && overlayUv.y <= 1.0;

  if (uDisplace > 0.0) {
    // Displacement mode: the overlay warps the image underneath instead of covering it
    vec2 offset = vec2(0.0);
    if (inside) {
      vec4 ov = texture2D(tOverlay, overlayUv);
      float luma = dot(ov.rgb, vec3(0.2126, 0.7152, 0.0722)) - 0.5;
      // Local gradient gives a direction, luminance gives the magnitude
      float dx = dot(texture2D(tOverlay, overlayUv + vec2(0.004, 0.0)).rgb, vec3(0.333)) -
                 dot(texture2D(tOverlay, overlayUv - vec2(0.004, 0.0)).rgb, vec3(0.333));
      float dy = dot(texture2D(tOverlay, overlayUv + vec2(0.0, 0.004)).rgb, vec3(0.333)) -
                 dot(texture2D(tOverlay, overlayUv - vec2(0.0, 0.004)).rgb, vec3(0.333));
      offset = (vec2(dx, dy) + luma * 0.2) * uDisplace * ov.a;
    }
    gl_FragColor = texture2D(tDiffuse, clamp(vUv + offset, 0.0, 1.0));
    return;
  }

  vec4 base = texture2D(tDiffuse, vUv);
  if (inside) {
    vec4 overlay = texture2D(tOverlay, overlayUv);
    base.rgb = mix(base.rgb, overlay.rgb, overlay.a * uOpacity);
  }
  gl_FragColor = base;
}

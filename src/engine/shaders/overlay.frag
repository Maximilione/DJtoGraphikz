precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tOverlay;
uniform float uOpacity;
uniform vec2 uOverlayScale;
uniform vec2 uOverlayOffset;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(tDiffuse, vUv);

  // Map UV to overlay space with scale and offset
  vec2 overlayUv = (vUv - 0.5 - uOverlayOffset) / uOverlayScale + 0.5;

  // Only sample overlay within [0,1] range
  if (overlayUv.x >= 0.0 && overlayUv.x <= 1.0 && overlayUv.y >= 0.0 && overlayUv.y <= 1.0) {
    vec4 overlay = texture2D(tOverlay, overlayUv);
    base.rgb = mix(base.rgb, overlay.rgb, overlay.a * uOpacity);
  }

  gl_FragColor = base;
}

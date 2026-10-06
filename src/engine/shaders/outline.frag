precision highp float;
// Outline neon: Sobel sul frame, contorno nel colore 1 della palette,
// originale attenuato da uWet (1 = solo contorni).
uniform sampler2D tDiffuse;
uniform float uWet;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec2 uResolution;
varying vec2 vUv;

float lum(vec2 o) {
  // spessore costante a ogni risoluzione: ~1px a 540p, ~2px a 1080p
  vec2 px = o * (uResolution.y / 540.0) / uResolution;
  return dot(texture2D(tDiffuse, vUv + px).rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  float tl = lum(vec2(-1.0, 1.0)),  tc = lum(vec2(0.0, 1.0)),  tr = lum(vec2(1.0, 1.0));
  float ml = lum(vec2(-1.0, 0.0)),                              mr = lum(vec2(1.0, 0.0));
  float bl = lum(vec2(-1.0, -1.0)), bc = lum(vec2(0.0, -1.0)), br = lum(vec2(1.0, -1.0));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  // soft content (plasma, caustics) has gradients of a few percent per pixel:
  // a 0.1 floor on the Sobel found nothing and amount 1 painted the wall
  // black. Lower floor, and the original never goes below a fifth.
  float edge = smoothstep(0.02, 0.35, length(vec2(gx, gy)));
  vec3 src = texture2D(tDiffuse, vUv).rgb;
  vec3 neon = max(uColor1, vec3(0.15)) * edge * (1.2 + uBeat * 0.8);
  gl_FragColor = vec4(src * (1.0 - 0.65 * uWet) + neon * uWet, 1.0);
}

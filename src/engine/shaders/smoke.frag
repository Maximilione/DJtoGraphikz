precision highp float;

uniform sampler2D tBufferS;
uniform vec2 uBufferSSize;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying vec2 vUv;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

// Visible pass: the density field the advection wrote, shaded as a lit volume.
// The buffer is 320 rows and semi-Lagrangian advection blurs it further, so
// on its own it draws smooth blobs: a lava lamp. The grain of smoke is put
// back here at output resolution (noise that rises with the plume eats into
// the density), and the form comes from light: a relief from the gradient and
// a shadow tap toward the lamp, so the far side of a column goes dark.

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y) - 0.5;
}

float wisps(vec2 q) {
  // each octave on a rotated lattice: value noise stacked on one grid shows
  // the grid, as a checker pattern along the thin edges
  return vnoise(q * 6.0 + vec2(0.0, -uTime * 0.30)) * 0.55
       + vnoise(mat2(0.8, 0.6, -0.6, 0.8) * q * 14.0 + vec2(uTime * 0.07, -uTime * 0.48)) * 0.30
       + vnoise(mat2(0.28, 0.96, -0.96, 0.28) * q * 31.0 + vec2(-uTime * 0.70, -uTime * 0.05)) * 0.15;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 px = 1.0 / uBufferSSize;
  float aspect = uResolution.x / uResolution.y;

  float d0 = texture2D(tBufferS, uv).r;
  float dx = texture2D(tBufferS, uv + vec2(px.x, 0.0) * 2.0).r - texture2D(tBufferS, uv - vec2(px.x, 0.0) * 2.0).r;
  float dy = texture2D(tBufferS, uv + vec2(0.0, px.y) * 2.0).r - texture2D(tBufferS, uv - vec2(0.0, px.y) * 2.0).r;
  // how much smoke lies between this point and the lamp (up and to the right)
  vec2 ld = vec2(0.6 / aspect, 0.8);
  // clamped by hand: on a repeating buffer the taps above the top edge came
  // back with the vents at the bottom, and cut the plumes with a flat shadow
  float toLamp = texture2D(tBufferS, min(uv + ld * 0.035, 0.998)).r + texture2D(tBufferS, min(uv + ld * 0.09, 0.998)).r;

  // wisps: three octaves, each rising a little faster than the one below.
  // They eat the thin edges fully and the dense core only a little.
  float nz = wisps(vec2(uv.x * aspect, uv.y));
  float d = d0 * clamp(1.0 + nz * (2.4 + 0.8 * uHigh) * (1.0 - 0.6 * smoothstep(0.15, 0.7, d0)), 0.0, 2.0);

  // the slope of the density toward the lamp: falling = this side faces it
  float lit = clamp(0.5 - (dx * 0.6 + dy * 0.8) * 16.0, 0.0, 1.0);
  // densities sit around 0.2 to 0.5 in the plume, so the extinction is steep
  float shadow = exp(-toLamp * 4.2);

  float t = 1.0 - exp(-d * 4.0);
  // the palette walks across the frame, not with the density: tied to density
  // it drew a contour line of the next colour around every blob
  float hue = uv.x * 0.45 + uv.y * 0.25 + uTime * 0.02;
  vec3 body = pal3(hue) * (0.05 + 1.7 * shadow * (0.3 + 0.7 * lit)) * (1.0 + nz * 0.9);
  // forward scatter: thin smoke between the eye and the lamp glows
  body += pal3(hue + 0.33) * (1.0 - t) * shadow * 0.35;

  vec3 bg = uColor3 * (0.05 - 0.035 * uv.y);
  vec3 c = mix(bg, body, smoothstep(0.0, 0.5, t));
  // the vents burn: dense smoke low in the frame is lit from inside, and the
  // kick is what stokes it
  float ember = t * t * exp(-uv.y * 3.2);
  c += pal3(hue + 0.33) * ember * (0.12 + 0.25 * uEnergy + 0.7 * uBeat);
  c *= 1.15 + 0.25 * uEnergy;

  float vig = smoothstep(1.4, 0.3, length((uv - 0.5) * vec2(1.5, 1.0)));
  // IGN dither: smooth density gradients band badly on RGBA8
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(c * vig + (ign - 0.5) / 255.0, 1.0);
}

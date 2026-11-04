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

// Visible pass: the density field the advection wrote, shaded like smoke lit
// from the side. The relief comes from the density gradient.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 px = 1.0 / uBufferSSize;

  float d = texture2D(tBufferS, uv).r;
  float dx = texture2D(tBufferS, uv + vec2(px.x, 0.0)).r - texture2D(tBufferS, uv - vec2(px.x, 0.0)).r;
  float dy = texture2D(tBufferS, uv + vec2(0.0, px.y)).r - texture2D(tBufferS, uv - vec2(0.0, px.y)).r;

  vec3 n = normalize(vec3(-dx * 9.0, -dy * 9.0, 1.0));
  float lit = max(0.0, dot(n, normalize(vec3(0.6, 0.7, 0.45))));

  // soft saturation: the old clamp(d*2.4) hit 1 over most of the plume and
  // painted it a flat slab of color2
  float t = 1.0 - exp(-d * 2.2);
  // the plume walks the palette with density and drifts across the frame:
  // a fixed c1 → c2 ramp left it colour 1, since t seldom gets near 0.95
  float hue = t * 0.5 + uv.x * 0.45 + uv.y * 0.2 + uTime * 0.02;
  vec3 c = mix(uColor3 * 0.06, pal3(hue), smoothstep(0.02, 0.35, t));
  c *= 0.35 + 1.0 * lit;
  c += pal3(hue + 0.33) * pow(t, 3.0) * (0.3 + 0.8 * uBeat);
  c *= 1.4 + 0.4 * uEnergy;

  float vig = smoothstep(1.4, 0.3, length((uv - 0.5) * vec2(1.5, 1.0)));
  gl_FragColor = vec4(c * vig, 1.0);
}

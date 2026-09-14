precision highp float;

uniform sampler2D tBufferA;
uniform vec2 uBufferASize;
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

// Visible pass of the reaction-diffusion effect: reads the chemistry the
// simulation passes just wrote and shades it. The relief comes from the
// gradient of B — the membranes catch a light, the flats stay dark.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 px = 1.0 / uBufferASize;

  float b = texture2D(tBufferA, uv).g;
  float bx = texture2D(tBufferA, uv + vec2(px.x, 0.0)).g
           - texture2D(tBufferA, uv - vec2(px.x, 0.0)).g;
  float by = texture2D(tBufferA, uv + vec2(0.0, px.y)).g
           - texture2D(tBufferA, uv - vec2(0.0, px.y)).g;

  vec3 n = normalize(vec3(-bx * 28.0, -by * 28.0, 1.0));
  vec3 l = normalize(vec3(0.55, 0.75, 0.65));
  float diff = max(0.0, dot(n, l));
  float spec = pow(max(0.0, dot(reflect(-l, n), vec3(0.0, 0.0, 1.0))), 22.0);

  // density → palette: the empty medium takes color3, the membranes run from
  // color1 into color2 as B saturates
  // B tops out around 0.35 in the interesting regimes, so the palette has to
  // live in that range — thresholds tuned for 1.0 leave color2 unused
  float t = smoothstep(0.04, 0.22, b);
  vec3 col = mix(uColor3 * 0.10, uColor1, t);
  col = mix(col, uColor2, smoothstep(0.22, 0.34, b));

  float edge = smoothstep(0.0, 0.18, length(vec2(bx, by)) * 14.0);
  col *= 0.45 + 0.95 * diff;
  col += uColor2 * spec * (0.5 + 1.5 * uHigh) * edge;
  col += uColor1 * edge * (0.10 + 0.45 * uBeat);
  // a quiet room must still light the projector: the floor is most of it
  col *= 0.95 + 0.45 * uEnergy;

  float vig = smoothstep(1.35, 0.30, length((uv - 0.5) * vec2(1.5, 1.0)));
  gl_FragColor = vec4(col * vig, 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float density;
uniform float streak;
uniform float wind;

// Rain on black. Three layers of streaks at different sizes for depth, the
// bass drives the fall and the kick is lightning: the whole frame goes grey
// for a frame and the streaks show up all at once.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float layer(vec2 uv, float cols, float speed, float len) {
  // wind shears the columns
  uv.x += (uv.y - 0.5) * wind * 0.4;
  float col = floor(uv.x * cols);
  float f = fract(uv.x * cols);
  float seed = hash(vec2(col, floor(cols)));
  float y = fract(uv.y * 1.2 + seed * 7.0 + speed * (0.7 + 0.6 * seed));
  float drop = smoothstep(0.0, len, y) * smoothstep(len * 1.15, len * 0.98, y);
  // thin: only the middle of the column, with a soft halo so the streaks read
  // in silence (idle floor) instead of vanishing into black
  float thin = smoothstep(0.35, 0.5, f) * smoothstep(0.65, 0.5, f)
             + smoothstep(0.1, 0.5, f) * smoothstep(0.9, 0.5, f) * 0.35;
  // not every column rains at once
  float on = step(0.35, hash(vec2(col, floor(y + seed) + floor(cols))));
  return drop * thin * on;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float fall = uBassTime * 0.9 + uTime * 0.6;
  float n = max(8.0, density);
  float l = clamp(streak, 0.03, 0.6);
  float r = 0.0;
  r += layer(uv, n, fall * 1.6, l) * 1.0;
  r += layer(uv + 0.37, n * 1.7, fall * 1.1, l * 0.7) * 0.55;
  r += layer(uv + 0.71, n * 2.8, fall * 0.7, l * 0.5) * 0.3;

  vec3 col = mix(vec3(1.0), uColor1, 0.3) * r * (0.9 + 0.4 * uMid);
  // a faint sky glow at the top: the storm has a horizon even in silence
  col += uColor1 * 0.05 * smoothstep(0.4, 1.0, uv.y) * (1.0 - 0.5 * uEnergy);
  // lightning
  float bolt = pow(clamp(uBassHit, 0.0, 1.0), 6.0);
  col += (vec3(0.18) + r * 0.8) * bolt;
  // ground: a wet reflection band along the bottom
  col += uColor2 * exp(-uv.y * 25.0) * r * 0.5;
  gl_FragColor = vec4(col, 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform sampler2D uSpectrum;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float bars;
uniform float mirror;
uniform float scope;

// The analyser's own picture: log-spaced bars from uSpectrum with peak caps,
// mirrored about the centre line, and the oscilloscope trace drawn over them.
// Everything else in the app reacts to five numbers; this one shows all 512.

float barAt(float u) {
  // three taps: neighbouring bins are noisier than a bar should look
  return texture2D(uSpectrum, vec2(clamp(u - 0.006, 0.0, 1.0), 0.5)).r * 0.25
       + texture2D(uSpectrum, vec2(clamp(u, 0.0, 1.0), 0.5)).r * 0.50
       + texture2D(uSpectrum, vec2(clamp(u + 0.006, 0.0, 1.0), 0.5)).r * 0.25;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float n = max(4.0, floor(bars));

  float col = floor(uv.x * n);
  float inCell = fract(uv.x * n);
  float gap = smoothstep(0.0, 0.06, inCell) * smoothstep(1.0, 0.94, inCell);

  float u = (col + 0.5) / n;
  float h = barAt(u);
  h = pow(h, 0.75) * (0.22 + 0.85 * (0.35 + 0.65 * uEnergy));
  // An analyser with no signal is an honest black screen and a useless visual:
  // idle at a low sweep so the bars are alive between tracks.
  h = max(h, 0.10 + 0.055 * sin(u * 9.0 + uTime * 1.3) + 0.04 * sin(u * 23.0 - uTime * 0.7));

  // baseline: centred when mirrored, on the floor when not
  float base = mix(0.06, 0.5, mirror);
  float d = abs(uv.y - base) - (mirror > 0.5 ? h * 0.5 : (uv.y > base ? h : -1.0));
  float lit = (mirror > 0.5)
    ? step(abs(uv.y - base), h * 0.5)
    : step(base, uv.y) * step(uv.y, base + h);

  vec3 tint = mix(uColor1, uColor2, u);
  tint = mix(tint, uColor3, smoothstep(0.65, 1.0, u));

  float grad = 1.0 - smoothstep(0.0, 1.0, abs(uv.y - base) / max(h * 0.5, 0.001));
  vec3 c = tint * lit * gap * (0.5 + 1.0 * grad);

  // cap: a bright line at the top of each bar reads as a level meter
  float capw = 1.5 / uResolution.y;
  float cap = step(abs(abs(uv.y - base) - h * 0.5), capw) * gap;
  c += tint * cap * (1.2 + 1.5 * uBeat);

  // oscilloscope over the top
  float w = texture2D(uSpectrum, vec2(uv.x, 0.5)).g - 0.5;
  float trace = abs(uv.y - (0.5 + w * 0.7 * scope));
  c += uColor3 * scope * (1.0 - smoothstep(0.0, 3.5 / uResolution.y, trace)) * (0.6 + 0.8 * uHigh);

  // floor glow so a silent room is not a black rectangle
  c += tint * exp(-abs(uv.y - base) * 14.0) * (0.05 + 0.12 * uEnergy) * gap;

  gl_FragColor = vec4(c, 1.0);
}

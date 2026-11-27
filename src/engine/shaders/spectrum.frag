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
uniform float uLineBoost;

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
  h = min(h, 0.96);   // a loud track must not push the bar (and its cap) out of frame

  // baseline: centred when mirrored, on the floor when not
  float base = mix(0.06, 0.5, mirror);
  float lit = (mirror > 0.5)
    ? 1.0 - smoothstep(h * 0.5 - 1.5 / uResolution.y, h * 0.5, abs(uv.y - base))
    : step(base, uv.y) * (1.0 - smoothstep(base + h - 1.5 / uResolution.y, base + h, uv.y));

  // three plateaus across the band, bass to air: a straight blend of two
  // complementary colours is grey for the whole middle of the screen
  vec3 tint = mix(uColor1, uColor2, smoothstep(0.24, 0.44, u));
  tint = mix(tint, uColor3, smoothstep(0.62, 0.82, u));

  float grad = 1.0 - smoothstep(0.0, 1.0, abs(uv.y - base) / max(h * 0.5, 0.001));
  vec3 c = tint * lit * gap * (0.28 + 0.8 * grad * grad);
  // hot tip: the part of the bar that moves
  float tip = smoothstep(0.55, 1.0, abs(uv.y - base) / max(h * 0.5, 0.001));
  c += mix(tint, vec3(1.0), 0.3) * lit * gap * tip * (0.35 + 0.9 * uBeat);

  // cap: a bright line at the top of each bar reads as a level meter
  float capw = max(1.5 * (1.0 + 2.5 * uLineBoost), 1.5 + 2.0 * uLineBoost) / uResolution.y;
  float cap = step(abs(abs(uv.y - base) - h * 0.5), capw) * gap;
  c += tint * cap * (1.2 + 1.5 * uBeat);

  // oscilloscope over the top (uniform branch: no fetch when it is off)
  if (scope > 0.001) {
    float w = texture2D(uSpectrum, vec2(uv.x, 0.5)).g - 0.5;
    float trace = abs(uv.y - (0.5 + w * 0.7 * scope));
    c += uColor3 * scope * (1.0 - smoothstep(0.0, max(3.5 * (1.0 + 2.5 * uLineBoost), 3.0 + 4.0 * uLineBoost) / uResolution.y, trace)) * (0.6 + 0.8 * uHigh);
  }

  // floor glow so a silent room is not a black rectangle
  c += tint * exp(-abs(uv.y - base) * 14.0) * (0.05 + 0.12 * uEnergy) * gap;
  // glow above each tip
  float over = max(abs(uv.y - base) - h * 0.5, 0.0);
  c += tint * exp(-over * 40.0) * 0.18 * gap * (0.4 + uEnergy);

  // the room behind the bars: a soft band of the palette that swells with the
  // bass, so the frame is not bars on a black card
  float back = exp(-abs(uv.y - base) * (5.0 - 2.5 * uBass));
  c += tint * back * (0.035 + 0.11 * uBass) * (1.0 - lit * gap);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.5453) - 0.5) / 255.0;

  gl_FragColor = vec4(c, 1.0);
}

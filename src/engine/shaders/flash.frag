precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float decay;
uniform float scan;
uniform float tint;

// Blackout strobe. The frame is black; a kick paints it white for an instant
// and the afterimage decays. Between hits a single scan line crosses the dark
// once per bar, so the wall is never a dead screen — and never a bright one.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // the lamp follows the frame's shape: on a 6:1 LED strip a round vignette
  // would leave the sides black (and a negative vignette comes out of the
  // tone map white)
  vec2 c = (uv - 0.5) * vec2(1.78, 1.0);

  // the kick envelope, sharpened: a strobe is a spike, not a swell. The beat
  // clock fires a dimmer flash on its own, so silence still strobes in time.
  // The lamp may only live in the first quarter of the beat: with a kick on
  // every beat at 150 BPM the envelope alone would never let the wall go dark.
  float gate = 1.0 - smoothstep(0.15, 0.25, uBeatPhase);
  float hit = pow(clamp(uBassHit, 0.0, 1.0), decay);
  float clock = pow(1.0 - uBeatPhase, decay * 2.0) * 0.3;
  float flash = max(hit, clock) * gate;

  // vignette: a lamp in a room, not a white rectangle
  float vig = max(1.0 - dot(c, c) * 0.9, 0.0);
  vec3 lamp = mix(vec3(1.0), uColor1, tint);
  vec3 col = lamp * flash * vig;
  // the filament between flashes: the room is dark, not off
  col += lamp * vig * 0.05;

  // one scan line per bar, top to bottom
  float line = exp(-abs(uv.y - (1.0 - uBarPhase)) * 90.0) * scan;
  col += uColor2 * line * (0.5 + 0.5 * uHigh);

  // faint grain in the black: the projector is on, the room is dark
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 17.0)) * 0.015;
  gl_FragColor = vec4(col, 1.0);
}

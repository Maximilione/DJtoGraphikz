precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float slats;
uniform float open;
uniform float tilt;

// Venetian blinds with a searchlight behind them. The slats are black; what
// you see is the light in the gaps, and the gaps open on the bass and snap
// shut between beats. The lamp swings, so the bars of light walk the wall.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // the searchlight behind the window
  vec2 lamp = vec2(0.5 * sin(uTime * 0.37), 0.15 + 0.25 * sin(uTime * 0.23));
  float d = length(p - lamp);
  float light = exp(-d * d * 9.0) * 1.4 + exp(-d * 14.0) * 0.8;
  // and a dim ambient so the room exists
  light += 0.012;

  // slats: tilt turns the gap edge into a slope across the width
  float n = max(2.0, floor(slats));
  float y = uv.y * n + (uv.x - 0.5) * tilt * 2.0;
  float f = fract(y);
  // the opening: base, plus bass, minus the close between beats
  float gap = clamp(open * (0.5 + 0.7 * uBass) * (0.6 + 0.4 * (1.0 - uBeatPhase)), 0.03, 0.9);
  float aa = 1.5 * n / uResolution.y;
  float through = smoothstep(0.5 - gap * 0.5 - aa, 0.5 - gap * 0.5, f)
                * smoothstep(0.5 + gap * 0.5 + aa, 0.5 + gap * 0.5, f);
  // a highlight along the top edge of each slat where the light catches it
  float edge = exp(-abs(f - (0.5 + gap * 0.5)) * 40.0) * 0.25;

  vec3 col = mix(vec3(1.0), uColor1, 0.35) * light * through;
  col += uColor2 * light * edge;
  col += vec3(1.0) * uBassHit * through * 0.25;
  gl_FragColor = vec4(col, 1.0);
}

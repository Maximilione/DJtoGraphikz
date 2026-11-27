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
  // wide dim tail: far slats still catch faint bars, depth across the width
  light += exp(-d * 2.5) * 0.10;

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

  // a second, dimmer lamp in colour 2 swings the other way: one lamp left
  // half the wall black and the palette down to a single colour
  vec2 lampB = vec2(-0.62 * sin(uTime * 0.29 + 1.7), -0.12 + 0.24 * sin(uTime * 0.19 + 0.6));
  float dB = length(p - lampB);
  float lightB = (exp(-dB * dB * 7.0) * 0.9 + exp(-dB * 2.2) * 0.10) * (0.55 + 0.6 * uMid);

  // white-hot core, saturated colour in the falloff
  vec3 lc = mix(uColor1, vec3(1.0), smoothstep(0.35, 1.3, light));
  vec3 lcB = mix(uColor2, vec3(1.0), smoothstep(0.5, 1.4, lightB));
  vec3 beam = lc * light + lcB * lightB;
  // the room behind: a dim colour 3 dusk, lighter toward the top of the window
  vec3 room = uColor3 * (0.025 + 0.035 * uv.y);
  vec3 col = (beam + room) * through;
  col += (uColor2 * light + uColor1 * lightB) * edge * (1.0 + 1.5 * uHigh);
  col += mix(uColor3, vec3(1.0), 0.5) * uBassHit * through * (light + lightB) * 0.6;
  // haze on this side of the blinds: the light that got through glows in the
  // air in front of the slats, so it is not cut by them. Scales with the gap.
  col += (uColor1 * exp(-d * 3.2) + uColor2 * exp(-dB * 3.2) * 0.6) * gap * (0.07 + 0.10 * uBassHit);
  // IGN dither: the gaussian falloff bands into rings on 8-bit targets
  col += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}

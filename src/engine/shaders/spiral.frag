precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float arms;
uniform float twist;
uniform float pulse;

// Hypno spiral, black and white. A logarithmic spiral so the arms keep their
// width from the centre to the edge; it reverses direction every bar and the
// kick thickens the white arms for one hit.

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r = length(p);
  float a = atan(p.y, p.x);

  // direction flips on the bar, phase runs on the beat clock so it is locked
  float bar = floor(uBeatClock / 4.0);
  float dir = mod(bar, 2.0) * 2.0 - 1.0;
  float phase = uBeatClock * 1.5 * dir + uTime * 0.4;

  float s = sin(max(1.0, floor(arms)) * a - twist * log(r + 0.03) + phase);
  // white share of each arm: half, plus the kick
  float thr = -0.0 + (uBassHit * pulse) * 0.8;
  float aa = fwidth(s) * 1.2;
  float white = smoothstep(-thr - aa, -thr + aa, s);

  // black hole at the centre, hard edge
  white *= smoothstep(0.02, 0.06, r);
  // the outer ring dims so the spiral reads as a disc on black
  white *= 1.0 - smoothstep(0.55, 0.75, r);

  vec3 ink = mix(vec3(1.0), uColor1, 0.2 + 0.3 * uMid);
  vec3 col = ink * white * (0.8 + 0.3 * uBeat);
  gl_FragColor = vec4(col, 1.0);
}

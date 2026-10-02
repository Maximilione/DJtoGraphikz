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

uniform float rings;
uniform float pump;
uniform float spin;

// Sidechain pump: nested rounded squares that duck on every beat and swell
// back before the next, the way a pumped pad does. Bounce puts the bass on
// the offbeat, so the frame is loudest between kicks.

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float roundedBox(vec2 p, float b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // the pump envelope: ducked at the beat, back up at the offbeat
  float ph = fract(uBeatClock);
  float env = 1.0 - pump * exp(-ph * 6.0);
  // offbeat swell
  env += pump * 0.25 * exp(-abs(ph - 0.5) * 8.0) * (0.5 + uBass);

  p = rot(uBeatClock * 0.1 * spin + uTime * 0.05) * p;
  float n = clamp(floor(rings), 2.0, 12.0);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (float(i) >= n) break;
    float fi = float(i);
    float size = (0.06 + fi * 0.055) * env;
    float r = 0.02 + 0.01 * fi;
    float d = abs(roundedBox(rot(fi * 0.12 * spin) * p, size, r));
    float w = 0.006 + 0.004 * uEnergy;
    float line = 1.0 - smoothstep(w, w + 0.003, d);
    float glow = exp(-d * 30.0) * 0.35;
    vec3 tint = mod(fi, 3.0) == 0.0 ? uColor1 : mod(fi, 3.0) == 1.0 ? uColor2 : uColor3;
    // outer rings brighter on the kick, inner on the hats
    float level = mix(0.6 + 0.6 * uHigh, 0.6 + 0.6 * uBassHit, fi / n);
    col += tint * (line + glow) * level;
  }
  // a core that flashes on the beat
  col += mix(uColor1, vec3(1.0), 0.5) * exp(-length(p) * 40.0) * uBeat;
  gl_FragColor = vec4(col, 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float rings;
uniform float pump;
uniform float spin;

// Sidechain pump: a tunnel of neon polygons that duck on the kick and swell
// back on the offbeat. Even rings duck while odd rings swell (counter-time),
// ticks ride the rings, a shockwave leaves the centre on every kick, and each
// bar of a 4-bar phrase changes the shape (4, 4, 6, 3 sides).

#define TAU 6.2831853
#define PI 3.1415927

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// regular n-gon, signed distance (negative inside); iq
float sdPoly(vec2 p, float r, float n) {
  float a = atan(p.x, p.y) + PI;
  float sec = TAU / n;
  return cos(floor(0.5 + a / sec) * sec - a) * length(p) - r;
}

float aaBand(float d, float w) {
  float aa = fwidth(d) + 1e-4;
  return 1.0 - smoothstep(w - aa, w + aa, abs(d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // wide strips: repeat the tunnel in square-ish cells
  float cells = max(1.0, floor(aspect / 1.6));
  float cw = aspect / cells;
  float cid = floor((p.x + aspect * 0.5) / cw);
  p.x = mod(p.x + aspect * 0.5, cw) - cw * 0.5;
  float cellDir = mod(cid, 2.0) * 2.0 - 1.0;

  float ph = fract(uBeatClock);
  float bc = mod(uBeatClock, 16.0);
  float barIdx = floor(bc / 4.0);
  float sides = barIdx < 1.5 ? 4.0 : (barIdx < 2.5 ? 6.0 : 3.0);
  // portrait: keep the tunnel inside the narrow side
  float fit = min(1.0, cw * 0.9);

  // kick shockwave: space bulges outward from the centre then settles
  float kick = exp(-ph * 5.0) * (0.35 + 0.65 * uBassHit);
  float r0 = length(p);
  float shockR = (1.0 - exp(-ph * 4.0)) * 0.75;
  float shock = exp(-abs(r0 - shockR) * 28.0) * (1.0 - ph) * (0.4 + 0.6 * uBassHit);
  p *= 1.0 - 0.06 * kick * exp(-abs(r0 - shockR) * 8.0) - 0.04 * kick;

  float n = clamp(floor(rings), 2.0, 12.0);
  float spinA = spin * (0.35 * sin(TAU * uBarPhase) + 0.3 * sin(TAU * bc / 16.0));
  float aMain = spinA * cellDir;

  // dark base: faint spokes that sweep with the bar, flicker on the last bar
  float ang = atan(p.y, p.x);
  float spokes = pow(max(0.0, sin(ang * 12.0 + uBarPhase * TAU)), 12.0);
  spokes *= (0.25 + 0.75 * (barIdx > 2.5 ? uBeat : 0.3)) * exp(-r0 * 2.2);
  vec3 col = mix(uColor2, uColor1, 0.5) * spokes * 0.35;
  // soft breathing haze behind the rings
  col += uColor3 * exp(-r0 * 3.2) * (0.08 + 0.12 * uBass);

  for (int i = 0; i < 12; i++) {
    if (float(i) >= n) break;
    float fi = float(i);
    float odd = mod(fi, 2.0);
    // even rings duck on the kick, odd rings swell on it: counter-time
    float envE = 1.0 - pump * exp(-ph * 6.0);
    envE += pump * 0.25 * exp(-abs(ph - 0.5) * 8.0) * (0.5 + uBass);
    float envO = 1.0 - pump * 0.6 * exp(-abs(ph - 0.5) * 6.0) + pump * 0.3 * kick;
    float env = max(mix(envE, envO, odd), 0.15);
    float size = (0.06 + fi * 0.33 / max(n - 1.0, 1.0)) * env * fit;
    float dirI = odd * 2.0 - 1.0;
    vec2 q = rot(aMain * dirI + fi * 0.12 * spin + (odd > 0.5 ? PI / sides : 0.0)) * p;
    float d = sdPoly(q, size, sides);
    float aw = fwidth(d) + 1e-4;
    float w = 0.0035 + 0.003 * uEnergy;
    float line = aaBand(d, w);
    float hot = aaBand(d, w * 0.35);
    float glow = exp(-abs(d) * (26.0 + 10.0 * odd)) * 0.4;
    // inner side dimmer, outer side brighter: the ring reads as a lit edge
    glow *= d < 0.0 ? 0.6 : 1.0;
    vec3 tint = mod(fi, 3.0) == 0.0 ? uColor1 : mod(fi, 3.0) == 1.0 ? uColor2 : uColor3;
    float level = mix(0.6 + 0.6 * uHigh, 0.6 + 0.8 * uBassHit, fi / n);
    col += tint * (line + glow) * level + vec3(1.0) * hot * 0.35 * level;

    // ticks standing on the outside of the ring, growing with the bass
    float cnt = (barIdx > 2.5 ? 40.0 : 20.0) + 4.0 * fi;
    float a2 = atan(q.y, q.x);
    float t = sin(a2 * cnt + dirI * uBarPhase * TAU * 2.0);
    float tk = smoothstep(0.5, 0.5 + fwidth(t) * 2.0 + 0.05, t);
    float h = 0.012 + 0.03 * (uBass * 0.6 + kick * 0.6) * (0.5 + 0.5 * odd);
    float band = step(0.004, d) * (1.0 - smoothstep(h - 0.004, h, d));
    col += tint * tk * band * (0.7 + 0.6 * uHigh) * level;

    // fill of the innermost ring: slow hatch, contrast against the darkness
    if (i == 0) {
      float hatch = 0.5 + 0.5 * sin((q.x + q.y) * 90.0);
      col += tint * step(d, 0.0) * (0.12 + 0.2 * hatch * uMid);
    }
  }

  // shockwave front
  col += mix(uColor3, vec3(1.0), 0.6) * shock * 0.9;
  // a core that breathes with the bass and flashes on the beat
  float core = exp(-r0 * (36.0 - 14.0 * uBass));
  col += mix(uColor1, vec3(1.0), 0.55) * core * (0.4 + uBeat * 1.1);

  // vignette in frame units
  vec2 qv = uv - 0.5;
  col *= 1.0 - 0.7 * smoothstep(0.1, 0.55, dot(qv, qv) * 2.0);
  gl_FragColor = vec4(col, 1.0);
}

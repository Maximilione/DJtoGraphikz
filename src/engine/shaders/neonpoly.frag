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
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float sides;
uniform float layers;
uniform float thickness;

// Neon polygon: nested rotating N-gons like a vector laser show; the shape
// morphs its side count with the bar, kick expands the stack.
//
// Every layer is the same pixel rotated: rotating uv by `a` adds `a` to its
// polar angle and leaves the radius alone, so the whole stack (plus the echo)
// shares ONE atan per pixel and each N-gon costs a mod and a cos.
float ngonP(float rad, float ang, float off, float seg, float r) {
  return rad * cos(mod(ang + off, seg) - seg * 0.5) - r;
}
// wrap to [-pi, pi): reproduces atan's range, so the seam of a fractional
// side count stays where the per-layer atan used to put it
float wrapA(float a) { return a - TAU * floor((a + PI) / TAU); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  float lkb = 1.0 + 2.5 * uLineBoost;
  float lminW = (3.0 + 4.0 * uLineBoost) / uResolution.y;
  vec3 color = vec3(0.0);

  // side count morphs smoothly: blend two ngons around the target
  float nBase = sides; // sides is the anchor
  float morph = fract(t * 0.1 + uBassTime * 0.05);
  float nA = nBase, nB = nBase + 1.0;
  float segA = TAU / nA, segB = TAU / nB, offA = PI / nA, offB = PI / nB;
  float mo = smoothstep(0.3, 0.7, morph);

  float rad = length(uv);
  float ang0 = atan(uv.y, uv.x);

  for (float i = 0.0; i < 8.0; i++) {
    if (i >= layers) break;
    float k = i / max(layers - 1.0, 1.0);
    float r = (0.15 + k * 0.62) * (1.0 + uBassHit * 0.2 + uBass * 0.06);
    float ang = wrapA(ang0 + t * (0.2 + k * 0.5) * (mod(i, 2.0) < 1.0 ? 1.0 : -1.0));

    // mo depends on uniforms only: a uniform branch, fwidth(d) stays valid
    float d;
    if (mo <= 0.0) d = ngonP(rad, ang, offA, segA, r);
    else if (mo >= 1.0) d = ngonP(rad, ang, offB, segB, r);
    else d = mix(ngonP(rad, ang, offA, segA, r), ngonP(rad, ang, offB, segB, r), mo);

    float w = max(thickness * (0.5 + uMid * 0.8) * 0.01 * lkb, lminW) + fwidth(d);
    float line = smoothstep(w, 0.0, abs(d));
    // neon: bright core + wide soft glow
    float glow = 0.005 * (1.0 + uLineBoost) / (abs(d) + 0.012) + 0.0009 / (abs(d) * abs(d) * 30.0 + 0.004);

    vec3 c = mix(uColor1, uColor2, k);
    c = mix(c, uColor3, step(0.5, fract(i * 0.5 + uHighTime * 1.5)) * 0.4);
    color += c * (line * (1.1 + uBassHit * 0.8) + glow * (0.7 + uBass * 0.5)) * (1.0 - k * 0.35);
  }

  // kick echo: a ghost polygon is thrown outward and fades
  {
    float er = 0.2 + (1.0 - uBassHit) * 0.85;
    float de = ngonP(rad, wrapA(ang0 + t * 0.3), offA, segA, er);
    color += mix(uColor3, uColor1, 0.5) * (smoothstep(max(0.012 * lkb, lminW), 0.0, abs(de)) * 1.2 + 0.006 / (abs(de) + 0.015)) * uBassHit;
  }

  // depth: faint radial rays and a breathing haze behind the stack
  float rb = 0.5 + 0.5 * sin(ang0 * nA * 2.0 + t * 0.4);
  float rb2 = rb * rb;
  float rays = rb2 * rb2 * rb2;
  color += mix(uColor2, uColor3, 0.5) * rays * exp(-rad * 2.2) * (0.08 + uEnergy * 0.12);
  color += uColor1 * exp(-rad * 3.0) * (0.05 + uBass * 0.15);
  color += uColor2 * 0.02;

  // vertex sparks on the outer ring (radius 0.77). The vertices step round
  // the ring by TAU/nA, so one cos/sin pair rotated by a constant matrix
  // replaces a trig pair per vertex; |uv - 0.77 cs|^2 expands to
  // dot(uv,uv) + 0.77^2 - 2*0.77*dot(uv, cs), no sqrt.
  vec3 sparkC = mix(uColor3, vec3(1.0), 0.4) * (0.0008 * (0.25 + uHighHit * 1.2));
  float uu = dot(uv, uv) + 0.5929;
  vec2 cs = vec2(cos(t * 0.2), sin(t * 0.2));
  vec2 st = vec2(cos(TAU / nA), sin(TAU / nA));
  for (float v = 0.0; v < 9.0; v++) {
    if (v >= nA) break;
    color += sparkC / (uu - 1.54 * dot(uv, cs) + 0.001);
    cs = vec2(cs.x * st.x - cs.y * st.y, cs.x * st.y + cs.y * st.x);
  }

  color *= 1.0 + uBeat * 0.3;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

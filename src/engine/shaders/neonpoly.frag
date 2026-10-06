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

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float sides;
uniform float layers;
uniform float thickness;

// Neon polygon: nested rotating N-gons like a vector laser show; the shape
// morphs its side count with the bar, kick expands the stack.
float ngon(vec2 p, float n, float r) {
  float a = atan(p.y, p.x) + PI / n;
  float seg = TAU / n;
  a = mod(a, seg) - seg * 0.5;
  return length(p) * cos(a) - r;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  float lkb = 1.0 + 2.5 * uLineBoost;
  float lminW = (3.0 + 4.0 * uLineBoost) / uResolution.y;
  vec3 color = vec3(0.0);

  // side count morphs smoothly: blend two ngons around the target
  float nBase = sides + sin(uBarPhase * TAU) * 0.0; // sides is the anchor
  float morph = fract(t * 0.1 + uBassTime * 0.05);
  float nA = nBase, nB = nBase + 1.0;

  for (float i = 0.0; i < 8.0; i++) {
    if (i >= layers) break;
    float k = i / max(layers - 1.0, 1.0);
    float r = (0.15 + k * 0.62) * (1.0 + uBassHit * 0.2 + uBass * 0.06);
    vec2 p = uv * rot(t * (0.2 + k * 0.5) * (mod(i, 2.0) < 1.0 ? 1.0 : -1.0));

    float dA = ngon(p, nA, r);
    float dB = ngon(p, nB, r);
    float d = mix(dA, dB, smoothstep(0.3, 0.7, morph));

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
    float de = ngon(uv * rot(t * 0.3), nA, er);
    color += mix(uColor3, uColor1, 0.5) * (smoothstep(max(0.012 * lkb, lminW), 0.0, abs(de)) * 1.2 + 0.006 / (abs(de) + 0.015)) * uBassHit;
  }

  // depth: faint radial rays and a breathing haze behind the stack
  float rad = length(uv);
  float ang0 = atan(uv.y, uv.x);
  float rays = pow(0.5 + 0.5 * sin(ang0 * nA * 2.0 + t * 0.4), 6.0);
  color += mix(uColor2, uColor3, 0.5) * rays * exp(-rad * 2.2) * (0.08 + uEnergy * 0.12);
  color += uColor1 * exp(-rad * 3.0) * (0.05 + uBass * 0.15);
  color += uColor2 * 0.02;

  // vertex sparks on the outer ring
  float n = nA;
  for (float v = 0.0; v < 9.0; v++) {
    if (v >= n) break;
    float ang = v * TAU / n + t * 0.2;
    vec2 vp = vec2(cos(ang), sin(ang)) * 0.77;
    float d = length(uv - vp);
    color += mix(uColor3, vec3(1.0), 0.4) * (0.0008 / (d * d + 0.001)) * (0.25 + uHighHit * 1.2);
  }

  color *= 1.0 + uBeat * 0.3;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

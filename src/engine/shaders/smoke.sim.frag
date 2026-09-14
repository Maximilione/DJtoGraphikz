precision highp float;

uniform sampler2D tBufferS;
uniform vec2 uBufferSSize;
uniform vec2 uResolution;
uniform float uFrame;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBassHit;
uniform float uHighHit;
uniform float uBeatClock;
uniform sampler2D uSpectrum;

uniform float rise;
uniform float swirl;
uniform float dissipate;

varying vec2 vUv;

// Semi-Lagrangian advection: every texel asks where its smoke WAS one step ago
// and copies from there. Backwards, not forwards — pushing density forward
// needs scatter, which a fragment shader cannot do. The velocity field is
// buoyancy plus curl noise; the kick injects at the bottom.

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i.xy + i.z * 57.0), hash(i.xy + vec2(1.0, 0.0) + i.z * 57.0), f.x);
  float b = mix(hash(i.xy + vec2(0.0, 1.0) + i.z * 57.0), hash(i.xy + vec2(1.0) + i.z * 57.0), f.x);
  float c = mix(hash(i.xy + (i.z + 1.0) * 57.0), hash(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 57.0), f.x);
  float d = mix(hash(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 57.0), hash(i.xy + vec2(1.0) + (i.z + 1.0) * 57.0), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) - 0.5;
}

vec2 curl(vec2 p, float t) {
  float e = 0.11;
  float n1 = vnoise(vec3(p + vec2(0.0, e), t));
  float n2 = vnoise(vec3(p - vec2(0.0, e), t));
  float n3 = vnoise(vec3(p + vec2(e, 0.0), t));
  float n4 = vnoise(vec3(p - vec2(e, 0.0), t));
  return vec2(n1 - n2, n4 - n3) / (2.0 * e);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uBufferSSize;
  float aspect = uBufferSSize.x / uBufferSSize.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  if (uFrame < 2.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  float d = texture2D(tBufferS, uv).r;

  // velocity: buoyancy up, stronger where the smoke is already dense, plus a
  // curl field that gives the plume its curling edges
  vec2 vel = vec2(0.0, (0.45 + 1.3 * rise) * (0.35 + d));
  float tw = uTime * 0.25 + uBeatClock * 0.05;
  // two octaves: one octave gives smooth arcs that read as comets, not smoke —
  // the small scale is what makes the edges curl and break up
  vel += curl(p * 2.3, tw) * swirl * (0.5 + 0.9 * uEnergy);
  vel += curl(p * 6.1 + 13.0, tw * 1.9) * swirl * 0.85 * (0.4 + 0.8 * uHigh);
  vel.x += sin(uv.y * 7.0 + uTime * 0.8) * 0.08 * swirl;

  vec2 back = uv - vel * vec2(1.0 / aspect, 1.0) * 0.0085;
  float moved = texture2D(tBufferS, clamp(back, 0.002, 0.998)).r;

  // dissipation, and a little extra near the top so the plume has an end
  float loss = 0.986 - dissipate * 0.05 - smoothstep(0.75, 1.0, uv.y) * 0.05;
  float next = moved * loss;

  // injection: three vents along the floor, each fed by its own spectrum band
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float band = 0.12 + fi * 0.3;
    float spec = texture2D(uSpectrum, vec2(band, 0.5)).r;
    float x = (fi - 1.0) * 0.42 + sin(uTime * 0.31 + fi * 2.1) * 0.12;
    vec2 c = vec2(x, -0.42);
    vec2 q = p - c;
    float vent = exp(-dot(q, q) / 0.0075);
    // the audio ADDS to a floor: a room with no music must still have smoke,
    // or the effect is a black rectangle until the kick lands
    next += vent * (0.55 + 0.6 * spec + 1.1 * uBassHit) * 0.16;
  }

  gl_FragColor = vec4(clamp(next, 0.0, 1.0), 0.0, 0.0, 1.0);
}

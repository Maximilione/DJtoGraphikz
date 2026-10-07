precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform float uLineBoost;

varying vec2 vUv;

uniform float rotspeed;
uniform float glow;
uniform float scale;

// Hypercube: a tesseract — an outer cube and an inner cube with corresponding
// vertices wired together — raymarched as thin metal edges in a dark, lightly
// foggy hangar. The two cubes carry independent multi-axis rotations (not a
// real 4D rotation, just two tumbles at different rates and the inner cube's
// size breathing), which is the cheap illusion of a 4D turn the brief asks
// for. Edges use Inigo Quilez's closed-form box-frame SDF for the two cubes
// (12 edges each for free, no per-edge loop) plus 8 capsules for the
// connectors; a glow halo is gathered along the march the way storm/
// beamfield gather their line glow, so edges stay visible as soft light even
// off-axis, not just where the ray lands exactly on the metal. Vertices
// pulse white/red on the beat. `uLineBoost` (global line-weight) thickens
// the edges like it does on the other wireframe effects.

mat3 rotX(float a) { float s = sin(a), c = cos(a); return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c); }
mat3 rotY(float a) { float s = sin(a), c = cos(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
mat3 rotZ(float a) { float s = sin(a), c = cos(a); return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0); }

mat3 gRout, gRin;
float gOuterS, gInnerS, gEdgeR;

vec3 cornerSign(int i) {
  if (i == 0) return vec3(-1.0, -1.0, -1.0);
  if (i == 1) return vec3(1.0, -1.0, -1.0);
  if (i == 2) return vec3(-1.0, 1.0, -1.0);
  if (i == 3) return vec3(1.0, 1.0, -1.0);
  if (i == 4) return vec3(-1.0, -1.0, 1.0);
  if (i == 5) return vec3(1.0, -1.0, 1.0);
  if (i == 6) return vec3(-1.0, 1.0, 1.0);
  return vec3(1.0, 1.0, 1.0);
}

// IQ's wireframe-box SDF: distance to the 12 edges of a box of half-size b
// without looping over them.
float sdBoxFrame(vec3 p, vec3 b, float e) {
  p = abs(p) - b;
  vec3 q = abs(p + e) - e;
  return min(min(
      length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
      length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
      length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float connectors(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 8; i++) {
    vec3 sgn = cornerSign(i);
    vec3 a = gRout * sgn * gOuterS;
    vec3 b = gRin * sgn * gInnerS;
    d = min(d, sdCapsule(p, a, b, gEdgeR * 0.9));
  }
  return d;
}

// glow contribution of the 16 vertices at p, gathered once per march step
float nodeGlowAt(vec3 p) {
  float g = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 sgn = cornerSign(i);
    vec3 a = gRout * sgn * gOuterS;
    vec3 b = gRin * sgn * gInnerS;
    float da = length(p - a);
    float db = length(p - b);
    g += 0.0035 / (da * da + 0.012) + 0.0035 / (db * db + 0.012);
  }
  return g;
}

float map(vec3 p) {
  vec3 po = transpose(gRout) * p;
  vec3 pi = transpose(gRin) * p;
  float d = sdBoxFrame(po, vec3(gOuterS), gEdgeR);
  d = min(d, sdBoxFrame(pi, vec3(gInnerS), gEdgeR * 0.85));
  d = min(d, connectors(p));
  return d;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float beat = clamp(uBeat, 0.0, 1.0);

  float rs = clamp(rotspeed, 0.05, 4.0);
  float sc = clamp(scale, 0.3, 2.5);
  float gl = clamp(glow, 0.1, 3.0);

  float t0 = uTime * rs;
  gRout = rotY(t0 * 0.37) * rotX(t0 * 0.23 + 0.6) * rotZ(t0 * 0.11);
  gRin = rotY(-t0 * 0.29 + 1.3) * rotX(t0 * 0.41) * rotZ(-t0 * 0.19 + 2.1);
  gOuterS = sc;
  gInnerS = gOuterS * (0.42 + 0.07 * sin(uTime * 0.5));
  float lb = 1.0 + 1.6 * uLineBoost;
  gEdgeR = (0.026 + 0.018 * gl) * sc * lb;

  vec3 ro = vec3(0.0, 0.0, -4.2 / sc);
  vec3 rd = normalize(vec3(uv, 1.3));
  float camA = uTime * 0.05;
  float ca = cos(camA), sa = sin(camA);
  ro.xz = vec2(ro.x * ca - ro.z * sa, ro.x * sa + ro.z * ca);
  rd.xz = vec2(rd.x * ca - rd.z * sa, rd.x * sa + rd.z * ca);

  float t = 0.0;
  float haloGlow = 0.0;
  float nodeGlow = 0.0;
  bool hit = false;
  vec3 p = ro;
  for (int i = 0; i < 72; i++) {
    p = ro + rd * t;
    float d = map(p);
    haloGlow += gEdgeR * gEdgeR * 3.0 / (d * d * 40.0 + 0.03) * 0.02 * gl;
    nodeGlow += nodeGlowAt(p) * 0.018;
    if (d < 0.0015) { hit = true; break; }
    t += clamp(d * 0.9, 0.01, 0.5);
    if (t > 14.0) break;
  }

  vec3 col = vec3(0.0);
  if (hit) {
    vec3 n = normalAt(p);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
    vec3 edgeCol = mix(uColor2, uColor1, 0.3);
    col += edgeCol * (0.5 + 0.5 * rim) * 1.2;
    col += vec3(1.0) * rim * 0.3;
  }
  vec3 haloCol = mix(uColor1, uColor3, 0.4 + 0.3 * sin(uTime * 0.3));
  col += haloCol * haloGlow;
  vec3 nodeCol = mix(uColor3, vec3(1.0), 0.5 + 0.5 * kick);
  col += nodeCol * nodeGlow * (0.6 + 1.8 * kick + 1.2 * beat);

  // dark hangar with a hint of fog, never fully flat at silence
  vec3 bg = uColor2 * 0.02 + uColor1 * 0.012 * smoothstep(1.0, -1.0, uv.y);
  col += bg;
  col += mix(uColor1, uColor2, 0.5) * 0.02;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.8, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

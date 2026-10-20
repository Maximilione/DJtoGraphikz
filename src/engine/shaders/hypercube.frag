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
// the 8 connector segments depend on uniforms only: endpoints, direction and
// 1/|ba|^2 are built once per pixel in main() instead of 2 mat3*vec3 + a
// division per corner on each of the ~75 map() and ~24 nodeGlowAt() calls
vec3 gA[8], gB[8], gBA[8];
float gInvBA2[8];

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

// 8 capsules between corresponding corners (precomputed endpoints)
float connectors(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 8; i++) {
    vec3 pa = p - gA[i];
    float h = clamp(dot(pa, gBA[i]) * gInvBA2[i], 0.0, 1.0);
    d = min(d, length(pa - gBA[i] * h));
  }
  return d - gEdgeR * 0.9;
}

// glow contribution of the 16 vertices at p, gathered once per march step
float nodeGlowAt(vec3 p) {
  float g = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 va = p - gA[i], vb = p - gB[i];
    g += 0.0035 / (dot(va, va) + 0.012) + 0.0035 / (dot(vb, vb) + 0.012);
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

// tetrahedron normal: 4 map() taps instead of 6
vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.003;
  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) +
                   k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
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
  for (int i = 0; i < 8; i++) {
    // corner i: bit 0 -> x, bit 1 -> y, bit 2 -> z
    vec3 sgn = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1)) * 2.0 - 1.0;
    gA[i] = gRout * sgn * gOuterS;
    gB[i] = gRin * sgn * gInnerS;
    gBA[i] = gB[i] - gA[i];
    gInvBA2[i] = 1.0 / dot(gBA[i], gBA[i]);   // never 0: inner <= 0.49 * outer
  }

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
    // nodeGlowAt loops the 8 corners — too costly to pay every one of the 72
    // steps for an accumulator this smooth; sample every 3rd step and scale
    // up to keep the same total contribution
    if (i % 3 == 0) nodeGlow += nodeGlowAt(p) * 0.018 * 3.0;
    if (d < 0.0015) { hit = true; break; }
    t += clamp(d * 0.9, 0.01, 0.5);
    if (t > 14.0) break;
  }

  vec3 col = vec3(0.0);
  if (hit) {
    vec3 n = normalAt(p);
    // squared by hand: pow() on a base that rounds to -1e-7 is undefined
    float e = 1.0 - max(dot(n, -rd), 0.0);
    float rim = e * e;
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

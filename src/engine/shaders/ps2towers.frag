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

varying vec2 vUv;

#define TAU 6.28318530718
#define HMAX 5.0                       // no block is ever taller: the DDA starts on this plane
#define AA 2                           // samples per pixel: block silhouettes are hard edges

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
uniform float towers;
uniform float foglevel;
uniform float orbit;

uniform float uLineBoost;

// Console boot "towers": seen from straight above, a finite grid of matte
// blue-white square blocks of different heights rises towards the camera out
// of a black void; perspective splays them outwards, a cold blue light burns
// at the bottom of the centre, two clusters of small cubes tumble above the
// field and specks of light drift between. Real 3D: grid DDA + one box per
// cell. Kick lifts and lights some blocks and feeds the core, bass-time rolls
// a slow height wave outwards, highs light the specks.

const vec3 CORE = vec3(0.5, 0.9, 0.5);  // the blue light, at the centre of the empty middle cell

// block height in a cell (0 = empty), hw = half width. Cell (0,0) is the centre of the field.
float towerH(vec2 cell, out float hw) {
  hw = 0.27 + 0.07 * hash(cell + 1.9);
  float r = length(cell);
  float R = 2.6 + towers * 0.11;                       // param = how far the field reaches
  float rf = mix(r, max(abs(cell.x), abs(cell.y)), 0.6);   // the field is a rounded square
  if (r < 0.5 || rf > R + 0.8) return 0.0;
  R += (hash(cell + 5.1) - 0.5) * 1.6;                 // ragged border
  if (rf > R || hash(cell) > 0.86) return 0.0;
  float hh = hash(cell + 7.7);
  float wave = sin(r * 0.9 - uBassTime * 1.3 - uTime * 0.25 + hash(cell + 3.3) * 2.2);
  float lift = uBassHit * 0.55 * step(0.62, hash(cell + 9.1));
  float h = 1.6 + 2.4 * hh * sqrt(hh) + 0.3 * wave + lift;
  h *= 0.35 + 0.65 * smoothstep(0.4, 3.2, r);          // crater around the core, so its light gets out
  return h * smoothstep(0.0, 1.2, R - rf);              // border blocks grow in, they do not pop
}

// DDA over the cells under the ray, slab test on each block. The camera is
// always above HMAX looking down, so rd.y < 0 and the walk is short.
// info: xy = hit offset from the block axis, z = half width, w = block height
float trace(vec3 ro, vec3 rd, out vec3 nrm, out vec4 info, out vec2 cid) {
  vec3 sd = vec3(abs(rd.x) < 1e-5 ? 1e-5 : rd.x, rd.y, abs(rd.z) < 1e-5 ? 1e-5 : rd.z);
  vec3 inv = 1.0 / sd;
  float tTop = (HMAX - ro.y) * inv.y, tEnd = -ro.y * inv.y;
  vec2 a = ro.xz + sd.xz * tTop;
  vec2 cell = floor(a);
  vec2 stp = sign(sd.xz);
  vec2 tDelta = abs(inv.xz);
  vec2 tMax = tTop + (cell + max(stp, 0.0) - a) * inv.xz;
  nrm = vec3(0.0, 1.0, 0.0); info = vec4(0.0); cid = vec2(0.0);
  for (int i = 0; i < 20; i++) {
    float hw;
    float h = towerH(cell, hw);
    if (h > 0.0) {
      vec3 c = vec3(cell.x + 0.5, 0.0, cell.y + 0.5);
      vec3 t1 = (c - vec3(hw, 0.0, hw) - ro) * inv, t2 = (c + vec3(hw, h, hw) - ro) * inv;
      vec3 tn = min(t1, t2), tf = max(t1, t2);
      float tN = max(tn.x, max(tn.y, tn.z)), tF = min(tf.x, min(tf.y, tf.z));
      if (tN < tF && tN > 0.0) {
        nrm = -sign(sd) * step(tn.yzx, tn.xyz) * step(tn.zxy, tn.xyz);
        vec3 p = ro + sd * tN;
        info = vec4(p.x - c.x, p.z - c.z, hw, h);
        cid = cell;
        return tN;
      }
    }
    if (min(tMax.x, tMax.y) > tEnd) break;
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; cell.x += stp.x; }
    else { tMax.y += tDelta.y; cell.y += stp.y; }
  }
  return -1.0;
}

mat3 tumble(float a, float b) {
  float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  return mat3(cb, 0.0, -sb, sa * sb, ca, sa * cb, ca * sb, -sa, ca * cb);
}

// a tumbling cube of half size s; returns t, world normal and the uv of the face that was hit
float cube(vec3 ro, vec3 rd, vec3 c, float s, mat3 m, out vec3 n, out vec2 fuv) {
  vec3 o = m * (ro - c), d = m * rd;
  d = mix(d, vec3(1e-5), step(abs(d), vec3(1e-5)));
  vec3 inv = 1.0 / d;
  vec3 t1 = (-s - o) * inv, t2 = (s - o) * inv;
  vec3 tn = min(t1, t2), tf = max(t1, t2);
  float tN = max(tn.x, max(tn.y, tn.z)), tF = min(tf.x, min(tf.y, tf.z));
  n = vec3(0.0); fuv = vec2(0.0);
  if (tN > tF || tN < 0.0) return -1.0;
  vec3 ax = step(tn.yzx, tn.xyz) * step(tn.zxy, tn.xyz);
  vec3 p = (o + d * tN) / s;
  fuv = ax.x > 0.5 ? p.yz : (ax.y > 0.5 ? p.zx : p.xy);
  n = (-sign(d) * ax) * m;                             // v * m = transpose(m) * v: back to world
  return tN;
}

vec3 render(vec3 ro, vec3 rd, float t, out float tHit) {
  vec3 blockC = mix(vec3(0.80, 0.83, 0.97), uColor1, 0.22);
  vec3 coreC = mix(vec3(0.16, 0.34, 1.0), uColor3, 0.45);
  float fogK = 0.35 + 0.65 * foglevel;
  float pulse = 1.0 + 0.5 * uBass + 0.9 * uBassHit;

  vec3 nrm; vec4 info; vec2 cid;
  float d = trace(ro, rd, nrm, info, cid);
  vec3 col = vec3(0.0);
  float tEnd;
  if (d > 0.0) {
    vec3 p = ro + rd * d;
    float kick = uBassHit * step(0.62, hash(cid + 9.1));
    float lit;
    if (nrm.y > 0.5) {
      // flat lit top, a thin catch-light on its rim
      float m = info.z - max(abs(info.x), abs(info.y));
      lit = 0.74 + 0.26 * hash(cid + 2.3) + 0.35 * kick;
      lit += smoothstep(0.02 + 0.03 * uLineBoost, 0.0, m) * (0.16 + 0.5 * kick);
    } else {
      // sides: two greys by orientation, falling to black towards the base
      float g = p.y / info.w;
      lit = (abs(nrm.x) > 0.5 ? 0.46 : 0.27) * (0.05 + 0.95 * g * g) * (1.0 + 0.3 * kick);
    }
    col = blockC * lit * exp(-(HMAX - p.y) * 0.16 * fogK);
    vec3 L = CORE - p;
    float d2 = dot(L, L);
    col += coreC * max(dot(nrm, L) * inversesqrt(d2), 0.0) * pulse * 1.0 / (1.0 + d2);
    tEnd = d;
  } else {
    // nothing down there: the void, with cold fog banks rolling around the field
    tEnd = (-3.0 - ro.y) / rd.y;
    vec2 g = ro.xz - rd.xz * (ro.y / rd.y);
    float cl = 0.6 * vnoise(g * 0.22 + vec2(t * 0.03, -t * 0.02)) + 0.4 * vnoise(g * 0.5 - t * 0.025);
    float R = 2.6 + towers * 0.11;
    col = coreC * cl * cl * 0.16 * fogK * smoothstep(R * 0.5, R + 4.0, length(g - 0.5));
  }

  // two clusters of small cubes tumbling above the field
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float a = t * (0.05 + 0.02 * fk) * (1.0 - 2.0 * fk) + 2.4 + 2.6 * fk;
    vec3 c = vec3(0.5 + cos(a) * (2.4 + 0.8 * fk), 6.4 - 0.3 * fk, 0.5 + sin(a) * (2.4 + 0.8 * fk));
    vec3 n; vec2 fuv;
    float tc = cube(ro, rd, c, 0.30, tumble(t * 0.23 + fk * 1.7 + uBassTime * 0.05, t * 0.17 + fk), n, fuv);
    if (tc > 0.0 && (d < 0.0 || tc < d)) {
      vec2 tile = abs(fract(fuv * 1.5 + 0.5) - 0.5);    // 3x3 small cubes per face
      float seam = smoothstep(0.40, 0.45, max(tile.x, tile.y));
      float lit = (0.10 + 0.68 * max(dot(n, vec3(0.25, 0.92, 0.30)), 0.0)) * (1.0 - 0.93 * seam);
      col = blockC * lit + coreC * max(-n.y, 0.0) * 0.22 * pulse;
      tEnd = tc; d = tc;
    }
  }

  // light of the core scattered by the haze along the ray (closed form for a point light)
  vec3 q = CORE - ro;
  float b = dot(q, rd);
  float cc = sqrt(max(dot(q, q) - b * b, 0.0) + 0.35);
  col += coreC * (atan((tEnd - b) / cc) + atan(b / cc)) / cc * exp(-cc * 0.45) * 0.24 * fogK * pulse;

  tHit = d;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // high above the field looking straight down, slowly spinning and sinking a little
  float spin = t * (0.04 + 0.08 * orbit) + uBassTime * 0.015;
  float off = 0.5 + orbit;
  vec3 ro = vec3(0.5 + off * cos(t * 0.07), 10.2 + 0.5 * sin(t * 0.11), 0.5 + off * sin(t * 0.07));
  vec3 fwd = normalize(vec3(0.5, 2.0, 0.5) - ro);
  vec3 rgt = normalize(cross(fwd, vec3(cos(spin), 0.0, sin(spin))));
  vec3 up = cross(rgt, fwd);

  vec3 color = vec3(0.0);
  float tHit = -1.0;
  for (int s = 0; s < AA; s++) {
    vec2 o = (float(s) - 0.5 * float(AA - 1)) * vec2(0.5, 0.33) / uResolution.y;
    vec3 rd = normalize((uv.x + o.x) * rgt + (uv.y + o.y) * up + 0.9 * fwd);
    color += render(ro, rd, t, tHit);
  }
  color /= float(AA);

  // specks of light drifting on slow orbits between the blocks and the camera
  vec3 speckC = mix(vec3(0.75, 0.88, 1.0), uColor2, 0.35);
  for (int m = 0; m < 14; m++) {
    float fm = float(m);
    float h1 = hash(vec2(fm, 41.0)), h2 = hash(vec2(fm, 5.0));
    float a = h1 * TAU + t * (0.06 + 0.16 * h2) * (h1 > 0.5 ? 1.0 : -1.0);
    vec3 v = vec3(0.5 + cos(a) * (0.8 + 5.2 * h2), 3.0 + 4.2 * hash(vec2(fm, 17.0)) + 0.4 * sin(t * 0.3 + fm),
                  0.5 + sin(a) * (0.8 + 5.2 * h2)) - ro;
    float z = dot(v, fwd);
    vec2 sp = 0.9 * vec2(dot(v, rgt), dot(v, up)) / z;
    float md = length(uv - sp);
    float tw = 0.7 + 0.3 * sin(t * (1.0 + h1 * 2.5) + fm) + 0.5 * uHighHit + 0.3 * uHigh;
    float hid = (tHit > 0.0 && length(v) > tHit) ? 0.0 : 1.0;   // behind a block
    color += speckC * tw * hid * 0.00011 / (z * (md * md + 0.00002 + 0.0004 / (z * z)));
  }

  // soft vignette, the kick breathes the light a little
  vec2 vq = (gl_FragCoord.xy / uResolution - 0.5) * 1.44;
  color *= smoothstep(1.7, 0.5, length(vq));
  color *= 1.0 + uBeat * 0.08;
  gl_FragColor = vec4(color, 1.0);
}

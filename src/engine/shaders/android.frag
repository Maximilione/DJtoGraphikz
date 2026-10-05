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

varying vec2 vUv;

uniform float dissolve;
uniform float panels;
uniform float glow;

// Android: a chrome humanoid bust (head, jaw, neck, shoulders, tapered torso,
// all procedural SDF, no assets) that the kick eats away. A noise threshold
// carves the body; each kick raises it and the figure reforms between hits.
// The metal reflects a studio built from the palette, a pattern of staggered
// panels with glowing seams covers the body, a visor slit burns across the
// eyes. Where the body is eaten, the cut edge glows and sparks drift upward
// (a screen-space particle layer, always present at low density). Raymarched
// once, 60 steps, inside a bounding sphere so the empty frame is free.

const float TAU = 6.2831853;

float gKick;
float gLvl;
vec3 gRotC;   // rotation (cos, sin) of the figure, shared by ray and reflections

float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h31(i), b = h31(i + vec3(1, 0, 0)), c = h31(i + vec3(0, 1, 0)), d = h31(i + vec3(1, 1, 0));
  float e = h31(i + vec3(0, 0, 1)), g = h31(i + vec3(1, 0, 1)), h = h31(i + vec3(0, 1, 1)), k = h31(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-4);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// the intact figure, +z is the face. y runs from the crown (0.95) to the cut (-1)
float body(vec3 p) {
  float head = sdEllipsoid(p - vec3(0.0, 0.62, 0.0), vec3(0.25, 0.32, 0.29));
  float jaw = sdEllipsoid(p - vec3(0.0, 0.42, 0.07), vec3(0.17, 0.2, 0.2));
  float d = smin(head, jaw, 0.08);
  float neck = sdCapsule(p, vec3(0.0, 0.3, -0.02), vec3(0.0, 0.0, -0.03), 0.105);
  d = smin(d, neck, 0.1);
  float sh = sdCapsule(p, vec3(-0.5, -0.12, -0.02), vec3(0.5, -0.12, -0.02), 0.15);
  d = smin(d, sh, 0.12);
  // the chest narrows towards the waist: scale x with height (the 0.8 keeps the field a safe step)
  vec3 q = p - vec3(0.0, -0.58, 0.0);
  q.x *= 1.0 + 0.5 * (q.y + 0.4);
  float torso = sdRoundBox(q, vec3(0.36, 0.4, 0.16), 0.08) * 0.8;
  d = smin(d, torso, 0.1);
  // a swell on the chest
  d = smin(d, sdEllipsoid(p - vec3(0.0, -0.3, 0.1), vec3(0.3, 0.2, 0.14)), 0.1);
  return d;
}

float erosion(vec3 p) { return vnoise(p * 4.0); }

float map(vec3 p) {
  float d = body(p);
  // far from the skin the carve cannot matter: skip the noise
  if (d > 0.12) return d;
  float e = erosion(p);
  return max(d, (gLvl - e) * 0.3);
}

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.003;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

vec3 rotY(vec3 v, float c, float s) { return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }

// cathedral-cold studio from the palette: dark room, soft boxes, a key and a rim
vec3 studio(vec3 r) {
  float h = r.y * 0.5 + 0.5;
  vec3 c = mix(uColor2 * 0.22, uColor1 * 0.5, h);
  float bands = smoothstep(0.78, 0.95, sin(r.y * 6.0 + uTime * 0.3 + r.x * 2.0));
  float ribs = smoothstep(0.84, 0.97, sin(atan(r.z, r.x) * 4.0 - uTime * 0.25));
  c += uColor3 * (bands + 0.7 * ribs) * 1.4;
  c += mix(uColor3, vec3(1.0), 0.5) * pow(max(dot(r, normalize(vec3(0.5, 0.8, 0.5))), 0.0), 14.0) * (2.2 + 1.5 * gKick);
  c += uColor1 * pow(max(dot(r, normalize(vec3(-0.8, 0.2, -0.5))), 0.0), 6.0) * 1.4;
  return c * (0.3 + 0.7 * smoothstep(-0.8, 0.3, r.y));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  float lvlKick = clamp(max(uBeat, uBassHit), 0.0, 1.0);
  gLvl = min(dissolve * 0.7 + 0.4 * lvlKick, 0.85);

  float ang = 0.55 * sin(uTime * 0.23 + uBassTime * 0.15);
  gRotC = vec3(cos(ang), sin(ang), 0.0);

  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv, -1.5));

  // night behind the figure: dark cold gradient, a halo that breathes with the bass
  float rr = length(uv - vec2(0.0, 0.1));
  vec3 col = uColor2 * (0.05 + 0.05 * (1.0 - uv.y))
           + uColor1 * exp(-rr * rr * 7.0) * (0.12 + 0.2 * uBass + 0.25 * gKick)
           + uColor3 * exp(-abs(uv.x) * 14.0) * 0.05 * (0.5 + uMid);

  // bounding sphere: radius 1.25 around (0,-0.02,0)
  vec3 oc = ro - vec3(0.0, -0.02, 0.0);
  float bq = dot(oc, rd);
  float disc = bq * bq - (dot(oc, oc) - 1.56);
  float ts = 0.0;
  bool hit = false;
  float t = 0.0;
  vec3 pO = vec3(0.0);
  if (disc > 0.0) {
    ts = -bq - sqrt(disc);
    t = max(ts, 0.0);
    // the figure is turned instead of the camera: ray in object space
    vec3 roO = rotY(ro, gRotC.x, -gRotC.y);
    vec3 rdO = rotY(rd, gRotC.x, -gRotC.y);
    t += hash21(gl_FragCoord.xy) * 0.01;
    for (int i = 0; i < 60; i++) {
      float d = map(roO + rdO * t);
      if (d < 0.002) { hit = true; break; }
      t += d;
      if (t > ts + 2.6) break;
    }
    if (hit) {
      pO = roO + rdO * t;
      vec3 nO = normalAt(pO);
      vec3 n = rotY(nO, gRotC.x, gRotC.y);      // back to world, for the reflections
      vec3 r = reflect(rd, n);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

      // panels: staggered bricks on the surface, seams between them
      vec2 g = vec2(pO.x * 1.0 + 0.7 * pO.z, pO.y) * panels * 3.2;
      float row = floor(g.y);
      g.x += 0.5 * mod(row, 2.0);
      vec2 cell = fract(g);
      vec2 cid = vec2(floor(g.x), row);
      float edgeD = min(min(cell.x, 1.0 - cell.x) * 0.6, min(cell.y, 1.0 - cell.y));
      float seam = 1.0 - smoothstep(0.02, 0.07, edgeD);
      float ph = hash21(cid);
      // each plate is a slightly different mirror: the studio is blurred on some
      vec3 mir = studio(r);
      vec3 rough = studio(normalize(r + (vec3(ph, hash21(cid + 3.0), hash21(cid + 7.0)) - 0.5) * 0.9));
      vec3 metal = mix(mir, rough, 0.45 * step(0.6, ph));
      vec3 surf = metal * (0.55 + 0.9 * fres) * mix(1.0, 0.25, seam);
      surf += uColor2 * 0.06;   // ambient: never a black body

      // seams carry light, a wave climbs the body with the bass
      float wave = pow(0.5 + 0.5 * sin(pO.y * 4.0 - uBassTime * 2.5 + ph * 2.0), 6.0);
      surf += uColor1 * seam * (0.25 + 1.2 * wave + 0.6 * gKick + 0.4 * uMid) * glow;

      // visor: a dark glass band across the eyes with a slit of light
      float front = smoothstep(0.05, 0.4, pO.z);
      float band = (1.0 - smoothstep(0.06, 0.09, abs(pO.y - 0.62 - 0.03 * pO.x * pO.x * 6.0))) * front
                 * (1.0 - smoothstep(0.2, 0.25, abs(pO.x)));
      float slit = (1.0 - smoothstep(0.008, 0.02, abs(pO.y - 0.62 - 0.03 * pO.x * pO.x * 6.0))) * front
                 * (1.0 - smoothstep(0.14, 0.22, abs(pO.x)));
      surf = mix(surf, surf * 0.12 + uColor2 * 0.05, band);
      surf += mix(uColor3, vec3(1.0), 0.5) * slit * (0.9 + 1.2 * uHigh + 1.0 * gKick) * (0.6 + glow);

      // the eroded edge burns
      float rim = 1.0 - smoothstep(0.0, 0.08, erosion(pO) - gLvl);
      surf += mix(uColor3, vec3(1.0), 0.3) * rim * (1.4 + 1.5 * uBass) * (0.4 + 0.6 * glow);

      col = surf;
    }
  }

  // sparks: three layers of grains rising from the eroded body. A few are
  // always alive; the level of the erosion and the kick bring the rest
  float dens = 0.07 + 0.55 * gLvl + 0.5 * lvlKick;
  float halo = exp(-dot(uv * vec2(1.0, 0.8) - vec2(0.0, 0.05), uv * vec2(1.0, 0.8) - vec2(0.0, 0.05)) * 1.6);
  vec3 sp = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 22.0 + 16.0 * fl;
    vec2 q = uv * sc;
    q.y -= uTime * (0.9 + 0.7 * fl) * (1.0 + 0.6 * uBass);
    q.x += sin(uTime * 0.5 + fl * 2.0 + q.y * 0.3) * 0.6;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash21(id + fl * 17.0);
    vec2 off = (vec2(hash21(id + 1.7), hash21(id + 4.1)) - 0.5) * 0.6;
    float live = step(h, dens * halo);
    float dd = length(f - off);
    float size = 0.07 + 0.08 * hash21(id + 9.3);
    float tw = 0.6 + 0.4 * sin(uTime * 6.0 + h * 40.0);
    sp += mix(uColor1, uColor3, hash21(id + 2.2)) * live * smoothstep(size, 0.0, dd) * tw;
  }
  col += sp * (1.0 + 0.8 * uHigh) * (0.6 + 0.5 * glow);

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.9, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

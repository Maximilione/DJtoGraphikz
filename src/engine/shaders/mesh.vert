precision highp float;

// Projects the model itself (the effect's camera is orthographic) so that the
// same vertex stage serves every look (0 wire, 1 points, 2 metal, 3 hologram,
// 4 dissolve surface, 5 dissolve dust: looks 4 and 5 are drawn together). LOOK is a define per material; the
// two looks that are not selected push their vertices out of the clip volume.
uniform float uTime;
uniform float uBass;
uniform float uBeat;
uniform float uBassHit;
uniform vec2 uResolution;
uniform float look;
uniform float spin;
uniform float burst;
uniform float dotsize;
uniform float uPointsOnly;
uniform float dissolve;

varying vec3 vN;
varying vec3 vP;
varying float vSeed;
varying vec3 vO;
varying float vLife;

float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h31(i), b = h31(i + vec3(1, 0, 0)), c = h31(i + vec3(0, 1, 0)), d = h31(i + vec3(1, 1, 0));
  float e = h31(i + vec3(0, 0, 1)), g = h31(i + vec3(1, 0, 1)), h = h31(i + vec3(0, 1, 1)), k = h31(i + vec3(1, 1, 1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

void main() {
  int lk = int(look + 0.5);
  // a point cloud has no surface: its dissolve look is the dust alone
  bool on = uPointsOnly > 0.5 ? (LOOK == (lk >= 4 ? 5 : 1))
          : (lk == LOOK || (LOOK == 5 && lk == 4));
  if (!on) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    return;
  }
  vec3 p = position;
#if LOOK == 2 || LOOK == 3 || LOOK == 4
  vec3 n = normal;
#else
  vec3 n = normalize(p + 1e-4);
#endif
  vSeed = h31(p * 7.0);

  vO = p;
  vLife = 1.0;
  // dissolve: the kick raises the erosion level, the body reforms between hits
  float kk = clamp(max(uBeat, uBassHit), 0.0, 1.0);
  float lvl = min(dissolve * 0.7 + 0.35 * kk, 0.85);
#if LOOK == 5
  float en = vn(p * 4.0);
  float gone = lvl - en;
  float idle = step(vSeed, 0.04);   // a few grains always drift, even with the body whole
  if (gone < 0.0 && idle < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    return;
  }
  float rise = gone > 0.0 ? gone : 0.12 * fract(uTime * 0.2 + vSeed * 9.0);
  float ph = fract(uTime * 0.25 + vSeed * 5.0);
  p.y += rise * (1.2 + 2.0 * ph) + 0.25 * ph * idle;
  p.xz += vec2(sin(vSeed * 40.0 + uTime), cos(vSeed * 40.0 + uTime * 0.7)) * rise * 0.5;
  vLife = (1.0 - ph) * (0.35 + 0.65 * smoothstep(0.0, 0.25, max(gone, 0.0) + idle * 0.2));
#endif
  // kick: vertices shoot out along their direction, each with its own reach
  float kick = clamp(max(uBeat, uBassHit), 0.0, 1.0);
  p += normalize(p + 1e-4) * kick * burst * 0.22 * (0.4 + vSeed);
  // bass swells the whole body
  p *= 1.0 + 0.22 * uBass + 0.1 * kick;

#if LOOK == 3
  float band = floor(p.y * 14.0 + floor(uTime * 10.0) * 3.7);
  float gl = step(0.88 - 0.35 * kk, fract(sin(band) * 43758.5));
  p.x += gl * (0.03 + 0.1 * kk) * (fract(sin(band * 7.1) * 913.1) - 0.5) * 2.0;
#endif
  float a = uTime * 0.35 * spin;
  float ca = cos(a), sa = sin(a);
  p = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  n = vec3(ca * n.x + sa * n.z, n.y, -sa * n.x + ca * n.z);
  float ct = cos(0.35), st = sin(0.35);
  p = vec3(p.x, ct * p.y - st * p.z, st * p.y + ct * p.z);
  n = vec3(n.x, ct * n.y - st * n.z, st * n.y + ct * n.z);

  vN = n;
  vP = p;
  float aspect = uResolution.x / uResolution.y;
  float w = 3.4 - p.z;
  gl_Position = vec4(p.x / aspect * 2.3, p.y * 2.3, (w - 3.4) * 0.5, w);
  gl_PointSize = max(1.0, dotsize * (uResolution.y / 1080.0) * 3.4 / w);
}

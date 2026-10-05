precision highp float;

// Projects the model itself (the effect's camera is orthographic) so that the
// same vertex stage serves the three looks. LOOK is a define per material; the
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

varying vec3 vN;
varying vec3 vP;
varying float vSeed;

float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  bool on = uPointsOnly > 0.5 ? (LOOK == 1) : (int(look + 0.5) == LOOK);
  if (!on) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    return;
  }
  vec3 p = position;
#if LOOK == 2
  vec3 n = normal;
#else
  vec3 n = normalize(p + 1e-4);
#endif
  vSeed = h31(p * 7.0);

  // kick: vertices shoot out along their direction, each with its own reach
  float kick = clamp(max(uBeat, uBassHit), 0.0, 1.0);
  p += normalize(p + 1e-4) * kick * burst * 0.22 * (0.4 + vSeed);
  // bass swells the whole body
  p *= 1.0 + 0.22 * uBass + 0.1 * kick;

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

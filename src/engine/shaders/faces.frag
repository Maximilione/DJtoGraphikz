precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uMidHit;
uniform float uHighHit;
uniform float uBassTime;
uniform float uHighTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float faces;
uniform float spin;
uniform float glow;

// Masks: one serene monumental head on a black void, between its own echoes
// drawn in light — the look of a big-stage melodic-techno show. The head is an
// idealised sculpture, not a portrait: an ovoid of glazed porcelain, brow arcs
// running into a straight nose, eyes closed, a small still mouth (procedural
// SDF, no assets). A few seams of light decorate it: the outline of the face,
// a line down the forehead and over the crown, a ring at each ear, two on the
// neck. The heads stand on a ring (polar domain repetition: one head per
// march step); only the one in front is porcelain, the others are holograms
// of the same form — a triangle mesh of light over tinted glass.
// Palette: colour 1 the seams and the left back light, colour 2 the right
// back light and the ear rings, colour 3 the hologram (mesh, scan band,
// particles). The white is ivory, the shadows are soft.
// `faces` = heads on the ring (continuous: the arc opens and closes),
// `spin` = how far the camera orbits (an amount, never a speed: a mapped
// param that multiplies a clock makes the picture jump),
// `glow` = seams, rims, hologram, scan band and particles.
// Kick: the seams open and flare, the rims and the holograms brighten. Bass:
// slow push-in. Mids / snare: the scan band brightens as it sweeps. Highs:
// the nodes of the mesh and the particles shimmer. Energy: at the peaks
// facets of the front head turn to hologram, from the back of the skull
// forward. In silence
// the carousel hands the porcelain from one head to the next every 32 beats,
// facet by facet, and the camera drifts.

const float PI = 3.14159265;
const float EYE_X = 0.275;
const vec3 L_KEY = vec3(-0.3508, 0.4511, -0.8206);   // unit vector towards the key: front, above, a little left
const vec3 K_U = vec3(0.9195, 0.0, -0.3931);         // across the key's soft box
const vec3 K_V = vec3(-0.1773, 0.8925, -0.4148);     // and up it
const vec3 L_A = vec3(-0.8533, 0.2008, 0.4819);      // back left, colour 1
const vec3 L_B = vec3(0.8533, 0.2008, 0.4819);       // back right, colour 2

float gKick, gOpen, gBreath, gR, gSec, gRing;
vec3 gC1, gC2, gC3;

float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// ellipsoid, first-order distance (f / |grad f|): good near the surface, cheap
float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = max(length(p / (r * r)), 1e-4);
  return k0 * (k0 - 1.0) / k1;
}

// same surface, one length: a looser bound, for the big shapes
float sdS(vec3 p, vec3 r, float m) { return (length(p / r) - 1.0) * m; }

float sdCap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

// distance to the nearest seam of light. The face is outlined by a leaning
// plane that cuts it off the skull (a cut in 3D stays a crisp line on the
// temples, where a front projection would smear); a line runs down the
// forehead from the hairline and on over the crown; two rings on the neck
float seamD(vec3 l) {
  float cut = l.z - 0.38 - 0.15 * l.y;
  float s = abs(cut) * 0.98;
  if (cut > 0.0) s = min(s, length(vec2(l.x, min(l.y - 0.52, 0.0))));
  else if (l.y > 0.0) s = min(s, abs(l.x));
  if (l.y < -0.98) s = min(s, min(abs(l.y + 1.06), abs(l.y + 1.16)));
  return s;
}

// the lash line of a closed eye: a shallow arc (front projection, a = |x|,y,z)
float lashD(vec3 a) {
  float x = clamp(a.x - EYE_X, -0.13, 0.13);
  return length(vec2(a.x - EYE_X - x, a.y - 0.040 - 1.3 * x * x));
}

// one head in its own frame: z forward (the face), y up
float head(vec3 l) {
  float dn = sdCap(l, vec3(0.0, -0.66, -0.12), vec3(0.0, -3.6, -0.34), 0.235, 0.32);
  float bd = length(l - vec3(0.0, 0.0, -0.08)) - 1.20;
  if (bd > 0.15) return min(bd, dn);
  vec3 a = vec3(abs(l.x), l.y, l.z);
  float d = sdS(l - vec3(0.0, 0.24, -0.10), vec3(0.60, 0.71, 0.78), 0.60);
  d = smin(d, sdS(l - vec3(0.0, -0.30, 0.10), vec3(0.50, 0.66, 0.52), 0.50), 0.30);
  d = smin(d, dn, 0.14);
  // the features only exist on the front, and only stick out so far
  if (l.z < 0.2) return d;
  // (the nose 0.33, brow and lids 0.14; never inside 0.27, where the shadow
  // and occlusion taps sample and need the true distance)
  if (a.x < 0.30 ? d > 0.40 : d > 0.27) return d - (a.x < 0.30 ? 0.33 : 0.14);
  // each group only where its smooth union can reach: the reach grows with
  // the distance from the skull, so the shadow and occlusion taps agree
  if (l.y > -0.25 - d) {
    // brow: one arc each side, running into the bridge of the nose
    float bx = a.x - 0.17;
    d = smin(d, sdEll(vec3(a.x - 0.16, l.y - 0.31 + 1.2 * bx * bx, l.z - 0.630 + 0.75 * a.x * a.x), vec3(0.17, 0.028, 0.050)), 0.10);
    // closed eyes: a shallow socket, the lid a gentle swell, the lashes a crease
    d = smax(d, -(length(a - vec3(EYE_X, 0.085, 0.84)) - 0.215), 0.12);
    d = smin(d, length(a - vec3(EYE_X, 0.070, 0.505)) - 0.100, 0.07);
    if (d < 0.03) d += 0.007 * smoothstep(0.012, 0.0, lashD(a));
  }
  if (a.x < 0.27 + d && l.y > -0.40 - d && l.y < 0.55 + d) {
    // a straight nose that leaves the forehead without a step
    float nz = sdCap(l, vec3(0.0, 0.36, 0.640), vec3(0.0, -0.17, 0.790), 0.040, 0.050);
    nz = smin(nz, sdEll(l - vec3(0.0, -0.205, 0.770), vec3(0.066, 0.042, 0.066)), 0.06);
    d = smin(d, nz, 0.13);
  }
  if (l.y < -0.12 + d) {
    d = smin(d, length(l - vec3(0.0, -0.80, 0.42)) - 0.13, 0.22);                          // chin
    // a small closed mouth, bent back into corners that lift a little
    float x2 = l.x * l.x;
    float lp = smin(sdEll(vec3(l.x, l.y + 0.470 + 0.5 * x2, l.z - 0.612 + 2.2 * x2), vec3(0.135, 0.025, 0.050)),
                    sdEll(vec3(l.x, l.y + 0.518 - 2.1 * x2, l.z - 0.608 + 2.2 * x2), vec3(0.122, 0.031, 0.054)), 0.012);
    d = smin(d, lp, 0.06);
  }
  // the seams are grooves, and the kick opens them
  if (d < 0.03) d += (0.005 + 0.016 * gOpen) * smoothstep(0.005 + 0.009 * gOpen, 0.0, seamD(l));
  return d;
}

// ring space -> frame of the nearest head; th = world angle of that head
vec3 toHead(vec3 p, out float th) {
  vec2 q = vec2(p.x, gR - p.z);
  float a = atan(q.x, q.y) - gRing;
  float c = floor(a / gSec + 0.5) * gSec;
  float la = a - c;
  float r = length(q);
  th = c + gRing;
  return vec3(r * sin(la), p.y, r * cos(la) - gR);
}

// the studio the glaze reflects: overhead softbox, horizon streak, the key's
// soft box, two strips, and the two coloured back lights
vec3 studio(vec3 r) {
  float top = smoothstep(0.30, 0.95, r.y);
  vec3 c = vec3(0.75 * top * top);
  c += vec3(0.12) * exp(-r.y * r.y * 70.0);
  vec2 kb = vec2(dot(r, K_U), dot(r, K_V));
  c += vec3(5.0) * exp(-kb.x * kb.x * 14.0 - kb.y * kb.y * 30.0) * step(0.0, dot(r, L_KEY));
  c += vec3(1.5) * pow(max(abs(r.x) * 0.80 - r.z * 0.60, 0.0), 40.0);
  c += gC1 * pow(max(dot(r, L_A), 0.0), 24.0) * 1.5;
  c += gC2 * pow(max(dot(r, L_B), 0.0), 24.0) * 1.5;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gOpen = gKick * gKick;
  gBreath = 0.5 + 0.5 * sin(uTime * 0.4);
  gC1 = uColor1;
  gC2 = uColor2;
  gC3 = uColor3;
  float g = glow;
  float N = clamp(faces, 5.0, 14.0);
  gSec = 2.0 * PI / N;
  gR = 1.25 / sin(PI / N);
  // the carousel advances one head every 32 beats and wraps: the heads are
  // identical, so the angle never accumulates and `faces` can move freely
  float cyc = fract(uBeatClock / 32.0 + uTime * 0.005);
  gRing = gSec * smoothstep(0.55, 1.0, cyc);

  float yaw = spin * 0.16 * sin(uTime * 0.07 + 1.0);
  float D = 6.0 + 0.14 * (N - 6.0) - 0.25 * sin(uBassTime * 0.25) - 0.08 * uBass;
  vec3 ta = vec3(0.0, -0.10, 0.0);
  vec3 ro = vec3(sin(yaw) * D, -0.70 + 0.18 * sin(uTime * 0.06), -cos(yaw) * D);
  vec3 fwd = normalize(ta - ro);
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, rgt);
  vec3 rd = normalize(fwd * 2.2 + rgt * uv.x + up * uv.y);

  // black void, a breath of the two back lights behind the heads
  vec3 col = gC1 * exp(-dot(uv + vec2(0.62, 0.0), uv + vec2(0.62, 0.0)) * 1.8) * 0.045
           + gC2 * exp(-dot(uv - vec2(0.62, 0.0), uv - vec2(0.62, 0.0)) * 1.8) * 0.045;
  col *= g * (0.6 + 0.4 * gBreath + 1.0 * gKick);

  // bounds: the cylinder that holds the ring, and a far plane that drops the
  // heads on the far side
  vec2 oc = ro.xz - vec2(0.0, gR);
  float ca = dot(rd.xz, rd.xz), cb = dot(oc, rd.xz), cc = dot(oc, oc) - (gR + 1.3) * (gR + 1.3);
  float disc = cb * cb - ca * cc;
  float tMax = (1.34 * gR - ro.z) / rd.z;
  float t = disc > 0.0 ? max((-cb - sqrt(disc)) / ca, 0.0) : tMax + 1.0;
  if (ro.y + rd.y * t > 1.3 && rd.y > 0.0) t = tMax + 1.0;

  bool hit = false;
  vec3 l = vec3(0.0);
  float th = 0.0;
  for (int i = 0; i < 80; i++) {
    if (t > tMax) break;
    l = toHead(ro + rd * t, th);
    float d = head(l);
    if (d < 0.002 + 0.0005 * t) { hit = true; break; }
    t += d * 0.9;
  }

  // only the echoes next to the front head show: the ones further round the
  // ring fade to nothing
  float near = 1.0 - smoothstep(0.9, 1.5, abs(th));
  if (hit && near > 0.0) {
    vec3 p = ro + rd * t;
    float cs = cos(th), sn = sin(th);
    // world <-> head frame is a reflection about the ring: the same matrix both ways
    vec3 vl = vec3(-rd.x * cs - rd.z * sn, -rd.y, -rd.x * sn + rd.z * cs);
    vec3 lk = vec3(L_KEY.x * cs + L_KEY.z * sn, L_KEY.y, L_KEY.x * sn - L_KEY.z * cs);
    vec3 a3 = vec3(abs(l.x), l.yz);

    vec2 k = vec2(1.0, -1.0);
    const float e = 0.003;
    vec3 nl = normalize(k.xyy * head(l + k.xyy * e) + k.yyx * head(l + k.yyx * e) +
                        k.yxy * head(l + k.yxy * e) + k.xxx * head(l + k.xxx * e));
    vec3 n = vec3(nl.x * cs + nl.z * sn, nl.y, nl.x * sn - nl.z * cs);
    float ndv = max(dot(nl, vl), 0.0);
    float fr = pow(1.0 - ndv, 3.0);
    float ra = max(dot(n, L_A), 0.0), rb = max(dot(n, L_B), 0.0);
    float rimI = g * (1.0 + 0.3 * gBreath + 1.4 * gKick);

    // the mesh: 28 cells round the head, each split in two triangles. A facet
    // is porcelain or hologram as a whole: its turn comes with how far the head
    // is from the front and, at the peaks, how far back on the skull it sits,
    // in an order of its own
    vec2 fu = vec2(atan(l.x, l.z + 0.10) * (14.0 / PI), l.y * 5.5);
    vec2 ci = floor(fu), f = fu - ci;
    float tri = step(1.0, f.x + f.y);
    float hh = hash12(ci + tri * 37.0);
    float back = 0.5 - 0.5 * cos((ci.x + 0.5) * (PI / 14.0));
    float away = smoothstep(0.12, 0.80, abs(th) / gSec);
    float m = away * 1.3 + back * smoothstep(0.55, 1.0, uEnergy) * 1.3 + (hh - 0.5) * 0.5 - 0.5;
    float holo = smoothstep(-0.04, 0.04, m);

    vec3 surf = vec3(0.0);
    if (holo < 1.0) {
      // porcelain: a soft ivory key, a fill that keeps the shadows open, two
      // coloured rims, a glaze
      float ao = clamp(0.45 + 0.55 * head(l + nl * 0.14) / 0.14, 0.0, 1.0);
      float ndl = dot(nl, lk);
      float sh = smoothstep(0.0, 1.0, head(l + nl * 0.02 + lk * 0.22) / (0.22 * max(ndl, 0.0) + 0.045));
      float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      float dif = pow(clamp(ndl * 0.70 + 0.30, 0.0, 1.0), 1.4) * (0.55 + 0.45 * sh);
      surf = 0.90 * (vec3(1.0, 0.972, 0.935) * dif * 1.25 + vec3(0.085) * ao * (0.6 + 0.4 * n.y));
      surf += 0.90 * gC1 * ra * ra * (0.08 + 2.0 * fr) * rimI * ao;
      surf += 0.90 * gC2 * rb * rb * (0.08 + 2.0 * fr) * rimI * ao;
      surf += studio(reflect(rd, n)) * F * ao * (0.4 + 0.6 * sh);
      surf += vec3(0.05) * pow(max(dot(nl, normalize(lk + vl)), 0.0), 14.0) * sh;
      // the lashes of the closed eyes
      surf *= 1.0 - 0.55 * smoothstep(0.012, 0.004, lashD(a3)) * step(0.3, l.z);
      // the seams: a groove with light in it and a glow on the glaze around,
      // and the kick turns them up
      float sd = seamD(l);
      float w = 0.005 + 0.009 * gOpen;
      surf *= 1.0 - 0.5 * smoothstep(w * 2.2, w * 0.7, sd);
      surf += mix(gC1, vec3(1.0), 0.3 * gOpen) * g
            * (smoothstep(w * 1.3, 0.0, sd) * (1.5 + 0.4 * gBreath + 3.0 * gOpen) + exp(-sd * sd * 500.0) * (0.14 + 0.5 * gOpen));
      // a ring of light inlaid at each ear
      float er = abs(length(l.yz - vec2(-0.02, -0.16)) - 0.095);
      surf += gC2 * smoothstep(0.012, 0.003, er) * step(0.38, a3.x) * g * (0.7 + 2.0 * gKick);
      surf *= smoothstep(-2.6, -1.2, l.y);
    }
    if (holo > 0.0) {
      // hologram: the mesh in light over tinted glass, a node at each vertex
      float ed = min(min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), abs(f.x + f.y - 1.0) * 0.7071);
      float line = smoothstep(0.04, 0.010, ed);
      vec2 fv = min(f, 1.0 - f);
      float node = smoothstep(0.10, 0.03, length(fv));
      float tw = 0.5 + 0.5 * sin(uHighTime * 7.0 + uTime * 0.9 + hash12(floor(fu + 0.5)) * 40.0);
      vec3 hol = gC3 * (line * (1.0 + 0.8 * gKick) + 0.16 + 0.55 * (1.0 - away) + 0.55 * fr
                      + node * (0.6 + tw * (0.8 + 1.6 * uHigh + 1.0 * uHighHit)));
      hol += (gC1 * ra * ra + gC2 * rb * rb) * fr * 0.5;
      // a facet lights up as it turns
      hol += gC3 * (1.0 - abs(2.0 * holo - 1.0)) * 0.6;
      surf = mix(surf, hol * g * near * smoothstep(-2.6, -1.2, l.y), holo);
    }

    // holographic scan band, sweeping the heads from the neck to the crown
    float by = p.y + 0.25 - 1.3 * sin(uBeatClock * PI / 16.0);
    float sI = g * (0.25 + 0.6 * uMid + 1.5 * uMidHit);
    float lines = smoothstep(0.25, 0.5, abs(fract(uv.y * 180.0) - 0.5));
    surf = mix(surf, gC3 * (lines * 0.35 + fr * 0.9) + surf * 0.5, exp(-by * by * 40.0) * clamp(0.45 * sI, 0.0, 0.7));
    surf += gC3 * exp(-by * by * 5000.0) * 1.6 * sI;

    // depth: the heads sink into the void as they recede
    surf *= exp(-max(p.z, 0.0) * 0.18);
    col = surf;
  }

  // particles of light adrift in the void, rising
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 dp = uv * (22.0 + 16.0 * fi) + vec2(uTime * 0.02 * (1.0 + fi), -uTime * (0.06 + 0.04 * fi));
    vec2 di = floor(dp);
    float dh = hash12(di + fi * 19.0);
    if (dh > 0.95) {
      vec2 df = fract(dp) - 0.5 - (vec2(hash12(di + 3.1), hash12(di + 7.7)) - 0.5) * 0.6;
      float tw = 0.5 + 0.5 * sin(uHighTime * 7.0 + uTime * 1.1 + dh * 90.0);
      col += mix(gC3, gC1, step(0.975, dh)) * exp(-dot(df, df) * 220.0)
           * (0.05 + tw * (0.10 + 0.5 * uHigh + 0.3 * uHighHit)) * g * (hit && near > 0.0 ? 0.25 : 1.0);
    }
  }

  // the app shows this as it is and blooms what is above mid grey: the shoulder
  // keeps the porcelain under it, only lights and reflections go over
  col = 1.0 - exp(-col * 0.92);
  col *= clamp(1.2 - dot(uv, uv) * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

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

// Masks: a carousel of monumental android heads on a black void, the look of
// a big-stage melodic-techno show. One procedural SDF head (skull, brow,
// cheekbones, nose, lips, lidded eyes, neck: no assets) repeated on a ring by
// polar domain repetition, so each march step evaluates a single head. The
// skin is glazed white porcelain cut into panels by thin seams, neck and ear
// hubs are dark liquid chrome, the eyes dark glass with a ring of light; all
// of it reflects an analytic studio (a soft box, two strips, a horizon).
// Whites are neutral; the palette is three roles: colour 1 the light inside
// (eyes, seams) and the left back light, colour 2 the right back light and
// the ear hubs, colour 3 the hologram (scan band, dissolve, particles).
// The head in front is whole; the ones receding along the ring break up into
// blocks, particles and wireframe (noise threshold).
// `faces` = heads on the ring (continuous: the arc opens and closes),
// `spin` = how far the camera orbits (an amount, never a speed: a mapped
// param that multiplies a clock makes the picture jump),
// `glow` = eyes, seams, rims, scan band and particles.
// Kick: the seams open and light up, eyes and rims flare. Bass: slow
// push-in. Mids / snare: the holographic scan band brightens as it sweeps.
// Highs: the particles shimmer. Energy: more of each head dissolves. In
// silence the carousel keeps turning one head every 16 beats, the heads nod,
// the scan band and the dissolve keep moving.

const float PI = 3.14159265;
const vec3 EYE = vec3(0.285, 0.04, 0.49);
const float EYE_R = 0.12;
const vec3 L_KEY = vec3(-0.1197, 0.4989, -0.8583);   // unit vector towards the key: front and above, a touch left
const vec3 K_U = vec3(0.9904, 0.0603, -0.1031);      // across the key's soft box
const vec3 K_V = vec3(0.0, 0.8646, 0.5025);          // and up it
const vec3 L_A = vec3(-0.8533, 0.2008, 0.4819);      // back left, colour 1
const vec3 L_B = vec3(0.8533, 0.2008, 0.4819);       // back right, colour 2

float gKick, gOpen, gBreath, gR, gSec, gRing;
vec3 gC1, gC2, gC3;   // inner light (eyes, seams) / the two back lights / the hologram

float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash13(vec3 p) { return fract(sin(dot(p, vec3(113.5, 271.9, 124.6))) * 43758.5453); }

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

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

// distance to the nearest seam between the porcelain panels. The face is a
// shell cut off the skull by a leaning plane (a cut in 3D stays a crisp line
// on the temples, where a front projection would smear); in front of it the
// jaw pieces and the chin, behind it the split over the crown
float seamD(vec3 l) {
  float ax = abs(l.x);
  float cut = l.z - 0.10 - 0.22 * l.y;
  float s = abs(cut) * 0.97;
  if (cut > 0.0) {
    float t = clamp((-0.05 - l.y) / 0.88, 0.0, 1.0);
    float cx = mix(0.47, 0.20, t * t * (1.7 - 0.7 * t));
    if (l.y < -0.05) s = min(s, abs(ax - cx));
    if (ax < cx) s = min(s, abs(l.y + 0.745 + 0.6 * l.x * l.x));
  } else if (l.y > 0.0) {
    s = min(s, ax);
  }
  return s;
}

// one head in its own frame: z forward (the face), y up
float head(vec3 l) {
  float dn = sdCap(l, vec3(0.0, -0.70, -0.14), vec3(0.0, -3.6, -0.30), 0.27, 0.34);
  float bd = length(l - vec3(0.0, 0.03, -0.08)) - 1.20;
  if (bd > 0.15) return min(bd, dn);
  vec3 a = vec3(abs(l.x), l.y, l.z);
  float d = sdS(l - vec3(0.0, 0.26, -0.10), vec3(0.64, 0.73, 0.82), 0.64);
  d = smin(d, sdS(l - vec3(0.0, -0.30, 0.12), vec3(0.46, 0.74, 0.54), 0.46), 0.22);
  d = smin(d, length(a - vec3(0.34, -0.50, 0.0)) - 0.13, 0.22);
  d = smin(d, dn, 0.08);
  d = smin(d, length(a - vec3(0.385, -0.04, 0.39)) - 0.17, 0.20);                         // cheekbone
  // ear: a machined hub
  d = smin(d, max(length(a.yz - vec2(0.0, -0.12)) - 0.13, abs(a.x - 0.61) - 0.05), 0.02);
  // the features only exist on the front, and only stick out so far
  if (l.z < 0.2) return d;
  // (the nose 0.33, brow and lids 0.14; never inside 0.27, where the shadow
  // and occlusion taps sample and need the true distance)
  if (a.x < 0.30 ? d > 0.40 : d > 0.27) return d - (a.x < 0.30 ? 0.33 : 0.14);
  // each group only where its smooth union can reach: the reach grows with
  // the distance from the skull, so the shadow and occlusion taps agree
  if (l.y > -0.25 - d) {
    d = smin(d, sdEll(l - vec3(0.0, 0.29, 0.57), vec3(0.40, 0.055, 0.095)), 0.16);       // brow
    // socket, then the lid over the eyeball with its almond opening
    d = smax(d, -(length(a - vec3(EYE.x, 0.04, 0.815)) - 0.22), 0.08);
    float eb = length(a - EYE);
    float lid = smax(eb - EYE_R - 0.012, -sdEll(a - vec3(EYE.x, 0.03, 0.61), vec3(0.15, 0.046, 0.10)), 0.01);
    d = min(smin(d, lid, 0.04), eb - EYE_R);
  }
  if (a.x < 0.24 + d && l.y > -0.45 - d && l.y < 0.26 + d) {
    float nz = sdCap(l, vec3(0.0, 0.13, 0.645), vec3(0.0, -0.20, 0.835), 0.034, 0.042);
    nz = smin(nz, sdEll(l - vec3(0.0, -0.262, 0.805), vec3(0.088, 0.058, 0.082)), 0.05);
    d = smin(d, nz, 0.08);
  }
  if (l.y < -0.19 + d) {
    d = smin(d, sdS(l - vec3(0.0, -0.54, 0.49), vec3(0.22, 0.19, 0.20), 0.19), 0.15);    // muzzle
    d = smin(d, length(l - vec3(0.0, -0.86, 0.50)) - 0.135, 0.14);                        // chin
    // lips, bent back and down into the corners
    float x2 = l.x * l.x;
    float lp = smin(sdEll(vec3(l.x, l.y + 0.528 + 1.2 * x2, l.z - 0.690 + 2.8 * x2), vec3(0.150, 0.030, 0.065)),
                    sdEll(vec3(l.x, l.y + 0.590 - 1.5 * x2, l.z - 0.685 + 2.8 * x2), vec3(0.135, 0.038, 0.070)), 0.008);
    d = smin(d, lp, 0.04);
  }
  // the seams are grooves, and the kick opens them
  if (d < 0.03) d += (0.005 + 0.018 * gOpen) * smoothstep(0.0038 + 0.010 * gOpen, 0.0, seamD(l));
  return d;
}

// how far the head at world angle th nods (radians, small: applied as a shear)
float nod(float th) { return 0.055 * sin(uTime * 0.31 + th * 1.3); }

// ring space -> frame of the nearest head; th = world angle of that head
vec3 toHead(vec3 p, out float th) {
  vec2 q = vec2(p.x, gR - p.z);
  float a = atan(q.x, q.y) - gRing;
  float c = floor(a / gSec + 0.5) * gSec;
  float la = a - c;
  float r = length(q);
  th = c + gRing;
  // the nod pivots at the base of the neck
  float ph = nod(th);
  vec2 yz = vec2(p.y + 1.2, r * cos(la) - gR + 0.2);
  return vec3(r * sin(la), yz.x + ph * yz.y - 1.2, yz.y - ph * yz.x - 0.2);
}

// the studio the chrome and the glaze reflect: overhead softbox, horizon
// streak, the key, and the two coloured back lights
vec3 studio(vec3 r) {
  float top = smoothstep(0.30, 0.95, r.y);
  vec3 c = vec3(0.75 * top * top);   // every white is neutral: the only colour on screen is the palette's
  c += vec3(0.12) * exp(-r.y * r.y * 70.0);
  vec2 kb = abs(vec2(dot(r, K_U), dot(r, K_V)));
  c += vec3(9.0) * smoothstep(0.26, 0.20, kb.x) * smoothstep(0.15, 0.10, kb.y) * step(0.0, dot(r, L_KEY));
  c += vec3(1.5) * pow(max(abs(r.x) * 0.80 - r.z * 0.60, 0.0), 40.0);   // two strip lights flanking the camera
  c += gC1 * pow(max(dot(r, L_A), 0.0), 24.0) * 1.5;
  c += gC2 * pow(max(dot(r, L_B), 0.0), 24.0) * 1.5;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gOpen = gKick * gKick;
  gBreath = 0.5 + 0.5 * sin(uTime * 0.5);
  gC1 = uColor1;
  gC2 = uColor2;
  gC3 = uColor3;
  float g = glow;
  float N = clamp(faces, 5.0, 14.0);
  gSec = 2.0 * PI / N;
  gR = 0.88 / sin(PI / N);
  // the carousel advances one head every 16 beats and wraps: the heads are
  // identical, so the angle never accumulates and `faces` can move freely
  float cyc = fract(uBeatClock / 16.0 + uTime * 0.01);
  gRing = gSec * smoothstep(0.45, 1.0, cyc);

  float yaw = spin * 0.22 * sin(uTime * 0.13 + 1.0);
  float D = 5.9 + 0.16 * (N - 9.0) - 0.3 * sin(uBassTime * 0.3) - 0.12 * uBass;
  vec3 ta = vec3(0.0, -0.16, 0.0);
  vec3 ro = vec3(sin(yaw) * D, -0.85 + 0.25 * sin(uTime * 0.09), -cos(yaw) * D);
  vec3 fwd = normalize(ta - ro);
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, rgt);
  vec3 rd = normalize(fwd * 2.2 + rgt * uv.x + up * uv.y);

  // black void, a breath of the two colours behind the heads
  vec3 col = gC1 * exp(-dot(uv + vec2(0.62, 0.0), uv + vec2(0.62, 0.0)) * 1.8) * 0.045
           + gC2 * exp(-dot(uv - vec2(0.62, 0.0), uv - vec2(0.62, 0.0)) * 1.8) * 0.045;
  col *= g * (0.6 + 0.4 * gBreath + 1.2 * gKick);

  // bounds: the cylinder that holds the ring, and a far plane that drops the
  // heads on the far side
  vec2 oc = ro.xz - vec2(0.0, gR);
  float ca = dot(rd.xz, rd.xz), cb = dot(oc, rd.xz), cc = dot(oc, oc) - (gR + 1.3) * (gR + 1.3);
  float disc = cb * cb - ca * cc;
  float tMax = (1.34 * gR - ro.z) / rd.z;
  float t = disc > 0.0 ? max((-cb - sqrt(disc)) / ca, 0.0) : tMax + 1.0;
  if (ro.y + rd.y * t > 1.3 && rd.y > 0.0) t = tMax + 1.0;

  bool hit = false;
  float eg = 1e3;
  vec3 l = vec3(0.0);
  float th = 0.0;
  for (int i = 0; i < 80; i++) {
    if (t > tMax) break;
    l = toHead(ro + rd * t, th);
    float d = head(l);
    eg = min(eg, length(vec3(abs(l.x), l.yz) - EYE));
    if (d < 0.002) { hit = true; break; }
    t += d * 0.9;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec2 q = vec2(p.x, gR - p.z);
    float wa = atan(q.x, q.y);
    float cs = cos(th), sn = sin(th), ph = nod(th);
    // world <-> head frame: a reflection about the ring (the same matrix both
    // ways), then the nod
    vec3 vl = vec3(-rd.x * cs - rd.z * sn, -rd.y, -rd.x * sn + rd.z * cs);
    vl.yz = vec2(vl.y + ph * vl.z, vl.z - ph * vl.y);
    vec3 lk = vec3(L_KEY.x * cs + L_KEY.z * sn, L_KEY.y, L_KEY.x * sn - L_KEY.z * cs);
    lk.yz = vec2(lk.y + ph * lk.z, lk.z - ph * lk.y);

    vec3 a3 = vec3(abs(l.x), l.yz);
    float jaw = l.y + 0.80 + 0.55 * l.z;                       // < 0: the neck

    // dissolve: the far heads, and the back of each skull as the energy rises
    float lvl = 0.25 + 0.75 * max(uEnergy, 0.22 + 0.18 * sin(uTime * 0.21));
    float m = smoothstep(0.4, 3.2, abs(wa) / gSec) * 1.15
            + smoothstep(0.55, -0.45, l.z) * lvl * (jaw < 0.0 ? 0.4 : 1.0);
    float diss = 0.0;
    if (m > 0.2) {
      m += (vnoise(l * 4.0 + vec3(0.0, uTime * 0.07, 0.0)) * 0.5
          + vnoise(l * 13.0 - vec3(0.0, uTime * 0.11, 0.0)) * 0.5 - 0.5) * 0.55
         + (hash13(floor(l * 52.0)) - 0.5) * 0.16;
      diss = smoothstep(0.495, 0.505, m);
    }

    vec3 surf = vec3(0.0);
    if (diss < 1.0) {
      vec2 k = vec2(1.0, -1.0);
      const float e = 0.003;
      vec3 nl = normalize(k.xyy * head(l + k.xyy * e) + k.yyx * head(l + k.yyx * e) +
                          k.yxy * head(l + k.yxy * e) + k.xxx * head(l + k.xxx * e));
      vec2 nyz = vec2(nl.y - ph * nl.z, nl.z + ph * nl.y);
      vec3 n = normalize(vec3(nl.x * cs + nyz.y * sn, nyz.x, nl.x * sn - nyz.y * cs));
      float ndv = max(dot(nl, vl), 0.0);

      float ao = clamp(0.25 + 0.75 * head(l + nl * 0.14) / 0.14, 0.0, 1.0);
      float ndl = dot(nl, lk);
      float sh = smoothstep(0.0, 1.0, head(l + nl * 0.02 + lk * 0.22) / (0.22 * max(ndl, 0.0) + 0.045));

      bool eye = length(a3 - EYE) < EYE_R + 0.003 && l.z > EYE.z;
      float hubR = length(l.yz - vec2(0.0, -0.12));
      bool metal = jaw < 0.0 || (a3.x > 0.645 && hubR < 0.14);
      float fr = pow(1.0 - ndv, 3.0);
      float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      float rimI = g * (1.0 + 0.3 * gBreath + 1.4 * gKick);
      vec3 env = studio(reflect(rd, n));
      if (eye) {
        // dark glass with a ring of light
        float er = length(a3.xy - EYE.xy) / EYE_R;
        float iris = smoothstep(0.045, 0.0, abs(er - 0.31));
        float core = smoothstep(0.09, 0.0, er);
        surf = env * (0.06 + 0.94 * F) * 0.35;
        surf += gC1 * (iris * 2.2 + core * 3.0 + 0.05 * smoothstep(0.5, 0.0, er)) * g * (0.9 + 0.3 * gBreath + 3.0 * gKick);
      } else if (!metal) {
        // porcelain: the key from above, deep shadow, two coloured rims, a glaze
        float dif = pow(clamp(ndl * 0.88 + 0.12, 0.0, 1.0), 1.8) * (0.2 + 0.8 * sh);
        const float alb = 0.90;
        surf = vec3(alb * (dif * 1.5 + 0.011 * ao));
        float ra = max(dot(n, L_A), 0.0), rb = max(dot(n, L_B), 0.0);
        surf += alb * gC1 * ra * ra * (0.08 + 2.0 * fr) * rimI * ao;
        surf += alb * gC2 * rb * rb * (0.08 + 2.0 * fr) * rimI * ao;
        surf += env * F * ao * (0.3 + 0.7 * sh);
        surf += vec3(0.06) * pow(max(dot(nl, normalize(lk + vl)), 0.0), 14.0) * sh;
        // nostrils
        surf *= 1.0 - 0.8 * smoothstep(0.020, 0.008, length(a3 - vec3(0.038, -0.318, 0.80)));
        // the grooves: dark, with light at the bottom that the kick turns up
        float sd = min(seamD(l), abs(jaw));
        float w = 0.0038 + 0.010 * gOpen;
        surf *= 1.0 - 0.92 * smoothstep(w * 2.4, w * 0.8, sd);
        surf += mix(gC1, vec3(1.0), 0.35 * gOpen) * smoothstep(w, 0.0, sd) * g * (0.07 + 0.06 * gBreath + 3.5 * gOpen);
      } else {
        // liquid chrome: neck and ear hubs
        surf = env * mix(0.45, 1.0, F) * ao + vec3(0.006) * ao;
        // neck rings
        surf *= 1.0 - 0.9 * smoothstep(0.07, 0.03, abs(fract(l.y * 9.0) - 0.5)) * step(jaw, 0.0);
        // the ring of light on the ear hub
        surf += gC2 * smoothstep(0.012, 0.003, abs(hubR - 0.085)) * step(0.66, a3.x) * g * (0.8 + 2.5 * gKick);
        surf *= smoothstep(-2.6, -1.0, l.y);
      }

      // holographic scan band, sweeping the heads from the neck to the crown
      float by = p.y + 0.25 - 1.3 * sin(uBeatClock * PI / 8.0);
      float sI = g * (0.25 + 0.6 * uMid + 1.5 * uMidHit);
      float lines = smoothstep(0.25, 0.5, abs(fract(uv.y * 180.0) - 0.5));
      surf = mix(surf, gC3 * (lines * 0.35 + fr * 0.9) + surf * 0.5, exp(-by * by * 40.0) * clamp(0.45 * sI, 0.0, 0.7));
      surf += gC3 * exp(-by * by * 5000.0) * 1.6 * sI;
    }
    if (diss > 0.0) {
      // what is left of a dissolved shell: particles thinning out, and the wireframe
      vec3 pc = l * 40.0 + vec3(0.0, uHighTime * 0.8 + uTime * 0.15, 0.0);
      vec3 ci = floor(pc);
      float hh = hash13(ci);
      vec3 pf = fract(pc) - 0.5 - (vec3(hash13(ci + 1.7), hash13(ci + 5.3), 0.5) - 0.5) * 0.5;
      float dot3 = smoothstep(0.26, 0.08, length(pf)) * step(smoothstep(0.5, 0.95, m), hh);
      float tw = 0.5 + 0.5 * sin(uHighTime * 9.0 + uTime * 1.3 + hh * 40.0);
      vec3 part = mix(gC3, gC1, hh * hh) * dot3 * (0.35 + tw * (0.5 + 1.6 * uHigh + 1.0 * uHighHit)) * g;
      float wl = min(abs(fract(l.y * 8.0) - 0.5), abs(fract(atan(l.x, l.z) * 12.0 / PI) - 0.5));
      part += gC3 * smoothstep(0.03, 0.0, wl) * 0.12 * g * (1.0 - smoothstep(0.5, 0.9, m));
      surf = mix(surf, part, diss);
    }
    // the edge of the dissolve burns
    surf += mix(gC3, vec3(1.0), 0.5) * exp(-(m - 0.5) * (m - 0.5) * 30000.0) * 0.9 * g;

    // depth: the heads sink into the void as they recede
    surf *= exp(-max(p.z, 0.0) * 0.22);
    col = surf;
  }

  // the eyes bleed light into the air
  col += gC1 * exp(-eg * eg * 45.0) * 0.22 * g * (0.8 + 0.2 * gBreath + 2.0 * gKick);

  // particles adrift in the void, rising
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 dp = uv * (22.0 + 16.0 * fi) + vec2(uTime * 0.03 * (1.0 + fi), -uTime * (0.10 + 0.06 * fi));
    vec2 di = floor(dp);
    float dh = hash12(di + fi * 19.0);
    if (dh > 0.95) {
      vec2 df = fract(dp) - 0.5 - (vec2(hash12(di + 3.1), hash12(di + 7.7)) - 0.5) * 0.6;
      float tw = 0.5 + 0.5 * sin(uHighTime * 7.0 + uTime * 1.1 + dh * 90.0);
      col += mix(gC3, gC1, step(0.975, dh)) * exp(-dot(df, df) * 220.0)
           * (0.05 + tw * (0.10 + 0.5 * uHigh + 0.3 * uHighHit)) * g * (hit ? 0.25 : 1.0);
    }
  }

  // the app shows this as it is and blooms what is above mid grey: the shoulder
  // keeps the porcelain under it, only lights and reflections go over
  col = 1.0 - exp(-col * 0.92);
  col *= clamp(1.2 - dot(uv, uv) * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

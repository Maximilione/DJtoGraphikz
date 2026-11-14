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

uniform float rings;
uniform float spin;
uniform float snap;
uniform float core;

// Armillary: a machine of nested polished rings turning around a core of
// light, standing over a black mirror floor. Each ring is a flat band (a torus
// with a rectangular section) on its own pair of axes; on the beat the rings
// take turns to swing a quarter turn and lock, so the whole thing reads as a
// combination lock counting the bar. The metal has no colour of its own: it
// mirrors three long softboxes, one per palette colour, plus the core. A
// groove runs around every band and carries a chase of light. The floor is an
// engraved dial that mirrors the machine with a second, shorter march.

const float TAU = 6.2831853;
const int MAXR = 6;
const int STEPS = 64;
const int RSTEPS = 36;

mat3 gM[6];
float gN;
float gKick;
float gCore;
float gFloor;
float gBox;                // softbox strength: full in the mirrors, off in the open background (pillars only)

// 1 below lo, 0 above hi: smoothstep with its edges in the legal order
float fall(float lo, float hi, float x) { return 1.0 - smoothstep(lo, hi, x); }

float h11(float x) { return fract(sin(x * 91.7) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(19.19, 73.31))) * 43758.5453); }

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }

float ringR(int i) { return 0.62 + 0.3 * float(i); }

// distance to ring i; q returns the section coordinates (radial, axial) and angle
float sdRing(vec3 p, int i, out vec3 q) {
  vec3 l = gM[i] * p;
  float R = ringR(i);
  float rad = length(l.xz) - R;
  q = vec3(rad, l.y, atan(l.z, l.x));
  vec2 d = abs(vec2(rad, l.y)) - vec2(0.03, 0.1 + 0.014 * float(i));
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.012;
}

float map(vec3 p, out int id, out vec3 q) {
  float d = 1e5;
  id = -1;
  q = vec3(0.0);
  for (int i = 0; i < MAXR; i++) {
    if (float(i) >= gN) break;
    vec3 qq;
    float di = sdRing(p, i, qq);
    if (di < d) { d = di; id = i; q = qq; }
  }
  return d;
}

float mapD(vec3 p) { int id; vec3 q; return map(p, id, q); }

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(mapD(p + e.xyy) - mapD(p - e.xyy),
                        mapD(p + e.yxy) - mapD(p - e.yxy),
                        mapD(p + e.yyx) - mapD(p - e.yyx)));
}

vec3 palI(float k) {
  k = mod(k, 3.0);
  return k < 0.5 ? uColor1 : (k < 1.5 ? uColor2 : uColor3);
}

// the room the chrome mirrors: three softboxes, a dim dome, a dark floor
vec3 env(vec3 d) {
  vec3 c = vec3(0.012, 0.014, 0.02) * (0.6 + 0.8 * max(d.y, 0.0));
  float a = atan(d.z, d.x);
  for (int k = 0; k < 3; k++) {
    float ca = float(k) * TAU / 3.0 + 0.6;
    float da = abs(mod(a - ca + 3.14159, TAU) - 3.14159);
    float box = fall(0.26, 0.34, da) * fall(0.42, 0.52, abs(d.y - 0.28));
    vec3 lc = k == 0 ? uColor1 : (k == 1 ? uColor2 : uColor3);
    c += lc * box * (1.5 + 1.4 * gKick) * gBox;
    c += lc * 0.1 * exp(-da * da * 2.0) * exp(-abs(d.y - 0.28) * 2.0);
  }
  // a ring of thin light pillars around the hall: what the chrome really mirrors
  float pa = a / TAU * 14.0;
  float pil = exp(-pow((fract(pa) - 0.5) * 9.0, 2.0)) * smoothstep(-0.12, 0.05, d.y) * fall(0.5, 0.95, d.y);
  c += palI(floor(pa)) * pil * (0.35 + 0.5 * uMid + 0.8 * gKick);
  c *= smoothstep(-0.5, 0.05, d.y) * 0.9 + 0.1;
  return c;
}

// march the rings inside their bounding sphere; returns distance or -1
float march(vec3 ro, vec3 rd, int steps, out int id, out vec3 q) {
  float Rb = ringR(int(gN) - 1) + 0.16;
  float b = dot(ro, rd), c = dot(ro, ro) - Rb * Rb;
  float h = b * b - c;
  id = -1;
  q = vec3(0.0);
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = max(-b - h, 0.0), tEnd = -b + h;
  for (int i = 0; i < STEPS; i++) {
    if (i >= steps || t > tEnd) break;
    float d = map(ro + rd * t, id, q);
    if (d < 0.0012) return t;
    t += d * 0.92;
  }
  return -1.0;
}

vec3 shadeRing(vec3 pos, vec3 rd, int id, vec3 q) {
  vec3 n = normalAt(pos);
  vec3 r = reflect(rd, n);
  float fr = 0.55 + 0.45 * pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
  // brushed along the band: the mirror image is smeared a little by angle
  float brush = h21(vec2(floor(q.z * 220.0), float(id)));
  vec3 col = env(normalize(r + (brush - 0.5) * 0.05)) * fr;
  // the core lights the inner faces
  vec3 toC = -pos / max(length(pos), 1e-3);
  float cd = max(dot(n, toC), 0.0);
  vec3 coreC = mix(uColor2, vec3(1.0, 0.95, 0.9), 0.6);
  col += coreC * cd * cd * gCore * (0.1 + 0.2 * uBass + 0.5 * gKick) / (0.35 + dot(pos, pos) * 0.5);
  // groove on the two flat faces: a chase of light, one segment per sixteenth
  float seg = floor(q.z / TAU * 32.0);
  float gap = step(0.12, fract(q.z / TAU * 32.0));
  float head = mod(floor(uBeatClock * 4.0) + float(id) * 5.0, 32.0);
  float dist = mod(head - seg, 32.0);
  float chase = exp(-dist * 0.35) + 0.08;
  float groove = fall(0.018, 0.03, abs(q.y)) * step(0.02, abs(q.x)) * gap;
  col = mix(col, vec3(0.0), groove * 0.85);
  col += palI(float(id)) * groove * chase * (1.4 + 1.2 * uMid + 2.0 * gKick);
  // rim strip on the outer edge catches the highs
  float edge = smoothstep(0.075, 0.1, abs(q.y)) * step(0.0, q.x);
  col += palI(float(id) + 1.0) * edge * 0.25 * (0.4 + 2.0 * uHigh);
  return col;
}

// core glow for a ray segment: closest approach to the origin within [0, tMax].
// A tight hot term (the core itself) and a short halo: the air stays black.
float coreGlow(vec3 ro, vec3 rd, float tMax) {
  float tc = clamp(-dot(ro, rd), 0.0, tMax);
  vec3 c = ro + rd * tc;
  float d2 = dot(c, c);
  return 0.05 / (d2 + 0.012) + 0.1 * exp(-d2 * 1.4);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gN = floor(clamp(rings, 2.0, 6.0) + 0.5);
  gCore = clamp(core, 0.0, 2.0);
  gFloor = -(ringR(int(gN) - 1) + 0.32);
  float sp = clamp(spin, 0.0, 2.0);
  float sn = clamp(snap, 0.0, 1.0);

  // ring attitudes: slow drift plus a quarter turn per beat, one ring at a time
  float bc = uBeatClock;
  for (int i = 0; i < MAXR; i++) {
    float fi = float(i);
    float turn = floor((bc + fi) / gN);
    float ph = fract((bc + fi) / gN) * gN;              // 0..gN, this ring moves during 0..1
    float e = clamp(ph, 0.0, 1.0);
    e = 1.0 - pow(1.0 - e, 4.0);                         // slam and settle
    float q4 = (turn + e) * 1.5708 * sn;
    float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float a1 = q4 * dir + t * sp * (0.11 + 0.05 * fi) * dir + fi * 1.1;
    float a2 = t * sp * 0.07 * dir + fi * 0.9 + 0.5 * q4;
    gM[i] = rotX(a1) * rotZ(a2);
  }

  // camera: low orbit, looking slightly down at the machine
  float az = t * 0.09 + uBassTime * 0.04;
  // far enough that the outermost ring and its mirror image both fit
  float cd = 2.6 + 2.6 * (ringR(int(gN) - 1) + 0.13);
  vec3 ro = vec3(cd * cos(az), 1.5 + 0.4 * sin(t * 0.13), cd * sin(az));
  vec3 ta = vec3(0.0, -0.45, 0.0);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * (1.55 - 0.07 * gKick) + rt * p.x + up * p.y);

  vec3 coreC = mix(uColor2, vec3(1.0, 0.95, 0.9), 0.6);
  float corePow = gCore * (0.5 + 0.5 * uBass + 1.0 * gKick) + 0.08;

  // background: a dark hall, the softboxes just visible in the haze
  gBox = 0.0;
  vec3 col = env(rd) * 0.2 + vec3(0.003, 0.004, 0.007);
  gBox = 1.0;
  float tMax = 40.0;

  int id; vec3 q;
  float th = march(ro, rd, STEPS, id, q);
  float tf = rd.y < 0.0 ? (gFloor - ro.y) / rd.y : -1.0;

  if (th > 0.0) {
    col = shadeRing(ro + rd * th, rd, id, q);
    tMax = th;
  } else if (tf > 0.0) {
    tMax = tf;
    vec3 fp = ro + rd * tf;
    float fr = length(fp.xz);
    float fa = atan(fp.z, fp.x);
    // engraved dial: rings and spokes, lit from above by the core
    float ringsL = fall(0.0, 0.025, 0.5 - abs(fract(fr) - 0.5));
    float spokes = fall(0.006, 0.014, abs(fract(fa / TAU * 24.0) - 0.5) * fr * TAU / 24.0)
                 * step(1.5, fr) * step(fract(fr * 0.5), 0.5);
    float lightF = corePow / (1.0 + fr * fr * 0.5);
    vec3 fcol = vec3(0.004, 0.005, 0.008) + coreC * 0.02 * lightF;
    fcol += mix(uColor3, uColor1, 0.5 + 0.5 * sin(fr * 1.3 - bc * 1.5708)) * (ringsL + spokes) * (0.05 + 0.3 * lightF);
    // beat ripple engraved in the dial
    float rip = exp(-pow((fr - (1.0 - gKick) * 9.0) * 12.0, 2.0)) * gKick;
    fcol += uColor1 * rip * 0.8;
    // mirror: the machine again, upside down, blurred by distance from contact
    vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
    int id2; vec3 q2;
    float t2 = march(fp, rr, RSTEPS, id2, q2);
    float fres = 0.45 + 0.55 * pow(1.0 - max(-rd.y, 0.0), 4.0);
    vec3 refl = t2 > 0.0 ? shadeRing(fp + rr * t2, rr, id2, q2) : env(rr) * 0.25;
    refl += coreC * coreGlow(fp, rr, t2 > 0.0 ? t2 : 30.0) * corePow;
    fcol += refl * fres * 0.9;
    fcol *= exp(-fr * 0.045);
    col = mix(col, fcol, exp(-tf * 0.012));
  }

  // the core itself: a small hot sphere and the glow of the air around it
  float g = coreGlow(ro, rd, tMax);
  col += coreC * g * corePow * 1.3;

  // foreground dust drifting through the light
  vec2 dp = p * 9.0 + vec2(t * 0.15, t * 0.08);
  vec2 di = floor(dp), df = fract(dp) - 0.5;
  float dr = h21(di);
  vec2 dofs = (vec2(h21(di + 3.0), h21(di + 8.0)) - 0.5) * 0.7;
  float mote = step(0.72, dr) * fall(0.0, 0.09 * dr, length(df - dofs));
  col += mix(coreC, uColor3, dr) * mote * (0.04 + 0.1 * uHigh) * (0.5 + corePow) / (0.6 + dot(p, p) * 6.0);

  col += uColor3 * 0.004;
  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.18 - dot(p, p) * 0.6, 0.45, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

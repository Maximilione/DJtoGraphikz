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

uniform float faces;
uniform float spin;
uniform float glow;

// Masks: a lantern of porcelain faces (procedural SDF heads, polar domain
// repetition: only the current face and its two neighbours are evaluated, and
// they fuse with a smooth-min) turning slowly over a pin, above a floor of thin
// copper fins radiating from a dark hub. Behind it a wall of dark glass heads
// with two incandescent eyes each, defocused. One march, 64 steps.
// Kick: the lantern swells and the fins light up in a wave from the hub out,
// the background eyes flash. Bass time: rotation. Mids: the fins ripple.
// Highs: eye twinkle. In silence everything breathes slowly, never black.

const float TAU = 6.2831853;
const float FLOOR_Y = -0.9;
const float FINS = 36.0;

float gKick, gR, gSec, gS, gCy, gBreath, gN;
vec3 gCop; // copper: the palette only tints it 35%
vec2 gRot;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = max(length(p / (r * r)), 1e-4);
  return k0 * (k0 - 1.0) / k1;
}

// one head, looking along +z, y up
float face(vec3 f, float hv) {
  float d = sdEll(f - vec3(0.0, 0.03 * hv, -0.05), vec3(0.40, 0.55 + 0.12 * hv, 0.44));
  d = smin(d, sdEll(f - vec3(0.0, -0.36, 0.04), vec3(0.25, 0.28, 0.30)), 0.15);
  vec3 c = vec3(abs(f.x), f.y, f.z);
  d = smin(d, length(c - vec3(0.26, -0.06, 0.26)) - 0.14, 0.09);
  vec3 pa = f - vec3(0.0, 0.10, 0.34);
  vec3 ba = vec3(0.0, -0.24, 0.11);
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  d = smin(d, length(pa - ba * h) - 0.035 - 0.035 * h, 0.05);
  d = smax(d, -(length(c - vec3(0.16, 0.10, 0.38)) - 0.095), 0.04);
  d = smax(d, -sdEll(c - vec3(0.0, -0.2, 0.42), vec3(0.14, 0.016, 0.07)), 0.015);
  return d;
}

float dFaces(vec3 p) {
  vec3 q = (p - vec3(0.0, gCy, 0.0)) / gS;
  float bd = length(q * vec3(1.0, 0.7, 1.0)) - (gR + 0.75);
  if (bd > 0.3) return bd * gS * 0.7;
  q.xz = vec2(q.x * gRot.x + q.z * gRot.y, q.z * gRot.x - q.x * gRot.y);
  float i = floor(atan(q.z, q.x) / gSec + 0.5);
  float d = 1e5;
  for (int j = -1; j <= 1; j++) {
    float ak = (i + float(j)) * gSec;
    vec2 e = vec2(cos(ak), sin(ak));
    vec3 f = vec3(dot(q.xz, vec2(-e.y, e.x)), q.y, dot(q.xz, e) - gR);
    float fi = (i + float(j));
    float hv = hash(vec2(mod(fi + gN, gN), 3.0));
    float fd = face(f, hv);
    d = (j == -1) ? fd : smin(d, fd, 0.12);
  }
  return d * gS * 0.8;
}

// local head coordinates of the nearest face, for the eye / mouth masks
vec3 faceLocal(vec3 p) {
  vec3 q = (p - vec3(0.0, gCy, 0.0)) / gS;
  q.xz = vec2(q.x * gRot.x + q.z * gRot.y, q.z * gRot.x - q.x * gRot.y);
  float ak = floor(atan(q.z, q.x) / gSec + 0.5) * gSec;
  vec2 e = vec2(cos(ak), sin(ak));
  return vec3(dot(q.xz, vec2(-e.y, e.x)), q.y, dot(q.xz, e) - gR);
}

float dFloor(vec3 p) {
  float pin = max(length(p.xz) - 0.06, abs(p.y) - 0.95);
  if (p.y > -0.5) return min(pin, max(p.y + 0.5, 0.02)); // bound, never a surface
  float r = length(p.xz);
  float a = atan(p.z, p.x) + uTime * 0.04;
  float sec = TAU / FINS;
  float la = a - floor(a / sec + 0.5) * sec;
  float rad = r * cos(la);
  float lat = r * sin(la) + (p.y - FLOOR_Y) * 0.3;
  float rip = 0.04 * sin(rad * 3.0 - uTime * 1.5) * (0.4 + 2.0 * uMid);
  float hh = 0.22 + rip;
  float th = 0.034 + 0.008 * rad;
  float d = max(max(abs(lat) - th, abs(p.y - (FLOOR_Y + hh)) - hh), max(0.55 - rad, rad - 3.4));
  float hub = max(r - 0.5, abs(p.y - (FLOOR_Y + 0.08)) - 0.1);
  return min(min(d * 0.6, hub), pin);
}

float map(vec3 p) { return min(dFaces(p), dFloor(p)); }

vec3 normalAt(vec3 p) {
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.0025;
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                   k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

// wave of light running from the hub outwards while the kick decays
float finWave(float rad) {
  float front = 3.6 * (1.0 - gKick);
  float w = (rad - front) * 1.6;
  return exp(-w * w) * sqrt(gKick);
}

// one layer of the glass-head wall: rgb + coverage
vec4 headLayer(vec2 uv, float L) {
  float sc = mix(9.0, 14.0, L);
  vec2 q = vec2(uv.x * sc + uTime * 0.03 * (1.0 - 0.5 * L) + L * 3.7, uv.y * sc * 0.8 + L * 1.3);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(id + L * 17.0);
  float h2 = hash(id.yx + 5.0 + L);
  float present = step(0.04, h2);
  float blur = mix(0.1, 0.4, L);
  vec2 e = f / vec2(0.34, 0.44);
  float ev = length(e);
  float mask = smoothstep(1.0 + blur, 1.0 - blur, ev) * present;
  vec3 n = vec3(e, sqrt(max(1.0 - ev * ev, 0.0)));
  float blue = pow(max(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0), 18.0) * (h > 0.72 ? 1.0 : 0.15);
  float rim = smoothstep(0.55, 1.0, ev) * mask;
  vec3 col = vec3(0.004, 0.004, 0.008) + vec3(0.1, 0.26, 0.7) * (blue * 0.9 + rim * 0.22 * (0.4 + 0.6 * h));
  float flash = 1.0 + 2.5 * gKick * (0.4 + 0.6 * h);
  float tw = 1.0 + uHigh * 0.8 * sin(uTime * 9.0 + h * 60.0);
  float ei = (0.35 + 0.65 * h) * flash * tw * glow * (0.8 + 0.2 * gBreath);
  vec3 ec = mix(vec3(1.0, 0.28, 0.08), uColor3, 0.35);
  float k1 = mix(450.0, 170.0, L), k2 = mix(60.0, 28.0, L);
  vec2 e1 = f - vec2(0.085, 0.06), e2 = f - vec2(-0.085, 0.06);
  float core = exp(-dot(e1, e1) * k1) + exp(-dot(e2, e2) * k1);
  float halo = (exp(-dot(e1, e1) * k2) + exp(-dot(e2, e2) * k2)) * 0.3;
  col += ec * (core * 2.0 + halo) * ei;
  return vec4(col * mix(1.0, 0.55, L) * present, mask);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gBreath = 0.5 + 0.5 * sin(uTime * 0.6);
  float N = floor(clamp(faces, 5.0, 14.0) + 0.5);
  gSec = TAU / N;
  gN = N;
  gCop = mix(vec3(1.0, 0.5, 0.18), uColor2, 0.35);
  gR = clamp(0.24 / sin(3.14159265 / N), 0.5, 1.2);
  gS = 1.35 * (1.0 + 0.08 * gKick + 0.02 * gBreath);
  gCy = 0.5 + 0.04 * sin(uTime * 0.7) + 0.05 * gKick;
  float ang = (uBassTime * 0.35 + uTime * 0.12) * spin;
  gRot = vec2(cos(ang), sin(ang));
  float g = glow;

  vec3 ro = vec3(0.0, 0.9, -5.6);
  vec3 fwd = normalize(vec3(0.0, 0.15, 0.0) - ro);
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, rgt);
  vec3 rd = normalize(fwd * 1.6 + rgt * uv.x + up * uv.y);

  // wall of glass heads, far layer under the near one
  vec2 buv = uv + vec2(0.03 * sin(uTime * 0.1), 0.0);
  vec4 far = headLayer(buv, 1.0);
  vec4 near = headLayer(buv, 0.0);
  vec3 col = mix(vec3(0.002, 0.002, 0.004) + far.rgb * far.a, near.rgb, near.a);
  col *= smoothstep(1.5, 0.15, length(uv * vec2(0.8, 1.1))) * 0.9 + 0.1;
  // warm backlight behind the lantern
  vec2 hc = uv - vec2(0.0, 0.12);
  col += gCop * exp(-dot(hc, hc) * 2.6) * 0.1 * g * (0.65 + 0.35 * gBreath + 0.5 * gKick);

  // dark glossy disc under the fins
  if (rd.y < -0.01) {
    float tp = (FLOOR_Y - ro.y) / rd.y;
    vec3 fp = ro + rd * tp;
    float fr = length(fp.xz);
    if (fr < 3.5) {
      float fade = smoothstep(3.5, 3.0, fr);
      vec3 disc = vec3(0.004, 0.002, 0.001) + gCop * finWave(fr) * 0.07 * g;
      col = mix(col, disc, fade * 0.97);
    }
  }

  float t = 2.0;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    if (d < 0.0015 + 0.0008 * t) { hit = true; break; }
    t += d;
    if (t > 16.0) break;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    vec3 v = -rd;
    float ndv = max(dot(n, v), 0.0);
    vec3 surf;
    if (dFaces(p) < dFloor(p)) {
      // porcelain
      vec3 alb = mix(vec3(1.0, 0.95, 0.88), uColor1, 0.04) * 0.92;
      vec3 L1 = normalize(vec3(-0.9, 0.4, -0.3));
      vec3 key = mix(vec3(1.0, 0.92, 0.82), gCop, 0.15);
      float w = clamp((dot(n, L1) + 0.1) / 1.1, 0.0, 1.0);
      w = w * w * (1.3 - 0.3 * w);
      float occ = 0.0;
      for (int i = 1; i <= 3; i++) {
        float hh = 0.05 * float(i);
        occ += (hh - map(p + n * hh)) / float(i * i);
      }
      float ao = clamp(1.0 - 2.4 * occ, 0.05, 1.0);
      vec3 lit = key * w * 1.6 * (0.9 + 0.1 * gBreath)
               + gCop * 0.035
               + gCop * max(-n.y, 0.0) * g * (0.08 + 0.3 * gKick + 0.4 * finWave(length(p.xz)));
      surf = alb * lit * ao;
      vec3 hv = normalize(L1 + v);
      surf += key * pow(max(dot(n, hv), 0.0), 40.0) * 0.12 * w;
      surf += gCop * pow(1.0 - ndv, 3.0) * 0.18 * smoothstep(-0.2, 0.6, n.x);
      vec3 fl = faceLocal(p);
      float ex = abs(fl.x) - 0.16;
      float eye = smoothstep(0.02, 0.006, abs(fl.y - 0.095 + 0.25 * ex)) * smoothstep(0.075, 0.04, abs(ex));
      float ym = -0.225 + 2.6 * fl.x * fl.x;
      float mouth = smoothstep(0.016, 0.005, abs(fl.y - ym)) * smoothstep(0.15, 0.1, abs(fl.x));
      float front = step(0.25, fl.z);
      surf *= 1.0 - front * (0.95 * eye + 0.8 * mouth);
    } else {
      // copper fins, hub and pin
      float rad = length(p.xz);
      vec3 rr = reflect(rd, n);
      // reflected lights orbit with the bass clock, so the glints run along the fins
      float sa = uBassTime * 0.6 + uTime * 0.2;
      vec3 Ls = normalize(vec3(cos(sa), 0.45, sin(sa)));
      vec3 Lt = normalize(vec3(-cos(sa * 0.7 + 2.0), 0.6, -sin(sa * 0.7 + 2.0)));
      float env = pow(max(dot(rr, Ls), 0.0), 60.0) * 2.5
                + pow(max(dot(rr, Lt), 0.0), 90.0) * 1.6
                + pow(max(dot(rr, normalize(vec3(-0.6, 0.5, -0.5))), 0.0), 70.0) * 1.0;
      float low = 0.35 + 0.65 * smoothstep(FLOOR_Y, FLOOR_Y + 0.3, p.y);
      float w = finWave(rad);
      float pulse = 0.1 + 0.08 * gBreath + 1.2 * w + 0.25 * uMid * (0.5 + 0.5 * sin(rad * 5.0 - uTime * 2.0));
      float topEdge = smoothstep(0.55, 0.95, n.y);
      surf = gCop * 0.06 * (0.4 + 0.6 * max(n.y, 0.0))
           + env * gCop * 0.9
           + gCop * topEdge * (0.9 + pulse * 1.8) * g * 0.9;
      surf *= low;
      if (rad < 0.6) {
        // dark glossy hub with a thin copper ring where the fins end
        float ring = smoothstep(0.1, 0.0, abs(rad - 0.5));
        surf = gCop * 0.02 + env * gCop * 0.25 + gCop * ring * (0.3 + 0.8 * w) * g;
      }
    }
    float fog = 1.0 - exp(-max(t - 5.0, 0.0) * 0.12);
    col = mix(surf, col, fog * 0.8);
  }

  // dust in the light
  vec2 dp = uv * vec2(34.0, 19.0) + vec2(uTime * 0.05, -uTime * 0.12);
  vec2 di = floor(dp);
  float dh = hash(di);
  vec2 df = fract(dp) - 0.5 - (vec2(hash(di + 3.1), hash(di + 7.7)) - 0.5) * 0.5;
  col += gCop * step(0.96, dh) * exp(-dot(df, df) * 90.0) * (0.12 + 0.3 * uHigh) * g
       * (0.5 + 0.5 * sin(uTime * 2.0 + dh * 80.0));

  col = col / (1.0 + 0.25 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.8, 0.5, 1.0);
  col += gCop * 0.004;
  gl_FragColor = vec4(col, 1.0);
}

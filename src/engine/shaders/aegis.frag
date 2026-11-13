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

uniform float cells;
uniform float impacts;
uniform float beam;
uniform float orbit;

// Aegis: a dome of force over a black plain, taking a hit on every beat. The
// dome is never marched: one quadratic gives the near and the far wall, and
// both are drawn, so the back of the shield shows through the front. Its skin
// is a hexagonal lattice laid with a stereographic projection from the nadir
// (conformal: the cells stay regular hexagons from the crown to the rim, only
// their size changes). Each beat picks a point of the dome, a bolt comes down
// on it from the sky, and a ring of lit cells spreads from the point across
// the lattice; four hits are alive at any time. Inside, a column of light
// feeds the crown. The plain is a wet mirror that repeats the dome.

const float TAU = 6.2831853;
const float RD = 1.0;                    // dome radius

float gKick, gCells, gImp, gBeam;
vec3 gIp[4];                             // impact points (unit vectors)
float gAge[4];                           // age of each impact, in beats

float h11(float x) { return fract(sin(x * 157.3) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(23.43, 61.97))) * 43758.5453); }

float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}

// hexagonal lattice: xy = offset from the cell centre, zw = cell id
vec4 hexCell(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  return dot(a, a) < dot(b, b) ? vec4(a, p - a) : vec4(b, p - b);
}

// distance to the border of the hexagon, 0 at the edge, 0.5 at the centre
float hexEdge(vec2 q) {
  q = abs(q);
  return 0.5 - max(q.x, dot(q, vec2(0.5, 0.8660254)));
}

// light of the shield at a point of the dome with outward normal n (n.y >= 0)
vec3 shell(vec3 n, vec3 rd, float face) {
  // stereographic chart from the nadir: the upper hemisphere fills the unit disc
  vec2 uv = n.xz / (1.0 + n.y);
  vec4 h = hexCell(uv * gCells);
  float ed = hexEdge(h.xy);
  // cell centre back on the sphere, so a whole cell answers to a hit at once
  vec2 cu = h.zw / gCells;
  float cl = dot(cu, cu);
  vec3 nc = vec3(2.0 * cu.x, 1.0 - cl, 2.0 * cu.y) / (1.0 + cl);
  float rnd = h21(h.zw);

  float fres = pow(1.0 - abs(dot(n, rd)), 2.5);
  // lattice lines: thin, brighter toward the silhouette
  float line = 1.0 - smoothstep(0.015, 0.045, ed);
  float glowL = exp(-ed * 9.0);
  // edge-on the cells shrink below a pixel: let the lattice dissolve into the rim glow
  float vis = smoothstep(0.0, 0.1, abs(dot(n, rd)));
  line *= vis;

  // hits: a ring of lit cells running outward from each impact point
  float hit = 0.0, flash = 0.0;
  for (int i = 0; i < 4; i++) {
    float ang = acos(clamp(dot(nc, gIp[i]), -1.0, 1.0));
    float age = gAge[i];
    float front = age * 1.15 + 0.02;
    // only the newest hit follows the real kick: in silence the lattice just breathes
    float amp = i == 0 ? 0.3 + 0.7 * sqrt(gKick) : 0.55;
    float ring = exp(-pow((ang - front) * 9.0, 2.0)) * exp(-age * 1.7) * amp;
    float wake = (1.0 - smoothstep(0.0, front, ang)) * exp(-age * 3.0) * 0.3 * amp;
    hit += ring + wake;
    float pang = acos(clamp(dot(n, gIp[i]), -1.0, 1.0));
    flash += exp(-pang * pang * 60.0) * exp(-age * 5.0) * amp;
  }
  hit *= gImp * (0.3 + 0.7 * vis);
  flash *= gImp;

  // slow energy drifting over the skin, and cells that flicker with the highs
  float flow = vn(uv * 3.0 + vec2(uTime * 0.12, -uTime * 0.07));
  float flick = step(0.93, fract(rnd * 7.0 + floor(uBeatClock * 2.0) * 0.137)) * uHigh;

  vec3 c = uColor1 * line * (0.22 + 0.9 * fres + 0.25 * uMid);
  c += uColor1 * glowL * 0.05;
  c += uColor3 * (0.03 + 0.1 * flow * flow) * (0.4 + fres);
  c += uColor3 * fres * fres * 0.9;
  // a lit cell: filled with colour 2, its border white hot
  float fill = smoothstep(0.0, 0.1, ed);
  c += uColor2 * hit * (0.12 + 0.5 * fill) * 1.3;
  c += mix(uColor2, vec3(1.0), 0.6) * hit * line * 1.6;
  c += uColor1 * flick * fill * 0.6;
  c += vec3(1.0, 0.97, 0.95) * flash * 2.0;
  // the rim where the shield meets the ground burns steadily
  c += mix(uColor1, vec3(1.0), 0.3) * exp(-n.y * 40.0) * (0.35 + 0.4 * uBass + 0.6 * gKick);
  return c * face;
}

// both walls of the dome along a ray, limited to tMax; also the lit air inside
vec3 dome(vec3 ro, vec3 rd, float tMax, out float chord) {
  chord = 0.0;
  float b = dot(ro, rd), c = dot(ro, ro) - RD * RD;
  float h = b * b - c;
  if (h < 0.0) return vec3(0.0);
  h = sqrt(h);
  float t0 = -b - h, t1 = -b + h;
  vec3 col = vec3(0.0);
  if (t0 > 0.0 && t0 < tMax) {
    vec3 n = (ro + rd * t0) / RD;
    if (n.y >= 0.0) col += shell(n, rd, 1.0);
  }
  if (t1 > 0.0 && t1 < tMax) {
    vec3 n = (ro + rd * t1) / RD;
    if (n.y >= 0.0) col += shell(n, rd, 0.55);
  }
  chord = max(min(t1, tMax) - max(t0, 0.0), 0.0);
  return col;
}

// the feed column on the axis: closest approach of the ray to the y axis
vec3 column(vec3 ro, vec3 rd, float tMax) {
  float a = max(dot(rd.xz, rd.xz), 1e-5);
  float tc = clamp(-dot(ro.xz, rd.xz) / a, 0.0, tMax);
  vec3 c = ro + rd * tc;
  float d2 = dot(c.xz, c.xz);
  float inside = step(0.0, c.y) * (1.0 - smoothstep(0.9, 1.0, c.y));
  float pulse = 0.6 + 0.4 * sin(c.y * 14.0 - uBeatClock * TAU);
  float g = (0.0016 / (d2 + 0.0009) + 0.012 / (d2 + 0.03)) * inside;
  // the crown: where the column meets the dome
  vec3 k = c - vec3(0.0, 1.0, 0.0);
  float crown = 0.004 / (dot(k, k) + 0.004);
  return (mix(uColor2, vec3(1.0), 0.55) * g * (0.7 + 0.3 * pulse) + uColor1 * crown)
       * gBeam * (0.45 + 0.7 * uBass + 1.1 * gKick);
}

vec3 sky(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 c = mix(uColor3 * 0.09, vec3(0.002, 0.003, 0.008), smoothstep(0.0, 0.45, y));
  // a low deck of cloud lit from below by the shield and by each hit
  float az = atan(d.z, d.x);
  vec2 cp = d.xz / (y + 0.18) * 0.9;
  float cl = vn(cp + vec2(uTime * 0.02, 0.0)) * 0.6 + vn(cp * 2.3 - vec2(0.0, uTime * 0.03)) * 0.4;
  cl = smoothstep(0.45, 0.9, cl) * smoothstep(0.02, 0.25, y);
  float newest = exp(-min(min(gAge[0], gAge[1]), min(gAge[2], gAge[3])) * 4.0);
  c += mix(uColor3, uColor2, 0.35) * cl * (0.09 + 0.4 * newest * gImp + 0.08 * uBass);
  // stars
  vec2 s = vec2(az, d.y) * 55.0;
  vec2 id = floor(s), f = fract(s) - 0.5;
  float r = h21(id);
  c += vec3(0.8, 0.88, 1.0) * step(0.9, r) * exp(-dot(f, f) * 300.0) * (0.4 + 4.0 * (r - 0.9)) * (1.0 - cl) * smoothstep(0.05, 0.3, y);
  return c;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gCells = clamp(cells, 4.0, 16.0);
  gImp = clamp(impacts, 0.0, 2.0);
  gBeam = clamp(beam, 0.0, 2.0);

  // camera first: hits land on the side we are looking at
  float az = t * 0.07 * clamp(orbit, 0.0, 2.0) + uBassTime * 0.03 * orbit + 0.6;
  vec3 ro = vec3(3.9 * cos(az), 0.62 + 0.14 * sin(t * 0.1), 3.9 * sin(az));
  vec3 ta = vec3(0.0, 0.34, 0.0);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float foc = 1.55 - 0.06 * gKick;
  vec3 rd = normalize(fw * foc + rt * p.x + up * p.y);

  // the four live hits: one per beat, the newest scaled by the real kick
  float bc = uBeatClock;
  for (int i = 0; i < 4; i++) {
    float bi = floor(bc) - float(i);
    float r1 = h11(bi * 1.37 + 0.11), r2 = h11(bi * 2.71 + 0.53);
    float el = 0.25 + 0.95 * r1;                       // elevation above the rim
    float ha = az + 3.14159 + (r2 - 0.5) * 2.6;        // around the camera-facing side
    gIp[i] = vec3(cos(el) * cos(ha + 3.14159), sin(el), cos(el) * sin(ha + 3.14159));
    gAge[i] = bc - bi;
  }

  vec3 col;
  float tMax = 1e4;
  float tg = rd.y < 0.0 ? -ro.y / rd.y : -1.0;
  float chord;

  if (tg > 0.0) {
    // the plain: wet black, a grid scratched in it, the dome mirrored
    tMax = tg;
    vec3 gp = ro + rd * tg;
    float gr = length(gp.xz);
    vec2 gq = abs(fract(gp.xz * 2.0) - 0.5);
    float px = tg / (uResolution.y * foc) * 2.0 / max(-rd.y, 0.05);
    float grid = 1.0 - smoothstep(px, px * 2.0 + 0.004, 0.5 - max(gq.x, gq.y));
    grid *= exp(-gr * 0.22) / (1.0 + px * 30.0);
    col = vec3(0.003, 0.004, 0.007) + uColor3 * grid * 0.16;
    // rings in the ground around the foot of the dome, pushed out by the kick
    float foot = exp(-pow((gr - RD) * 22.0, 2.0));
    col += mix(uColor1, vec3(1.0), 0.25) * foot * (0.3 + 0.4 * uBass + 0.6 * gKick);
    float shock = exp(-pow((gr - RD - (1.0 - gKick) * 5.0) * 12.0, 2.0)) * gKick * step(RD, gr);
    col += uColor2 * shock * 0.6;
    col += uColor1 * 0.02 / (0.3 + abs(gr - RD) * 3.0);
    // mirror
    vec3 rr = vec3(rd.x, -rd.y, rd.z);
    float ch2;
    vec3 refl = dome(gp, rr, 1e4, ch2) + column(gp, rr, 1e4) + sky(rr) * 0.6;
    refl += uColor3 * ch2 * 0.05;
    float rough = 0.75 + 0.25 * vn(gp.xz * 9.0);
    float fres = 0.12 + 0.88 * pow(1.0 - max(-rd.y, 0.0), 3.0);
    col += refl * fres * rough * 0.7;
    col = mix(col, uColor3 * 0.09, 1.0 - exp(-tg * 0.05));
  } else {
    col = sky(rd);
  }

  // the dome and what is inside it, in front of the ground or the sky
  col += dome(ro, rd, tMax, chord);
  col += uColor3 * chord * (0.035 + 0.03 * uBass) + uColor2 * chord * chord * 0.012 * gBeam;
  col += column(ro, rd, tMax);

  // bolts: the two newest hits arrive down a jagged line from the sky
  for (int i = 0; i < 2; i++) {
    float age = gAge[i];
    float life = exp(-age * 7.0) * gImp * (i == 0 ? 0.3 + 0.7 * sqrt(gKick) : 0.55);
    if (life < 0.01) continue;
    vec3 ip = gIp[i] * RD;
    vec3 v = ip - ro;
    float z = dot(v, fw);
    if (z < 0.1) continue;
    vec2 sp = vec2(dot(v, rt), dot(v, up)) * foc / z;       // impact on screen
    // direction of arrival: outward along the dome normal, as seen on screen
    vec3 v2 = ip + gIp[i] * 0.6 + vec3(0.0, 0.5, 0.0) - ro;
    vec2 sp2 = vec2(dot(v2, rt), dot(v2, up)) * foc / max(dot(v2, fw), 0.1);
    vec2 dir = normalize(sp2 - sp + vec2(1e-4, 0.0));
    vec2 q = p - sp;
    float al = dot(q, dir);
    float pe = dot(q, vec2(-dir.y, dir.x));
    if (al > 0.0) {
      float seed = floor(bc) - float(i);
      float jag = (vn(vec2(al * 14.0, seed * 3.1)) - 0.5) * 0.09 * smoothstep(0.0, 0.15, al)
                + (vn(vec2(al * 47.0, seed * 5.7)) - 0.5) * 0.02;
      float d = abs(pe - jag);
      float bolt = 0.0012 / (d + 0.0012) + 0.03 * exp(-d * 30.0);
      col += mix(uColor2, vec3(1.0), 0.7) * bolt * life * (0.6 + 0.9 * gKick) * exp(-al * 0.6);
    }
    col += mix(uColor2, vec3(1.0), 0.5) * life * 0.006 / (dot(q, q) + 0.004);
  }

  col += uColor3 * 0.004;
  col = col / (1.0 + 0.45 * col);
  col *= clamp(1.18 - dot(p, p) * 0.55, 0.5, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

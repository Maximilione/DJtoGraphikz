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

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform float towers;
uniform float foglevel;
uniform float orbit;

uniform float uLineBoost;

// PS2 boot screen: a field of slim square glass columns of different heights
// rising out of a dark blue haze, glowing edges, mirror floor, slow floating
// dust. Real 3D: grid DDA + per-cell box. Kick lifts the towers and flares the
// edges, bass-time drives the height wave, mids sway the columns.

// x,y = column centre offset, z = half width ; returns height (0 = empty)
float towerH(vec2 cell, out vec3 geo) {
  geo = vec3(0.0);
  if (abs(cell.x - 0.5) < 1.0) return 0.0;           // free corridor: we glide between towers
  float presence = hash(cell);
  if (presence < 1.0 - towers / 70.0) return 0.0;     // param = density
  float hh = hash(cell + 7.7);
  float ph = hash(cell + 3.3) * TAU;
  float sw = 0.07 * (1.0 + uMid * 2.0);
  geo = vec3(sin(uTime * 0.35 + ph) * sw, cos(uTime * 0.29 + ph * 1.7) * sw, 0.13 + 0.09 * hash(cell + 1.9));
  float wave = 0.5 + 0.5 * sin(cell.y * 0.45 + cell.x * 0.3 - uBassTime * 1.3 + ph);
  float lift = uBassHit * (0.25 + 0.5 * hash(cell + 9.1));
  return 0.7 + hh * hh * 3.2 * (0.55 + 0.45 * wave) + lift + uBass * 0.25;
}

// DDA over cells, slab test on the column of each cell. maxSteps keeps bounds constant.
float trace(vec3 ro, vec3 rd, int maxSteps, out vec3 nrm, out vec4 info, out float hw) {
  // info: xy = hit local xz relative to column centre, z = hitH/H, w = column H (0 -> floor)
  vec2 cell = floor(ro.xz);
  vec2 stp = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
  vec3 sd = vec3(abs(rd.x) < 1e-5 ? 1e-5 : rd.x, abs(rd.y) < 1e-5 ? -1e-5 : rd.y, abs(rd.z) < 1e-5 ? 1e-5 : rd.z);
  vec3 inv = 1.0 / sd;
  vec2 tDelta = abs(inv.xz);
  vec2 tMax = vec2((cell.x + max(stp.x, 0.0) - ro.x) * inv.x, (cell.y + max(stp.y, 0.0) - ro.z) * inv.z);
  float tFloor = rd.y < 0.0 ? -ro.y / rd.y : 60.0;
  nrm = vec3(0.0, 1.0, 0.0); info = vec4(0.0); hw = 0.2;
  for (int i = 0; i < 48; i++) {
    if (i >= maxSteps) break;
    float tExit = min(tMax.x, tMax.y);
    if (tExit > tFloor) break;
    vec3 geo;
    float h = towerH(cell, geo);
    if (h > 0.0) {
      vec3 c = vec3(cell.x + 0.5 + geo.x, 0.0, cell.y + 0.5 + geo.y);
      vec3 bmin = c - vec3(geo.z, 0.0, geo.z);
      vec3 bmax = c + vec3(geo.z, h, geo.z);
      vec3 t1 = (bmin - ro) * inv, t2 = (bmax - ro) * inv;
      vec3 tn = min(t1, t2), tf = max(t1, t2);
      float tNear = max(tn.x, max(tn.y, tn.z));
      float tFar = min(tf.x, min(tf.y, tf.z));
      if (tNear < tFar && tNear > 0.0 && tNear < tFloor) {
        nrm = -sign(sd) * step(tn.yzx, tn.xyz) * step(tn.zxy, tn.xyz);
        vec3 p = ro + sd * tNear;
        info = vec4(p.x - c.x, p.z - c.z, p.y / h, h);
        hw = geo.z;
        return tNear;
      }
    }
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; cell.x += stp.x; }
    else { tMax.y += tDelta.y; cell.y += stp.y; }
  }
  if (rd.y < 0.0) {
    vec3 p = ro + rd * tFloor;
    info = vec4(p.x, p.z, 0.0, 0.0);
    return tFloor;
  }
  return -1.0;
}

vec3 shade(vec3 ro, vec3 rd, float t, vec3 nrm, vec4 info, float hw, vec3 fogC) {
  vec3 ice = mix(vec3(0.30, 0.62, 1.0), uColor1, 0.30);
  vec3 rim = mix(vec3(0.72, 0.90, 1.0), uColor2, 0.20);
  if (t < 0.0) {
    float hz = exp(-abs(rd.y) * 5.0);
    return fogC * (0.7 + hz * 1.6);
  }
  float fog = exp(-t * (0.05 + foglevel * 0.035));
  vec3 col;
  if (info.w <= 0.0) {
    // dark floor with a faint cell grid
    vec2 g = abs(fract(info.xy) - 0.5);
    float gl = smoothstep(0.03 + t * 0.004, 0.0, 0.5 - max(g.x, g.y));
    col = fogC * 0.5 + ice * gl * 0.10;
  } else {
    float H = info.w;
    float hy = info.z * H;
    float vg = info.z;
    // distance to the nearest edge (world units), blurred with depth (fake DOF)
    float ew = 0.012 + t * 0.006 + 0.004 * uLineBoost;
    float side = abs(nrm.x) > 0.5 ? abs(info.y) : abs(info.x);
    float wH = hw;
    float cornerD = max(wH - side, 0.0);
    float vertD = min(hy, H - hy);
    float edge;
    if (nrm.y > 0.5) {
      float m = min(wH - abs(info.x), wH - abs(info.y));
      edge = smoothstep(ew * 3.0, 0.0, m);
    } else {
      edge = max(smoothstep(ew * 2.0, 0.0, cornerD), smoothstep(ew * 2.0, 0.0, vertD));
    }
    float flare = 0.55 + 0.35 * uBass + 1.3 * uBassHit + 0.5 * uBeat;
    float body = (0.06 + 0.55 * vg * vg) * (0.8 + 0.4 * uBass);
    float axis = abs(nrm.x) > 0.5 ? 0.85 : (nrm.y > 0.5 ? 1.25 : 1.0);
    col = ice * body * axis;
    col += rim * edge * flare * (0.5 + 0.7 * vg);
    col += rim * smoothstep(0.93, 1.0, vg) * 0.5 * flare;    // glowing crown
    float fres = pow(1.0 - abs(dot(nrm, -rd)), 3.0);
    col += ice * fres * 0.2;
  }
  return mix(fogC * 0.8, col, fog);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 fogC = mix(vec3(0.010, 0.022, 0.060), uColor3 * 0.10, 0.35);

  // slow glide through the field, soft sway, low pitch
  vec3 ro = vec3(1.0 + sin(t * 0.13) * 0.55, 1.5 + sin(t * 0.21) * 0.12,
                 t * (0.30 + orbit * 0.25) + uBassTime * 0.12);
  float yaw = sin(t * 0.09) * 0.22;
  float pitch = -0.17 + sin(t * 0.15) * 0.04;
  vec3 rd = normalize(vec3(uv, 1.25));
  rd.yz = rot(pitch) * rd.yz;
  rd.xz = rot(yaw) * rd.xz;

  vec3 nrm; vec4 info; float hw;
  float d = trace(ro, rd, 44, nrm, info, hw);
  vec3 color = shade(ro, rd, d, nrm, info, hw, fogC);

  // mirror floor
  if (d > 0.0 && info.w <= 0.0) {
    vec3 p = ro + rd * d + vec3(0.0, 0.002, 0.0);
    vec3 rrd = vec3(rd.x, -rd.y, rd.z);
    vec3 n2; vec4 i2; float hw2;
    float d2 = trace(p, rrd, 22, n2, i2, hw2);
    if (d2 > 0.0 && i2.w > 0.0) {
      color += shade(p, rrd, d2, n2, i2, hw2, fogC) * 0.40 * exp(-d * 0.08);
    }
  }

  // slow floating dust, three depth layers (far ones dimmer and softer)
  for (int m = 0; m < 18; m++) {
    float fm = float(m);
    float mh = hash(vec2(fm, 41.0));
    float z = 0.4 + 0.6 * hash(vec2(fm, 5.0));
    vec2 mp = vec2(
      (hash(vec2(fm, 17.0)) - 0.5) * 1.9 + sin(t * (0.12 + mh * 0.25) + fm) * 0.07 - yaw * 0.3,
      mod(mh + t * (0.012 + mh * 0.02), 1.0) * 1.1 - 0.5);
    float md = length(uv - mp);
    float tw = 0.75 + 0.25 * sin(t * (1.0 + mh * 2.5) + fm) + uHighHit * 0.5;
    float sz = 0.00018 * (1.5 - z);
    color += mix(vec3(0.7, 0.85, 1.0), uColor1, 0.3) * (sz / (md * md + 0.0004 * (1.5 - z))) * tw * z * 0.5;
  }

  // elegant vignette, kick breathes the light a little
  vec2 vq = (gl_FragCoord.xy / uResolution - 0.5) * 1.44;
  color *= smoothstep(1.7, 0.5, length(vq));
  color *= 1.0 + uBeat * 0.12;
  color = vec3(1.0) - exp(-color * 1.25);      // soft tone-map, no clipped whites
  gl_FragColor = vec4(color, 1.0);
}

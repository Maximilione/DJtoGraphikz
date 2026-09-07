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

// PS2 boot screen, done properly: TRUE 3D prisms via heightfield column
// raycast (grid DDA) — real faces, real occlusion, floor reflection, deep
// blue haze. The kick raises fresh towers, bass makes the skyline breathe.

float towerH(vec2 cell) {
  // clear corridor along the camera path (x ≈ 0..1) so we glide BETWEEN towers
  if (abs(cell.x - 0.5) < 1.6) return 0.0;
  float presence = hash(cell);
  float thresh = 1.0 - towers / 90.0;          // param drives density
  if (presence < thresh) return 0.0;
  float hh = hash(cell + 7.7);
  float lift = step(0.8, hash(cell + floor(uBassTime * 1.2) * 3.1)) * uBassHit * 0.8;
  return 0.8 + hh * hh * 4.6 + lift + uBass * 0.3;
}

// grid-DDA heightfield trace. Returns dist, writes normal + hit height info.
float trace(vec3 ro, vec3 rd, out vec3 nrm, out float hitH, out float colH) {
  vec2 cell = floor(ro.xz);
  vec2 stp = vec2(rd.x >= 0.0 ? 1.0 : -1.0, rd.z >= 0.0 ? 1.0 : -1.0);
  vec2 inv = vec2(
    1.0 / (abs(rd.x) < 1e-5 ? (rd.x < 0.0 ? -1e-5 : 1e-5) : rd.x),
    1.0 / (abs(rd.z) < 1e-5 ? (rd.z < 0.0 ? -1e-5 : 1e-5) : rd.z));
  vec2 tDelta = abs(inv);
  vec2 tMax = vec2(
    (cell.x + max(stp.x, 0.0) - ro.x) * inv.x,
    (cell.y + max(stp.y, 0.0) - ro.z) * inv.y);
  float tEnter = 0.0;
  vec2 lastAxis = vec2(1.0, 0.0);

  for (int i = 0; i < 40; i++) {
    float h = towerH(cell);
    float tExit = min(tMax.x, tMax.y);
    if (h > 0.0) {
      float yEnter = ro.y + rd.y * tEnter;
      if (yEnter <= h && yEnter >= 0.0) {
        nrm = vec3(-lastAxis.x * stp.x, 0.0, -lastAxis.y * stp.y);
        hitH = yEnter; colH = h;
        return tEnter;
      }
      if (rd.y < 0.0) {
        float tTop = (h - ro.y) / rd.y;
        if (tTop > tEnter && tTop < tExit) { nrm = vec3(0.0, 1.0, 0.0); hitH = h; colH = h; return tTop; }
      }
    }
    // floor inside this cell?
    if (rd.y < 0.0) {
      float tFloor = -ro.y / rd.y;
      if (tFloor > tEnter && tFloor <= tExit) { nrm = vec3(0.0, 1.0, 0.0); hitH = 0.0; colH = 0.0; return tFloor; }
    }
    tEnter = tExit;
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; cell.x += stp.x; lastAxis = vec2(1.0, 0.0); }
    else { tMax.y += tDelta.y; cell.y += stp.y; lastAxis = vec2(0.0, 1.0); }
    if (tEnter > 40.0) break;
  }
  nrm = vec3(0.0, 1.0, 0.0); hitH = -1.0; colH = 0.0;
  return -1.0;
}

vec3 shade(vec3 ro, vec3 rd, float t, vec3 nrm, float hitH, float colH, vec3 fogC) {
  if (t < 0.0) return fogC * (0.6 + rd.y * 1.2); // sky: darker upward
  vec3 p = ro + rd * t;
  float fog = exp(-t * (0.035 + foglevel * 0.03));
  vec3 col;
  if (hitH <= 0.001 && colH <= 0.0) {
    // floor: near-black blue
    col = fogC * 0.35;
  } else {
    // tower: translucent silver glass, brighter toward the top, faint bands
    float vgrad = colH > 0.0 ? hitH / colH : 1.0;
    float axis = abs(nrm.x) > 0.5 ? 0.92 : abs(nrm.z) > 0.5 ? 0.70 : 1.25;
    vec3 silver = mix(vec3(0.78, 0.84, 0.95), uColor1, 0.10);
    col = silver * (0.35 + vgrad * 0.75) * axis;
    col += silver * smoothstep(0.92, 1.0, vgrad) * 0.8;                 // glowing crown
    col += silver * (0.5 + 0.5 * sin(hitH * 9.0 + uTime * 0.4)) * 0.06; // faint bands
    float fres = pow(1.0 - abs(dot(nrm, -rd)), 2.0);
    col += vec3(0.7, 0.8, 1.0) * fres * 0.35;
  }
  return mix(fogC * 0.55, col, fog);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 fogC = mix(vec3(0.012, 0.018, 0.06), uColor3 * 0.12, 0.4);

  // camera: gliding sideways through the tower field, gentle sway, low pitch
  vec3 ro = vec3(0.5 + sin(t * 0.15) * 0.6, 2.1 + sin(t * 0.23) * 0.15, t * (0.35 + orbit * 0.3) + uBassTime * 0.15);
  float yaw = sin(t * 0.11) * 0.5;
  float pitch = -0.30 + sin(t * 0.17) * 0.05;
  vec3 rd = normalize(vec3(uv, 1.15));
  rd.yz = rot(pitch) * rd.yz;
  rd.xz = rot(yaw) * rd.xz;

  vec3 nrm; float hitH, colH;
  float d = trace(ro, rd, nrm, hitH, colH);
  vec3 color = shade(ro, rd, d, nrm, hitH, colH, fogC);

  // floor reflection: bounce once, cheaper trace budget via same function
  if (d > 0.0 && hitH <= 0.001 && colH <= 0.0) {
    vec3 p = ro + rd * d + vec3(0.0, 0.001, 0.0);
    vec3 rrd = reflect(rd, vec3(0.0, 1.0, 0.0));
    vec3 n2; float h2, c2;
    float d2 = trace(p, rrd, n2, h2, c2);
    if (d2 > 0.0 && c2 > 0.0) {
      vec3 rc = shade(p, rrd, d2, n2, h2, c2, fogC);
      float fade = exp(-d * 0.10);
      color += rc * 0.35 * fade;
    }
  }

  // rising motes — the PS2 fireflies
  for (int m = 0; m < 12; m++) {
    float fm = float(m);
    float mh = hash(vec2(fm, 41.0));
    vec2 mp = vec2(
      (hash(vec2(fm, 17.0)) - 0.5) * 1.6 + sin(t * (0.25 + mh * 0.6) + fm) * 0.06,
      mod(mh + t * (0.025 + mh * 0.045), 1.0) * 1.15 - 0.6);
    float md = length(uv - mp);
    float tw = 0.7 + 0.3 * sin(t * (3.0 + mh * 7.0) + fm) + uHighHit * 0.6;
    color += mix(vec3(0.85, 0.9, 1.0), uColor1, mh * 0.4) * (0.00022 / (md * md + 0.0003)) * tw * 0.6;
  }

  // gentle vignette + beat bloom (subtle: PS2 is elegant, not a strobe)
  color *= smoothstep(1.6, 0.55, length(uv));
  color *= 1.0 + uBeat * 0.10;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

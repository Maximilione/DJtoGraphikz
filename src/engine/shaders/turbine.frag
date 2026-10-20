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

uniform float speed;
uniform float strobe;
uniform float blades;

// Turbine: a huge rotor (wind or jet) seen head-on in a dark hangar, raymarched.
// The blades are a polar-repeated, radius-twisted box (true propeller pitch:
// the cross-section rotates around its own radial axis as the radius grows),
// spinning continuously around the hub. Between kicks it is a dark metal
// silhouette with only a cold rim and a soft analytic "blur disc" standing in
// for the spin blur a single raymarched sample cannot give. On the kick a hard
// flash from the hub lights the blades for that instant only, which is what
// reads as a frozen/slowed frame once the lit instant and the dark instants
// alternate with the beat.

const float TAU = 6.2831853;
const vec3 HUB = vec3(0.0, 0.0, -6.0);
const float HUB_R = 0.75;
const float BLADE_LEN = 3.4;
const float BLADE_THICK = 0.12;

float gKick;
float gAngle;
float gNB;
float gSector, gInvSector; // TAU / gNB and its reciprocal, once per pixel

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCyl(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float bladeField(vec3 p) {
  vec3 q = p - HUB;
  float r = length(q.xy);
  float ang = atan(q.y, q.x) - gAngle;
  float u = (ang + gSector * 0.5) * gInvSector;
  float a2 = (u - floor(u) - 0.5) * gSector;
  float x = r - HUB_R;                // along the blade, root to tip
  float y = r * a2;                   // lateral (arc) offset within the blade
  float z = q.z;
  float xt = clamp(x * (1.0 / BLADE_LEN), 0.0, 1.0);
  // pitch twist: the cross-section rotates around the radial axis with x
  float twist = 1.1 * xt;
  float cs = cos(twist), sn = sin(twist);
  float yz_y = y * cs - z * sn;
  float yz_z = y * sn + z * cs;
  float taper = mix(0.46, 0.08, xt);
  vec3 bp = vec3(x - BLADE_LEN * 0.5, yz_y, yz_z);
  return sdBox(bp, vec3(BLADE_LEN * 0.5, taper, BLADE_THICK));
}

float map(vec3 p) {
  vec3 q = p - HUB;
  float hub = sdCyl(q, 0.55, HUB_R * 1.05);
  return min(hub, bladeField(p));
}

// Bounding sphere round the rotor: blade tip r <= HUB_R + BLADE_LEN = 4.15,
// |z| <= hypot(taper, BLADE_THICK) = 0.475, hub 0.96 -> everything sits
// inside radius 4.18 of HUB; 4.25 leaves a margin. The camera is ~8.2 away,
// so the march starts at the sphere, stops at its far side, and rays that
// miss it (the frame corners) never march at all.
float march(vec3 ro, vec3 rd) {
  vec3 oc = ro - HUB;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - 18.0625); // 4.25^2
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = max(0.1, -b - h);
  float tEnd = min(30.0, -b + h);
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.003) return t;
    t += d * 0.9;
    if (t > tEnd) break;
  }
  return -1.0;
}

vec3 backdrop(vec2 uv) {
  vec3 c = uColor2 * 0.03 + uColor1 * 0.015 * (0.5 - uv.y);
  float girders = smoothstep(0.985, 1.0, abs(sin(uv.x * 14.0)));
  c += uColor1 * girders * 0.015;
  return c;
}

vec3 shade(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
  vec2 k = vec2(1.0, -1.0);
  const float e = 0.0035;
  vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                     k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));

  // always-on floor: cold rim + a dim ambient key, so the rotor reads as a
  // dark shape even with no flash at all
  float rf = 1.0 - max(dot(n, -rd), 0.0);
  float rim = rf * rf * sqrt(rf); // ^2.5
  vec3 c = uColor2 * 0.05 + uColor1 * rim * 0.22;
  vec3 Lamb = normalize(vec3(0.3, 0.6, 0.6));
  c += uColor2 * max(dot(n, Lamb), 0.0) * 0.12;

  // strobe: a hard flash from the hub, synced to the kick only (uniform
  // branch: between kicks the whole block is a multiply by zero)
  float flash = gKick * clamp(strobe, 0.0, 2.0);
  if (flash > 0.0) {
    vec3 L = normalize((HUB + vec3(0.0, 0.0, 1.6)) - p);
    float diff = max(dot(n, L), 0.0);
    float d2 = diff * diff;
    vec3 strobeCol = mix(vec3(1.0), uColor3, 0.3);
    c += strobeCol * diff * flash * 3.2 + strobeCol * (d2 * d2 * d2) * flash * 2.0;
  }
  return c;
}

// Analytic stand-in for spin blur: a soft, angularly-blurred band at the
// rotor's plane. Width grows with rotation speed (fast spin reads blurrier);
// it fades out as the strobe takes over the crisp raymarched frame.
vec3 bladeGlow(vec3 ro, vec3 rd) {
  if (rd.z >= -0.001) return vec3(0.0);
  float tp = (HUB.z - ro.z) / rd.z;
  if (tp < 0.0 || tp > 40.0) return vec3(0.0);
  vec3 p = ro + rd * tp;
  vec3 q = p - HUB;
  float r = length(q.xy);
  float radial = smoothstep(HUB_R - 0.1, HUB_R + 0.3, r) *
                 (1.0 - smoothstep(HUB_R + BLADE_LEN - 0.4, HUB_R + BLADE_LEN + 0.2, r));
  if (radial <= 0.0) return vec3(0.0); // outside the annulus: no atan/cos/pow
  float ang = atan(q.y, q.x) - gAngle;
  float spd = clamp(speed, 0.1, 3.0);
  float sharpness = mix(9.0, 1.6, clamp(spd / 3.0, 0.0, 1.0));
  float band = pow(0.5 + 0.5 * cos(gNB * ang), sharpness);
  float still = 1.0 - gKick * 0.85;
  return mix(uColor1, uColor2, 0.4) * band * radial * 0.22 * still;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  gKick = clamp(uBassHit, 0.0, 1.0);
  gNB = floor(clamp(blades, 3.0, 8.0) + 0.5);
  gSector = TAU / gNB;
  gInvSector = gNB / TAU;
  float rot = clamp(speed, 0.1, 3.0);
  gAngle = uTime * rot * 1.6 + uBassTime * 0.05;

  vec3 ro = vec3(0.6 + 0.35 * sin(uTime * 0.09), 0.25, 2.2);
  vec3 rd = normalize(vec3(uv, -1.35));

  float t = march(ro, rd);
  vec3 col;
  if (t > 0.0) {
    col = mix(backdrop(uv), shade(ro, rd, t), exp(-max(t - 5.0, 0.0) * 0.05));
  } else {
    col = backdrop(uv);
  }

  col += bladeGlow(ro, rd);

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.25 - dot(uv, uv) * 0.85, 0.4, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

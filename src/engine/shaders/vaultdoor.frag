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

uniform float apertura;
uniform float rings;
uniform float glow;

// Vaultdoor: a blast-door iris fills the frame — a steel disc recessed into a
// hazard-striped wall, rivets round its rim, concentric rings whose panel
// seams rotate against each other like a camera diaphragm. The disc has a
// real hole at its centre (a true SDF annulus, not a texture trick): at rest
// it sits barely cracked, and on every kick it snaps open, a ray can pass
// clean through it and hit the glow wall standing behind, then it falls
// shut again. The ring seams carry a light pulse that runs ring to ring
// (a cascade keyed to uBeatClock) the way current runs down a strip of
// conduit. Dark brushed steel, lit only by what bleeds from the hole and the
// seams — the light is the image.

const float TAU = 6.2831853;
const float R = 1.65;      // door radius
const float THICK = 0.3;
const float ZDOOR = 0.0;
const float ZBACK = -1.6;  // the glow wall behind the door

float gGlow;   // soft bleed accumulated during the march, like monolith's fog
float gAper;   // current hole radius, computed once per frame in main()

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdSphere(vec3 p, float r) { return length(p) - r; }

// door disc: a flat annulus (capped cylinder minus the centre hole)
float doorSdf(vec3 p) {
  float r = length(p.xy);
  float cyl = max(r - R, abs(p.z - ZDOOR) - THICK * 0.5);
  float hole = r - gAper; // standard SDF convention: negative inside the hole
  return max(cyl, -hole); // CSG subtract: carves the hole out of the disc
}

// rivets: one ring of bumps just inside the rim, angularly repeated
float rivetSdf(vec3 p) {
  float r = length(p.xy);
  float a = atan(p.y, p.x);
  float n = 20.0;
  float ai = floor(a / TAU * n + 0.5);
  float ac = ai / n * TAU;
  vec3 c = vec3(cos(ac), sin(ac), 0.0) * (R - 0.14);
  return sdSphere(p - vec3(c.xy, ZDOOR + THICK * 0.5), 0.055);
}

// the recessed frame wall the door sits in: a flat slab with a circular
// hole matched to the door radius, so the door alone fills that opening
float wallSdf(vec3 p) {
  float slab = sdBox(p - vec3(0.0, 0.0, ZDOOR - 0.05), vec3(5.0, 3.2, 0.06));
  float r = length(p.xy);
  return max(slab, -(r - R));
}

// the glow wall standing in the dark behind the door — only reached by rays
// that pass clean through the centre hole
float backSdf(vec3 p) { return p.z - ZBACK; }

float map(vec3 p) {
  return min(min(min(doorSdf(p), rivetSdf(p)), wallSdf(p)), backSdf(p));
}

vec3 glowColor() {
  return mix(uColor3, vec3(1.0), 0.5 + 0.3 * uBassHit);
}

float march(vec3 ro, vec3 rd, float tmax) {
  float t = 0.05;
  for (int i = 0; i < 70; i++) {
    if (t > tmax) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    // bleed glow: brighter the closer a step sits to the hole's edge
    float r = length(p.xy);
    float edge = abs(r - gAper);
    gGlow += clamp(d, 0.03, 0.5) * 0.05 / (0.06 + edge * edge * 2.0);
    if (d < 0.003) return t;
    t += d * 0.9;
  }
  return -1.0;
}

vec3 shade(vec3 p, vec3 rd) {
  const float e = 0.004;
  vec2 k = vec2(1.0, -1.0);
  vec3 n = normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) +
                     k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));

  float r = length(p.xy);
  float ang = atan(p.y, p.x);

  // light from the hole, always on (floor), stronger with bass / kick
  vec3 lp = vec3(0.0, 0.0, ZDOOR);
  vec3 L = normalize(lp - p);
  float lit = max(dot(n, L), 0.0) / (1.0 + 0.15 * r * r);
  float bleed = 0.35 + 0.9 * uBass + 1.2 * uBassHit;
  vec3 col = glowColor() * lit * bleed * 0.6;

  // dark brushed steel base + cold rim
  col += uColor2 * 0.045;
  col += uColor1 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.4;

  bool onDoor = r < R + 0.01 && abs(p.z - ZDOOR) < THICK;
  if (onDoor) {
    // concentric rings, each rotated against the next; a light pulse runs
    // ring to ring, cascading outward on the beat
    float nRings = max(3.0, rings);
    float ringW = (R - gAper) / nRings;
    float ri = floor((r - gAper) / max(ringW, 0.001));
    float ringRot = ri * 0.7 + uBeatClock * 0.15 * (mod(ri, 2.0) * 2.0 - 1.0);
    float seg = abs(sin((ang + ringRot) * 10.0));
    float seam = smoothstep(0.93, 1.0, seg);
    float cascade = smoothstep(0.0, 1.0, sin(ri * 0.9 - uBeatClock * 1.6) * 0.5 + 0.5);
    col += glowColor() * seam * (0.15 + 0.85 * cascade) * (0.4 + 0.6 * uMid) * glow;
    // ring boundary grooves catch a thin rim of light too
    float bandEdge = smoothstep(0.0, 0.03, ringW * 0.5 - abs(mod(r - gAper, ringW) - ringW * 0.5));
    col += uColor1 * bandEdge * 0.12;
  } else if (r < R + 0.9) {
    // hazard border on the recessed wall around the door
    float stripe = fract((p.x + p.y) * 2.2 - uTime * 0.05);
    float band = step(0.5, stripe);
    col += mix(vec3(0.0), uColor3 * 0.5, band) * 0.35;
    col += uColor2 * 0.03;
  }
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float breathe = 0.5 + 0.5 * sin(uBeatClock * 0.5);
  float base = apertura * (0.6 + 0.4 * breathe);
  float snap = uBassHit * (R - apertura) * 0.55;
  gAper = clamp(base + snap, 0.02, R * 0.8);
  gGlow = 0.0;

  vec3 ro = vec3(0.0, 0.0, 2.6);
  vec3 rd = normalize(vec3(uv, -1.3));

  float tmax = 8.0;
  float t = march(ro, rd, tmax);
  vec3 col;
  if (t > 0.0) {
    vec3 p = ro + rd * t;
    if (p.z < ZDOOR - THICK * 0.4) {
      // passed clean through the hole: the glow wall behind the door — not
      // a flat disc, a radial burn brightest at the centre, with a pulse
      float r2 = length(p.xy);
      float radial = exp(-r2 * r2 * 0.35);
      float pulse = 0.5 + 0.5 * sin(uBeatClock * 2.0 + r2 * 4.0);
      col = glowColor() * (0.5 + 1.1 * uBass + 1.5 * uBassHit) * (0.5 + 0.5 * pulse) * (0.4 + 0.9 * radial);
    } else {
      col = shade(p, rd);
    }
    col = mix(uColor2 * 0.04, col, exp(-max(t - 2.6, 0.0) * 0.1));
  } else {
    col = uColor2 * 0.03 + uColor1 * 0.015 * (0.5 - uv.y);
  }

  vec3 bleedCol = glowColor();
  col += bleedCol * gGlow * 0.025 * (0.6 + 0.8 * uBass) * glow;
  // emergency floor: never fully dark even at rest
  col += uColor1 * 0.012;

  col = col / (1.0 + 0.5 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.85, 0.35, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

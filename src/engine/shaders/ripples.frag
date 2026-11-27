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
uniform float spreadv;
uniform float heightk;
uniform float sheen;

// Liquid surface seen low across the water: the kick drops a stone in the
// middle, hats rain around it — expanding rings interfere like real water and
// mirror a palette sky. Flat from above it had no depth and read as plastic.

// one ring: xy = gradient of the height, z = height. birth is a floor of
// `now`, so age >= 0 always; the two decays share one exp
vec3 ripple(vec2 w, vec2 c, float birth, float now, float speed) {
  float age = now - birth;
  vec2 dv = w - c;
  float r = max(length(dv), 1e-4);
  float env = exp(-r * 2.2 - age * 1.4) * smoothstep(0.0, 0.08, age);
  float ph = (r - age * speed) * 30.0;
  float sn = sin(ph), cs = cos(ph);
  return vec3(dv / r * (30.0 * cs - 2.2 * sn), sn) * env;
}

// palette sky the water mirrors: colour 2 glowing at the horizon, colour 3
// overhead, a low moon of colour 1 straight ahead, and curtains of light
// that rise with the energy so the top of the frame is alive too
const vec3 LDIR = vec3(0.0, 0.2588, 0.9659);
vec3 sky(vec3 d) {
  float y = max(d.y, 0.0);
  float glow = exp(-y * 6.0);
  vec3 c = mix(uColor3 * 0.10, uColor2 * (0.38 + 0.35 * uEnergy + 0.5 * uBassHit), glow);
  // curtains: vertical folds drifting sideways, brightest a little above the horizon
  float ax = d.x / (abs(d.z) + 0.35);
  float fold = sin(ax * 7.0 + 1.6 * sin(ax * 2.3 - uTime * 0.21) + uTime * 0.13);
  float fold2 = sin(ax * 13.0 - uTime * 0.17 + 2.0 * fold);
  float curtain = (0.5 + 0.5 * fold) * (0.6 + 0.4 * fold2);
  curtain *= curtain * smoothstep(0.0, 0.10, y) * exp(-y * (3.2 - 2.0 * uEnergy));
  c += mix(uColor1, uColor3, 0.5 + 0.5 * fold2) * curtain * (0.16 + 1.1 * uEnergy);
  float s = max(dot(d, LDIR), 0.0);
  float s2 = s * s, s8 = s2 * s2 * s2 * s2, s64 = s8 * s8 * s8 * s8 * s8 * s8 * s8 * s8;
  // wide glow, then the disc with a white heart
  c += uColor1 * (s8 * s8 * 0.25 + s64 * s64 * 0.5);
  c += mix(uColor1, vec3(1.0), 0.7) * smoothstep(0.9978, 0.9988, s) * 0.9;
  return c;
}

void main() {
  // short side: rings keep their size on a portrait output instead of being
  // cropped to a slice of one ring
  float side = min(uResolution.x, uResolution.y);
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / side;
  float t = uTime;
  float speed = spreadv * 0.4;

  // wide lens looking down at the water: it takes two thirds of the frame and
  // the stone sits in the middle of it, not in a strip at the bottom
  const float HORIZON = 0.17;
  const float FOCAL = 0.62;
  const float CAMH = 1.0;
  vec3 rd = normalize(vec3(uv.x, uv.y - HORIZON, FOCAL));
  vec3 color;

  if (rd.y < -1e-3) {
    float dist = CAMH / -rd.y;
    vec2 pos = rd.xz * dist;
    // the old top-down frame, laid on the water in front of the camera
    vec2 w = (pos - vec2(0.0, 2.3)) * 0.44;
    // rings finer than a pixel towards the horizon would shimmer: fade them
    float foot = dist * dist / (CAMH * FOCAL * side) * 0.44 * 30.0;
    float lod = clamp(1.3 - foot * 0.9, 0.0, 1.0);

    // height field: kick ripples from center-ish points (last 4 kicks emulated
    // via the gated bass clock), hat ripples at random spots
    vec3 hk = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float birth = floor(uBassTime * 1.5 - fi) / 1.5;
      vec2 c = (vec2(hash(vec2(birth, 1.0)), hash(vec2(birth, 7.0))) - 0.5) * 0.7;
      hk += ripple(w, c, birth, uBassTime, speed);
    }
    // the bass is the height of the water: low swell in a quiet room, three
    // times that on a loud track
    hk *= 0.55 + 1.5 * uBass;
    vec3 hg = hk;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float birth = floor(uHighTime * 3.0 - fi) / 3.0;
      vec2 c = (vec2(hash(vec2(birth, 13.0)), hash(vec2(birth, 29.0))) - 0.5) * vec2(1.6, 1.0);
      hg += ripple(w, c, birth, uHighTime, speed * 1.6) * (0.25 + 0.5 * uHigh);
    }
    hg *= heightk * lod;
    // ambient swell so still water still breathes
    float sw = 0.05 * (0.3 + uEnergy);
    float ax = w.x * 3.0 + t * 0.7, ay = w.y * 2.5 - t * 0.5;
    hg += vec3(3.0 * cos(ax) * sin(ay), 2.5 * sin(ax) * cos(ay), sin(ax) * sin(ay)) * sw;

    vec3 nrm = normalize(vec3(-hg.x * 0.03, 1.0, -hg.y * 0.03));
    vec3 refl = reflect(rd, nrm);
    refl.y = abs(refl.y);
    float fz = 1.0 - max(dot(-rd, nrm), 0.0);
    float fres = 0.04 + 0.96 * fz * fz * fz * fz * fz;

    // crests carry colour 1, the faces turned to the camera colour 2, troughs
    // stay dark: the rings are drawn in the palette, not in grey reflections
    float crest = clamp(hg.z * 1.6, 0.0, 1.0);
    float face = clamp(-hg.y * 0.03, 0.0, 1.0);
    vec3 body = uColor3 * 0.05 + uColor1 * crest * crest * 0.85 + uColor2 * face * 0.55;
    color = mix(body, sky(refl), fres * (1.0 - 0.65 * crest));
    // the moon is already in sky(refl): sheen scales its glitter, the highs
    // and the kick light it
    float s = max(dot(refl, LDIR), 0.0);
    float s2 = s * s, s8 = s2 * s2 * s2 * s2, s32 = s8 * s8 * s8 * s8;
    color += mix(uColor1, vec3(1.0), 0.3) * s32 * s32 * (sheen - 0.5 + 1.6 * uHigh + uBeat * 0.4) * 0.7;
    // glints: single facets catching the light, a new set on every hat
    vec2 gw = w * 70.0;
    float gh = hash(floor(gw) + floor(uHighTime * 8.0) * 3.1);
    vec2 gf = fract(gw) - 0.5;
    color += mix(uColor1, vec3(1.0), 0.5) * step(0.9, gh) * exp(-dot(gf, gf) * 22.0) * uHigh * sheen * lod * (0.3 + 1.2 * crest);

    // the kick: a bright ring leaves the stone and runs out as the hit decays
    float kr = (length(w) - (0.06 + 0.85 * (1.0 - uBassHit))) * 15.0;
    float kring = exp(-kr * kr) * uBassHit;
    color += mix(uColor2, vec3(1.0), 0.35) * kring * 1.5 + uColor2 * crest * uBassHit * 0.5;
    // haze towards the horizon
    color = mix(color, sky(vec3(rd.x, 0.0, rd.z)), 1.0 - exp(-dist * 0.035));
  } else {
    color = sky(rd);
  }

  // vignette in frame space, bounded on any aspect (a 6:1 strip was black
  // past |uv.x| > 1.5)
  color *= smoothstep(1.5, 0.6, length((vUv - 0.5) * vec2(1.78, 1.0)));
  color = clamp(color, 0.0, 2.0);   // sheen below 0.5 takes glitter away, never below black
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;   // sky and haze gradients band on 8 bit
  gl_FragColor = vec4(color, 1.0);
}

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

uniform float tempo;
uniform float crew;
uniform float pyro;
uniform float tape;

// Titan Hand: a frame from a 90s tokusatsu episode. The set is a miniature:
// the foot of a building too big for the frame, three steel bay doors, a
// plaza, smoke-machine haze along the ground, model trees out of focus in
// front of the lens. Three suited heroes hold the plaza. Every 8 beats a bay
// rattles, bursts open on the beat, and the hand of something the size of the
// building comes out of it: a suit actor's glove, wet black latex fingers and
// a fur sleeve. It gropes after the team, pats the ground, winds up and slams
// (sparks, shake, a punch-in), shakes its fist and is gone; the doors slam
// and the team runs to the next bay and strikes the roll-call pose with a
// coloured charge going off behind each of them. Nothing here is flat paint:
// every solid is a distance field lit with a key, a back light and a
// specular. The picture is finished the way a home deck would have recorded it.

const float FY = -0.2;                   // where the facade meets the plaza
const float HS = 0.25;                   // height of a hero on screen

// ---- tokusatsu kit: the same block lives in titanhand.frag and kaijustomp.frag ----
// Everything here is drawn as a lit object, not as a flat shape: each 2D
// distance field carries its gradient, the inside is given a round profile,
// and that normal is lit by a key light, a coloured back light and a wet
// specular. That is what makes latex read as latex.
const float TAU = 6.2831853;

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(27.17, 91.43))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { return 0.62 * vn(p) + 0.38 * vn(p * 2.3 + 7.3); }

vec3 gCol;                      // the frame being painted
float gPx;                      // edge softness: one pixel in focus, many out of it
vec3 gL, gKey, gAmb, gRim;      // key direction and colour, ambient, back light
vec3 cA, cB, cC;                // the three suit colours, from the palette

float aa(float d) { return 1.0 - smoothstep(-gPx, gPx, d); }

// distance fields that also return their gradient in .yz
vec3 gCirc(vec2 p, float r) { float l = length(p); return vec3(l - r, p / max(l, 1e-5)); }
vec3 gSeg(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 q = pa - ba * h;
  float l = length(q);
  return vec3(l - mix(ra, rb, h), q / max(l, 1e-5));
}
vec3 gEll(vec2 p, vec2 r) {
  float k0 = length(p / r);
  vec2 g = p / (r * r);
  float k1 = length(g);
  return vec3(k0 * (k0 - 1.0) / max(k1, 1e-5), g / max(k1, 1e-5));
}
vec3 gBox(vec2 p, vec2 b, float r) {
  vec2 w = abs(p) - b + r;
  float g = max(w.x, w.y);
  vec2 q = max(w, 0.0);
  float l = length(q);
  vec2 n = g > 0.0 ? q / max(l, 1e-5) : (w.x > w.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3((g > 0.0 ? l : g) - r, sign(p) * n);
}
vec3 smin3(vec3 a, vec3 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec3(mix(b.x, a.x, h) - k * h * (1.0 - h), mix(b.yz, a.yz, h));
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// light a field as a rounded solid. rad = how far in the surface keeps
// curving; gloss 0 cloth .. 1 wet latex; bn = extra normal tilt (texture)
void lit(vec3 dg, float rad, vec3 alb, float gloss, vec2 bn) {
  float d = dg.x;
  if (d > 0.03) return;
  gCol *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.03, d)) * step(0.0, d);     // it shades what is behind it
  float t = clamp(-d / rad, 0.0, 1.0);
  float z = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  vec3 n = normalize(vec3(dg.yz * (1.0 - t) + bn, z + 0.06));
  float dif = max(dot(n, gL) * 0.8 + 0.2, 0.0);
  float sp = pow(max(dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))), 0.0), mix(10.0, 110.0, gloss)) * gloss * (0.35 + 2.2 * gloss);
  float rim = pow(1.0 - n.z, 2.2) * max(dot(n.xy, -normalize(gL.xy)) * 0.6 + 0.6, 0.0);
  vec3 c = alb * (gAmb + gKey * dif) + gKey * sp + gRim * rim * (0.2 + 0.6 * alb + 0.3 * gloss);
  c *= 0.5 + 0.5 * smoothstep(0.0, 0.3, t);
  gCol = mix(gCol, c, aa(d));
}

// two-bone limb from a to c, each bone l long, s picks the side the joint bends to
void limb(vec2 q, vec2 a, vec2 c, float l, float s, float r, vec3 c1, vec3 c2, float gloss) {
  vec2 dl = c - a;
  float ln = max(length(dl), 1e-4);
  vec2 dir = dl / ln;
  ln = min(ln, 2.0 * l - 1e-3);
  c = a + dir * ln;
  vec2 j = a + dir * ln * 0.5 + vec2(-dir.y, dir.x) * s * sqrt(max(l * l - ln * ln * 0.25, 0.0));
  lit(gSeg(q, a, j, r, r * 0.88), r, c1, gloss, vec2(0.0));
  lit(gSeg(q, j, c, r * 0.9, r * 0.8), r, c2, gloss, vec2(0.0));
  lit(gCirc(q - c, r * 0.95), r, c2, gloss, vec2(0.0));
}

// one of the suited team, feet at o, s = height on screen, facing dir.
// mode 0 guard stance, 1 run, 2 tumble through the air, 3 the roll-call pose.
// v 0..2 picks the colour, the visor and the pose
void hero(vec2 p, vec2 o, float s, float dir, float mode, float ph, float v) {
  vec2 q = (p - o) / s;
  q.x *= dir;
  if (q.x < -0.6 || q.x > 0.6 || q.y < -0.25 || q.y > 1.3) return;
  float keep = gPx;
  gPx /= s;
  float run = step(0.5, mode) * step(mode, 1.5), tum = step(1.5, mode) * step(mode, 2.5), pose = step(2.5, mode);
  float guard = 1.0 - run - tum - pose;
  if (tum > 0.5) {
    float ra = -ph;
    vec2 c = q - vec2(0.0, 0.5);
    q = vec2(c.x * cos(ra) - c.y * sin(ra), c.x * sin(ra) + c.y * cos(ra)) + vec2(0.0, 0.5);
  }
  vec3 suit = v < 0.5 ? cA : v < 1.5 ? cB : cC;
  vec3 white = vec3(0.92, 0.92, 0.9);
  float bob = 0.012 * sin(uBeatClock * TAU + v);
  vec2 hip = vec2(0.0, 0.5 - 0.05 * guard - 0.02 * run + bob * guard + 0.03 * abs(sin(ph)) * run);
  float lean = 0.26 * run + 0.08 * guard + 0.2 * tum;
  vec2 chest = hip + vec2(lean * 0.3, 0.29 - 0.05 * tum);
  float a0 = ph, a1 = ph + 3.14159;
  vec2 fA = guard * vec2(-0.17, 0.02) + run * vec2(0.21 * cos(a1) - 0.03, 0.02 + 0.13 * max(sin(a1), 0.0)) + tum * (hip + vec2(0.1, -0.2)) + pose * vec2(-0.13, 0.02);
  vec2 fB = guard * vec2(0.15, 0.02) + run * vec2(0.21 * cos(a0) - 0.03, 0.02 + 0.13 * max(sin(a0), 0.0)) + tum * (hip + vec2(0.17, -0.12)) + pose * vec2(0.14, 0.02);
  vec2 hA, hB;
  if (pose > 0.5) {
    hA = v < 0.5 ? vec2(-0.25, 1.0) : v < 1.5 ? vec2(-0.2, 0.6) : vec2(-0.14, 0.5);
    hB = v < 0.5 ? vec2(0.26, 1.0) : v < 1.5 ? vec2(0.3, 0.93) : vec2(0.07, 1.1);
  } else {
    hA = chest + guard * vec2(0.16, -0.03) + run * vec2(0.17 * cos(a0), -0.16 + 0.1 * cos(a0)) + tum * vec2(0.14, -0.18);
    hB = chest + guard * vec2(0.22, -0.13) + run * vec2(0.17 * cos(a1), -0.16 + 0.1 * cos(a1)) + tum * vec2(0.2, -0.1);
  }
  float es = pose > 0.5 ? 1.0 : -1.0;
  limb(q, chest + vec2(-0.05, -0.025), hA, 0.165, -es, 0.047, suit * 0.8, white * 0.8, 0.45);
  limb(q, hip + vec2(-0.035, 0.0), fA, 0.25, 1.0, 0.062, suit * 0.8, white * 0.8, 0.45);
  lit(gEll(q - fA - vec2(0.04, -0.002), vec2(0.075, 0.038)), 0.04, white * 0.8, 0.5, vec2(0.0));
  // torso: spandex with a white chevron and a belt
  vec3 tg = gSeg(q, hip + vec2(0.0, 0.02), chest, 0.085, 0.118);
  vec2 tq = q - chest;
  vec3 ta = suit;
  ta = mix(ta, white, 1.0 - smoothstep(0.0, 0.012, abs(tq.y + 0.07 + abs(tq.x - lean * 0.02) * 0.9 - 0.02) - 0.022));
  ta = mix(ta, white, step(abs(q.y - hip.y - 0.035), 0.02));
  ta = mix(ta, vec3(1.0, 0.8, 0.25), step(length((q - hip - vec2(0.03, 0.035)) * vec2(1.0, 1.3)), 0.027));
  lit(tg, 0.1, ta, 0.45, vec2(0.0));
  limb(q, hip + vec2(0.035, 0.0), fB, 0.25, 1.0, 0.062, suit, white, 0.45);
  lit(gEll(q - fB - vec2(0.04, -0.002), vec2(0.075, 0.038)), 0.04, white, 0.5, vec2(0.0));
  // helmet: one glossy shell, a black visor and a silver mouthpiece of our own
  vec2 hc = chest + vec2(0.02 + lean * 0.06, 0.15);
  vec2 e = q - hc;
  float vis = v < 0.5 ? max(max(abs(e.x - 0.04) - 0.055, abs(e.y - 0.014) - 0.03), 0.016 - (e.y + 0.016) - abs(e.x - 0.04) * 0.9)
            : v < 1.5 ? length((e - vec2(0.04, 0.014)) * vec2(0.62, 1.0)) - 0.034
            : max(abs(e.x - 0.04) - 0.055, abs(e.y - 0.014 - (e.x - 0.04) * 0.4) - 0.02);
  vec3 ha = suit;
  ha = mix(ha, white, step(abs(e.x + 0.005), 0.011) * step(0.02, e.y) * step(v, 0.5));
  ha = mix(ha, white, step(abs(e.y - 0.062), 0.008) * step(1.5, v));
  ha = mix(ha, vec3(0.75, 0.77, 0.8), 1.0 - smoothstep(-0.004, 0.004, length((e - vec2(0.045, -0.047)) * vec2(0.6, 1.0)) - 0.022));
  ha = mix(ha, vec3(0.015), 1.0 - smoothstep(-0.004, 0.004, vis));
  lit(gCirc(e, 0.1), 0.1, ha, 0.95, vec2(0.0));
  limb(q, chest + vec2(0.055, -0.025), hB, 0.165, -es, 0.047, suit, white, 0.45);
  gPx = keep;
}

// a pyro charge: white-hot core, coloured fire, then smoke that rises. q from the
// charge, R its size, age in seconds-ish (0 = ignition). rgb premultiplied, a = cover
vec4 boom(vec2 q, float age, float R, vec3 hue, float seed) {
  if (age <= 0.0 || age > 1.6 || abs(q.x) > R * 2.2) return vec4(0.0);
  float grow = 1.0 - exp(-age * 8.0);
  q.y -= R * 0.55 * age;
  float n = fbm(q * 5.0 / R + vec2(seed * 9.0, -age * 2.5));
  float d = length(q * vec2(1.0, 0.8)) / (R * (0.2 + 0.8 * grow)) + (n - 0.5) * 0.9;
  float heat = clamp(1.0 - age * 1.9, 0.0, 1.0);
  float core = 1.0 - smoothstep(0.05, 0.75, d);
  vec3 fire = mix(hue * 1.3, vec3(1.0, 0.96, 0.78), core * core) * (1.0 + 2.2 * core);
  vec3 smoke = mix(hue * 0.4, vec3(0.16, 0.15, 0.15), 0.45) * (0.5 + 0.9 * n);
  float a = (1.0 - smoothstep(0.7, 1.08, d)) * (1.0 - smoothstep(0.9, 1.6, age));
  vec3 c = mix(smoke, fire, heat * (0.3 + 0.7 * core));
  // the bloom the tube adds around anything this bright
  float halo = heat * heat * exp(-dot(q, q) / (R * R * 1.4));
  return vec4(c * a + hue * halo * 0.55 * (1.0 - a), a);
}
void addBoom(vec2 q, float age, float R, vec3 hue, float seed) {
  vec4 b = boom(q, age, R, hue, seed);
  gCol = gCol * (1.0 - b.a) + b.rgb;
}

// a shower of sparks thrown up from q = 0, falling under gravity
vec3 sparks(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 9.0) return vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    float d = sdSeg(q, pos, pos - vel * 0.07);
    acc += exp(-d * d / (R * R * 0.0004)) * (0.4 + 0.6 * h11(fi + seed * 3.0));
  }
  return vec3(1.0, 0.72, 0.3) * acc * 2.2 * (1.0 - age) + vec3(1.0, 0.85, 0.6) * exp(-dot(q, q) / (R * R * 0.08)) * max(1.0 - age * 6.0, 0.0);
}

// what a consumer deck did to the picture. c0 is the frame, cl the same frame a
// few pixels to the left: the second render is what the colour smear costs
vec3 tapeLook(vec3 c0, vec3 cl, vec2 fc, float amt) {
  vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 av = (c0 + cl) * 0.5;
  // luma stays sharp, colour is smeared sideways and the red lags the blue
  vec3 chroma = vec3(cl.r - dot(cl, W), av.g - dot(av, W), c0.b - dot(c0, W));
  vec3 c = mix(c0, vec3(dot(c0, W) * 0.85 + dot(av, W) * 0.15) + chroma * 1.25, amt);
  float line = floor(fc.y / uResolution.y * 486.0);
  c *= 1.0 - 0.1 * amt * mod(line + floor(uTime * 30.0), 2.0);                  // interlace
  c += (h21(fc + fract(uTime) * 91.0) - 0.5) * 0.07 * amt;                    // tape noise
  float sw = step(fc.y / uResolution.y, 0.02) * amt;                           // head-switching band
  c = mix(c, vec3(h21(vec2(floor(fc.x / 5.0), floor(uTime * 60.0) + line))) * 0.8, 0.6 * sw * step(0.35, h11(line + floor(uTime * 60.0))));
  c = mix(vec3(dot(c, W)), c, 1.0 + 0.25 * amt);                              // tape oversaturates
  c = c * (1.0 - 0.04 * amt) + 0.022 * amt;                                    // lifted blacks
  return c;
}
// ---- end of the tokusatsu kit ----

float gPix, gTc, gXd, gSide, gOpen, gRum, gKick, gHandOn, gCurl, gSpread, gHS, gSlamX, gImpAge, gBurstAge, gShutAge, gPoseAge, gPat1, gPat2, gFit, gPunch, gShadow, gCrew;
vec2 gW, gHD, gShake;
vec3 gGlow;
vec4 gH0, gH1, gH2;                      // x, hop, facing, mode
vec3 gPh;                                // run / tumble phase per hero

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float kf(float a, float b) { return clamp((gTc - a) / (b - a), 0.0, 1.0); }
float secs(float t0) { return (gTc - t0) * 8.0 * 0.47 / clamp(tempo, 0.25, 2.0); }
float bay(float n) {
  float blk = floor(n / 3.0);
  return mod(n * (h11(blk * 7.9 + 1.5) > 0.5 ? 1.0 : 2.0) + floor(h11(blk * 3.7 + 0.5) * 3.0), 3.0) - 1.0;
}

vec3 facade(vec2 p) {
  vec3 conc = mix(vec3(0.6, 0.58, 0.55), uColor3, 0.16);
  float xd = clamp(floor(p.x / 0.6 + 0.5), -1.0, 1.0) * 0.6;
  float act = step(abs(xd - gXd), 0.01);
  vec2 dq = vec2(p.x - xd, p.y - FY);
  vec3 col = conc;
  // cast panels, and the grime the model shop airbrushed on
  vec2 pj = abs(fract(p / vec2(0.2, 0.11) + 0.5) - 0.5) * vec2(0.2, 0.11);
  col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.004, min(pj.x, pj.y)));
  col *= 0.78 + 0.4 * fbm(vec2(p.x * 9.0, p.y * 2.2));
  col *= mix(1.08, 0.55, smoothstep(-0.1, 0.5, p.y));         // a small set, lit from low down
  if (p.y > 0.36) {
    // upper storeys: ranks of windows far too small, which is what makes it huge
    vec2 wc = vec2(p.x / 0.032, (p.y - 0.365) / 0.04);
    vec2 wi = floor(wc), wf = fract(wc) - 0.5;
    float wd = max(abs(wf.x) - 0.3, abs(wf.y) - 0.3);
    vec3 glass = mix(vec3(0.04, 0.06, 0.1), vec3(0.25, 0.33, 0.42), wf.y + 0.5);
    glass = mix(glass, vec3(1.0, 0.85, 0.5), 0.7 * step(0.82, h21(wi)));
    col = mix(col, glass, 1.0 - smoothstep(-0.05, 0.05, wd));
    col *= 1.0 - 0.45 * (1.0 - smoothstep(0.36, 0.39, p.y));
  }
  float lg = abs(p.y - 0.345) - 0.015;
  col = mix(col, conc * (p.y > 0.347 ? 1.2 : 0.85), 1.0 - smoothstep(0.0, 0.003, lg));
  // piers between the bays, bevelled: lit on the left edge, shaded on the right
  float px = abs(abs(p.x) - 0.6) - 0.3;
  if (p.y < 0.33) {
    float pr = abs(px) - 0.05;
    col = mix(col, conc * 1.05 * (0.85 + 0.3 * fbm(p * 30.0)), 1.0 - smoothstep(0.0, 0.003, pr));
    col *= 1.0 + 0.3 * (1.0 - smoothstep(0.0, 0.008, abs(px + 0.046)));
    col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.01, abs(px - 0.046)));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.05, 0.085, px)) * step(0.05, px);
  }
  // the bay: painted steel frame, slatted doors
  dq.x += act * gRum * 0.005 * sin(uTime * 75.0);
  float dB = max(abs(dq.x) - 0.15, dq.y - 0.5);
  if (dB < 0.024) {
    vec3 frame = mix(vec3(0.5, 0.5, 0.48), uColor1, 0.5) * 0.7;
    float hz = step(0.5, fract((dq.x + dq.y) * 22.0));
    frame = mix(frame, mix(vec3(0.95, 0.78, 0.1), vec3(0.06), hz), step(dq.y, 0.5));
    frame *= 0.7 + 0.5 * smoothstep(0.024, 0.0, dB) * (0.6 + 0.4 * fbm(p * 60.0));
    col = mix(col, frame, 1.0 - smoothstep(0.02, 0.024, dB));
    if (dB < 0.0) {
      float ang = act * gOpen * 1.45 + act * gRum * 0.12 * abs(sin(uTime * 31.0));
      float lxx = (0.15 - abs(dq.x)) / cos(ang);
      if (lxx < 0.15) {
        float sv = sin(ang);
        float yy = dq.y / (1.0 + 0.12 * sv * lxx / 0.15);
        vec3 steel = mix(vec3(0.36, 0.37, 0.4), uColor2, 0.38) * 0.55;
        float sl = fract(yy / 0.03);
        vec3 lc = steel * (0.72 + 0.4 * smoothstep(0.0, 0.35, sl) - 0.4 * smoothstep(0.82, 1.0, sl));
        lc *= (1.0 - 0.5 * sv) * (0.8 + 0.35 * fbm(vec2(lxx * 30.0, yy * 14.0)));
        lc = mix(lc, mix(vec3(0.9, 0.75, 0.1), vec3(0.05), step(0.5, fract((lxx + yy) * 16.0))), step(yy, 0.045) * 0.9);
        lc *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.006, 0.15 - lxx));
        lc += vec3(0.5) * pow(max(1.0 - abs(sl - 0.3) * 4.0, 0.0), 3.0) * 0.12;
        // the doors sit back in the frame: its shadow lies across their top and one side
        col = lc * (1.0 - 0.55 * smoothstep(0.42, 0.5, dq.y)) * (1.0 - 0.4 * smoothstep(-0.11, -0.15, dq.x));
      } else {
        // inside: black, and smoke lit from behind
        float sm = fbm(vec2(dq.x * 7.0 + uTime * 0.25, dq.y * 5.0 - uTime * 0.6));
        col = vec3(0.008, 0.01, 0.016) + gGlow * (0.18 + 0.75 * sm * sm) * smoothstep(0.55, 0.0, dq.y);
      }
    }
  }
  return col;
}

vec3 plaza(vec2 p) {
  float f = FY - p.y;
  float X = p.x / (1.0 + f * 1.6);
  vec3 col = mix(vec3(0.3, 0.3, 0.32), uColor3, 0.07);
  col *= 0.75 + 0.5 * fbm(vec2(X * 16.0, f * 50.0));
  col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.003 * (1.0 + f * 3.0), abs(fract(X / 0.25) - 0.5) * 0.25));
  float row = pow(f / 0.3, 0.75) * 4.0;
  col *= 1.0 - 0.3 * step(fract(row), 0.06);
  col = mix(col, vec3(0.8, 0.68, 0.15), 0.65 * step(abs(f - 0.045), 0.005) * step(0.3, fract(X / 0.1)));
  col *= 0.5 + 0.5 * smoothstep(0.0, 0.07, f);
  // light spilling out of an open bay, and its smear on the wet tarmac
  float sx = (p.x - gXd) / 0.22;
  col += gGlow * (0.22 * exp(-sx * sx) * exp(-f * 7.0) + 0.1 * exp(-sx * sx * 4.0) * fbm(vec2(X * 30.0, f * 12.0))) * gOpen;
  // hosed down before the take: the set shows in the tarmac
  float keep = gPx;
  if (f < 0.22) col += facade(vec2(p.x + (vn(vec2(X * 40.0, f * 9.0)) - 0.5) * 0.03, FY + f * 1.6 + 0.01)) * 0.16 * exp(-f * 5.0) * smoothstep(0.22, 0.15, f);
  gPx = keep;
  return col;
}

vec2 rot(vec2 v, float a) { return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a)); }

// finger k (-1..1): knuckle b, middle joint m, tip t
void finger(float fk, out vec2 b, out vec2 m, out vec2 t) {
  float ang = fk * (0.14 + 0.3 * gSpread) + 0.08 * sin(uTime * 7.0 + fk * 2.3) * (1.0 - gCurl);
  vec2 d1 = vec2(cos(ang), sin(ang));
  b = vec2(0.5, 0.17 * fk);
  m = b + d1 * 0.27 * (1.0 - 0.4 * gCurl);
  t = m + rot(d1, -gCurl * 2.4 - 0.25 * (1.0 - gCurl)) * (0.24 - 0.02 * abs(fk)) * (1.0 - 0.3 * gCurl);
}

void titanHand(vec2 p) {
  if (gHandOn < 0.5) return;
  vec2 R = vec2(gXd, FY + 0.27);
  if (sdSeg(p, R, gW) > 0.5) return;
  float sc = gHS / 0.37;
  // the sleeve: fur, darker the deeper into the bay it goes
  vec2 C = mix(R, gW, 0.5) + vec2(-gSide * 0.04, 0.16);
  vec3 g = vec3(1e3, 0.0, 0.0);
  vec2 pa = R;
  for (int i = 1; i <= 5; i++) {
    float t = float(i) / 5.0;
    vec2 pb = mix(mix(R, C, t), mix(C, gW, t), t);
    g = smin3(g, gSeg(p, pa, pb, 0.088 * sc, 0.088 * sc), 0.02);
    pa = pb;
  }
  vec2 ad = normalize(gW - C);
  float strand = fbm(vec2(dot(p, vec2(-ad.y, ad.x)) * 140.0, dot(p, ad) * 16.0));
  g.x += (vn(p * 150.0) - 0.5) * 0.016 + (strand - 0.5) * 0.012;
  vec3 fur = vec3(0.075, 0.055, 0.045);
  vec3 under = gCol;
  lit(g, 0.09 * sc, fur * (0.5 + 1.1 * strand), 0.3, vec2(strand - 0.5) * 0.9);
  // it comes out of the dark: the far end is lost in the bay
  gCol = mix(gCol, mix(under, vec3(0.01, 0.012, 0.018), 0.85), aa(g.x) * (1.0 - smoothstep(0.03, 0.22, length(p - R))));

  vec2 n = vec2(-gHD.y, gHD.x) * -gSide;
  vec2 q = vec2(dot(p - gW, gHD), dot(p - gW, n)) / gHS;
  if (abs(q.x - 0.4) > 0.95 || abs(q.y) > 0.8) return;
  float keep = gPx;
  gPx /= gHS;
  vec2 b, m, t;
  vec3 h = gEll(q - vec2(0.3, 0.0), vec2(0.33, 0.27));
  for (int k = -1; k <= 1; k++) {
    finger(float(k), b, m, t);
    h = smin3(h, gSeg(q, b - vec2(0.1, 0.0), m, 0.094, 0.084), 0.05);
    h = smin3(h, gSeg(q, m, t, 0.082, 0.068), 0.025);
  }
  // thumb
  vec2 td = rot(normalize(vec2(0.62, -0.78)), 0.5 * gCurl - 0.25 * gSpread);
  vec2 tb = vec2(0.13, -0.2), tm = tb + td * 0.2, tt = tm + rot(td, 0.5 + 1.2 * gCurl) * 0.17;
  h = smin3(h, gSeg(q, tb, tm, 0.105, 0.09), 0.06);
  h = smin3(h, gSeg(q, tm, tt, 0.088, 0.072), 0.025);
  // latex: creases across the joints, pores, and where the fur is glued on
  float furm = smoothstep(0.42, 0.26, q.x + 0.12 * fbm(q * 9.0)) ;
  float hs = fbm(vec2(q.y * 40.0, q.x * 6.0));
  h.x += furm * ((vn(q * 60.0) - 0.5) * 0.03 + (hs - 0.5) * 0.02);
  float crease = sin(q.x * 40.0) * smoothstep(0.42, 0.56, q.x) * (1.0 - smoothstep(0.86, 1.0, q.x));
  vec2 bn = mix(vec2(crease * 0.22, 0.0) + (vec2(vn(q * 30.0), vn(q * 30.0 + 9.0)) - 0.5) * 0.3, vec2(hs - 0.5) * 1.2, furm);
  vec3 skin = vec3(0.13, 0.115, 0.115);
  lit(h, 0.11, mix(skin, fur * (0.5 + 1.1 * hs), furm), mix(0.8, 0.3, furm), bn);
  // the seam where glove meets sleeve: a fold the wardrobe department never hid
  gCol *= 1.0 - 0.5 * aa(h.x + 0.01) * (1.0 - smoothstep(0.0, 0.02, abs(q.x - 0.0 - 0.03 * sin(q.y * 9.0))));
  for (int k = -1; k <= 1; k++) {
    finger(float(k), b, m, t);
    vec2 nd = normalize(t - m);
    vec2 e = q - t + nd * 0.012;
    e = vec2(dot(e, nd), dot(e, vec2(-nd.y, nd.x)));
    lit(gEll(e, vec2(0.05, 0.042)), 0.045, vec3(0.2, 0.18, 0.15), 0.8, vec2(0.0));
  }
  gPx = keep;
}

vec3 render(vec2 fc) {
  vec2 p = ((fc - 0.5 * uResolution) / uResolution.y * gFit) * gPunch + gShake;
  gPx = gPix;
  gCol = p.y > FY ? facade(p) : plaza(p);
  // smoke machine: a low bank along the foot of the wall
  float hz = fbm(vec2(p.x * 2.5 - uTime * 0.07, p.y * 7.0 + uTime * 0.03));
  float bank = exp(-pow((p.y - FY + 0.02) / 0.11, 2.0)) * (0.25 + 0.75 * hz);
  vec3 hazeC = mix(vec3(0.62, 0.66, 0.72), gGlow, 0.25);
  gCol = mix(gCol, hazeC, 0.42 * bank);
  // shadow of the hand before it lands
  vec2 sq = (p - vec2(gSlamX, -0.37)) / vec2(0.2, 0.035);
  gCol *= 1.0 - 0.6 * gShadow * (1.0 - smoothstep(0.3, 1.0, dot(sq, sq)));

  float py = clamp(pyro, 0.0, 2.0);
  // roll call: one charge behind each of them, in their colour
  if (gPoseAge > 0.0 && py > 0.0) {
    addBoom(p - vec2(gH0.x - 0.03, -0.17), gPoseAge, 0.26 * py, cA, 1.0);
    if (gCrew > 1.5) addBoom(p - vec2(gH1.x + 0.05, -0.14), gPoseAge - 0.06, 0.28 * py, cB, 2.0);
    if (gCrew > 2.5) addBoom(p - vec2(gH2.x - 0.05, -0.15), gPoseAge - 0.12, 0.26 * py, cC, 3.0);
  }
  // dust blown out of the bay when the doors go
  if (gBurstAge > 0.0) addBoom(p - vec2(gXd, FY + 0.08), gBurstAge * 1.1 + 0.3, 0.14, vec3(0.75, 0.72, 0.68), 5.0);

  for (int k = 2; k >= 1; k--) {
    vec4 hh = k == 1 ? gH1 : gH2;
    if (gCrew < float(k) + 0.5) continue;
    float ly = k == 1 ? -0.36 : -0.34;
    vec2 s2 = (p - vec2(hh.x, ly)) / vec2(0.07, 0.012);
    gCol *= 1.0 - 0.5 * (1.0 - smoothstep(0.4, 1.0, dot(s2, s2)));
    hero(p, vec2(hh.x, ly + hh.y), HS, hh.z, hh.w, k == 1 ? gPh.y : gPh.z, float(k));
  }
  titanHand(p);
  vec2 s0 = (p - vec2(gH0.x, -0.385)) / vec2(0.075, 0.013);
  gCol *= 1.0 - 0.5 * (1.0 - smoothstep(0.4, 1.0, dot(s0, s0)));
  hero(p, vec2(gH0.x, -0.385 + gH0.y), HS * 1.05, gH0.z, gH0.w, gPh.x, 0.0);

  // practical sparks: the slam, the two pats, the doors
  vec3 sp = sparks(p - vec2(gSlamX, -0.36), gImpAge * 1.3, 0.22 * (0.5 + 0.5 * py), 1.0);
  sp += sparks(p - vec2(gPat1, -0.33), secs(0.25) * 2.0, 0.09 * py, 2.0);
  sp += sparks(p - vec2(gPat2, -0.33), secs(0.375) * 2.0, 0.09 * py, 3.0);
  sp += sparks(p - vec2(gXd, FY + 0.3), gBurstAge * 1.5, 0.2 * (0.4 + 0.6 * py), 4.0);
  sp += sparks(p - vec2(gXd, FY + 0.02), gShutAge * 2.0, 0.1 * py, 5.0);
  gCol += sp;
  if (gImpAge > 0.0) addBoom(p - vec2(gSlamX, -0.34), gImpAge * 0.9 + 0.3, 0.16, vec3(0.6, 0.57, 0.52), 7.0);

  // model trees an inch from the lens: nothing but soft dark shapes
  float fg = fbm(p * 5.0 + 3.0);
  float t1 = smoothstep(0.3, 0.16, length((p - vec2(-0.95, -0.56)) * vec2(0.8, 1.0)) + 0.12 * fg);
  float t2 = smoothstep(0.28, 0.14, length((p - vec2(0.97, -0.58)) * vec2(0.9, 1.0)) + 0.12 * fg);
  gCol = mix(gCol, vec3(0.03, 0.05, 0.035) + hazeC * 0.06, 0.93 * max(t1, t2));
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gKick = clamp(uBassHit, 0.0, 1.0);
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  gPix = 1.0 * gFit / uResolution.y;
  gCrew = floor(clamp(crew, 1.0, 3.0) + 0.5);
  cA = mix(uColor1, vec3(1.0), 0.1);
  cB = mix(uColor2, vec3(1.0), 0.1);
  cC = mix(uColor3, vec3(1.0), 0.1);

  // ---- the 8-beat routine ----
  float cyc = uBeatClock * clamp(tempo, 0.25, 2.0) / 8.0;
  float n = floor(cyc);
  gTc = fract(cyc);
  gXd = bay(n) * 0.6;
  float xn = bay(n + 1.0) * 0.6;
  gSide = abs(gXd) > 0.3 ? -sign(gXd) : (h11(n * 5.3 + 2.0) > 0.5 ? 1.0 : -1.0);
  gRum = smoothstep(0.04, 0.12, gTc) * step(gTc, 0.125);
  gOpen = step(0.125, gTc) * step(gTc, 0.75);
  gBurstAge = secs(0.125);
  gShutAge = secs(0.75);
  gImpAge = secs(0.5);
  gPoseAge = gTc > 0.5 ? secs(0.875) : secs(-0.125);
  gHandOn = step(0.125, gTc) * step(gTc, 0.75);
  gHS = 0.37;
  gSlamX = clamp(gXd + gSide * 0.47, -0.8, 0.8);

  // the hand: out, grope, wind up, slam, fist, gone
  vec2 R = vec2(gXd, FY + 0.27);
  vec2 d1 = normalize(vec2(gSide * 0.55, -1.0)), d4 = normalize(vec2(gSide * 0.9, -0.45)), d5 = normalize(vec2(gSide * 0.25, 1.0));
  float pat = exp(-pow((gTc - 0.25) / 0.012, 2.0)) + exp(-pow((gTc - 0.375) / 0.012, 2.0));
  gPat1 = gXd + gSide * 0.24;
  gPat2 = gXd + gSide * 0.33;
  vec2 P1 = vec2(gXd + gSide * 0.1, -0.02);
  vec2 P2 = vec2(gXd + gSide * 0.2, -0.06);
  vec2 P3 = vec2(gSlamX - gSide * 0.22, 0.14);
  vec2 P4 = vec2(gSlamX, -0.33) - d4 * 0.5 * gHS;
  vec2 P5 = vec2(gXd + gSide * 0.2, -0.02);
  float o1 = kf(0.125, 0.185);
  gW = mix(R, P1, 1.0 - pow(1.0 - o1, 3.0) + 0.25 * sin(o1 * 3.14159) * (1.0 - o1));
  gW = mix(gW, P2, ease(kf(0.19, 0.42)));
  gW.y -= 0.075 * pat;
  gW = mix(gW, P3, ease(kf(0.42, 0.49)));
  gW = mix(gW, P4, pow(kf(0.49, 0.5), 2.0));
  gW = mix(gW, P5, ease(kf(0.57, 0.63)));
  gW += vec2(0.018 * sin(uTime * 26.0), 0.0) * step(0.63, gTc) * step(gTc, 0.69);
  gW = mix(gW, R, ease(kf(0.69, 0.75)));
  gHD = mix(vec2(0.0, -1.0), d1, ease(kf(0.125, 0.19)));
  gHD = mix(gHD, d4, ease(kf(0.42, 0.5)));
  gHD = mix(gHD, d5, ease(kf(0.57, 0.63)));
  gHD = normalize(mix(gHD, vec2(0.0, -1.0), ease(kf(0.69, 0.75))) + vec2(1e-4, 0.0));
  gCurl = 0.35 * (1.0 - kf(0.125, 0.17)) + 0.25 * pat + ease(kf(0.57, 0.62)) * (1.0 - ease(kf(0.69, 0.73)));
  gSpread = ease(kf(0.14, 0.2)) * (1.0 - 0.5 * ease(kf(0.57, 0.62)));
  gHS *= mix(0.55, 1.0, ease(kf(0.125, 0.18))) * mix(1.0, 0.55, ease(kf(0.69, 0.75)));
  gShadow = ease(kf(0.42, 0.5)) * (1.0 - ease(kf(0.56, 0.62)));

  // the team
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float off = k == 0 ? 0.0 : k == 1 ? 0.17 : -0.17;
    float start = clamp(gXd + off, -0.68, 0.68), next = clamp(xn + off, -0.68, 0.68);
    float flee = clamp(k == 0 ? gSlamX : k == 1 ? gXd + gSide * 0.78 : gXd - gSide * 0.34, -0.82, 0.82);
    float a = kf(0.13 + 0.012 * fk, 0.3 + 0.02 * fk), c = kf(0.752 + 0.01 * fk, 0.86);
    float x = mix(start, flee, ease(a));
    float j = k == 0 ? kf(0.455, 0.58) : kf(0.5, 0.56);
    if (k == 0) x = mix(x, clamp(flee + gSide * 0.26, -0.82, 0.82), ease(j));
    x = mix(x, next, ease(c));
    float moving = step(0.001, a) * step(a, 0.999) + step(0.001, c) * step(c, 0.999);
    float air = step(0.001, j) * step(j, 0.999);
    float mode = moving;                                      // run
    if (k == 2 && a > 0.001 && a < 0.999) mode = 2.0;         // one of them always rolls clear
    if (k == 0 && air > 0.5) mode = 2.0;
    if (gTc < 0.05 || gTc >= 0.875) mode = 3.0;
    float face = mode > 2.5 ? 1.0 : moving > 0.5 ? (c > 0.001 ? sign(next - flee + 1e-3) : sign(flee - start + 1e-3)) : sign(gXd + gSide * 0.15 - x + 1e-3);
    if (k == 0 && air > 0.5) face = gSide;
    float hop = air * sin(j * 3.14159) * (k == 0 ? 0.13 : 0.035) + (mode > 1.5 && mode < 2.5 && k == 2 ? 0.05 * sin(a * 3.14159) : 0.0);
    float ph = mode > 1.5 && mode < 2.5 ? (k == 0 ? j : a) * TAU : uBeatClock * TAU * 1.5 + fk * 2.0;
    vec4 st = vec4(x, hop, face, mode);
    if (k == 0) { gH0 = st; gPh.x = ph; } else if (k == 1) { gH1 = st; gPh.y = ph; } else { gH2 = st; gPh.z = ph; }
  }

  // camera: hand-held jolt on every hit, a punch-in on the slam and the pose
  float hit = exp(-max(gImpAge, 0.0) * 7.0) * step(0.0, gImpAge) + 0.5 * exp(-max(gBurstAge, 0.0) * 8.0) * step(0.0, gBurstAge)
            + 0.3 * exp(-max(gShutAge, 0.0) * 9.0) * step(0.0, gShutAge) + 0.15 * gRum + 0.12 * gKick;
  gShake = hit * 0.02 * vec2(sin(uTime * 61.0), cos(uTime * 47.0));
  float pz = exp(-max(gImpAge, 0.0) * 4.0) * step(0.0, gImpAge) + 0.8 * exp(-max(gPoseAge, 0.0) * 3.0) * step(0.0, gPoseAge);
  gPunch = 1.0 - 0.07 * pz;

  // light: a hard key from upper left, sky fill, a coloured lamp behind the doors
  float flash = (exp(-max(gPoseAge, 0.0) * 5.0) * step(0.0, gPoseAge) + exp(-max(gImpAge, 0.0) * 9.0) * step(0.0, gImpAge)) * clamp(pyro, 0.0, 2.0);
  gL = normalize(vec3(-0.5, 0.55, 0.67));
  gKey = vec3(1.0, 0.95, 0.86) * (1.0 + 0.5 * flash);
  gAmb = vec3(0.27, 0.3, 0.37);
  gGlow = mix(uColor1, vec3(1.0, 0.6, 0.3), 0.3) * (0.7 + 0.5 * gKick + 0.3 * uBass);
  gRim = gGlow * 0.9 + vec3(1.0, 0.8, 0.5) * flash;

  // tracking error: each scanline sits a hair off
  vec2 fc = gl_FragCoord.xy;
  float line = floor(fc.y / uResolution.y * 243.0);
  fc.x += tp * uResolution.y * 0.0012 * (h11(line + floor(uTime * 30.0) * 3.1) - 0.5);
  float bl = uResolution.y * 0.006;
  vec3 c0 = render(fc);
  vec3 col = tp > 0.01 ? tapeLook(c0, render(fc - vec2(bl, 0.0)), gl_FragCoord.xy, tp) : c0;
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.25 - dot(vp, vp) * 0.8, 0.4, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

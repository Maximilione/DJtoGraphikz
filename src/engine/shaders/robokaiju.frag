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

uniform float pace;
uniform float pyro;
uniform float haze;
uniform float tape;

// Robo vs Kaiju: a 16-bit versus fight between two giants, side on, over a
// tabletop city at dusk. A robot combined from vehicles (truck legs, exhaust
// stacks, a windscreen across the chest) against a reptile with a nose horn,
// a bone collar, a sail of round paddles and a club on its tail. They trade
// blows two beats at a time and every blow lands on a beat: jab and cross,
// the heavy one, a kick, a grab and a throw over the head, a block. Every few
// bars one of them brings out the big move (the blade of light, the tail
// that comes round) and the other goes down, gets up, and answers. At the end
// of the 16 bars both fire and the beams meet in the middle. The blocks of
// the street behind them are brought down on the beats and stood up again.

// ---- tokusatsu kit: as in titanhand.frag and kaijustomp.frag, without the hero sheets ----
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
float gAlpha;                   // 1 for solids, less for the smear behind a fast limb
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
  gCol *= 1.0 - 0.4 * gAlpha * (1.0 - smoothstep(0.0, 0.03, d)) * step(0.0, d);     // it shades what is behind it
  float t = clamp(-d / rad, 0.0, 1.0);
  float z = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  vec3 n = normalize(vec3(dg.yz * (1.0 - t) + bn, z + 0.06));
  float dif = max(dot(n, gL) * 0.8 + 0.2, 0.0);
  float sp = pow(max(dot(n, normalize(gL + vec3(0.0, 0.0, 1.0))), 0.0), mix(10.0, 110.0, gloss)) * gloss * (0.35 + 2.2 * gloss);
  float rim = pow(1.0 - n.z, 2.2) * max(dot(n.xy, -normalize(gL.xy)) * 0.6 + 0.6, 0.0);
  vec3 c = alb * (gAmb + gKey * dif) + gKey * sp + gRim * rim * (0.2 + 0.6 * alb + 0.3 * gloss);
  c *= 0.5 + 0.5 * smoothstep(0.0, 0.3, t);
  gCol = mix(gCol, c, aa(d) * gAlpha);
}

// ---- the pixel grid ----
// The whole picture lives on one grid of virtual pixels (about 216 lines):
// sprites are drawn 1:1 on it, so every pixel on screen is the same size.
float gVP;                      // one virtual pixel, in scene units
float gPix;
vec3 gSprLight;                 // the light of the set on the sprites
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

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
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float an = mix(0.25, 2.9, h11(fi * 1.7 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (0.8 + 1.8 * h11(fi * 3.1 + seed + 7.0));
    vec2 pos = v * age + vec2(0.0, -2.2 * R * age * age);
    vec2 vel = v + vec2(0.0, -4.4 * R * age);
    float d = sdSeg(q, pos, pos - vel * 0.07);
    acc += exp(-d * d / (R * R * 0.0004)) * (0.4 + 0.6 * h11(fi + seed * 3.0));
  }
  return vec3(1.0, 0.72, 0.3) * acc * 2.8 * (1.0 - age) + vec3(1.0, 0.85, 0.6) * exp(-dot(q, q) / (R * R * 0.08)) * max(1.0 - age * 6.0, 0.0);
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

// ---- the duel ----
// Robot and kaiju are pixel art, drawn frame by frame by scripts/toku/robo.py and kaiju.py
// (8 x 8 cells of 288 x 224 each). The sheets are indexed: R = material, G = tone 1..5;
// the ramps are built here, so the robot wears the palette and the kaiju keeps its hide.
uniform sampler2D uAtlasRobo;
uniform sampler2D uAtlasKaiju;

const float GY = -80.0;                  // the street, in virtual pixels from the middle of the frame
const float RX = -72.0, KX = 78.0;       // where each one stands
const float M_IDLE = 0.0, M_PUNCH = 1.0, M_HEAVY = 2.0, M_KICK = 3.0, M_GRAB = 4.0, M_GETUP = 5.0, M_SPEC = 6.0, M_CHARGE = 7.0, M_FIRE = 8.0;

float gFit, gB, gHaze, gPy, gCam, gHitAge, gHitPow, gBlocked, gBeam, gClash, gSlamAge, gSlamX;
vec2 gShake, gHitPos;
vec3 gR, gK;                             // per fighter: frame on the sheet, x, y of the feet
float gFirst;                            // who is drawn first (the one being hit)
vec3 eR, eK;                             // the colour of each one's energy

float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// the fight, two beats at a time: who attacks (0 robot, 1 kaiju), with what, and whether it is blocked.
// 32 slots = 16 bars, then it starts again: nobody stays down
vec3 slotDef(float s) {
  s = mod(s, 32.0);
  if (s < 8.0) {
    if (s < 0.5) return vec3(0.0, M_PUNCH, 0.0);
    if (s < 1.5) return vec3(1.0, M_HEAVY, 1.0);
    if (s < 2.5) return vec3(1.0, M_KICK, 0.0);
    if (s < 3.5) return vec3(0.0, M_GRAB, 0.0);
    if (s < 4.5) return vec3(1.0, M_GETUP, 1.0);
    if (s < 5.5) return vec3(0.0, M_HEAVY, 1.0);
    if (s < 6.5) return vec3(1.0, M_PUNCH, 0.0);
    return vec3(0.0, M_SPEC, 0.0);                       // bar 4: the blade
  }
  if (s < 16.0) {
    if (s < 8.5) return vec3(1.0, M_GETUP, 0.0);
    if (s < 9.5) return vec3(1.0, M_HEAVY, 0.0);
    if (s < 10.5) return vec3(0.0, M_KICK, 0.0);
    if (s < 11.5) return vec3(1.0, M_SPEC, 0.0);         // bar 6: the tail
    if (s < 12.5) return vec3(0.0, M_GETUP, 0.0);
    if (s < 13.5) return vec3(1.0, M_GRAB, 0.0);
    if (s < 14.5) return vec3(0.0, M_GETUP, 1.0);
    return vec3(0.0, M_PUNCH, 0.0);
  }
  if (s < 24.0) {
    if (s < 16.5) return vec3(1.0, M_PUNCH, 0.0);
    if (s < 17.5) return vec3(0.0, M_HEAVY, 0.0);
    if (s < 18.5) return vec3(0.0, M_KICK, 0.0);
    if (s < 19.5) return vec3(1.0, M_GRAB, 0.0);
    if (s < 20.5) return vec3(0.0, M_GETUP, 1.0);
    if (s < 21.5) return vec3(1.0, M_HEAVY, 1.0);
    if (s < 22.5) return vec3(0.0, M_PUNCH, 0.0);
    return vec3(1.0, M_SPEC, 0.0);                       // bar 12: the tail
  }
  if (s < 24.5) return vec3(0.0, M_GETUP, 0.0);
  if (s < 25.5) return vec3(0.0, M_HEAVY, 0.0);
  if (s < 26.5) return vec3(1.0, M_KICK, 0.0);
  if (s < 27.5) return vec3(0.0, M_SPEC, 0.0);           // bar 14: the blade
  if (s < 28.5) return vec3(1.0, M_GETUP, 0.0);
  if (s < 29.5) return vec3(0.0, M_IDLE, 0.0);
  if (s < 30.5) return vec3(0.0, M_CHARGE, 0.0);         // bars 15-16: both fire, the beams meet
  return vec3(0.0, M_FIRE, 0.0);
}

// what one of them is doing at u (0..1) of the slot: frame, how far it has moved toward the other, how high.
// Every hit is at u = 0.5, which is a beat; the second punch of a combo at 0.75, the half beat
vec3 fighter(float who, vec3 d, float u, float thrown, float apart) {
  float idle = mod(floor(gB * 2.0) + who * 2.0, 4.0);
  float f = idle, ox = 0.0, oy = 0.0;
  bool atk = abs(d.x - who) < 0.5;
  float m = d.y;
  float back = u > 0.5 ? exp(-(u - 0.5) * 7.0) : 0.0;
  if (m == M_PUNCH) {
    if (atk) f = u < 0.38 ? idle : u < 0.5 ? 10.0 : u < 0.6 ? 11.0 : u < 0.68 ? 12.0 : u < 0.75 ? 13.0 : u < 0.85 ? 14.0 : u < 0.94 ? 15.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.6 ? 32.0 : u < 0.7 ? 33.0 : u < 0.75 ? idle : u < 0.86 ? 32.0 : u < 0.96 ? 33.0 : idle; ox = -5.0 * back - (u > 0.75 ? 6.0 * exp(-(u - 0.75) * 9.0) : 0.0); }
  } else if (m == M_HEAVY) {
    if (atk) f = u < 0.25 ? idle : u < 0.36 ? 16.0 : u < 0.5 ? 17.0 : u < 0.6 ? 18.0 : u < 0.78 ? 19.0 : u < 0.9 ? 20.0 : idle;
    else if (d.z > 0.5) { f = u < 0.4 ? idle : u < 0.5 ? 43.0 : u < 0.64 ? 44.0 : u < 0.84 ? 43.0 : idle; ox = -9.0 * back; }
    else { f = u < 0.5 ? idle : u < 0.68 ? 32.0 : u < 0.86 ? 33.0 : idle; ox = -14.0 * back; }
  } else if (m == M_KICK) {
    if (atk) f = u < 0.36 ? idle : u < 0.5 ? 21.0 : u < 0.58 ? 22.0 : u < 0.74 ? 23.0 : u < 0.84 ? 24.0 : u < 0.94 ? 25.0 : idle;
    else { f = u < 0.5 ? idle : u < 0.66 ? 32.0 : u < 0.86 ? 33.0 : idle; ox = -11.0 * back; }
  } else if (m == M_GRAB) {
    if (atk) f = u < 0.2 ? idle : u < 0.3 ? 26.0 : u < 0.4 ? 27.0 : u < 0.5 ? 28.0 : u < 0.72 ? 29.0 : u < 0.86 ? 30.0 : 31.0;
    else if (u >= 0.3) {
      // seized, hauled overhead on the beat, thrown back where it came from
      // as high as the frame allows (the top is 215 px above the street): the lying robot is 95 px thick, the kaiju 130
      vec2 hold = vec2(KX - RX + 16.0, who < 0.5 ? 118.0 : 100.0);
      if (u < 0.4) { f = 32.0; ox = 12.0 * (u - 0.3) / 0.1; }
      else if (u < 0.5) { float v = ease((u - 0.4) / 0.1); f = 34.0; ox = mix(12.0, hold.x, v); oy = hold.y * v; }
      else if (u < 0.72) { f = 35.0; ox = hold.x; oy = hold.y + (u < 0.56 ? 3.0 : 0.0); }
      else { float v = (u - 0.72) / 0.28; f = v < 0.7 ? 35.0 : 36.0; ox = mix(hold.x, 0.0, v); oy = hold.y * (1.0 - v * v) + 14.0 * sin(v * 3.14159); }
    }
  } else if (m == M_GETUP) {
    if (atk) f = u < 0.07 && thrown > 0.5 ? 36.0 : u < 0.16 && thrown > 0.5 ? 37.0 : u < 0.3 ? 38.0 : u < 0.46 ? 39.0 : u < 0.62 ? 40.0 : u < 0.76 ? 41.0 : u < 0.9 ? 42.0 : idle;
    else f = d.z > 0.5 && u > 0.12 && u < 0.62 ? 58.0 : idle;
  } else if (m == M_SPEC) {
    if (atk) {
      if (who < 0.5) f = u < 0.08 ? idle : u < 0.2 ? 45.0 : u < 0.32 ? 46.0 : u < 0.5 ? 47.0 : u < 0.55 ? 48.0 : u < 0.62 ? 49.0 : u < 0.72 ? 50.0 : u < 0.88 ? 51.0 : 52.0;
      else f = u < 0.1 ? idle : u < 0.36 ? 45.0 : u < 0.5 ? 46.0 : u < 0.58 ? 47.0 : u < 0.68 ? 48.0 : u < 0.78 ? 49.0 : u < 0.86 ? 50.0 : u < 0.93 ? 51.0 : 52.0;
    } else if (u >= 0.5) {
      f = u < 0.57 ? 34.0 : u < 0.67 ? 35.0 : u < 0.75 ? 36.0 : u < 0.85 ? 37.0 : 38.0;
      oy = 22.0 * sin(clamp((u - 0.5) / 0.25, 0.0, 1.0) * 3.14159);
    }
  } else if (m == M_CHARGE) {
    // they back off to give the beams room
    f = u < 0.2 ? 9.0 - mod(floor(gB * 6.0), 6.0) : u < 0.5 ? 53.0 : u < 0.75 ? 54.0 : 55.0;
    ox = -30.0 * ease(u / 0.2);
  } else if (m == M_FIRE) {
    f = u < 0.5 ? 56.0 + mod(floor(gB * 8.0), 2.0) : u < 0.66 ? 32.0 : u < 0.84 ? 33.0 : idle;
    ox = -30.0 - (u < 0.5 ? 3.0 * u : 12.0 * back);
  }
  if (apart > 0.5 && u < 0.3) {                           // and walk back in when the smoke clears
    f = 4.0 + mod(floor(gB * 6.0), 6.0);
    ox = -30.0 * (1.0 - u / 0.3);
  }
  return vec3(f, ox, oy);
}

void duelSprite(vec2 q, vec3 st, float who, float white) {
  float dir = who < 0.5 ? 1.0 : -1.0;
  vec2 c = floor(q - floor(vec2(who < 0.5 ? RX + st.y : KX - st.y, GY + st.z) + 0.5));
  c = vec2((dir > 0.0 ? c.x : -c.x - 1.0) + (who < 0.5 ? 120.0 : 140.0), c.y + 12.0);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= 288.0 || c.y >= 224.0) return;
  vec2 px = vec2(mod(st.x, 8.0) * 288.0 + c.x, floor(st.x / 8.0) * 224.0 + 223.0 - c.y);
  vec2 uv = vec2((px.x + 0.5) / 2304.0, 1.0 - (px.y + 0.5) / 1792.0);
  vec4 t = who < 0.5 ? texture2D(uAtlasRobo, uv) : texture2D(uAtlasKaiju, uv);
  if (t.a < 0.5) return;
  float mat = floor(t.r * 255.0 / 32.0 + 0.5), lv = floor(t.g * 255.0 / 50.0 + 0.5);
  vec3 hue = who < 0.5 ? eR : eK;
  vec3 col;
  if (mat > 5.5 && mat < 6.5) {                          // energy: white core, the fighter's colour at the edge
    gCol = lv > 4.5 ? vec3(1.0) : lv > 3.5 ? mix(hue, vec3(1.0), 0.65) : lv > 2.5 ? hue * 1.2 : hue * 0.7;
    return;
  }
  if (mat > 4.5 && mat < 5.5) { gCol = white > 0.5 ? vec3(1.0) : vec3(0.03, 0.025, 0.07); return; }
  float k = lv < 1.5 ? 0.3 : lv < 2.5 ? 0.52 : lv < 3.5 ? 0.76 : 1.0;
  if (who < 0.5) {
    vec3 base = mat < 1.5 ? cA : mat < 2.5 ? vec3(0.93, 0.95, 0.98) : mat < 3.5 ? vec3(0.3, 0.33, 0.42) : mat < 4.5 ? mix(vec3(1.0, 0.78, 0.25), cB, 0.2) : hue;
    col = base * k;
    if (lv < 1.5) col = mix(col, vec3(0.1, 0.07, 0.3), 0.25);
    if (lv > 4.5) col = mix(base, vec3(1.0, 1.0, 0.94), 0.65);
    if (mat > 6.5) col = mix(hue * (0.35 + 0.3 * lv), vec3(1.0), lv > 3.5 ? 0.5 : 0.0);          // glass, lit from inside
    else col *= gSprLight;
  } else {
    if (mat < 1.5) col = lv < 1.5 ? vec3(0.05, 0.055, 0.086) : lv < 2.5 ? vec3(0.118, 0.13, 0.172) : lv < 3.5 ? vec3(0.212, 0.235, 0.282) : lv < 4.5 ? vec3(0.345, 0.384, 0.447) : vec3(0.588, 0.635, 0.698);
    else if (mat < 2.5) col = lv < 1.5 ? vec3(0.235, 0.172, 0.133) : lv < 2.5 ? vec3(0.5, 0.41, 0.29) : lv < 3.5 ? vec3(0.77, 0.69, 0.525) : lv < 4.5 ? vec3(0.933, 0.894, 0.77) : vec3(1.0, 0.99, 0.94);
    else if (mat < 3.5) col = vec3(0.62, 0.52, 0.42) * k * (lv > 4.5 ? 1.25 : 1.0);
    else if (mat < 4.5) { col = mix(cC, vec3(0.1, 0.5, 0.45), 0.25) * k; if (lv > 4.5) col = mix(col, vec3(1.0), 0.55); }
    else col = mix(hue * (0.3 + 0.28 * lv), vec3(1.0, 0.95, 0.85), lv > 3.5 ? 0.55 : 0.0);         // eye, throat, the lit sail
    if (mat < 6.5) col *= gSprLight;
  }
  gCol = white > 0.5 ? vec3(1.0) : col;
}

// a beam, as an FX sprite would be drawn: banded from white core to coloured edge, breathing at 12 fps
void beam(vec2 q, vec2 a, vec2 b, float w, vec3 hue) {
  vec2 ba = b - a;
  float h = clamp(dot(q - a, ba) / dot(ba, ba), 0.0, 1.0);
  float t12 = floor(uTime * 12.0);
  float ww = w * (0.8 + 0.2 * h11(t12 * 1.3)) * (1.0 + 0.35 * sin(h * length(ba) * 0.35 - t12 * 2.1)) * smoothstep(0.0, 0.06, h + 0.02);
  float d = length(q - a - ba * h) / ww;
  if (d > 1.0) return;
  gCol = d < 0.3 ? vec3(1.0) : d < 0.55 ? mix(hue, vec3(1.0), 0.65) : d < 0.8 ? hue * 1.2 : hue * 0.7;
}

// broken masonry thrown from q = 0: little squares, tumbling
void debris(vec2 q, float age, float R, float seed) {
  if (age <= 0.0 || age > 1.0 || dot(q, q) > R * R * 16.0) return;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float an = mix(0.4, 2.75, h11(fi * 1.9 + seed));
    vec2 v = vec2(cos(an), sin(an)) * R * (1.2 + 2.0 * h11(fi * 2.7 + seed + 3.0));
    vec2 e = abs(floor(q - v * age - vec2(0.0, -3.4 * R * age * age)));
    float sz = 1.0 + floor(2.0 * h11(fi * 4.1 + seed));
    if (max(e.x, e.y) < sz) gCol = mix(vec3(0.42, 0.4, 0.44), vec3(0.16, 0.15, 0.2), step(0.5, h11(fi + seed * 2.0)));
  }
}

// a row of the model city, night side: dark boxes, a few windows lit. fall = 1 standing .. 0 a heap
vec4 city(vec2 q, float X, float base, float wd, float hmin, float hvar, float seed, vec3 tintc, float live) {
  float id = floor(X / wd);
  float lx = X - id * wd;
  float hh = floor(hmin + hvar * h11(id * 1.7 + seed));
  float fall = 1.0, ph = 0.0;
  if (live > 0.5) {
    // each block is brought down on a beat where a blow lands, lies in ruins, and is stood up again for the next take
    ph = mod(gB - (1.0 + 2.0 * floor(h11(id * 7.7 + seed) * 16.0)), 32.0);
    fall = ph < 1.0 ? 1.0 - 0.86 * ease(ph * 1.3) : ph < 10.0 ? 0.14 : ph < 12.0 ? mix(0.14, 1.0, ease((ph - 10.0) / 2.0)) : 1.0;
    lx += ph < 1.0 ? floor(2.0 * sin(uTime * 70.0 + q.y * 0.4)) : 0.0;
  }
  float y = q.y - base;
  float top = hh * fall + (fall < 0.5 ? floor(5.0 * vn(vec2(X * 0.35, id))) : 0.0);
  if (lx < 2.0 || lx > wd - 2.0 || y > top || y < 0.0) return vec4(0.0);
  vec3 c = mix(vec3(0.16, 0.15, 0.24), tintc, 0.16 + 0.14 * h11(id + seed * 3.0)) * (0.7 + 0.5 * h11(id * 5.1 + seed));
  if (lx > wd - 9.0) c *= 0.6;                              // the side turned away
  vec2 wc = vec2(floor((lx - 4.0) / 5.0), floor(y / 7.0));
  vec2 wf = vec2(mod(lx - 4.0, 5.0), mod(y, 7.0));
  if (fall > 0.9 && lx > 4.0 && lx < wd - 10.0 && wf.x < 3.0 && wf.y > 2.0 && wf.y < 6.0 && y < top - 3.0) {
    float litw = step(0.62, h21(wc + id * 7.0 + seed));
    c = mix(vec3(0.07, 0.08, 0.15), mix(vec3(1.0, 0.8, 0.42), tintc, 0.25), litw);
  }
  if (y > top - 1.5) c *= 1.5;                              // the roof line catches the last light
  if (fall < 0.5) c *= 0.55 + 0.5 * h21(floor(vec2(X, y) / 2.0));   // rubble
  if (ph >= 10.0 && ph < 12.0) c = mix(c, tintc, 0.5 * step(0.5, fract(gB * 4.0)));   // being stood up again
  return vec4(c, 1.0);
}

vec3 render(vec2 fc) {
  vec2 q = (fc - 0.5 * uResolution) / uResolution.y * gFit / gVP + gShake;
  float X = q.x + gCam;
  // ---- dusk: the last band of colour under a night sky, a low sun cut by the skyline ----
  float sy = (q.y - GY) / 190.0;
  vec3 dusk = mix(vec3(1.0, 0.5, 0.28), uColor2, 0.45);
  vec3 col = mix(mix(dusk, mix(vec3(0.42, 0.16, 0.42), uColor3, 0.35), smoothstep(0.02, 0.4, sy)), vec3(0.035, 0.04, 0.12), smoothstep(0.25, 0.95, sy));
  vec2 sq = q - vec2(58.0 - gCam * 0.1, GY + 52.0);
  float sun = length(sq);
  if (sun < 40.0 && mod(sq.y - 2.0, 9.0) > 2.0 - sq.y * 0.06) col = mix(vec3(1.0, 0.86, 0.5), dusk * 1.25, clamp(0.5 - sq.y / 60.0, 0.0, 1.0));
  col += vec3(0.8, 0.85, 1.0) * step(0.985, h21(floor(q + vec2(gCam * 0.05, 0.0)))) * smoothstep(0.45, 0.8, sy) * (0.5 + 0.5 * sin(uTime * 3.0 + q.x));
  // ---- the far skyline, then the blocks along the street: these are the ones that fall ----
  vec4 far = city(q, q.x + gCam * 0.3 + 300.0, GY + 16.0, 31.0, 34.0, 62.0, 3.0, uColor3, 0.0);
  col = mix(col, mix(far.rgb, dusk * 0.5, 0.5), far.a);
  vec4 mid = city(q, q.x + gCam * 0.6 + 500.0, GY + 10.0, 46.0, 30.0, 58.0, 1.0, mix(uColor2, uColor1, 0.5), 1.0);
  col = mix(col, mid.rgb, mid.a);
  {
    // the dust of the one coming down, in its own column
    float Xm = q.x + gCam * 0.6 + 500.0;
    float id = floor(Xm / 46.0);
    float ph = mod(gB - (1.0 + 2.0 * floor(h11(id * 7.7 + 1.0) * 16.0)), 32.0);
    gCol = col;
    if (ph < 3.0 && gPy > 0.0) addBoom(vec2(Xm - (id + 0.5) * 46.0, q.y - GY - 14.0), ph * 0.5 + 0.5, 22.0 * (0.6 + 0.4 * gPy), vec3(0.5, 0.45, 0.48), id);
    col = gCol;
  }
  // ---- pavement and road ----
  if (q.y < GY + 10.0) {
    float f = GY + 10.0 - q.y;
    col = vec3(0.3, 0.29, 0.36) * (mod(floor(X / 8.0), 2.0) < 0.5 ? 1.0 : 0.88);
    if (f > 5.0) {
      float Xr = q.x / (1.0 + f * 0.012) + gCam;
      col = mix(vec3(0.1, 0.1, 0.16), dusk * 0.3, 0.25 * exp(-f * 0.05)) * (0.85 + 0.3 * h21(floor(vec2(Xr, f) / 2.0)));
      if (abs(f - 26.0) < 1.5 && mod(Xr, 34.0) < 18.0) col = vec3(0.6, 0.58, 0.5);
      if (f < 7.0) col *= 0.6;
    }
  }
  gCol = col;
  // ---- shadows on the street, then the two of them: the one being hit first, so the blow is drawn over it ----
  for (int k = 0; k < 2; k++) {
    vec3 st = k == 0 ? gR : gK;
    vec2 s2 = (q - vec2(k == 0 ? RX + st.y - 6.0 : KX - st.y + 12.0, GY - 1.0)) / vec2(k == 0 ? 44.0 : 62.0, 5.0);
    if (dot(s2, s2) < 1.0 && mod(q.x + q.y, 2.0) < 1.0) gCol *= 0.45;
  }
  float wh = gHitAge >= 0.0 && gHitAge < 0.09 && gBlocked < 0.5 ? 1.0 : 0.0;
  if (gFirst < 0.5) { duelSprite(q, gR, 0.0, wh); duelSprite(q, gK, 1.0, 0.0); }
  else { duelSprite(q, gK, 1.0, wh); duelSprite(q, gR, 0.0, 0.0); }
  // ---- the beams and where they meet ----
  if (gBeam > 0.5) {
    vec2 a = vec2(RX + gR.y + 12.0, GY + 95.0), b = vec2(KX + gK.y - 85.0, GY + 111.0);
    vec2 c = vec2(gClash, GY + 102.0);
    beam(q, a, c, 9.0, eR);
    beam(q, b, c, 9.0, eK);
    float t12 = floor(uTime * 12.0);
    vec2 e = q - c;
    float r = length(e) / (13.0 + 4.0 * h11(t12) + 5.0 * cos(atan(e.y, e.x) * 6.0 + t12));
    if (r < 1.0) gCol = r < 0.45 ? vec3(1.0) : r < 0.75 ? mix(mix(eR, eK, step(0.0, e.x)), vec3(1.0), 0.6) : mix(eR, eK, step(0.0, e.x)) * 1.2;
  }
  // ---- the blow: star of impact, sparks, masonry; a charge goes off on the big ones ----
  if (gHitAge >= 0.0) {
    vec2 e = q - gHitPos;
    float ag = gHitAge * 0.5;
    if (ag < 0.11) {
      float r = length(e) / ((gBlocked > 0.5 ? 9.0 : 14.0) * gHitPow * (0.6 + 4.0 * ag) * (1.0 + 0.6 * cos(atan(e.y, e.x) * 8.0 + 1.0)));
      if (r < 1.0) gCol = r < 0.55 ? vec3(1.0) : gBlocked > 0.5 ? vec3(0.6, 0.85, 1.0) : vec3(1.0, 0.85, 0.3);
    }
    gCol += sparks(e, ag * 1.6, 22.0 * gHitPow, floor(gB)) * (gBlocked > 0.5 ? vec3(0.6, 0.8, 1.6) : vec3(1.0));
    if (gHitPow > 0.9 && gPy > 0.0) addBoom(e - vec2(0.0, 6.0), ag * 1.4 - 0.02, (gHitPow > 1.7 ? 60.0 : 24.0) * gPy, gHitPow > 1.7 ? mix(eR, eK, 0.5) : vec3(1.0, 0.55, 0.2), floor(gB) + 3.0);
    debris(e, ag * 1.3, 16.0 * gHitPow, floor(gB) + 5.0);
  }
  if (gSlamAge >= 0.0) {                                   // a thrown body meets the street
    vec2 e = q - vec2(gSlamX, GY + 4.0);
    addBoom(e, gSlamAge * 0.7 + 0.3, 30.0 * (0.5 + 0.5 * gHaze), vec3(0.5, 0.46, 0.5), floor(gB) + 9.0);
    debris(e, gSlamAge * 0.8, 20.0, floor(gB) + 7.0);
  }
  // ---- smoke machine along the street ----
  float hz = fbm(vec2(q.x * 0.012 + gCam * 0.008 - uTime * 0.04, q.y * 0.03));
  gCol = mix(gCol, mix(dusk * 0.6, vec3(0.3, 0.28, 0.4), 0.5), clamp(gHaze * 0.3 * exp(-pow((q.y - GY - 6.0) / 22.0, 2.0)) * (0.3 + hz), 0.0, 0.8));
  return gCol;
}

void main() {
  float tp = clamp(tape, 0.0, 1.0);
  gAlpha = 1.0;
  gFit = max(1.0, 1.5 * uResolution.y / uResolution.x);
  // one grid of virtual pixels for everything: about 216 lines, a whole number of screen pixels each
  float scl = max(1.0, floor(uResolution.y / 216.0 + 0.5));
  gVP = scl * gFit / uResolution.y;
  gPix = 0.6;
  gPx = 0.6;
  gHaze = clamp(haze, 0.0, 2.0);
  gPy = clamp(pyro, 0.0, 2.0);
  cA = mix(uColor1, vec3(1.0), 0.08);
  cB = mix(uColor2, vec3(1.0), 0.08);
  cC = mix(uColor3, vec3(1.0), 0.08);
  eR = mix(cB, vec3(0.3, 0.9, 1.0), 0.35);
  eK = mix(cC, vec3(1.0, 0.35, 0.2), 0.35);

  // the fight keeps to the beat: half, normal or double time, never in between
  gB = uBeatClock * (pace < 0.75 ? 0.5 : pace < 1.5 ? 1.0 : 2.0);
  float s = floor(gB * 0.5), u = fract(gB * 0.5);
  vec3 d = slotDef(s), dp = slotDef(s - 1.0);
  float thrown = dp.y == M_GRAB ? 1.0 : 0.0;
  float apart = dp.y == M_FIRE ? 1.0 : 0.0;
  gR = fighter(0.0, d, u, thrown, apart);
  gK = fighter(1.0, d, u, thrown, apart);
  gFirst = d.x > 0.5 ? 0.0 : 1.0;                           // the attacker is drawn last

  // what lands in this slot, and where
  float vx = d.x < 0.5 ? KX - 30.0 : RX + 30.0;            // the chest of whoever takes it
  gHitAge = -1.0; gHitPow = 0.0; gBlocked = d.z; gSlamAge = -1.0; gBeam = 0.0;
  gHitPos = vec2(vx, GY + 92.0);
  if (d.y == M_PUNCH) { gHitAge = u < 0.5 ? -1.0 : u < 0.75 ? (u - 0.5) * 2.0 : (u - 0.75) * 2.0; gHitPow = 0.6; gHitPos.y += u < 0.75 ? 0.0 : 10.0; }
  else if (d.y == M_HEAVY) { gHitAge = (u - 0.5) * 2.0; gHitPow = 1.0; gHitPos.x += d.z > 0.5 ? (d.x < 0.5 ? -14.0 : 14.0) : 0.0; }
  else if (d.y == M_KICK) { gHitAge = (u - 0.5) * 2.0; gHitPow = 0.8; gHitPos.y -= 22.0; }
  else if (d.y == M_SPEC) { gHitAge = (u - 0.5) * 2.0; gHitPow = 1.5; }
  else if (d.y == M_FIRE) { gHitAge = (u - 0.5) * 2.0; gHitPow = 2.0; gBlocked = 0.0; gBeam = u < 0.5 ? 1.0 : 0.0; }
  else if (d.y == M_GETUP) { gBlocked = 0.0; if (thrown > 0.5) { gSlamAge = u * 2.0; gSlamX = d.x < 0.5 ? RX - 34.0 : KX + 30.0; } }
  if (d.y != M_HEAVY) gBlocked = 0.0;
  // the beams meet in the middle and push each other back and forth, eight steps to the beat
  gClash = floor(0.5 * (RX + KX) - 10.0 + 30.0 * sin(floor(gB * 8.0) * 0.9) * u * 2.0);
  if (d.y == M_FIRE) gHitPos = vec2(gClash, GY + 102.0);

  float hit = (gHitAge >= 0.0 ? exp(-gHitAge * 5.0) * gHitPow : 0.0) + (gSlamAge >= 0.0 ? exp(-gSlamAge * 5.0) * 1.2 : 0.0) + (gBeam > 0.5 ? 0.25 : 0.0);
  gShake = floor(hit * vec2(3.0 * sin(uTime * 57.0), 4.0 * cos(uTime * 43.0)) + 0.5);
  gCam = floor(7.0 * sin(gB * 3.14159 / 16.0) + 0.5);     // the camera drifts a little along the street
  float flash = gHitAge >= 0.0 && gHitPow > 0.9 ? exp(-gHitAge * 6.0) * gPy : 0.0;
  gL = normalize(vec3(-0.55, 0.5, 0.67));
  gKey = vec3(1.0, 0.94, 0.84);
  gAmb = vec3(0.3, 0.33, 0.4);
  gRim = vec3(1.0, 0.7, 0.4);
  gSprLight = vec3(0.94, 0.92, 1.0) * (1.0 + 0.35 * flash) + vec3(0.25, 0.12, 0.0) * flash;

  vec2 fc = gl_FragCoord.xy;
  float line = floor(fc.y / uResolution.y * 243.0);
  fc.x += tp * uResolution.y * 0.0012 * (h11(line + floor(uTime * 30.0) * 3.1) - 0.5);
  // the frame is computed at the centre of its virtual pixel and held to a
  // 16-bit console's colour depth with an ordered dither; the tape comes after
  vec2 vq = floor(fc / scl);
  vec2 fv = (vq + 0.5) * scl;
  float dth = bayer4(vq);
  vec3 c0 = floor(render(fv) * 15.0 + dth) / 15.0;
  vec3 col = tp > 0.01 ? tapeLook(c0, floor(render(fv - vec2(2.0 * scl, 0.0)) * 15.0 + dth) / 15.0, gl_FragCoord.xy, tp) : c0;
  // an impact frame: the whole picture goes to white for an instant on the biggest blows
  if (gHitAge >= 0.0 && gHitAge < 0.07 && gHitPow > 1.4) col = mix(col, vec3(1.0), 0.75);
  vec2 vp = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  col *= clamp(1.25 - dot(vp, vp) * 0.8, 0.4, 1.0);
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uHighHit;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBarPhase;
uniform float uBassHit;
uniform float uLineBoost;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float size;
uniform float height;
uniform float wavespeed;
uniform float edge;

// Iso Blocks: an orthographic isometric heightfield of unit cubes, drawn with
// no raymarching. World axes project to ex, ey, ez (30 degree projection); a
// pixel is resolved by testing a fixed set of candidate columns against the
// three rhombi of each (top, left, right) and keeping the nearest one, where
// "nearest" is the largest x+y (the viewer looks along (1,1,1)). Three flat
// tones plus thin neon edges. Written from the projection maths; palette and
// beat logic are ours.

const vec2 EX = vec2(0.8660254, -0.5);
const vec2 EY = vec2(-0.8660254, -0.5);
// inverse of [EX EY], column-major: (x,y) = Mi * q  for a point q on plane z=0
const mat2 MI = mat2(0.5773503, -0.5773503, -1.0, -1.0);

float hash12(vec2 c) {
  return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash22(vec2 c) {
  return fract(sin(vec2(dot(c, vec2(127.1, 311.7)), dot(c, vec2(269.5, 183.3)))) * 43758.5453);
}

// column height at integer cell c
float colH(vec2 c, vec2 org, float front, float fade) {
  float base = 0.15 + 0.5 * uBass;
  float r = length(c - org);
  float d = (r - front) * 0.7;
  float w = exp(-d * d) * fade;
  // the swell is centred on the screen, not on the wave origin: the origin
  // jumps every 4 beats and would make the whole field pop with it
  float s = 0.5 + 0.5 * sin(length(c) * 0.6 - mod(uTime, 62.831853) * 1.2);
  // a per-cell offset under the swell, then whole cubes only: eighth-cube
  // steps gave a flat sheet of lit tops with sliver sides, nothing like
  // tumbling blocks. Integer heights put full side faces on every step.
  float h = height * (base * s + 0.3 * hash12(c + 17.0) + w * (0.6 + 0.8 * uBassHit) * (0.5 + hash12(c)));
  return min(floor(h + 0.5), 3.0);
}

vec3 palette(int i) {
  if (i == 0) return uColor1;
  if (i == 1) return uColor2;
  return uColor3;
}

float toneLevel(int t) {
  if (t == 0) return 1.0;
  if (t == 1) return 0.55;
  return 0.22;
}

void main() {
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  // size = cubes per screen height (a top rhombus is 1 unit tall)
  float cubes = clamp(size, 4.0, 16.0);
  vec2 p = p0 * cubes;

  float beat = mod(uBeatClock, 256.0);
  float quad = floor(beat / 4.0);
  vec2 org = floor(hash22(vec2(quad, 7.0)) * 12.0 - 6.0);
  float ph = fract(beat / 4.0);
  float front = ph * 4.0 * wavespeed * 3.0;
  // fade the old ring before the origin moves, so the next wave starts clean
  float fade = 1.0 - smoothstep(0.7, 1.0, ph);

  vec2 mp = MI * p;
  vec2 g0 = floor(mp);

  float bestKey = -1e9;
  vec2 bc = g0;
  float bH = 0.0;
  int bFace = 0;           // 0 top, 1 left (y face), 2 right (x face)
  vec2 bUv = fract(mp);    // face-local coords (cube units)

  for (int d = 0; d < 5; d++) {
    for (int m = 0; m < 3; m++) {
      vec2 off = vec2(float(d)) + (m == 1 ? vec2(1.0, 0.0) : (m == 2 ? vec2(0.0, 1.0) : vec2(0.0)));
      vec2 c = g0 + off;
      float H = colH(c, org, front, fade);
      float key = (c.x + c.y) * 2.0;

      // top
      vec2 gt = MI * (p - vec2(0.0, H)) - c;
      bool inTop = all(greaterThanEqual(gt, vec2(0.0))) && all(lessThan(gt, vec2(1.0)));
      // right face (x = c.x+1)
      vec2 qr = p - (c.x + 1.0) * EX - c.y * EY;
      float yy = -qr.x / 0.8660254;
      float zr = qr.y + 0.5 * yy;
      bool inR = yy >= 0.0 && yy < 1.0 && zr >= 0.0 && zr < H;
      // left face (y = c.y+1)
      vec2 ql = p - c.x * EX - (c.y + 1.0) * EY;
      float xx = ql.x / 0.8660254;
      float zl = ql.y + 0.5 * xx;
      bool inL = xx >= 0.0 && xx < 1.0 && zl >= 0.0 && zl < H;

      if (inTop && key + 1.0 > bestKey) {
        bestKey = key + 1.0; bc = c; bH = H; bFace = 0; bUv = gt;
      }
      if (inR && key > bestKey) {
        bestKey = key; bc = c; bH = H; bFace = 2; bUv = vec2(yy, zr);
      }
      if (inL && key > bestKey) {
        bestKey = key; bc = c; bH = H; bFace = 1; bUv = vec2(xx, zl);
      }
    }
  }

  // nothing hit (ground): dim top of the base cell
  if (bestKey < -1e8) {
    bc = g0; bH = 0.0; bFace = 0; bUv = fract(mp);
  }

  // tones: light direction rotates every bar, kick flips the two side tones
  int rotIdx = int(mod(quad, 3.0));
  int tone = int(mod(float(bFace + rotIdx), 3.0));
  if (uBassHit > 0.6) {
    if (tone == 1) tone = 2;
    else if (tone == 2) tone = 1;
  }
  int palRot = int(mod(floor(beat / 32.0), 3.0));
  int pi = int(mod(float(tone + palRot), 3.0));
  float L = toneLevel(tone);
  vec3 col = mix(palette(pi) * L, vec3(L), 0.35);
  if (bFace == 0) col *= 0.85 + 0.4 * uBass;
  // the floor stays dim and the towers carry the light: a flat field of lit
  // tops was a wall of colour on the projector, with nothing for the kick to add
  col *= 0.4 + 0.6 * clamp(bH / 2.0, 0.0, 1.0);

  // soft shadow from the back neighbour onto a top face
  if (bFace == 0) {
    float hb = colH(bc - vec2(1.0, 0.0), org, front, fade);
    if (hb > bH + 0.3) col *= 0.7;
  }

  // neon edges
  float eD;
  if (bFace == 0) {
    eD = min(min(bUv.x, 1.0 - bUv.x), min(bUv.y, 1.0 - bUv.y));
  } else {
    eD = min(min(bUv.x, 1.0 - bUv.x), min(bUv.y, bH - bUv.y));
  }
  float w = (0.025 + 0.03 * uLineBoost) * edge;
  float aa = clamp(fwidth(eD) * 0.75, 0.002, 0.08);
  float line = 1.0 - smoothstep(w - aa, w + aa, eD);
  // stacked-cube seams on the side faces, every whole unit from the floor:
  // thinner and dimmer than the outline, they make a tower read as blocks
  float zs = abs(fract(bUv.y + 0.5) - 0.5);
  float aas = clamp(fwidth(zs), 0.002, 0.08);   // outside the branch: derivatives need uniform flow
  if (bFace != 0) {
    line = max(line, 0.45 * (1.0 - smoothstep(w * 0.5 - aas, w * 0.5 + aas, zs)) * step(0.5, bH - bUv.y));
  }
  vec3 edgeCol = mix(uColor3, vec3(1.0), 0.6) * (0.8 + 0.6 * uHigh + 0.8 * uBeat + 0.3 * uEnergy);
  col = mix(col, edgeCol, clamp(line, 0.0, 1.0));

  // sparkle: a few random tops flash white on hi-hat hits
  if (bFace == 0 && hash12(bc + floor(mod(uTime, 512.0) * 8.0)) > 0.93) {
    col += vec3(uHighHit * 0.8);
  }

  col *= 1.0 / (1.0 + 0.35 * dot(p0, p0));
  col *= 1.0 + 0.25 * uBassHit;
  col = 1.0 - exp(-max(col, vec3(0.0)) * 1.6);
  col += uColor1 * 0.02;

  gl_FragColor = vec4(col, 1.0);
}

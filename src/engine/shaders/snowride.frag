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
uniform float pistewidth;
uniform float curviness;
uniform float gates;

// 1080°-style snowboard run v2: banked camera carving down a snaking piste,
// projected slalom gates and pine trees, board nose in frame, snow spray on
// the kick. Bass = speed, kick = jump, hats = falling snow.

float curveAt(float z) {
  return sin(z * 0.11) * curviness + sin(z * 0.043 + 1.7) * curviness * 1.5;
}

// perspective projection of a world point (xw = lateral offset from rider
// line, zw = distance ahead) → screen x + scale; horizon at hy
vec3 project(float xw, float zw, float hy) {
  float persp = 1.0 / max(zw, 0.4);
  return vec3(xw * persp * 1.05, hy - 1.55 * persp * (0.62 - hy + 0.62), persp);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float t = uTime;

  float speed = 8.0 + uBass * 7.0;
  float travel = t * speed + uBassTime * 2.0;

  // camera BANK: lean into the turn (derivative of the course curve)
  float bank = (curveAt(travel + 2.0) - curveAt(travel)) * 0.35;
  vec2 suv = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5);
  suv = rot(bank) * suv;
  float x = suv.x;
  float y = suv.y + 0.5;

  float jump = uBassHit * uBassHit;
  float hy = 0.60 + jump * 0.10;           // horizon (screen y)
  vec3 color;

  if (y < hy) {
    // ---- slope, per scanline ----
    float depth01 = hy - y;
    float z = 0.055 / max(depth01, 0.004);
    float zw = z + travel;
    float c = curveAt(zw) - curveAt(travel) - jump * 0.0;
    float wx = x * z * 3.2 + c;

    // snow with fine corduroy + soft blue mogul shading
    float mogul = sin(wx * 3.0 + zw * 0.9) * sin(wx * 1.7 - zw * 0.6);
    vec3 snow = mix(vec3(0.86, 0.90, 0.99), vec3(0.66, 0.74, 0.92), mogul * 0.5 + 0.5);
    snow += sin(wx * 160.0) * 0.02;                                  // corduroy
    snow += step(0.985, hash(floor(vec2(wx * 50.0, zw * 8.0)))) * 0.2 * (0.4 + uHigh); // sparkle

    float half_w = pistewidth * 1.6;
    float inP = smoothstep(half_w + 0.3, half_w, abs(wx));
    // off-piste: powder, darker blue, tree shadows
    snow = mix(snow * mix(vec3(0.55, 0.62, 0.85), vec3(1.0), 0.4), snow, inP);
    // carved track behind the rider
    float trackX = curveAt(zw - 0.5) - curveAt(travel);
    snow = mix(snow, snow * vec3(0.72, 0.78, 0.94), smoothstep(0.12, 0.02, abs(wx - trackX)) * inP);
    // piste edge dye
    snow = mix(snow, uColor2 * 0.8 + 0.2, smoothstep(0.07, 0.015, abs(abs(wx) - half_w)) * 0.6);

    color = mix(snow, vec3(0.78, 0.83, 0.96), smoothstep(0.22, 0.02, depth01) * 0.7); // haze
  } else {
    // ---- sky + peaks ----
    float sy = (y - hy) / max(1.0 - hy, 0.2);
    color = mix(vec3(0.55, 0.68, 0.95), vec3(0.18, 0.30, 0.62), sy);
    color = mix(color, uColor3 * 0.6 + 0.3, 0.2);
    float sd = length(vec2(x - 0.5, y - hy - 0.24));
    color += vec3(1.0, 0.95, 0.85) * (0.010 / (sd + 0.04));
    float ridge = hy + 0.045 + sin(x * 2.6 + 0.4) * 0.05 + sin(x * 6.3) * 0.022;
    float ridge2 = hy + 0.02 + sin(x * 3.9 + 2.2) * 0.03;
    color = mix(color, vec3(0.60, 0.68, 0.88), smoothstep(ridge2, ridge2 - 0.006, y) * 0.7);
    color = mix(color, vec3(0.88, 0.93, 1.0), smoothstep(ridge, ridge - 0.008, y));
  }

  // ---- projected sprites: slalom gates + pine trees (near→far occlusion) ----
  float gateEvery = max(16.0 - gates, 4.0);
  for (int i = 11; i >= 0; i--) {
    float fi = float(i);
    // TREES: fixed world slots on both sides
    {
      float tz = (floor(travel / 7.0) + fi) * 7.0 + 3.5;
      float zw = tz - travel;
      if (zw > 0.6 && zw < 42.0) {
        float th = hash(vec2(floor(tz / 7.0), 5.0));
        float side = th > 0.5 ? 1.0 : -1.0;
        float txw = side * (pistewidth * 1.6 + 0.8 + th * 2.2) + curveAt(tz) - curveAt(travel);
        float persp = 1.0 / zw;
        float sxp = txw * persp * 1.05;
        float syBase = hy - 1.9 * persp;                 // tree base on the slope
        float treeH = (1.1 + th * 0.9) * persp;
        float treeW = 0.30 * persp * (1.0 + th * 0.4);
        float ty = (y - syBase) / max(treeH, 1e-4);      // 0 base → 1 tip
        if (ty > 0.0 && ty < 1.0) {
          float halfw = treeW * (1.0 - ty) * 0.5;
          float dx = abs(x - sxp);
          if (dx < halfw) {
            vec3 pine = mix(vec3(0.05, 0.14, 0.13), vec3(0.10, 0.24, 0.20), ty);
            pine += vec3(0.5) * smoothstep(0.5, 1.0, ty) * 0.25;   // snow cap
            float fogT = exp(-zw * 0.05);
            color = mix(color, pine, fogT * smoothstep(halfw, halfw * 0.7, dx));
          }
        }
      }
    }
    // GATES: alternating left/right slalom poles with flags
    {
      float gz = (floor(travel / gateEvery) + fi) * gateEvery + gateEvery * 0.5;
      float zw = gz - travel;
      if (zw > 0.6 && zw < 40.0) {
        float gid = floor(gz / gateEvery);
        float side = mod(gid, 2.0) < 1.0 ? 1.0 : -1.0;
        float gxw = side * pistewidth * 0.9 + curveAt(gz) - curveAt(travel);
        float persp = 1.0 / zw;
        float sxp = gxw * persp * 1.05;
        float syBase = hy - 1.9 * persp;
        float poleH = 1.05 * persp;
        float py = (y - syBase) / max(poleH, 1e-4);
        if (py > 0.0 && py < 1.0) {
          vec3 gc = mod(gid, 2.0) < 1.0 ? uColor1 : uColor2;
          float dx = abs(x - sxp);
          float pw = 0.016 * persp * 3.2;
          float fogT = exp(-zw * 0.04);
          // pole
          if (dx < pw) color = mix(color, gc * 1.2, fogT);
          // triangular flag at the top, pointing inward, fluttering
          if (py > 0.62) {
            float fl = (py - 0.62) / 0.38;
            float flagLen = 0.07 * persp * 3.2 * (1.0 - fl) * (1.0 + sin(t * 7.0 + gid) * 0.12);
            float inward = -side;
            float rel = (x - sxp) * inward;
            if (rel > 0.0 && rel < flagLen) color = mix(color, gc * 1.35, fogT);
          }
        }
      }
    }
  }

  // ---- board nose: dark rounded wedge at the bottom, leaning with the bank ----
  {
    vec2 b = vec2(x + bank * 0.9, y - 0.02 + jump * 0.06);
    float nose = length(vec2(b.x * 1.25, max(b.y + 0.03, 0.0)));
    float board = smoothstep(0.16, 0.15, nose);
    vec3 bc = mix(vec3(0.06, 0.07, 0.10), uColor1 * 0.5, 0.25);
    bc += vec3(0.25) * smoothstep(0.02, 0.0, abs(nose - 0.115)); // edge highlight
    color = mix(color, bc, board * step(y, 0.16));
  }

  // snow spray on the kick, from the board
  float spray = uBassHit;
  if (spray > 0.03) {
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float h = hash(vec2(fi, floor(uBassTime * 2.0)));
      vec2 sp = vec2((h - 0.5) * 0.8 * spray - bank * 0.5, 0.10 + h * 0.35 * spray);
      float sd2 = length(vec2(x, y) - sp);
      color += vec3(1.0) * min(0.0006 / (sd2 * sd2 + 0.0009), 1.6) * spray * 0.4;
    }
  }
  // ambient snowfall (denser with hats)
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, 77.0));
    vec2 fp = vec2(fract(h * 7.3 + sin(t * (0.25 + h * 0.3) + fi) * 0.05) * 1.7 - 0.85,
                   1.0 - fract(h + t * (0.15 + h * 0.2)));
    float fd = length(vec2(x, y) - fp);
    color += vec3(0.95) * min(0.00006 / (fd * fd + 0.0001), 0.9) * (0.5 + uHigh * 0.7);
  }

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

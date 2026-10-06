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
uniform float uLineBoost;
uniform float uBeatClock;

// 1080-style snowboard run v3: stylised downhill. Perspective piste that
// snakes and rolls, banked camera swaying with the bar, pines and slalom
// gates in parallax, dawn sky with hazy ridges, kick = jump (camera lifts,
// falls back with a glow and a dust burst). Bass = speed, hats = snowfall.

float curveAt(float z) {
  return sin(z * 0.11) * curviness + sin(z * 0.043 + 1.7) * curviness * 1.5;
}

// ridge height above the horizon for a mountain layer
float ridge(float x, float s) {
  return sin(x * 2.3 + s) * 0.05 + sin(x * 5.1 + s * 2.0) * 0.025 + abs(sin(x * 1.3 + s * 3.0)) * 0.05;
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float t = uTime;
  float px = 1.0 / uResolution.y;
  float lw = 1.0 + 2.5 * uLineBoost;

  float travel = t * 6.0 + uBassTime * 9.0;
  float jump = uBassHit * uBassHit;

  // camera roll: into the turn + a lazy sway on the bar + a nudge on the beat
  float bank = (curveAt(travel + 2.0) - curveAt(travel)) * 0.35
             + sin(uBarPhase * TAU) * 0.035 + (uBeat - 0.3) * 0.01;
  vec2 suv = vec2((uvp.x - 0.5) * aspect, uvp.y - 0.5);
  suv = rot(bank) * suv;
  float x = suv.x;
  float bob = sin(travel * 0.5) * 0.008;            // soft bumps in the track
  float y = suv.y + 0.5 - jump * 0.06 + bob;        // the kick lifts the view
  float camH = 1.0 + jump * 0.8;
  float hy = 0.58 + jump * 0.03;
  float heading = (curveAt(travel + 4.0) - curveAt(travel)) * 0.12;

  // palette
  vec3 sunC = mix(uColor3, vec3(1.0, 0.82, 0.68), 0.45);
  vec3 skyHor = mix(uColor3, vec3(0.80, 0.88, 1.0), 0.45) * 0.85;
  vec3 skyTop = mix(uColor2 * 0.4, vec3(0.04, 0.07, 0.26), 0.55);
  vec3 lit = mix(vec3(0.86, 0.93, 1.0), uColor3, 0.18) * 0.72;
  vec3 shade = mix(vec3(0.10, 0.20, 0.52), uColor2 * 0.5, 0.25);
  vec3 fogC = mix(vec3(0.72, 0.82, 0.96), uColor3, 0.25) * 0.75;
  vec2 sun = vec2(0.28, hy + 0.13);

  vec3 color;
  if (y >= hy) {
    float sy = clamp((y - hy) / (1.0 - hy), 0.0, 1.0);
    color = mix(skyHor, skyTop, pow(sy, 0.55));
    float sd = length(vec2(x - sun.x, y - sun.y));
    color += sunC * (smoothstep(0.045, 0.036, sd) * 0.9 + 0.012 / (sd + 0.05));
    // three ridges, far to near, with snowy tops and haze
    for (int m = 0; m < 3; m++) {
      float fm = float(m);
      float mx = x + heading * (0.4 + fm * 0.5) + fm * 1.7;
      float r = ridge(mx * (1.0 + fm * 0.5), fm * 2.1 + 0.7) * (1.0 - fm * 0.22) + 0.02 + fm * 0.004;
      float d = (y - hy) - r;
      float inM = smoothstep(0.003, -0.002, d);
      vec3 mc = mix(vec3(0.34, 0.44, 0.72), shade * 1.2, fm * 0.38);
      mc = mix(mc, uColor2 * 0.5, 0.15);
      mc = mix(mc, lit, smoothstep(-0.035, -0.004, d) * (0.55 - fm * 0.12));   // snowy crest
      mc = mix(mc, fogC, 0.5 - fm * 0.17);                                   // distance haze
      color = mix(color, mc, inM);
    }
  } else {
    float depth = max(hy - y, 0.003);
    float z = 0.5 * camH / depth;
    float zw = z + travel;
    float cc = curveAt(zw) - curveAt(travel);
    float X = x * z * 2.2;
    float p = X - cc;                                   // lateral position on the piste
    float wpx = 2.2 * z * px;                           // world size of one pixel
    float hw = pistewidth * 1.4;

    // lit snow vs blue shadow: soft rolling bumps, sharp contrast
    float b = 0.5 + 0.6 * sin(zw * 0.55 + sin(p * 0.7) * 1.3) * sin(p * 0.45 + zw * 0.13 + 1.0);
    vec3 snow = mix(shade, lit, smoothstep(0.30, 0.62, b));
    float inP = smoothstep(hw + max(0.25, wpx * 2.0), hw, abs(p));
    // off-piste powder: deeper blue
    snow = mix(mix(snow, shade, 0.55) * 0.85, snow, inP);
    snow += step(0.985, hash(floor(vec2(p * 14.0, zw * 3.0)))) * 0.25 * (0.4 + uHigh) * exp(-z * 0.08);

    // piste edges: dashed colour bands
    float ew = max(0.14, wpx * 3.0) * lw;
    float dash = step(0.5, fract(zw * 0.45));
    float edge = smoothstep(ew, ew * 0.4, abs(abs(p) - hw)) * (0.55 + 0.45 * dash);
    snow = mix(snow, mix(uColor2, uColor1, dash) * 0.95 + 0.1, edge * (0.6 + 0.4 * uBeat));

    // light trail: two carved grooves + soft glow, pulsing with the music
    float tw = max(0.10, wpx * 2.5) * lw;
    float groove = smoothstep(tw, tw * 0.3, abs(abs(p) - 0.32));
    float glow = exp(-p * p * 5.0);
    vec3 trailC = mix(uColor1, uColor2, 0.5 + 0.5 * sin(zw * 0.18));
    float stripe = 0.55 + 0.45 * sin(zw * 1.4);
    float tI = (0.22 + 0.5 * uEnergy + uBassHit * 0.7) * exp(-z * 0.05) * inP;
    snow += trailC * (groove * (0.9 + stripe * 0.5) + glow * 0.35) * tI;
    snow *= 1.0 - groove * 0.15;

    // reflection of the sun on the snow
    float sdx = (x - sun.x) / (0.05 + depth * 0.6);
    float refl = exp(-sdx * sdx) * exp(-depth * 5.0) * (0.5 + 0.5 * hash(vec2(floor(p * 18.0), floor(zw * 4.0 + t * 2.0))));
    snow += sunC * refl * 0.45;

    color = snow;
  }

  // snow fog hugging the horizon, drifting
  float fogn = 0.5 + 0.5 * sin(x * 4.0 + t * 0.3 + sin(y * 9.0 + t * 0.2) * 2.0);
  float haze = exp(-abs(y - hy) * 9.0) * (0.55 + 0.35 * fogn);
  color = mix(color, fogC, haze * 0.65);

  // ---- pines + slalom gates in parallax (far to near, nearest drawn last) ----
  float gateEvery = max(16.0 - gates, 4.0);
  vec3 pineD = mix(vec3(0.03, 0.12, 0.16), uColor2 * 0.3, 0.3);
  for (int i = 11; i >= 0; i--) {
    float fi = float(i);
    for (int k = 0; k < 2; k++) {
      float side = k == 0 ? -1.0 : 1.0;
      float tz = (floor(travel / 5.0) + fi) * 5.0 + 2.5;
      float zw = tz - travel;
      float th = hash(vec2(floor(tz / 5.0), side * 5.0));
      if (zw > 1.0 && zw < 48.0 && th > 0.25) {
        float Hw = 1.7 + th * 1.1;
        float L = side * (pistewidth * 1.4 + 1.1 + th * 2.6) + curveAt(tz) - curveAt(travel);
        float sxp = L / (zw * 2.2);
        float yb = hy - 0.5 * camH / zw;
        float hs = Hw * 0.5 / zw;
        float ty = (y - yb) / max(hs, 1e-4);
        float bw = 0.32 * Hw / (zw * 2.2);
        if (ty > 0.0 && ty < 1.0 && abs(x - sxp) < bw) {
          float tier = fract(ty * 3.0);
          float w = ty < 0.1 ? 0.09 : (1.0 - ty) * (0.55 + 0.45 * (1.0 - tier));
          float dx = abs(x - sxp);
          float hwid = bw * w;
          if (dx < hwid) {
            float sd = (x - sxp) / max(hwid, 1e-5);
            vec3 pc = mix(pineD, pineD * 2.6 + shade * 0.2, smoothstep(-0.2, 1.0, sd) * 0.7);
            pc = mix(pc, lit, smoothstep(0.62, 0.95, tier) * 0.55 * step(0.1, ty));   // snow on the boughs
            float rim = smoothstep(0.78, 1.0, dx / hwid);
            pc = mix(pc, uColor3 * 0.9, rim * 0.5);
            color = mix(color, pc, exp(-zw * 0.035));
          }
        }
      }
    }
    // gates: alternating left/right, pole + flag + halo
    {
      float gz = (floor(travel / gateEvery) + fi) * gateEvery + gateEvery * 0.5;
      float zw = gz - travel;
      if (zw > 1.0 && zw < 45.0) {
        float gid = floor(gz / gateEvery);
        float side = mod(gid, 2.0) < 1.0 ? 1.0 : -1.0;
        float L = side * pistewidth * 0.85 + curveAt(gz) - curveAt(travel);
        float sxp = L / (zw * 2.2);
        float yb = hy - 0.5 * camH / zw;
        float hs = 1.5 * 0.5 / zw;
        float py = (y - yb) / max(hs, 1e-4);
        float dx = abs(x - sxp);
        float pw = max(0.05 / (zw * 2.2), (1.5 + 2.0 * uLineBoost) * px);
        if (py > -0.05 && py < 1.05 && dx < pw * 10.0) {
          vec3 gc = mod(gid, 2.0) < 1.0 ? uColor1 : uColor2;
          float fogT = exp(-zw * 0.03);
          float inY = step(0.0, py) * step(py, 1.0);
          color += gc * exp(-dx / (pw * 3.0)) * 0.22 * inY * fogT * (0.6 + uBeat * 0.6);   // halo
          if (dx < pw) color = mix(color, gc * 1.1 + 0.15, fogT * inY);
          if (py > 0.6 && py < 1.0) {
            float fl = (py - 0.6) / 0.4;
            float flagLen = 0.5 / (zw * 2.2) * (1.0 - fl) * (1.0 + sin(t * 6.0 + gid + fl * 3.0) * 0.12);
            float rel = (x - sxp) * -side;
            if (rel > 0.0 && rel < flagLen) color = mix(color, gc * 1.2 + 0.2, fogT);
          }
          // base glow on the snow
          color += gc * exp(-abs(py) * 6.0) * exp(-dx / (pw * 5.0)) * 0.12 * fogT * step(-0.05, py) * step(py, 0.2);
        }
      }
    }
  }

  // ---- dust: continuous powder plume off the trajectory + burst on the kick ----
  vec2 org = vec2(-bank * 0.4, 0.04);
  float age = 1.0 - uBassHit;
  float beatSeed = floor(uBeatClock);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, 3.7));
    float ph = fract(t * (0.5 + h * 0.4) + h * 5.0);
    vec2 pp = org + vec2((h - 0.5) * 0.35 * (0.3 + ph) * 2.0, ph * (0.10 + 0.14 * uBass));
    float r = 0.012 + ph * 0.035;
    color += vec3(0.78, 0.88, 1.0) * smoothstep(r, 0.0, length(vec2(x, y) - pp)) * (1.0 - ph) * (0.18 + 0.3 * uEnergy);
    // kick burst
    float hb = hash(vec2(fi, beatSeed));
    float ang = (hb - 0.5) * 2.4;
    vec2 bp = org + vec2(sin(ang), 0.55 + 0.5 * hash(vec2(fi, 9.1))) * age * 0.55 - vec2(0.0, age * age * 0.18);
    float br = 0.018 + age * 0.05;
    color += vec3(1.0, 0.98, 0.96) * smoothstep(br, 0.0, length(vec2(x, y) - bp)) * uBassHit * 0.55;
  }

  // ---- snowfall: three parallax layers ----
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 7.0 + fl * 6.0;
    vec2 q = vec2(x * sc + sin(t * 0.4 + fl * 2.0) * 0.7 + uHighTime * 0.1, y * sc + t * (1.0 + fl * 0.6));
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id + fl * 13.0);
    vec2 off = vec2(hash(id + 7.1), hash(id + 3.3)) - 0.5;
    float d = length(f - off * 0.6);
    color += vec3(0.92, 0.96, 1.0) * smoothstep(0.13 - fl * 0.025, 0.0, d) * step(0.6, h) * (0.35 + uHigh * 0.6 + uHighHit * 0.3);
  }

  // kick: the landing glow
  color += mix(uColor1, uColor3, 0.5) * jump * 0.22 * exp(-length(vec2(x, y - 0.35)) * 1.6);

  // soft tone-map: stays off pure white on peaks
  color = 1.0 - exp(-color * 1.5);
  gl_FragColor = vec4(color, 1.0);
}

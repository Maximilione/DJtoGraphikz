precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float uBarPhase;
uniform float lanes;
uniform float pump;
uniform float drift;

// The rolling bassline of bounce techno, drawn: lanes of bevelled glass
// blocks sliding past each other at their own speeds, a ruler of fine ticks
// under each lane, every block swelling on the offbeat (where the bass sits)
// and ducking on the kick. A wave of light runs along the lanes on the
// offbeat and lights every block it crosses; the kick strobes the accent
// lane, which walks one lane per beat; every four bars the lanes flip.

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float box(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float n = clamp(floor(lanes), 2.0, 12.0);
  float laneF = uv.y * n;
  float lane = floor(laneF);
  float fy = fract(laneF) - 0.5;
  float pxl = 1.0 / (uResolution.y / n);        // one pixel in lane-heights
  float aa = max(pxl, 0.0015);

  float beat = mod(uBeatClock, 64.0);   // 64-beat loop: nothing grows without bound
  float ph = fract(beat);
  float bars4 = mod(floor(beat / 16.0), 2.0);       // flips every 4 bars
  float dir = (mod(lane, 2.0) * 2.0 - 1.0) * (1.0 - 2.0 * bars4);
  float lr = hash(lane * 3.1 + 1.0);

  // block units: ~2.2 lane heights wide whatever the format
  float xw = uv.x * aspect * n / 2.2;
  float speed = floor(16.0 * drift * (0.6 + 0.9 * lr) + 0.5) / 64.0;   // whole cells per loop: no seam
  float x = xw + beat * speed * dir + lr * 7.0;
  float cell = mod(floor(x), 97.0);
  float fx = fract(x) - 0.5;

  // offbeat swell, kick duck: the sidechain upside down
  float env = 1.0 - pump * 0.45 * exp(-ph * 7.0)
            + pump * 0.3 * exp(-abs(ph - 0.5) * 7.0) * (0.6 + 0.8 * uBass);
  float rw = hash(cell * 1.7 + lane);
  float w = 0.40 * env * (0.65 + 0.5 * rw);
  float h = 0.33 * env;

  float d = box(vec2(fx, fy), vec2(w, h), 0.07);
  float inside = 1.0 - smoothstep(-aa * 2.0, 0.0, d);
  float rim = exp(-abs(d + 0.03) * 70.0) * inside;
  float glow = exp(-max(d, 0.0) * 9.0);

  // offbeat light wave running along the lanes (screen space, loops per bar)
  float wc = fract(beat * 0.5 + (dir > 0.0 ? 0.0 : 0.25) + lr * 0.15);   // wave head per lane
  float dx = uv.x - wc;
  float waveL = exp(-abs(dx) * 22.0) + step(dx, 0.0) * step(-0.45, dx) * exp(dx * 6.0) * 0.25;
  waveL *= 0.4 + 0.9 * exp(-abs(ph - 0.5) * 6.0);

  float hot = step(0.88, hash(cell * 5.3 + lane * 2.9 + floor(beat / 4.0)));
  float accentLane = mod(floor(beat), n);
  float accent = step(abs(lane - accentLane), 0.1);
  float kick = exp(-ph * 6.0) * (0.5 + 0.7 * uBassHit);

  // glass fill: dark body, brighter top edge, sheen band
  float gy = fy / max(h, 0.01);
  vec3 body = mix(uColor3, uColor2, 0.5 + 0.5 * hash(cell + lane * 0.37)) * (0.10 + 0.10 * (0.5 - gy * 0.5));
  body += vec3(0.07) * smoothstep(0.5, 1.0, -gy) ;            // top sheen
  body *= 0.8 + 0.6 * uEnergy;
  vec3 col = body * inside;
  col += uColor1 * rim * (0.55 + 0.5 * uMid);
  col += uColor2 * glow * (1.0 - inside) * (0.10 + 0.35 * uBass) * (0.4 + waveL);
  col += uColor1 * inside * hot * (0.45 + 0.9 * uBassHit);
  col += mix(uColor1, vec3(1.0), 0.35) * inside * waveL * (0.5 + 0.6 * uHigh);
  col += uColor1 * rim * waveL * 0.8;

  // accent lane strobes with the kick
  col = mix(col, uColor1 * (0.5 + 0.9 * uBeat) * (inside * 0.9 + 0.15 * glow), accent * 0.6 * kick);
  col += uColor2 * accent * kick * 0.12;

  // lane floor: ruler ticks sliding the opposite way, thin separators
  float tx = fract(xw * 6.0 - beat * speed * dir * 3.0);
  float tick = (1.0 - smoothstep(0.0, aa * 14.0, abs(tx - 0.5) - 0.02)) *
               step(abs(fy + 0.43), 0.035 + 0.03 * step(0.9, fract(xw * 6.0 * 0.25)));
  col += uColor3 * tick * 0.45 * (0.5 + 0.5 * uHigh + 0.5 * waveL);
  col += uColor2 * 0.05 * exp(-abs(fy + 0.5) * 40.0) * (1.0 + 2.0 * uBass);
  col += uColor3 * 0.04 * (1.0 - smoothstep(0.0, 0.5, abs(fy)));   // lane haze

  // global kick pulse + bar sweep
  col *= 0.88 + 0.35 * exp(-ph * 5.0) * uBassHit;
  float sweep = exp(-abs(uv.x - uBarPhase) * 28.0) * 0.12;
  col += uColor1 * sweep * (0.3 + uEnergy);

  // vignette in frame units
  vec2 q = (uv - 0.5) * vec2(min(aspect, 2.2), 1.0);
  col *= 1.0 - 0.45 * smoothstep(0.35, 1.2, length(q));
  gl_FragColor = vec4(col, 1.0);
}

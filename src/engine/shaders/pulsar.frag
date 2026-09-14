precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBeatClock;
uniform float uBassHit;
uniform float uHighHit;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float lines;
uniform float peaks;
uniform float flow;

// Unknown Pleasures as a linescape: slices of one continuous terrain drawn
// near-to-far with running-max hidden-line removal, in perspective, so the
// ridges converge on a horizon instead of stacking flat. A gaussian window on
// world X keeps the sides dead flat — that is the sleeve's signature. The
// field scrolls toward the camera locked to the beat clock, and each kick
// raises a ridge band that then travels in with the terrain.

#define FOCAL 2.144          // 50° vertical fov
#define EYE_Y 0.28
#define HORIZON 0.55

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y) - 0.5;
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

// one noise walk, two readings: the low octaves are the rolling body, the
// high ones sharpened into the sleeve's spikes. Sharing the walk halves the
// hash count, and this loop runs once per slice per pixel.
vec2 terrain(vec2 p) {
  float o1 = vnoise(p); p = ROT * p * 2.03;
  float o2 = vnoise(p); p = ROT * p * 2.01;
  float o3 = vnoise(p);
  float body = 0.56 * o1 + 0.28 * o2 + 0.14 * o3;
  float sharp = max(0.0, 0.55 * o2 + 0.45 * o3 + 0.12) * 3.2;
  return vec2(body, sharp * sharp);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x - 0.5) * 2.0 * aspect, (uv.y - 0.5) * 2.0);

  float slices = max(12.0, floor(lines));
  float amp = peaks * (0.085 + 0.135 * uEnergy + 0.06 * uMid);

  // the field runs toward the camera: one `flow` world unit per beat
  float off = uBeatClock * flow + uTime * 0.02;
  // one band per bar: the field travels `flow` per beat, so a bar is 4x that
  float bandLen = max(0.12, flow * 4.0);

  float eye = EYE_Y + 0.05 * uBeat + 0.04 * sin(uTime * 0.23);
  // step in 1/z, not z: a flat plane then projects to evenly spaced screen
  // lines, so the far slices never pile into a solid bar at the horizon
  float q0 = 1.0 / 0.40, qN = 1.0 / 7.0;
  float dq = (q0 - qN) / slices;

  float lh = -1e5;
  vec3 acc = vec3(0.0);

  for (int i = 0; i < 96; i++) {
    float fi = float(i);
    if (fi >= slices) break;

    float q = q0 - fi * dq;                    // inverse depth of this slice
    float z = 1.0 / q;
    float xw = p.x / (FOCAL * q);              // world X under this pixel
    float zw = z + off;

    // sleeve window: dead-flat plane at the sides, activity in the middle
    float win = exp(-pow(p.x / (aspect * 0.52), 2.0));

    // kick band: ridges born on a beat, riding in with the field
    float ph = fract(zw / bandLen);
    float band = flow < 0.02 ? 0.0 : exp(-pow(min(ph, 1.0 - ph) / 0.20, 2.0));

    vec2 tr = terrain(vec2(xw * 2.6, zw * 1.5));
    float h = (tr.x * 1.15 + tr.y * 0.42) * win
      * amp * (0.70 + band * (0.30 + 1.10 * uBass + 0.70 * uBassHit));

    float py = (h - eye) * FOCAL * q + HORIZON;
    float d = py - p.y;

    if (d > lh) {
      float depth = fi / slices;
      float w = 0.0024 + 0.0012 * uHigh;
      float ink = 1.0 - smoothstep(w, w * 2.8, abs(d));
      float glow = exp(-abs(d) / (0.008 + 0.024 * uBeat))
                 * (0.09 + 0.18 * uEnergy) * (1.0 - depth);

      vec3 tint = mix(uColor1, uColor2, depth * depth);
      acc += tint * (ink + glow) * exp(-2.4 * depth);
      lh = d;
    }
  }

  vec3 bg = uColor3 * 0.030 * smoothstep(1.35, 0.2, length((uv - 0.5) * vec2(1.5, 1.0)));
  vec3 col = bg + sqrt(clamp(acc, 0.0, 1.0)) * (0.85 + 0.4 * uBeat);
  col += (hash21(uv * 971.0 + uTime) - 0.5) * 0.012;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}

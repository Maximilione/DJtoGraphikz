precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float pillars;
uniform float fog;
uniform float flicker;

// A concrete corridor, raymarched: pillars and ceiling beams repeat along the
// travel axis, one lamp rides ahead of the camera and flickers like a bad
// ballast. The kick is the only thing that ever lights the far end.

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
  float room = -sdBox(p, vec3(2.0, 1.3, 1e4));
  float sp = max(0.5, pillars);
  vec3 q = p;
  q.z = mod(q.z, sp) - sp * 0.5;
  float pil = min(sdBox(q - vec3(1.6, 0.0, 0.0), vec3(0.28, 1.3, 0.28)),
                  sdBox(q + vec3(1.6, 0.0, 0.0), vec3(0.28, 1.3, 0.28)));
  float beam = sdBox(q - vec3(0.0, 1.2, 0.0), vec3(2.0, 0.16, 0.16));
  return min(room, min(pil, beam));
}

vec3 normal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float z0 = uBassTime * 2.2 + uTime * 0.3;
  vec3 ro = vec3(0.35 * sin(uTime * 0.31), -0.35 + 0.05 * sin(uTime * 0.7), z0);
  vec3 rd = normalize(vec3(p.x, p.y, 1.4));
  // a slow hand-held roll
  float roll = 0.04 * sin(uTime * 0.5);
  rd.xy = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * rd.xy;

  float d = 0.0;
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    d = map(ro + rd * t);
    if (d < 0.002 || t > 40.0) break;
    t += d * 0.9;
  }

  vec3 col = vec3(0.0);
  if (t < 40.0) {
    vec3 pos = ro + rd * t;
    vec3 n = normal(pos);
    // the lamp rides ahead, under the ceiling; flicker is a coin toss at 30 Hz
    vec3 lamp = vec3(0.0, 1.0, z0 + 3.0);
    float coin = step(0.35, hash(vec2(floor(uTime * 30.0), 1.0)));
    float fl = mix(1.0, coin, flicker);
    vec3 L = lamp - pos;
    float dist = length(L);
    L /= dist;
    float diff = max(dot(n, L), 0.0) / (1.0 + dist * dist * 0.18);
    // concrete: grey, grainy, slightly darker in the seams
    float grain = 0.75 + 0.25 * hash3(floor(pos * 12.0));
    vec3 albedo = vec3(0.55) * grain;
    float kick = 0.5 + 1.2 * uBass;
    col = albedo * diff * fl * kick * mix(vec3(1.0), uColor1, 0.35);
    // the kick reaches the far end for an instant
    col += albedo * 0.08 * uBassHit;
  }
  float f = exp(-t * 0.13 * max(0.05, fog));
  col = mix(vec3(0.0), col, f);
  // dust in the beam
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 31.0)) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}

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

  // the corridor repeats every pillar bay, so the camera can wrap on a
  // multiple of it: after hours of travel the raymarch and the normals
  // still run on small coordinates instead of drifting in float noise
  float sp = max(0.5, pillars);
  float z0 = mod(uBassTime * 2.2 + uTime * 0.3, sp * 32.0);
  vec3 ro = vec3(0.35 * sin(uTime * 0.31), -0.35 + 0.05 * sin(uTime * 0.7), z0);
  vec3 rd = normalize(vec3(p.x, p.y, 1.4));
  // a slow hand-held roll
  float roll = 0.04 * sin(uTime * 0.5);
  rd.xy = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * rd.xy;

  float d = 0.0;
  float t = 0.0;
  // light shafts: each bay has a lamp under the ceiling, and the dust and
  // smoke between ray and lamp scatter it (cheap inverse-square integral)
  float shaft = 0.0;
  float lampOn = (0.5 + 0.25 * uBass) + 0.9 * uBassHit + 0.4 * uBeat;
  for (int i = 0; i < 64; i++) {
    vec3 pp = ro + rd * t;
    d = map(pp);
    float lz = (floor(pp.z / sp) + 0.5) * sp;
    vec3 dl = pp - vec3(0.0, 1.0, lz);
    float st = clamp(d * 0.9, 0.02, 0.6);
    shaft += st * 0.12 / (0.35 + dot(dl, dl)) * exp(-t * 0.08);
    if (d < 0.002 || t > 40.0) break;
    t += d * 0.9;
  }

  vec3 tint = mix(vec3(1.0), uColor1, 0.35);
  vec3 col = vec3(0.0);
  if (t < 40.0) {
    vec3 pos = ro + rd * t;
    vec3 n = normal(pos);
    // the lamp rides ahead, under the ceiling; flicker is a coin toss at 30 Hz
    vec3 lamp = vec3(0.0, 1.0, z0 + 3.0);
    float coin = step(0.35, hash(vec2(mod(floor(uTime * 30.0), 1024.0), 1.0)));
    float fl = mix(1.0, coin, flicker);
    vec3 L = lamp - pos;
    float dist = length(L);
    L /= dist;
    float diff = max(dot(n, L), 0.0) / (1.0 + dist * dist * 0.18);
    // concrete: grey, grainy, slightly darker in the seams
    float grain = 0.75 + 0.25 * hash3(floor(vec3(pos.xy, mod(pos.z, sp)) * 12.0));
    vec3 albedo = vec3(0.6) * grain;
    float kick = 1.0 + 0.8 * uBass;
    col = albedo * diff * fl * kick * tint * 1.6;
    // fixed bay lamp nearest to the hit: keeps every bay lit, kick drives it
    float bz = (floor(pos.z / sp) + 0.5) * sp;
    vec3 L2 = vec3(0.0, 1.0, bz) - pos;
    float d2 = length(L2);
    L2 /= d2;
    float diff2 = max(dot(n, L2), 0.0) / (1.0 + d2 * d2 * 0.5);
    col += albedo * diff2 * lampOn * mix(vec3(1.0), uColor2, 0.5) * 0.8;
    // wet floor and wall sheen: lamp reflections
    vec3 r = reflect(rd, n);
    float sheen = pow(max(dot(r, L2), 0.0), 18.0) * (0.4 + 0.6 * step(0.5, n.y));
    col += uColor2 * sheen * lampOn * 0.9 / (1.0 + d2 * 0.3);
    // neon tubes on the ceiling beams
    float neon = smoothstep(0.1, 0.0, abs(pos.y - 1.03)) * step(0.9, pos.y);
    col += uColor1 * neon * lampOn * 1.2;
    // ambient floor so the room never goes dark
    col += albedo * (0.07 + 0.05 * uEnergy) * uColor3;
    // the kick reaches the far end for an instant
    col += albedo * 0.12 * uBassHit;
  }
  float f = exp(-t * 0.13 * max(0.05, fog));
  col = mix(uColor3 * 0.07, col, f);
  col += mix(uColor2, vec3(1.0), 0.3) * shaft * lampOn * 0.4;
  // dust in the beam
  col += vec3(hash(gl_FragCoord.xy + fract(uTime) * 31.0)) * 0.015;
  // soft shoulder: lamps glow without ever clipping to flat white
  col = 1.0 - exp(-col * 1.4);
  // contrast: concrete stays dark and moody, lamps and neon pop
  col = pow(col, vec3(1.7)) * 1.25;
  gl_FragColor = vec4(col, 1.0);
}

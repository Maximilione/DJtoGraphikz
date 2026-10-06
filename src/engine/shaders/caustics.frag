precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassTime;
uniform float uBassHit;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float causticscale;
uniform float sharpness;
uniform float depthk;

// Pool caustics: a folded, self-advecting sine field, then a high power to turn
// the crests into the bright filaments light makes on the bottom of a pool.
// The power IS the effect — without it this is just plasma.

// Two stacked caustic fields (surface + a slower, larger floor layer for
// parallax depth), light shafts falling through the water, and a kick that
// sends a shockwave ring through the surface and flares the filaments.

float causField(vec2 p, float t, float cnt) {
  vec2 i = p;
  float acc = 0.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    if (float(n) >= cnt) break;
    float tn = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    acc += 1.0 / length(vec2(p.x / (sin(i.x + tn) / inten),
                             p.y / (cos(i.y + tn) / inten)));
  }
  acc /= cnt;
  return 1.17 - pow(acc, 1.4);
}

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 q = (uvp - 0.5) * vec2(aspect, 1.0);

  // The coordinates are deliberately huge and offset: the whole effect lives in
  // the near-singularities of 1/length(p * inten / sin(...)), and those only
  // land in a useful range when p is of order a hundred.
  vec2 p = uvp * vec2(aspect, 1.0) * 6.28318 * causticscale - 250.0;

  float t = uTime * 0.35 + uBassTime * 0.5;

  // kick: a ring born at the centre on every beat pushes the surface outward
  float r = length(q);
  float rd = (r - fract(uBeatClock) * 1.1) / 0.07;
  float ring = exp(-rd * rd) * uBassHit;
  p += (q / (r + 0.001)) * ring * 2.4 * causticscale;

  float acc = causField(p, t, 5.0);
  float light = clamp(pow(abs(acc), 8.0 + sharpness * 7.0 + uHigh * 3.0), 0.0, 2.5);

  // floor layer: bigger cells, slower, offset: reads as light further down
  vec2 p2 = p * 0.58 + vec2(sin(t * 0.7), cos(t * 0.6)) * 4.0 - 120.0;
  float acc2 = causField(p2, t * 0.55 + 7.0, 2.0);
  float light2 = clamp(pow(abs(acc2), 7.0 + sharpness * 5.0), 0.0, 2.0);

  // depth tint: the water column between the surface and the floor
  float depth = clamp(acc * 0.8, 0.0, 1.0);
  vec3 water = mix(uColor3 * 0.10, uColor1 * 0.30, depth * depthk);
  // deeper at the bottom, brighter near the surface
  water *= 0.7 + 0.8 * uvp.y;

  // light shafts falling from the surface
  float sh = 0.5 + 0.5 * sin(q.x * 6.5 + sin(q.y * 2.2 + t * 0.8) * 1.6 + t * 0.4);
  float shafts = pow(sh, 3.0) * smoothstep(0.0, 1.0, uvp.y) * (0.05 + 0.10 * uEnergy + 0.18 * uBassHit);

  vec3 c = water * 0.35 + uColor3 * 0.035;
  c += uColor1 * light2 * (0.10 + 0.12 * uEnergy);
  c += uColor2 * shafts;
  c += uColor2 * light * (0.22 + 0.40 * uEnergy + 0.35 * uBeat + 0.45 * uBassHit);
  c += uColor1 * pow(light, 1.6) * 0.22;
  // clean hot cores for the bloom to take
  c += mix(uColor2, vec3(1.0), 0.6) * pow(light, 3.0) * (0.06 + 0.28 * uBassHit + 0.12 * uBeat);
  c += uColor2 * ring * 0.35;

  float vig = smoothstep(1.4, 0.3, length((uvp - 0.5) * vec2(1.5, 1.0)));
  c *= vig;
  // soft shoulder: the highlights land near 0.9 instead of clipping flat
  c = 1.0 - exp(-c * 1.25);
  gl_FragColor = vec4(c, 1.0);
}

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
  const float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    if (float(n) >= cnt) break;
    float tn = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    // 1/length(p*inten/(s,c)) = (1/inten) * rsqrt(|p/(s,c)|^2): the constant
    // factors out of the loop, two divisions and a sqrt become one rsqrt
    // (sin = 0 still gives w = inf and a 0 contribution, as before)
    vec2 w = p * vec2(1.0 / sin(i.x + tn), 1.0 / cos(i.y + tn));
    acc += inversesqrt(dot(w, w));
  }
  acc *= (1.0 / inten) / cnt;
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

  // Both fields are normalised to their ceiling (1.17) before the power, so
  // light tops out at 1 on the crests only. Raw, acc sat above 1 over a third
  // of the frame and the power clipped all of it to one flat white sheet.
  float acc = causField(p, t, 5.0);
  float a1 = clamp(acc / 1.17, 0.0, 1.0);
  float light = pow(a1, 7.0 + sharpness * 9.0 + uHigh * 4.0);

  // floor layer: bigger cells, slower, offset: reads as light further down
  vec2 p2 = p * 0.58 + vec2(sin(t * 0.7), cos(t * 0.6)) * 4.0 - 120.0;
  float acc2 = causField(p2, t * 0.55 + 7.0, 2.0);
  float light2 = pow(clamp(acc2 / 1.17, 0.0, 1.0), 5.0 + sharpness * 5.0);

  // the water column: colour 3 in the deep, colour 1 where the surface swells
  // (a1 low = trough = dark), brighter toward the top of the frame
  float swell = smoothstep(0.35, 0.95, a1);
  vec3 water = mix(uColor3 * 0.07, mix(uColor3, uColor1, 0.6) * 0.22, swell * depthk * 0.5);
  water *= 0.45 + 0.9 * uvp.y;

  // light shafts falling from the surface
  float sh = 0.5 + 0.5 * sin(q.x * 6.5 + sin(q.y * 2.2 + t * 0.8) * 1.6 + t * 0.4);
  float shafts = (sh * sh * sh) * smoothstep(0.0, 1.0, uvp.y) * (0.04 + 0.08 * uEnergy + 0.14 * uBassHit);

  // filaments take colour 1 or 2 by region (a slow, frame-wide wave), so the
  // palette reads as two lights crossing the pool
  float region = 0.5 + 0.5 * sin(q.x * 2.1 + sin(q.y * 1.7 - t * 0.31) * 1.8 + t * 0.23);
  vec3 fil = mix(uColor1, uColor2, smoothstep(0.3, 0.7, region));
  float gain = 0.75 + 0.6 * uEnergy + 0.5 * uBassHit + 0.25 * uBeat;

  vec3 c = water;
  c += mix(uColor3, uColor1, 0.35) * light2 * (0.22 + 0.18 * uEnergy);
  c += mix(uColor2, uColor3, 0.5) * shafts;
  c += fil * light * gain;
  // white only in the very core of a crest, so the bloom has something clean
  c += mix(fil, vec3(1.0), 0.75) * (light * light * light) * (0.7 + 0.7 * uBassHit + 0.3 * uEnergy);
  c += mix(uColor2, vec3(1.0), 0.3) * ring * (0.25 + 0.5 * light);

  float vig = smoothstep(1.4, 0.3, length((uvp - 0.5) * vec2(1.5, 1.0)));
  c *= vig;
  // soft shoulder: the highlights land near 0.9 instead of clipping flat
  c = 1.0 - exp(-c * 1.25);
  // IGN dither: the dark water gradient bands on an 8-bit target
  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}

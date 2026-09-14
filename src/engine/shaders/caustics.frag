precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassTime;
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

void main() {
  vec2 uvp = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  // The coordinates are deliberately huge and offset: the whole effect lives in
  // the near-singularities of 1/length(p * inten / sin(...)), and those only
  // land in a useful range when p is of order a hundred. Scaled down to the
  // usual -1..1 the field blows out to flat white.
  vec2 p = uvp * vec2(aspect, 1.0) * 6.28318 * causticscale - 250.0;

  float t = uTime * 0.35 + uBassTime * 0.5;

  // A point is repeatedly displaced by the field it stands in, and the
  // reciprocal distance to the folded coordinate lines is accumulated. The big
  // power at the end turns the crests into the thin bright filaments light
  // actually makes on the bottom of a pool.
  vec2 i = p;
  float acc = 0.0;
  float inten = 0.005;

  for (int n = 0; n < 5; n++) {
    float tn = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    acc += 1.0 / length(vec2(p.x / (sin(i.x + tn) / inten),
                             p.y / (cos(i.y + tn) / inten)));
  }
  acc /= 5.0;
  acc = 1.17 - pow(acc, 1.4);

  float light = clamp(pow(abs(acc), 8.0 + sharpness * 7.0 + uHigh * 3.0), 0.0, 2.5);

  // depth tint: the water column between the surface and the floor
  float depth = clamp(acc * 0.8, 0.0, 1.0);
  vec3 water = mix(uColor3 * 0.10, uColor1 * 0.30, depth * depthk);

  vec3 c = water * 0.30 + uColor2 * light * (0.22 + 0.40 * uEnergy + 0.35 * uBeat);
  c += uColor1 * pow(light, 1.6) * 0.22;

  float vig = smoothstep(1.4, 0.3, length((uvp - 0.5) * vec2(1.5, 1.0)));
  gl_FragColor = vec4(c * vig, 1.0);
}

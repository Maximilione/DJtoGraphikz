precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    val += noise(p) * amp;
    p *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Fire rises upward
  vec2 p = uv * vec2(3.0, 2.0);
  p.y += 0.5; // shift origin to bottom

  // Turbulence — multiple noise layers scrolling upward
  float speed = 2.0 + uBass * 3.0;
  float turb1 = fbm(p * 1.0 + vec2(0.0, -t * speed));
  float turb2 = fbm(p * 2.0 + vec2(t * 0.5, -t * speed * 1.3) + 5.0);
  float turb3 = fbm(p * 4.0 + vec2(-t * 0.3, -t * speed * 1.5) + 10.0);

  // Distort UV with turbulence
  vec2 distorted = p;
  distorted.x += (turb1 - 0.5) * 0.5 * (1.0 + uMid);
  distorted.y += turb2 * 0.3;

  // Fire shape — fades at top, wide at bottom
  float fireHeight = 1.0 - uv.y * 0.8 - 0.2;
  fireHeight += turb1 * 0.4 + turb2 * 0.2;
  fireHeight *= 1.0 + uBass * 0.5 + uBeat * 0.5;

  // Core fire
  float core = smoothstep(0.0, 0.8, fireHeight);
  float hot = smoothstep(0.3, 1.0, fireHeight);
  float outer = smoothstep(-0.3, 0.5, fireHeight);

  // Flame wisps
  float wisps = fbm(distorted * 3.0 + vec2(0.0, -t * speed * 2.0));
  wisps = smoothstep(0.3, 0.7, wisps);

  // Color gradient — hot core to cool edges
  vec3 color = vec3(0.0);
  color += uColor1 * hot * 1.5;        // hot core
  color += uColor2 * core * 0.8;        // mid fire
  color += uColor3 * outer * 0.3;       // outer glow
  color += uColor1 * wisps * core * 0.5; // wisps

  // Sparks / embers
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float sparkX = (hash(vec2(fi, 0.0)) - 0.5) * 1.5;
    float sparkSpeed = 1.0 + hash(vec2(fi, 1.0)) * 2.0;
    float sparkY = fract(hash(vec2(fi, 2.0)) + t * sparkSpeed * 0.3) * 2.0 - 0.5;
    sparkX += sin(t * sparkSpeed + fi) * 0.1;

    vec2 sparkPos = vec2(sparkX, sparkY * 0.5 + 0.3);
    float sparkDist = length(uv - sparkPos);
    float spark = 0.002 / (sparkDist * sparkDist + 0.001);
    spark = min(spark, 2.0);

    float sparkFade = 1.0 - sparkY;
    color += mix(uColor1, uColor2, hash(vec2(fi, 3.0))) * spark * sparkFade * 0.1;
  }

  // Beat flare
  color *= 1.0 + uBeat * 0.5;

  // Fade bottom
  color *= smoothstep(-0.7, -0.2, uv.y);

  color = pow(max(color, vec3(0.0)), vec3(0.9));
  gl_FragColor = vec4(color, 1.0);
}

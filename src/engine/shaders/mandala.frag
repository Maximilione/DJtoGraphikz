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

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.3;

  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Kaleidoscopic fold — number of folds reactive to audio
  float folds = floor(6.0 + uMid * 6.0);
  float foldAngle = TAU / folds;
  float fa = mod(a + t * 0.2, foldAngle);
  if (fa > foldAngle * 0.5) fa = foldAngle - fa;

  vec2 polar = vec2(r, fa);

  // Multiple concentric mandala rings
  float pattern = 0.0;

  // Ring 1 — petal shapes
  float petals = sin(fa * folds + t) * 0.5 + 0.5;
  float ring1 = sin(r * 20.0 - t * 2.0 - uBass * 5.0);
  ring1 = smoothstep(0.7, 1.0, ring1);
  pattern += ring1 * petals;

  // Ring 2 — dotted circles
  float dotAngle = floor(a / (TAU / (folds * 2.0))) * (TAU / (folds * 2.0));
  for (float i = 1.0; i < 6.0; i++) {
    float ringR = i * 0.12 + uBeat * 0.02 * i;
    vec2 dotPos = vec2(cos(dotAngle + t * 0.1 * i), sin(dotAngle + t * 0.1 * i)) * ringR;
    float dot = 0.01 / (length(uv - dotPos) + 0.01);
    pattern += dot * 0.05;
  }

  // Ring 3 — wave interference
  float wave1 = sin(r * 30.0 + a * folds - t * 3.0);
  float wave2 = sin(r * 25.0 - a * folds * 0.5 + t * 2.0);
  float interference = (wave1 + wave2) * 0.5;
  interference = smoothstep(0.6, 1.0, interference);
  pattern += interference * 0.5;

  // Ring 4 — radial spokes with thickness modulation
  float spokes = abs(sin(a * folds * 2.0));
  spokes = pow(spokes, 10.0 + uHigh * 20.0);
  float spokeMask = smoothstep(0.05, 0.5, r) * smoothstep(0.8, 0.3, r);
  pattern += spokes * spokeMask * 0.8;

  // Color based on radius and angle
  float colorPhase = r * 3.0 + a / TAU + t * 0.2 + uHigh;
  vec3 c1 = uColor1 * (sin(colorPhase * TAU) * 0.5 + 0.5);
  vec3 c2 = uColor2 * (sin(colorPhase * TAU + TAU / 3.0) * 0.5 + 0.5);
  vec3 c3 = uColor3 * (sin(colorPhase * TAU + TAU * 2.0 / 3.0) * 0.5 + 0.5);

  vec3 color = (c1 + c2 + c3) * pattern;

  // Breathing glow
  float breathe = 1.0 + sin(t * 2.0 + uBass * 3.0) * 0.2 + uBeat * 0.5;
  color *= breathe;

  // Center eye
  float eye = exp(-r * 8.0) * (0.3 + uBeat * 1.0);
  color += mix(uColor1, uColor2, 0.5) * eye;

  // Fade edges
  color *= smoothstep(1.0, 0.3, r);

  gl_FragColor = vec4(color, 1.0);
}

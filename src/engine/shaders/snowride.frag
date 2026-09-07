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

// 1080°-style snowboard run: pseudo-3D slope scrolling toward the camera,
// the course snakes left and right, slalom gates fly past, snow sprays.
// Bass = speed, kick = jump (the camera lifts and the slope drops away).
float curveAt(float z) {
  return sin(z * 0.13) * curviness + sin(z * 0.047) * curviness * 1.6;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float x = (uv.x - 0.5) * aspect;
  float t = uTime;
  vec3 color;

  float speed = 7.0 + uBass * 6.0;
  float travel = t * speed + uBassTime * 2.0;
  // jump on the kick: camera up, slope falls away, brief hangtime
  float jump = uBassHit * uBassHit * 0.10;
  float horizon = 0.62 + jump * 0.5;

  if (uv.y < horizon) {
    // --- slope: per-scanline perspective (OutRun-style) ---
    float depth01 = (horizon - uv.y);
    float z = 0.06 / max(depth01, 0.004);           // world distance of this scanline
    float zw = z + travel;
    float persp = 1.0 / z;

    float c = curveAt(zw) - curveAt(travel);        // course offset relative to the rider
    float wx = x * z * 3.0 + c;                     // world x on this scanline

    // snow base: blue-white with sparkle
    float sparkle = step(0.986, hash(floor(vec2(wx * 40.0, zw * 6.0)))) * (0.5 + uHigh);
    vec3 snow = mix(vec3(0.75, 0.82, 0.92), vec3(1.0), smoothstep(0.0, 0.5, depth01));
    snow = mix(snow, uColor3 * 0.9 + 0.35, 0.25);
    snow += sparkle * 0.25;

    // piste: groomed corduroy inside the course, powder outside
    float half_w = pistewidth;
    float inPiste = smoothstep(half_w + 0.25, half_w, abs(wx));
    float corduroy = sin(wx * 55.0) * 0.03 * inPiste;
    snow += corduroy;
    // piste edges (blue dye lines)
    float edgeD = abs(abs(wx) - half_w);
    snow = mix(snow, uColor2, smoothstep(0.08, 0.0, edgeD) * 0.7);
    // board tracks carving behind the rider
    float trackX = sin(zw * 0.8) * 0.25;
    snow = mix(snow, snow * 0.75, smoothstep(0.06, 0.0, abs(wx - trackX)) * inPiste);

    // slalom gates: paired poles every few meters, alternating colors
    float gateEvery = max(14.0 - gates, 3.0);
    float gz = mod(zw, gateEvery);
    float gateId = floor(zw / gateEvery);
    float nearGate = smoothstep(0.5, 0.0, gz);
    if (nearGate > 0.0) {
      vec3 gateC = mod(gateId, 2.0) < 1.0 ? uColor1 : uColor2;
      for (int side = 0; side < 2; side++) {
        float sx = (float(side) * 2.0 - 1.0) * half_w * 0.8;
        float poleD = abs(wx - sx);
        float poleW = 0.05;
        float pole = smoothstep(poleW, poleW * 0.4, poleD) * nearGate;
        snow = mix(snow, gateC * 1.3, pole);
        // flag glow
        snow += gateC * (poleW * 0.4) / (poleD + poleW) * nearGate * 0.4;
      }
    }

    // distance haze toward the horizon
    color = mix(snow, uColor3 * 0.5 + 0.4, smoothstep(0.25, 0.0, depth01) * 0.6);
  } else {
    // --- sky and mountains ---
    float sy = (uv.y - horizon) / (1.0 - horizon);
    color = mix(uColor3 * 0.65 + 0.25, uColor3 * 0.25, sy);
    // sun
    float sd = length(vec2(x - 0.45, uv.y - horizon - 0.22));
    color += mix(uColor1, vec3(1.0), 0.5) * (0.012 / (sd + 0.045));
    // mountain ridge silhouette
    float ridge = horizon + 0.05
      + sin(x * 3.1 + curveAt(travel) * 0.3) * 0.04
      + sin(x * 7.7 + 2.0) * 0.02;
    float mtn = smoothstep(ridge, ridge - 0.008, uv.y);
    color = mix(color, mix(vec3(0.85, 0.9, 1.0), uColor3, 0.3) * (0.5 + sy), mtn * 0.9);
  }

  // snow spray on the kick: burst of flakes from the bottom center
  float sprayAmt = uBassHit;
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, floor(uBassTime * 1.5)));
    vec2 fp = vec2((h - 0.5) * 1.2 * (1.0 - sprayAmt * 0.3),
                   -0.02 + (1.0 - sprayAmt) * -0.4 + h * 0.5 * sprayAmt);
    fp.y = mix(-0.45, fp.y, sprayAmt);
    float fd = length(vec2(x, uv.y - 0.18) - fp);
    color += vec3(1.0) * (0.0005 / (fd * fd + 0.0008)) * sprayAmt * 0.5;
  }
  // ambient falling snow, denser with the hats
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float h = hash(vec2(fi, 77.0));
    vec2 fp = vec2(fract(h * 7.3 + sin(t * (0.2 + h * 0.3) + fi) * 0.04) * 1.6 - 0.8,
                   fract(h + t * (0.12 + h * 0.18)) );
    float fd = length(vec2(x, 1.0 - uv.y) - vec2(fp.x, fp.y));
    color += vec3(0.9) * (0.00025 / (fd * fd + 0.0004)) * (0.4 + uHigh * 0.6);
  }

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

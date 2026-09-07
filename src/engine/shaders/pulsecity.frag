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
uniform float columns;
uniform float gapw;
uniform float punch;

// Pulse city: a skyline of towers that are also an equalizer — lows drive the
// center towers, highs the edges; windows flicker, kick lifts the whole city.
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float t = uTime;

  float colf = uv.x * columns;
  float col = floor(colf);
  float f = fract(colf);
  float h = hash(vec2(col, 1.0));

  // band by position: center = bass, mid ring = mid, edges = high
  float cx = abs(uv.x - 0.5) * 2.0;
  float band = cx < 0.35 ? uBass : cx < 0.7 ? uMid : uHigh;

  // tower height: static base + band drive + kick punch
  float baseH = 0.18 + h * 0.3;
  float height = baseH + band * (0.35 + punch * 0.25) + uBassHit * punch * 0.12;

  // tower mask with gaps
  float inGap = step(1.0 - gapw, f) ;
  float tower = step(uv.y, height) * (1.0 - inGap);

  // windows: flickering grid inside the tower
  vec2 wg = vec2(f * 4.0, uv.y * 40.0);
  vec2 wc = floor(wg);
  float win = step(0.35, hash(wc + col * 7.0 + floor(uHighTime * 4.0) * 0.13));
  float winMask = step(0.25, fract(wg.x)) * step(0.3, fract(wg.y));

  vec3 towerC = mix(uColor2, uColor1, uv.y / max(height, 0.01));
  vec3 color = towerC * tower * 0.35;
  color += uColor3 * tower * win * winMask * 0.5;

  // rooftop glow line
  float roofD = abs(uv.y - height);
  color += mix(uColor1, uColor3, band) * smoothstep(0.012, 0.0, roofD) * (1.0 - inGap) * (0.8 + uBeat);

  // sky: scan lines + faint gradient above
  float sky = 1.0 - step(uv.y, height);
  color += uColor3 * sky * 0.05 * (1.0 - uv.y) * (1.0 + uEnergy);
  color += uColor2 * sky * smoothstep(0.02, 0.0, abs(fract(uv.y * 30.0 - t) - 0.5) - 0.45) * 0.08;

  // reflection floor
  if (uv.y < 0.06) color += towerC * 0.15 * (1.0 - uv.y / 0.06);

  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

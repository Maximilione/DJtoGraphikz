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
  vec3 color = vec3(0.0);

  // sky: vertical gradient, sweeping searchlights, kick makes them flare
  float skyg = pow(1.0 - uv.y, 1.5);
  color += mix(uColor2, uColor3, uv.y) * (0.05 + skyg * 0.1) * (1.0 + uEnergy);
  for (int s = 0; s < 3; s++) {
    float fs = float(s);
    float bx = 0.2 + fs * 0.3;
    float ang = sin(t * (0.3 + fs * 0.13) + fs * 2.0) * 0.5;
    float dx = (uv.x - bx) * aspect - (uv.y * tan(ang));
    float beam = smoothstep(0.05, 0.0, abs(dx)) * (1.0 - uv.y * 0.6);
    color += mix(uColor1, uColor3, fs * 0.5) * beam * (0.05 + uBassHit * 0.5 + uMid * 0.1);
  }

  // far skyline: slower, dimmer, parallax depth with fog
  float fcolf = uv.x * columns * 0.55 + 3.7;
  float fcol = floor(fcolf);
  float fh = hash(vec2(fcol, 9.0));
  float fheight = 0.3 + fh * 0.3 + uMid * 0.08 + uBassHit * 0.04;
  float fgap = step(1.0 - gapw * 1.5, fract(fcolf));
  float ftower = step(uv.y, fheight) * (1.0 - fgap);
  color = mix(color, mix(uColor2, uColor1, 0.3) * (0.12 + uv.y * 0.12), ftower);
  color += uColor2 * ftower * step(0.7, hash(floor(vec2(fcolf * 4.0, uv.y * 30.0)) + fcol)) * 0.15;

  float colf = uv.x * columns;
  float col = floor(colf);
  float f = fract(colf);
  float h = hash(vec2(col, 1.0));

  // band by position: center = bass, mid ring = mid, edges = high
  float cx = abs(uv.x - 0.5) * 2.0;
  float band = cx < 0.35 ? uBass : cx < 0.7 ? uMid : uHigh;

  // tower height: static base + band drive + kick punch
  float baseH = 0.18 + h * 0.3;
  float height = baseH + band * (0.35 + punch * 0.25) + uBassHit * punch * 0.15;

  // tower mask with gaps
  float inGap = step(1.0 - gapw, f);
  float tower = step(uv.y, height) * (1.0 - inGap);

  // windows: flickering grid inside the tower
  vec2 wg = vec2(f * 4.0, uv.y * 40.0);
  vec2 wc = floor(wg);
  float win = step(0.35, hash(wc + col * 7.0 + floor(uHighTime * 4.0) * 0.13));
  float winMask = step(0.25, fract(wg.x)) * step(0.3, fract(wg.y));

  vec3 towerC = mix(uColor2, uColor1, uv.y / max(height, 0.01));
  // tower body: dark glass, lighter toward the right edge
  vec3 body = towerC * (0.2 + 0.25 * f);
  color = mix(color, body, tower);
  color += mix(uColor3, vec3(1.0), 0.35) * tower * win * winMask * (0.45 + uBass * 0.4 + uBassHit * 0.4);

  // rooftop glow line + bloom halo above the roofs
  float roofD = abs(uv.y - height);
  vec3 roofC = mix(uColor1, uColor3, band);
  color += roofC * smoothstep(0.012, 0.0, roofD) * (1.0 - inGap) * (1.0 + uBeat * 1.2);
  color += roofC * 0.006 / (roofD + 0.012) * (1.0 - inGap) * (0.3 + band);

  // scan lines in the sky
  float sky = 1.0 - step(uv.y, height);
  color += uColor2 * sky * smoothstep(0.02, 0.0, abs(fract(uv.y * 30.0 - t) - 0.5) - 0.45) * 0.06;

  // glossy reflection floor: mirrored towers fading with distance
  if (uv.y < 0.1) {
    float fk = 1.0 - uv.y / 0.1;
    float ref = step(0.0, height - uv.y * 1.5) * (1.0 - inGap);
    color += towerC * (0.15 + ref * 0.35) * fk * (1.0 + uBassHit);
    color += roofC * smoothstep(0.015, 0.0, uv.y - 0.0) * 0.3;
  }

  color += uColor2 * 0.015;
  color *= 1.0 + uBeat * 0.3;
  color = min(color, vec3(2.0));
  gl_FragColor = vec4(color, 1.0);
}

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

float hash(float n) { return fract(sin(n) * 43758.5453); }

float char(vec2 p, float seed) {
  // Fake digital character grid
  p = floor(p * vec2(4.0, 6.0));
  return step(0.5, hash(p.x * 7.0 + p.y * 13.0 + seed * 31.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 pixel = gl_FragCoord.xy;

  float t = uTime;
  float bass = uBass;
  float beat = uBeat;

  // Grid
  float columns = 40.0 + uMid * 20.0;
  float cellW = uResolution.x / columns;
  float cellH = cellW * 1.5;

  vec2 cell = floor(pixel / vec2(cellW, cellH));
  vec2 cellUv = fract(pixel / vec2(cellW, cellH));

  // Rain speed per column
  float colSpeed = 2.0 + hash(cell.x * 0.123) * 4.0;
  colSpeed *= 1.0 + bass * 3.0;

  float rain = cell.y + t * colSpeed + hash(cell.x * 7.77) * 100.0;
  float charVal = char(cellUv, floor(rain));

  // Trail fade
  float trail = fract(rain);
  trail = pow(trail, 2.0 + uHigh * 3.0);

  // Head brightness
  float head = smoothstep(0.0, 0.1, trail) * smoothstep(1.0, 0.8, trail);
  head = pow(head, 0.5);

  // Compose
  float brightness = charVal * trail * 0.8;
  brightness += charVal * head * 2.0; // bright head

  vec3 color = uColor1 * brightness;
  color += uColor2 * head * charVal * 1.5; // white-ish head
  color += uColor3 * charVal * pow(trail, 6.0) * 0.3; // accent

  // Beat flash — occasional full bright columns
  float flashCol = step(0.92, hash(cell.x * 3.33 + floor(t * 4.0)));
  color += uColor1 * flashCol * beat * 2.0 * charVal;

  // Scanlines
  color *= 0.9 + 0.1 * sin(pixel.y * 3.0);

  // Energy
  color *= 0.7 + uEnergy * 0.5;

  gl_FragColor = vec4(color, 1.0);
}

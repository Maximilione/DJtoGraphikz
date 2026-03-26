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

float hash1(float n) { return fract(sin(n) * 43758.5453); }

// Block noise
float blockNoise(vec2 p, float blockSize) {
  vec2 block = floor(p / blockSize);
  return hash(block);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 centered = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Time quantization — glitch frames
  float glitchTime = floor(t * 15.0) / 15.0;
  float glitchIntensity = uBeat * 0.8 + uBass * 0.3;

  // Horizontal displacement blocks
  float blockY = floor(uv.y * (10.0 + uMid * 20.0));
  float displacement = (hash(vec2(blockY, glitchTime)) - 0.5) * glitchIntensity * 0.2;

  // Only displace some blocks
  float blockActive = step(0.6 - glitchIntensity * 0.3, hash(vec2(blockY + 100.0, glitchTime)));
  displacement *= blockActive;

  vec2 glitchUv = uv + vec2(displacement, 0.0);

  // RGB channel separation with different displacements
  float rDisp = displacement * 1.5;
  float gDisp = displacement * 0.5;
  float bDisp = displacement * -0.8;

  vec2 rUv = uv + vec2(rDisp, 0.0);
  vec2 gUv = uv + vec2(gDisp, 0.0);
  vec2 bUv = uv + vec2(bDisp, 0.0);

  // Base pattern — digital grid
  vec2 gridUv = centered * 8.0;
  float gridPattern = 0.0;

  // Moving digital blocks
  vec2 blockUv = floor(gridUv + vec2(t * 2.0, t * 0.5)) / 8.0;
  float blockVal = hash(blockUv + vec2(glitchTime));

  // Stripes
  float stripes = sin(centered.y * 100.0 + t * 5.0) * 0.5 + 0.5;
  stripes = step(0.5, stripes);

  // Data stream columns
  float colId = floor(centered.x * 30.0);
  float colSpeed = hash1(colId) * 3.0 + 1.0;
  float colData = hash(vec2(colId, floor(centered.y * 20.0 + t * colSpeed)));
  colData = step(0.6, colData);

  // Scanlines
  float scan = sin(gl_FragCoord.y * 2.0) * 0.5 + 0.5;
  scan = pow(scan, 0.5);

  // Compose with RGB separation
  float rVal = blockVal * step(0.3, hash(rUv * 10.0 + glitchTime)) + colData * 0.5;
  float gVal = stripes * 0.3 + colData * 0.7;
  float bVal = blockVal * 0.5 + stripes * 0.5;

  color.r = uColor1.r * rVal + uColor2.r * colData * 0.5;
  color.g = uColor1.g * gVal * 0.5 + uColor3.g * rVal * 0.5;
  color.b = uColor2.b * bVal + uColor3.b * stripes * 0.3;

  // Big glitch blocks on beat
  float bigBlock = blockNoise(centered + vec2(0.0, glitchTime), 0.15 + (1.0 - glitchIntensity) * 0.3);
  if (bigBlock > 0.7 && glitchIntensity > 0.3) {
    color = mix(color, uColor2 * 1.5, (bigBlock - 0.7) * 3.0 * glitchIntensity);
  }

  // Horizontal tear lines
  float tearLine = step(0.98, hash(vec2(floor(uv.y * uResolution.y), glitchTime)));
  color += uColor3 * tearLine * glitchIntensity;

  // Scanline darkening
  color *= 0.8 + scan * 0.2;

  // Flicker
  float flicker = 0.9 + hash1(glitchTime) * 0.1;
  color *= flicker;

  // Beat pulse
  color *= 1.0 + uBeat * 0.3;

  gl_FragColor = vec4(color, 1.0);
}

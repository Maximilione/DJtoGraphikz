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
uniform float uBassHit;
uniform float blocks;
uniform float intensity;
uniform float fps;

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

// Base pattern at a (possibly displaced) position: moving blocks, stripes,
// data-stream columns
vec3 pattern(vec2 c, float t, float glitchTime) {
  vec2 blockUv = floor(c * 8.0 + vec2(t * 2.0, t * 0.5)) / 8.0;
  float blockVal = hash(blockUv + vec2(glitchTime));
  float stripes = step(0.5, sin(c.y * 100.0 + t * 5.0) * 0.5 + 0.5);
  float colId = floor(c.x * 30.0);
  float colSpeed = hash1(colId) * 3.0 + 1.0;
  float colData = step(0.6, hash(vec2(colId, floor(c.y * 20.0 + t * colSpeed))));
  return vec3(blockVal, stripes, colData);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 centered = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;
  vec3 color = vec3(0.0);

  // Time quantization — glitch frames
  float glitchTime = floor(t * fps) / max(fps, 1.0);
  // uBassHit: kicks slam in extra glitch on top of the beat envelope
  float glitchIntensity = (uBeat * 0.8 + uBass * 0.3 + uBassHit * 0.4) * intensity;

  // Horizontal displacement blocks
  float blockY = floor(uv.y * (blocks + uMid * 20.0));
  float displacement = (hash(vec2(blockY, glitchTime)) - 0.5) * glitchIntensity * 0.2;

  // Only displace some blocks
  float blockActive = step(0.6 - glitchIntensity * 0.3, hash(vec2(blockY + 100.0, glitchTime)));
  displacement *= blockActive;

  // RGB channel separation: the pattern is sampled three times, each channel
  // shifted by its own amount (the old code computed these offsets and never
  // used them — the displacement blocks did nothing on screen)
  vec3 pr = pattern(centered + vec2(displacement * 1.5, 0.0), t, glitchTime);
  vec3 pg = pattern(centered + vec2(displacement * 0.5, 0.0), t, glitchTime);
  vec3 pb = pattern(centered + vec2(displacement * -0.8, 0.0), t, glitchTime);

  // Scanlines
  float scan = sin(gl_FragCoord.y * 2.0) * 0.5 + 0.5;
  scan = pow(scan, 0.5);

  // Compose: .x blocks, .y stripes, .z data columns
  float rVal = pr.x * step(0.3, hash(centered * 10.0 + displacement * 15.0 + glitchTime)) + pr.z * 0.5;
  float gVal = pg.y * 0.3 + pg.z * 0.7;
  float bVal = pb.x * 0.5 + pb.y * 0.5;

  color.r = uColor1.r * rVal + uColor2.r * pr.z * 0.5;
  color.g = uColor1.g * gVal * 0.5 + uColor3.g * rVal * 0.5;
  color.b = uColor2.b * bVal + uColor3.b * pb.y * 0.3;

  // Big glitch blocks on beat (block size clamped: at full intensity it hit
  // zero, the division made NaN and the blocks silently disappeared)
  float bigBlock = blockNoise(centered + vec2(0.0, glitchTime), 0.15 + (1.0 - clamp(glitchIntensity, 0.0, 1.0)) * 0.3);
  if (bigBlock > 0.7 && glitchIntensity > 0.3) {
    // clamped: intensity 3 on a loud track pushed the mix past 1 and the
    // blocks blew out to white
    color = mix(color, uColor2 * 1.5, clamp((bigBlock - 0.7) * 3.0 * glitchIntensity, 0.0, 1.0));
  }

  // Horizontal tear lines
  float tearLine = step(0.98, hash(vec2(floor(uv.y * uResolution.y), glitchTime)));
  color += uColor3 * tearLine * min(glitchIntensity, 1.5);

  // Scanline darkening
  color *= 0.8 + scan * 0.2;

  // Flicker
  float flicker = 0.9 + hash1(glitchTime) * 0.1;
  color *= flicker;

  // Beat pulse
  color *= 1.0 + uBeat * 0.3;

  gl_FragColor = vec4(color, 1.0);
}

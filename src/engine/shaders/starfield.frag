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

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  vec3 color = vec3(0.0);

  float speed = 1.0 + uBass * 3.0 + uBeat * 2.0;

  // Multiple star layers at different depths
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float depth = 1.0 + fl * 0.8;
    float layerSpeed = speed * (1.0 + fl * 0.5);

    // Tile the space
    float scale = 10.0 + fl * 8.0;
    vec2 st = uv * scale;

    // Scroll forward (warp speed)
    float z = fract(uTime * layerSpeed * 0.1 + fl * 0.25);
    float zScale = mix(3.0, 0.1, z);

    st *= zScale;
    vec2 cellId = floor(st);
    vec2 cellUv = fract(st) - 0.5;

    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 neighbor = vec2(float(dx), float(dy));
        vec2 id = cellId + neighbor;

        float h = hash(vec3(id, fl));
        if (h > 0.7) { // only some cells have stars
          vec2 starPos = neighbor + vec2(hash(vec3(id + 1.0, fl)), hash(vec3(id + 2.0, fl))) - 0.5 - cellUv;

          float d = length(starPos);
          float brightness = z * z; // stars get brighter as they approach

          // Star glow
          float star = 0.02 / (d * d + 0.005) * brightness;
          star = min(star, 3.0);

          // Twinkle
          float twinkle = sin(uTime * 2.0 + h * 100.0 + uHigh * 5.0) * 0.3 + 0.7;
          star *= twinkle;

          // Streak when moving fast
          float streak = exp(-d * 20.0 / max(speed * 0.3, 0.5)) * brightness * speed * 0.05;

          // Color variation per star
          vec3 sColor = mix(uColor1, uColor2, h);
          sColor = mix(sColor, uColor3, hash(vec3(id + 3.0, fl)));

          color += sColor * (star + streak);
        }
      }
    }
  }

  // Nebula background
  float nebula = sin(uv.x * 3.0 + uTime * 0.1) * sin(uv.y * 2.0 - uTime * 0.15);
  nebula = nebula * 0.5 + 0.5;
  color += mix(uColor1, uColor3, nebula) * 0.02 * uEnergy;

  // Beat flash
  color *= 1.0 + uBeat * 0.5;

  color = min(color, vec3(1.5));
  gl_FragColor = vec4(color, 1.0);
}

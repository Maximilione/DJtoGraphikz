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

#define TAU 6.28318530718

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Scale
  float scale = 4.0 + uMid * 3.0;
  vec2 p = uv * scale;

  // Voronoi
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float d1 = 8.0; // nearest
  float d2 = 8.0; // second nearest
  vec2 nearestPoint = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(ip + neighbor);

      // Animate points with audio
      point = 0.5 + 0.5 * sin(t * 0.8 + TAU * point + uBass * 3.0);

      vec2 diff = neighbor + point - fp;
      float dist = length(diff);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        nearestPoint = point;
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  // Edge detection
  float edge = d2 - d1;
  float edgeLine = 1.0 - smoothstep(0.0, 0.08 + uHigh * 0.05, edge);

  // Cell color based on point hash
  float cellId = dot(nearestPoint, vec2(12.9898, 78.233));
  float cellHue = fract(cellId * 43758.5453 + t * 0.1);

  // Patterns
  vec3 cellColor = mix(uColor1, uColor2, cellHue);
  cellColor = mix(cellColor, uColor3, fract(cellHue * 3.0 + 0.5));

  // Shade by distance
  float shade = 1.0 - d1 * 0.8;
  shade = pow(max(shade, 0.0), 1.5);

  vec3 color = cellColor * shade * 0.5;

  // Neon edges
  color += uColor1 * edgeLine * 2.0;
  color += uColor3 * edgeLine * pow(1.0 - d1, 3.0);

  // Beat pulse on edges
  color += (uColor1 + uColor2) * edgeLine * uBeat * 3.0;

  // Center glow
  float glow = exp(-length(uv) * 2.0) * uEnergy;
  color += uColor2 * glow * 0.5;

  color *= 1.0 + uBeat * 0.5;

  gl_FragColor = vec4(color, 1.0);
}

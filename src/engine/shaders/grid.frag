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
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float density;
uniform float fogamt;
uniform float wavefreq;

varying vec2 vUv;

#define PI 3.14159265359

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime;

  // Perspective grid — synthwave/tron style
  vec2 p = uv;
  p.y -= 0.1; // offset horizon

  // Rotation on beat
  p *= rot(sin(t * 0.1) * 0.05 + uBeat * 0.02);

  vec3 color = vec3(0.0);

  // Horizon line
  float hd = abs(p.y + 0.1);
  float horizon = smoothstep(max(0.005, fwidth(hd) * 1.5), 0.0, hd);
  color += uColor2 * horizon * 2.0;

  // Ground plane (below horizon)
  if (p.y < -0.1) {
    // Perspective transform
    float depth = -0.3 / (p.y + 0.1);
    float x = p.x * depth;
    float z = depth + t * (2.0 + uBass * 4.0);

    // Grid lines
    float gridX = abs(fract(x * 0.5 * density) - 0.5);
    float gridZ = abs(fract(z * 0.3 * density) - 0.5);

    float lineX = smoothstep(max(0.02, fwidth(gridX) * 1.5), 0.0, gridX);
    float lineZ = smoothstep(max(0.02, fwidth(gridZ) * 1.5), 0.0, gridZ);
    float grid = max(lineX, lineZ);

    // Distance fog
    float fog = exp(-depth * fogamt);

    // Pulse waves along Z
    float wave = sin(z * wavefreq - t * 3.0 - uBarPhase * 6.28) * 0.5 + 0.5;
    wave = pow(wave, 4.0);

    color += uColor1 * grid * fog * (0.8 + uBeat * 0.5);
    color += uColor3 * wave * fog * 0.3 * lineX;

    // Grid intersection highlights
    float intersect = lineX * lineZ;
    color += uColor2 * intersect * fog * 1.5;
  }

  // Sky — subtle gradient
  if (p.y >= -0.1) {
    float skyGrad = smoothstep(-0.1, 0.5, p.y);
    color += mix(uColor1, vec3(0.0), skyGrad) * 0.05;

    // Sun/moon
    float sunDist = length(p - vec2(0.0, 0.15));
    float sun = 0.05 / (sunDist + 0.05);
    sun *= sun;
    color += mix(uColor2, uColor3, 0.5) * sun * (0.3 + uBeat * 0.3);

    // Horizontal scan lines in sky
    float scanlines = sin(p.y * 200.0 + t) * 0.5 + 0.5;
    scanlines = pow(scanlines, 8.0);
    color += uColor1 * scanlines * 0.02 * (1.0 - skyGrad);
  }

  // Side mountains / buildings silhouette
  float buildingX = abs(p.x);
  float buildingH = 0.05 + sin(buildingX * 20.0) * 0.03 + cos(buildingX * 37.0) * 0.02;
  float building = smoothstep(buildingH + 0.01, buildingH, p.y + 0.1);
  color = mix(color, vec3(0.0), building * 0.7);
  // Building edges glow
  float be = abs(p.y + 0.1 - buildingH);
  float buildingEdge = smoothstep(max(0.01, fwidth(be) * 1.5), 0.0, be);
  color += uColor2 * buildingEdge * 0.5;

  // Global beat pulse
  color *= 1.0 + uBeat * 0.3;

  // Scanline overlay
  float scan = sin(gl_FragCoord.y * 1.5) * 0.03;
  color -= scan;

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}

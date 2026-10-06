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
uniform float uBassHit;
uniform float density;
uniform float fogamt;
uniform float wavefreq;

varying vec2 vUv;

#define PI 3.14159265359

float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
  color += mix(uColor2, vec3(1.0), 0.3) * horizon * (2.0 + uBassHit * 2.0);
  // haze band at the horizon
  color += mix(uColor1, uColor2, 0.5) * exp(-abs(p.y + 0.1) * 9.0) * (0.18 + 0.25 * uBassHit + 0.15 * uEnergy);

  // Ground plane (below horizon)
  if (p.y < -0.1) {
    // Perspective transform
    float depth = -0.3 / (p.y + 0.1);
    float x = p.x * depth;
    float z = depth + t * (2.0 + uBass * 4.0);

    // Grid lines. The old spacing (2 units in x, 3.3 in z) put ONE vertical
    // line on screen at the bottom of the frame: the ground plane was empty.
    float gridX = abs(fract(x * 2.0 * density) - 0.5);
    float gridZ = abs(fract(z * 1.0 * density) - 0.5);

    float lineX = smoothstep(max(0.02, fwidth(gridX) * 1.5), 0.0, gridX);
    float lineZ = smoothstep(max(0.02, fwidth(gridZ) * 1.5), 0.0, gridZ);
    // near the horizon the lines are denser than pixels: fade them out there
    // instead of letting them fuse into a solid bright band
    lineZ *= 1.0 - smoothstep(0.15, 0.45, fwidth(gridZ));
    lineX *= 1.0 - smoothstep(0.15, 0.45, fwidth(gridX));
    float grid = max(lineX, lineZ);
    // soft halo along the lines, same distance fade
    float halo = max(exp(-gridX * 9.0) * (1.0 - smoothstep(0.15, 0.45, fwidth(gridX))),
                     exp(-gridZ * 9.0) * (1.0 - smoothstep(0.15, 0.45, fwidth(gridZ))));

    // Distance fog
    float fog = exp(-depth * fogamt);

    // Pulse waves along Z
    float wave = sin(z * wavefreq - t * 3.0 - uBarPhase * 6.28) * 0.5 + 0.5;
    wave = pow(wave, 4.0);

    color += uColor1 * (grid * 1.7 + halo * 0.35) * fog * (1.0 + uBeat * 0.8 + uBassHit);
    color += uColor3 * wave * fog * (0.25 * halo + 0.9 * grid) * (0.5 + uBass);
    // idle floor: a dim glow on the ground plane, so the horizon reads in silence
    color += uColor1 * fog * 0.25 * (1.0 - 0.5 * uEnergy);

    // Grid intersection highlights
    float intersect = lineX * lineZ;
    color += mix(uColor2, vec3(1.0), 0.4) * intersect * fog * 2.2;
  }

  // Sky — subtle gradient
  if (p.y >= -0.1) {
    float skyGrad = smoothstep(-0.1, 0.5, p.y);
    color += mix(uColor1, uColor3, skyGrad) * (0.28 - 0.14 * skyGrad);

    // Sun/moon
    float sunDist = length(p - vec2(0.0, 0.15));
    float sun = 0.05 / (sunDist + 0.05);
    sun *= sun;
    // retro sun: horizontal slits cut into the lower half of the disc
    float slits = mix(1.0, smoothstep(0.35, 0.65, sin(p.y * 110.0)), step(p.y, 0.15) * smoothstep(0.1, 0.0, sunDist - 0.05));
    color += mix(uColor2, uColor3, 0.5) * sun * slits * (0.6 + uBeat * 0.8 + uBassHit * 0.6);
    // stars
    vec2 sg = p * 60.0;
    float sh = hash2(floor(sg));
    color += vec3(1.0) * step(0.985, sh) * smoothstep(0.4, 0.0, length(fract(sg) - 0.5)) * (0.4 + 0.6 * sin(t * 2.0 + sh * 40.0)) * 0.45 * skyGrad;

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
  color += uColor2 * buildingEdge * (0.8 + 0.8 * uBeat);

  // Global beat pulse
  color *= 1.0 + uBeat * 0.4;

  // Scanline overlay
  color *= 1.0 - 0.05 * (sin(gl_FragCoord.y * 1.5) * 0.5 + 0.5);

  // soft shoulder for clean bloom highlights
  color = vec3(1.0) - exp(-max(color, vec3(0.0)) * 1.2);
  gl_FragColor = vec4(color, 1.0);
}

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
uniform float iterations;
uniform float zoom;
uniform float morph;

varying vec2 vUv;

#define PI 3.14159265359

mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Julia set with audio-reactive constant
  float t = uTime * 0.15;
  vec2 c = vec2(
    -0.7 + sin(t) * morph + uBass * 0.1,
    0.27015 + cos(t * 0.7) * 0.1 + uMid * 0.05
  );

  float zm = zoom - uBeat * 0.3;
  vec2 z = uv * zm;
  z *= rot(t * 0.2);

  float iter = 0.0;
  float maxIter = floor(iterations);
  float escape = 64.0;      // larger bailout = smoother bands
  bool escaped = false;
  // orbit traps: they are what gives the interior structure instead of a
  // flat fill, and the exterior filaments something to catch the light on
  float trapR = 1e9;
  float trapX = 1e9;

  // Constant loop bound (= param max), dynamic break on the actual count
  for (float i = 0.0; i < 80.0; i++) {
    if (i >= maxIter) break;
    if (dot(z, z) > escape) { escaped = true; break; }
    // z = z^2 + c
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    trapR = min(trapR, length(z));
    trapX = min(trapX, abs(z.x));
    iter = i + 1.0;
  }

  vec3 color;
  if (escaped) {
    // Smooth iteration count, then expand the low end: most exterior pixels
    // escape in a handful of steps, so a linear ramp painted them all the
    // same colour — the old version was a flat wash outside the set.
    float smoothIter = iter + 1.0 - log2(max(log2(dot(z, z)), 1.0));
    float f = pow(clamp(smoothIter / maxIter, 0.0, 1.0), 0.35);
    float phase = f * 9.0 + uTime * 0.35 + uHigh * 1.5;
    color  = uColor1 * (sin(phase) * 0.5 + 0.5);
    color += uColor2 * (sin(phase + 2.094) * 0.5 + 0.5);
    color += uColor3 * (sin(phase + 4.189) * 0.5 + 0.5);
    color *= 0.45 + 0.55 * f;
    // filaments picked out by the orbit trap
    color += uColor3 * exp(-trapX * 14.0) * 0.5;
  } else {
    // inside the set: shade by how close the orbit came to the origin
    float g = exp(-trapR * 2.2);
    color = mix(uColor3 * 0.06, uColor1 * 0.7, g);
    color += uColor2 * exp(-trapX * 9.0) * 0.35;
    color *= 0.6 + uBass * 0.5;
  }

  color *= 1.0 + uBeat * 0.5;

  gl_FragColor = vec4(color, 1.0);
}

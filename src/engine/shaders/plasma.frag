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
uniform float zoom;
uniform float ringfreq;

varying vec2 vUv;

// The palette as a loop, 1 → 2 → 3 → 1, with a plateau on each colour so the
// three read as three and not as their blends.
vec3 pal3(float x) {
  x = fract(x) * 3.0;
  float f = smoothstep(0.25, 0.75, fract(x));
  return x < 1.0 ? mix(uColor1, uColor2, f) : x < 2.0 ? mix(uColor2, uColor3, f) : mix(uColor3, uColor1, f);
}

#define PI 3.14159265359

void main() {
  // normalised by the short side: on a portrait output the rings stay the
  // same size they are on a landscape one instead of blowing up past the frame
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y);
  vec2 uv0 = uv;                 // unzoomed: the centre glow stays a spot
  float r0 = length(uv0);        // length(uv) = zoom * r0 (zoom > 0)
  uv *= zoom;
  float t = uTime;

  // Multiple sine plasma layers
  float bass = uBass;
  float mid = uMid;
  float beat = uBeat;

  float v1 = sin(uv.x * 10.0 + t * 2.0 + bass * 8.0);
  float v2 = sin(uv.y * 8.0 - t * 1.5 + mid * 6.0);
  float v3 = sin((uv.x + uv.y) * 6.0 + t * 1.2);
  float v4 = sin(length(uv * 8.0 - vec2(sin(t*0.7)*3.0, cos(t*0.5)*3.0)) - t * 3.0);
  float v5 = sin(length(uv * 6.0 + vec2(cos(t*0.3)*2.0, sin(t*0.8)*2.0)) + t * 2.0);

  // Interference
  float v = v1 + v2 + v3 + v4 * (1.0 + bass * 2.0) + v5 * (1.0 + mid);
  v *= 0.2;

  // Moiré rings
  float rings = sin(r0 * zoom * ringfreq - t * 4.0 - bass * 15.0);
  rings = rings * 0.5 + 0.5;
  rings = pow(rings, 2.0 + mid * 3.0);

  // Color from plasma value
  // The plasma value walks the palette loop. Was c1 + c2 * rings + c3 * …:
  // colour 1 at full weight everywhere, colour 2 only on the sparse rings.
  float hue = (v * 3.0 + t * 0.3) * 0.1591549;
  vec3 color = pal3(hue) * (0.75 + 0.5 * rings) + pal3(hue + 0.5) * 0.2 * (v * 0.5 + 0.5);
  color *= 0.7;

  // Energy-reactive brightness. The gains compound (0.7 × energy × beat ×
  // tone map): the old 2.5× beat strobe drove the whole frame to pastel white
  color *= 0.6 + uEnergy * 0.5;

  // Beat pulse
  color *= 1.0 + beat * 0.5;

  // Pulsing center — measured on uv0: at zoom 0.3 the zoomed radius never
  // left the glow and the whole frame was a flat pastel wash
  float glow = exp(-r0 * 2.5) * (0.3 + beat * 0.6);
  color += pal3(t * 0.05) * 1.6 * glow;

  gl_FragColor = vec4(color, 1.0);
}

precision highp float;

uniform sampler2D tDiffuse;
uniform float uWet;
uniform sampler2D tPrevFrame;
uniform float uDecay;
uniform float uZoom;
uniform float uRotation;
uniform float uBass;
uniform float uTime;
uniform float uWarp;      // noise displacement of the trail (TouchDesigner-style smear)
varying vec2 vUv;

#define PI 3.14159265359

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec4 current = texture2D(tDiffuse, vUv);

  // Zoom and rotate the previous frame for trail effect
  vec2 uv = vUv - 0.5;
  float zoom = 1.0 - uZoom * (1.0 + uBass * 0.02);
  float rot = uRotation * 0.01 * (1.0 + uBass);
  float c = cos(rot), s = sin(rot);
  uv = mat2(c, -s, s, c) * uv;
  uv *= zoom;
  uv += 0.5;

  // Vector-field displacement — trails curl instead of just zooming
  if (uWarp > 0.0) {
    float t = uTime * 0.15;
    vec2 flow = vec2(
      noise(uv * 4.0 + vec2(t, 0.0)) - 0.5,
      noise(uv * 4.0 + vec2(0.0, t) + 13.7) - 0.5
    );
    uv += flow * uWarp * (1.0 + uBass * 2.0) * 0.05;
  }

  vec4 prev = texture2D(tPrevFrame, uv);

  // Mix with decay
  float decay = uDecay;
  gl_FragColor = mix(current, max(current, prev * decay), uWet);
}

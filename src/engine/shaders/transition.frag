precision highp float;

uniform sampler2D tOld;
uniform sampler2D tNew;
uniform float uProgress;    // 0 = old, 1 = new
uniform int uType;          // 0=crossfade, 1=wipe-left, 2=wipe-down, 3=radial, 4=dissolve
uniform vec2 uResolution;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 oldColor = texture2D(tOld, vUv);
  vec4 newColor = texture2D(tNew, vUv);

  float t = clamp(uProgress, 0.0, 1.0);
  float mix_val = t;

  if (uType == 1) {
    // Wipe left-to-right
    float edge = t * 1.2 - 0.1;
    mix_val = smoothstep(edge - 0.05, edge + 0.05, vUv.x);
  } else if (uType == 2) {
    // Wipe top-to-bottom
    float edge = t * 1.2 - 0.1;
    mix_val = smoothstep(edge - 0.05, edge + 0.05, 1.0 - vUv.y);
  } else if (uType == 3) {
    // Radial wipe from center
    vec2 center = vUv - 0.5;
    float dist = length(center) * 1.414; // normalize to ~1 at corners
    float edge = t * 1.3;
    mix_val = smoothstep(edge - 0.08, edge + 0.08, dist);
    mix_val = 1.0 - mix_val; // expand outward
  } else if (uType == 4) {
    // Dissolve noise
    float noise = hash(floor(vUv * uResolution / 4.0));
    mix_val = smoothstep(t - 0.1, t + 0.1, noise);
  }
  // uType == 0: crossfade, mix_val = t (default)

  gl_FragColor = mix(oldColor, newColor, mix_val);
}

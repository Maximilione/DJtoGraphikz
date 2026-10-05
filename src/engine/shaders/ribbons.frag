precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBassTime;
uniform float uBeatClock;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;

varying vec2 vUv;

uniform float count;
uniform float curl;
uniform float twist;

// Ribbons: aurora curtains seen as ribbons of light that fold through depth.
// Up to 14 layers from far to near, each a band around a wandering centre
// line (sines of different frequency whose phase is dragged along the layer,
// so the line curls). The band width follows |cos| of a travelling phase:
// where it closes the ribbon is edge on, where it opens you see its face,
// which is what reads as a twist in 3D. Faces are soft, rims are bright. Far
// layers are small and dim, near ones big and hot. The bass swells the curl,
// the kick pushes brightness through all the layers.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float kick = clamp(uBassHit, 0.0, 1.0);
  float T = uTime * 0.25 + uBassTime * 0.35;
  float n = floor(clamp(count, 3.0, 14.0) + 0.5);
  float amp = (0.18 + 0.1 * uBass + 0.12 * kick) * clamp(curl, 0.0, 2.0);
  float tw = 2.0 + 2.0 * clamp(twist, 0.0, 2.0);

  vec3 col = mix(uColor2 * 0.08, uColor1 * 0.05, smoothstep(-0.5, 0.6, uv.y));
  col += uColor3 * 0.025 / (1.0 + 6.0 * dot(uv, uv));

  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    if (fi >= n) break;
    float f = (fi + 0.5) / n;                 // 0 far .. 1 near
    float s = mix(0.55, 1.8, f * f);          // perspective scale of the layer
    vec2 p = uv / s;
    float ph = fi * 1.7;
    p.x += 0.35 * sin(T * 0.5 + ph);
    float x = p.x * 3.0;
    float c = amp * (sin(x * 0.9 + T + ph)
                   + 0.55 * sin(x * 2.1 - T * 1.3 + ph * 2.0 + 1.3 * sin(T * 0.7 + fi))
                   + 0.25 * sin(x * 4.3 + T * 2.0 + ph * 3.0));
    c += (fi / n - 0.5) * 0.45 + 0.08 * sin(T * 0.4 + fi);
    float d = p.y - c;
    float ad = abs(d);
    float hw = 0.012 + 0.11 * abs(cos(x * tw * 0.3 + T * 0.8 + ph));
    float face = smoothstep(hw, hw * 0.15, ad);
    float edge = exp(-pow((ad - hw) / 0.008, 2.0));
    // palette across the layers and along the ribbon
    float m = fract(f * 1.3 + 0.12 * sin(x * 0.7 + T));
    vec3 pc = m < 0.5 ? mix(uColor1, uColor2, m * 2.0) : mix(uColor2, uColor3, m * 2.0 - 1.0);
    float near = 0.35 + 0.9 * f;
    float lum = (0.35 * face + 0.9 * edge) * near * (0.7 + 0.8 * kick + 0.4 * uEnergy);
    // curtains fade away below their rim
    lum += 0.22 * face * smoothstep(0.0, -0.3, d) * near;
    col += pc * lum * (1.4 / sqrt(n * 0.2 + 1.0));
  }

  col = col / (1.0 + 0.55 * col);
  col *= clamp(1.2 - dot(uv, uv) * 0.6, 0.5, 1.0);
  gl_FragColor = vec4(col, 1.0);
}

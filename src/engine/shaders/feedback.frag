precision highp float;

// Feedback warp: il frame precedente viene zoomato, ruotato e traslato attorno
// al centro prima di essere rimescolato sotto quello nuovo. Un solo knob
// (uWet = amount della catena): basso = scia corta, alto = MilkDrop
// (zoom 1.02 e 0.3° per frame, decay 0.97).
uniform sampler2D tDiffuse;
uniform sampler2D tPrevFrame;
uniform float uWet;
uniform float uBass;
uniform float uBeat;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec4 current = texture2D(tDiffuse, vUv);
  float a = clamp(uWet, 0.0, 1.0);

  // Per-frame transform of the history, all scaled by amount.
  // The beat kicks the zoom, the bass speeds up the spin.
  float zoom  = 1.0 + mix(0.003, 0.02, a) * (1.0 + uBass * 0.5) + uBeat * 0.01 * a;
  float rot   = mix(0.002, 0.0052, a) * (1.0 + uBass * 1.5);   // 0.11°..0.3° per frame
  vec2  drift = vec2(cos(uTime * 0.31), sin(uTime * 0.23)) * 0.003 * a;
  float decay = mix(0.80, 0.97, a);

  vec2 uv = vUv - 0.5;
  float c = cos(rot), s = sin(rot);
  uv = (mat2(c, -s, s, c) * uv) / zoom;
  uv += 0.5 + drift;

  // Vector-field displacement — trails curl instead of just zooming
  float t = uTime * 0.15;
  vec2 flow = vec2(
    noise(uv * 4.0 + vec2(t, 0.0)) - 0.5,
    noise(uv * 4.0 + vec2(0.0, t) + 13.7) - 0.5
  );
  uv += flow * (0.6 + 0.6 * a) * (1.0 + uBass * 2.0) * 0.05;

  vec4 prev = texture2D(tPrevFrame, uv);

  // The decay IS the wet of this effect: the mix only fades the trail in over
  // the first quarter of the fader so the intensity macro can take it to zero.
  gl_FragColor = mix(current, max(current, prev * decay), smoothstep(0.0, 0.25, a));
}

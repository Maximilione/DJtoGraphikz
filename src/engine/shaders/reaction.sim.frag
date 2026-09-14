precision highp float;

uniform sampler2D tBufferA;
uniform vec2 uBufferASize;
uniform vec2 uResolution;
uniform float uFrame;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBassHit;
uniform float uBeatClock;

uniform float feed;
uniform float kill;
uniform float inject;

varying vec2 vUv;

// Gray-Scott reaction-diffusion. This pass reads the buffer it wrote last
// iteration and writes the next state — the thing a single fullscreen pass
// structurally cannot do. Listed several times in the effect so the chemistry
// advances a few steps per frame; one step per frame crawls.
// ITERS must match how many times the pass appears in Engine's EFFECT_SHADERS.
#define ITERS 8.0

float hash(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uBufferASize;
  vec2 px = 1.0 / uBufferASize;

  // Seed: A saturated everywhere, B in blobs scattered over the whole frame.
  // Without a seed the equations sit at the trivial fixed point and nothing
  // ever happens — and a single central seed takes most of a minute to grow
  // across a projector, which is not a thing a VJ can use.
  if (uFrame < 2.0) {
    vec2 g = uv * vec2(16.0 * uBufferASize.x / uBufferASize.y, 16.0);
    vec2 gi = floor(g), gf = fract(g) - 0.5;
    float pick = step(0.42, hash(gi.x * 37.1 + gi.y * 91.7));
    vec2 jit = vec2(hash(gi.x * 13.3 + gi.y * 7.1), hash(gi.x * 29.9 + gi.y * 3.7)) - 0.5;
    float blob = pick * step(length(gf - jit * 0.55), 0.20);
    gl_FragColor = vec4(1.0, blob, 0.0, 1.0);
    return;
  }

  vec4 c = texture2D(tBufferA, uv);
  float a = c.r, b = c.g;

  // 9-point laplacian: the 5-point one is visibly anisotropic, the patterns
  // grow along the texel axes instead of radially
  vec2 lap = vec2(-1.0) * c.rg;
  lap += 0.2 * texture2D(tBufferA, uv + vec2( px.x, 0.0)).rg;
  lap += 0.2 * texture2D(tBufferA, uv + vec2(-px.x, 0.0)).rg;
  lap += 0.2 * texture2D(tBufferA, uv + vec2(0.0,  px.y)).rg;
  lap += 0.2 * texture2D(tBufferA, uv + vec2(0.0, -px.y)).rg;
  lap += 0.05 * texture2D(tBufferA, uv + px).rg;
  lap += 0.05 * texture2D(tBufferA, uv - px).rg;
  lap += 0.05 * texture2D(tBufferA, uv + vec2( px.x, -px.y)).rg;
  lap += 0.05 * texture2D(tBufferA, uv + vec2(-px.x,  px.y)).rg;

  // the music nudges the chemistry: mids and highs walk the feed/kill point
  // around, which is what turns coral into worms into spots
  float f = clamp(feed + uHigh * 0.004 - uMid * 0.001, 0.005, 0.09);
  float k = clamp(kill + uMid * 0.0022, 0.03, 0.075);

  float abb = a * b * b;
  a += (1.00 * lap.x - abb + f * (1.0 - a));
  b += (0.50 * lap.y + abb - (f + k) * b);

  // kick injection: three spots that move to a new place every beat. Split
  // across the iterations of this frame so the dose does not depend on ITERS.
  if (uBassHit > 0.01 && inject > 0.001) {
    float beat = floor(uBeatClock);
    float shot = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 cpos = vec2(hash(beat * 7.13 + float(i) * 13.7),
                       hash(beat * 11.7 + float(i) * 29.3));
      vec2 d = (uv - cpos) * vec2(uBufferASize.x / uBufferASize.y, 1.0);
      shot += exp(-dot(d, d) / 0.0012);
    }
    b += shot * uBassHit * inject * 0.25 / ITERS;
  }

  gl_FragColor = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}

precision highp float;

uniform sampler2D tBufferP;
uniform vec2 uBufferPSize;
uniform float uFrame;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uBassHit;
uniform float uBeatClock;
uniform sampler2D uSpectrum;

uniform float turbulence;
uniform float drag;
uniform float burst;

varying vec2 vUv;

// One texel per particle: xy = position in a [-1,1] box (x already in aspect
// units), zw = velocity. The draw pass reads this texture in its VERTEX shader,
// so 65k particles cost one texture fetch each and no CPU work at all.

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash3(vec2 p) {
  return vec3(hash(p), hash(p + 17.3), hash(p - 41.7));
}

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec2 o = vec2(0.0, 1.0);
  float n000 = hash(i.xy + i.z * 57.0), n100 = hash(i.xy + o.yx + i.z * 57.0);
  float n010 = hash(i.xy + o.xy + i.z * 57.0), n110 = hash(i.xy + o.yy + i.z * 57.0);
  float n001 = hash(i.xy + (i.z + 1.0) * 57.0), n101 = hash(i.xy + o.yx + (i.z + 1.0) * 57.0);
  float n011 = hash(i.xy + o.xy + (i.z + 1.0) * 57.0), n111 = hash(i.xy + o.yy + (i.z + 1.0) * 57.0);
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z) - 0.5;
}

// Four taps of one noise field give both its curl (divergence-free: particles
// swirl and never pile up) and its gradient (particles run downhill and DO pile
// up). Pure curl advection spreads 65k particles into an even grain — the
// structure comes from mixing a little gradient in.
vec4 field(vec2 p, float t) {
  float e = 0.12;
  float nu = vnoise(vec3(p + vec2(0.0, e), t));
  float nd = vnoise(vec3(p - vec2(0.0, e), t));
  float nr = vnoise(vec3(p + vec2(e, 0.0), t));
  float nl = vnoise(vec3(p - vec2(e, 0.0), t));
  vec2 grad = vec2(nr - nl, nu - nd) / (2.0 * e);
  return vec4(vec2(grad.y, -grad.x), grad);   // xy = curl, zw = gradient
}

void main() {
  vec2 uv = gl_FragCoord.xy / uBufferPSize;
  vec4 st = texture2D(tBufferP, uv);
  vec2 pos = st.xy, vel = st.zw;

  float seed = hash(gl_FragCoord.xy);
  float life = hash(gl_FragCoord.xy + 3.1);

  // spawn: on the first frames, and whenever a particle wanders off the box.
  // Respawn happens on a ring whose radius follows the spectrum band this
  // particle was assigned, so the swarm breathes with the music.
  float band = hash(gl_FragCoord.xy + 9.7);
  float spec = texture2D(uSpectrum, vec2(band, 0.5)).r;
  // Finite, staggered lifetimes. Without them the swarm just diffuses until it
  // covers the frame evenly and stops reading as a swarm at all; recycling
  // keeps a shape and lets the spectrum re-place particles as the track moves.
  float span = 70.0 + life * 150.0;
  float age = mod(uFrame + life * 733.0, span);
  // a half-float buffer that has gone to Inf never comes back on its own, and
  // one NaN particle is one vertex the driver may drop the whole draw for
  bool broken = !(dot(pos, pos) >= 0.0) || !(dot(vel, vel) >= 0.0);
  bool reborn = uFrame < 2.0 || broken || age < 1.0
             || abs(pos.x) > 2.2 || abs(pos.y) > 1.45;

  if (reborn) {
    float a = hash(gl_FragCoord.xy + floor(uBeatClock) * 0.137) * 6.2831853;
    // sqrt of a uniform variable fills a disc evenly; without it everything
    // lands on a ring and the middle of the frame stays empty
    // sqrt spreads evenly over a disc; life*life piles everything in the
    // middle, which in a silent room (spec = 0) is all there is
    float r = sqrt(life) * (0.95 + spec * 0.75);
    pos = vec2(cos(a) * r * 1.5, sin(a) * r);
    vel = vec2(cos(a), sin(a)) * (0.05 + 0.25 * spec);
  }

  float t = uTime * 0.13 + uBeatClock * 0.04;
  // Advection, not a spring: particles follow the curl field. An acceleration
  // model with an inward force and per-frame damping collapses the whole swarm
  // onto the origin in about a second — the damping wins long before the noise
  // has moved anything.
  // one field for every particle: a per-particle scale looks like plain noise,
  // because nothing is following the same streamline as its neighbours
  vec4 f0 = field(pos * 1.7, t);
  vec4 f1 = field(pos * 4.6 + 9.1, t * 1.7);
  vec2 flow = (f0.xy + f1.xy * 0.30 * seed) * turbulence
            - (f0.zw * 0.75 + f1.zw * 0.25) * (0.5 + 0.8 * uMid);
  // a silent room must still move: the audio adds to the floor, it is not
  // the whole term. At 0.25 the swarm barely drifts and reads as a still image.
  flow *= 0.60 + 0.55 * uEnergy;
  vel = mix(vel, flow, clamp(0.06 + 0.5 * drag, 0.02, 0.9));

  // kick: a radial shove that the drag eats over the next beat
  vel += normalize(pos + 1e-4) * uBassHit * burst * 1.6;

  // slow drift back to the middle, so nothing leaves for good on a quiet part
  pos -= pos * 0.004 * (1.0 - 0.7 * uBass);

  // fixed step: a VJ set runs for hours and the swarm must not change speed
  // with the frame rate
  vel = clamp(vel, -8.0, 8.0);
  pos += vel * 0.021;

  gl_FragColor = vec4(pos, vel);
}

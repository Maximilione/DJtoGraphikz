precision highp float;

uniform sampler2D tBufferP;
uniform vec2 uBufferPSize;
uniform vec2 uResolution;
uniform float uEnergy;
uniform float uBeat;
uniform float dotsize;

varying float vSpeed;
varying float vSeed;

// Vertex texture fetch: the position of every particle is read straight from
// the simulation buffer, so the CPU never touches a vertex.

void main() {
  // gl_VertexID, not a custom attribute: WebGL2 gives it for free, and a
  // per-vertex attribute here is one more thing that can silently arrive as
  // zero for every vertex — which draws all 16k particles on the same pixel.
  int cols = int(uBufferPSize.x);
  vec2 aIndex = vec2(float(gl_VertexID - (gl_VertexID / cols) * cols),
                     float(gl_VertexID / cols));

  vec4 st = texture2D(tBufferP, (aIndex + 0.5) / uBufferPSize);
  vSpeed = length(st.zw);
  vSeed = fract(aIndex.x * 0.017 + aIndex.y * 0.041);

  float aspect = uResolution.x / uResolution.y;
  gl_Position = vec4(st.x / aspect, st.y, 0.0, 1.0);

  // speed only modulates the size, it must not set it: in a silent room every
  // particle is slow and the whole swarm would shrink to invisible
  float size = dotsize * (0.9 + 0.9 * clamp(vSpeed, 0.0, 1.2)) * (1.0 + 0.5 * uBeat);
  // sqrt, not a straight ratio: a sprite's brightness goes with its AREA, so
  // scaling the diameter linearly makes the swarm four times dimmer whenever
  // the engine halves the render resolution
  float ps = size * sqrt(uResolution.y / 1080.0);
  // a NaN point size is not clamped by clamp(): the comparison is false either
  // way and the driver is free to drop the point, or the draw
  gl_PointSize = (ps > 0.0 && ps < 1e4) ? clamp(ps, 2.0, 24.0) : 2.0;
}

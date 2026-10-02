precision highp float;

// RGB delay: R dal frame corrente, G e B da due frame piu' vecchi (la scia a
// colori temporale dei video anni 2000). I frame vecchi arrivano dall'Engine
// come target a meta' risoluzione.
uniform sampler2D tDiffuse;
uniform sampler2D tDelay1;   // `stride` frame fa
uniform sampler2D tDelay2;   // `2*stride` frame fa
uniform float uWet;
varying vec2 vUv;

void main() {
  vec4 cur = texture2D(tDiffuse, vUv);
  vec3 wet = vec3(cur.r, texture2D(tDelay1, vUv).g, texture2D(tDelay2, vUv).b);
  gl_FragColor = vec4(mix(cur.rgb, wet, uWet), 1.0);
}

precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uHighHit;
uniform float uEnergy;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying vec3 vN;
varying vec3 vP;
varying float vSeed;

void main() {
  // treble: edges and points flicker, each by its own seed
  float spark = 1.0 + 2.2 * clamp(uHighHit + uHigh * 0.5, 0.0, 1.0)
                * step(0.55, fract(vSeed * 13.0 + uTime * 7.0));
#if LOOK == 0
  // neon wireframe: palette runs along the height, additive
  float k = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uColor1, uColor2, k);
  gl_FragColor = vec4(c * (0.55 + 0.5 * uEnergy) * spark, 1.0);
#elif LOOK == 1
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 c = mix(uColor3, uColor1, fract(vSeed * 3.0 + vP.y * 0.4));
  gl_FragColor = vec4(c * soft * (0.8 + 0.6 * uEnergy) * spark, 1.0);
#else
  // metal: a striped fake environment seen through the reflection vector
  vec3 n = normalize(vN);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  float env = 0.5 + 0.5 * sin(r.y * 6.0 + r.x * 3.0 + uTime * 0.6);
  vec3 c = mix(uColor1, uColor2, env);
  c = mix(c, uColor3, fres);
  float spec = pow(max(dot(r, normalize(vec3(0.4, 0.7, 0.6))), 0.0), 24.0);
  c = c * (0.3 + 0.7 * (0.5 + 0.5 * n.y)) + spec * (0.6 + uBass);
  c += uColor3 * fres * 0.5 * (1.0 + uHighHit * 2.0);
  gl_FragColor = vec4(c, 1.0);
#endif
}

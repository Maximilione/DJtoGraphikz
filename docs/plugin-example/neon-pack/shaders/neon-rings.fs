/*{
  "DESCRIPTION": "Anelli concentrici che pulsano",
  "CATEGORIES": ["Generator"],
  "INPUTS": [
    { "NAME": "rings", "LABEL": "Anelli", "TYPE": "float", "MIN": 2.0, "MAX": 30.0, "DEFAULT": 10.0 },
    { "NAME": "speed", "LABEL": "Velocita", "TYPE": "float", "MIN": 0.0, "MAX": 4.0, "DEFAULT": 1.0 }
  ]
}*/
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / RENDERSIZE.y;
  float d = length(uv);
  float w = 0.5 + 0.5 * sin(d * rings * 6.2831 - TIME * speed * 2.0);
  vec3 col = mix(uColor1, uColor2, smoothstep(0.2, 0.8, w)) * smoothstep(0.9, 0.0, d);
  gl_FragColor = vec4(col, 1.0);
}

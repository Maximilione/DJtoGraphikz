import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { Engine } from '@engine/Engine'
import { NumberInput } from '../NumberInput/NumberInput'

interface ShaderEditorProps {
  engine: Engine | null
}

// ---- Fractal/animation templates ----
const TEMPLATES: { name: string; category: string; code: string }[] = [
  {
    name: 'Mandelbrot',
    category: 'Fractal',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float zoom = 2.5 - uBass * 0.5;
  vec2 c = uv * zoom + vec2(-0.5, 0.0);
  c += vec2(sin(uTime * 0.1) * 0.3, cos(uTime * 0.13) * 0.2);
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (float i = 0.0; i < 64.0; i++) {
    if (dot(z, z) > 4.0) break;
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iter = i;
  }
  float f = iter / 64.0;
  float phase = f * 6.0 + uTime * 0.5;
  vec3 color = uColor1 * sin(phase) * 0.5 + uColor2 * sin(phase + 2.094) * 0.5 + uColor3 * sin(phase + 4.189) * 0.5;
  color = abs(color) * (1.0 + uBeat * 0.5);
  if (dot(z, z) <= 4.0) color = vec3(0.0);
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Julia Set',
    category: 'Fractal',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.2;
  vec2 c = vec2(-0.7 + sin(t) * 0.15 + uBass * 0.08, 0.27 + cos(t * 0.7) * 0.1 + uMid * 0.05);
  vec2 z = uv * (1.8 - uBeat * 0.2);
  float cs = cos(t * 0.15), sn = sin(t * 0.15);
  z = vec2(z.x*cs - z.y*sn, z.x*sn + z.y*cs);
  float iter = 0.0;
  for (float i = 0.0; i < 50.0; i++) {
    if (dot(z, z) > 4.0) break;
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iter = i;
  }
  float f = iter / 50.0;
  vec3 color = mix(uColor1, uColor2, sin(f * 8.0 + uTime) * 0.5 + 0.5);
  color = mix(color, uColor3, sin(f * 12.0 + uTime * 0.7) * 0.5 + 0.5);
  color *= f * 2.0 * (1.0 + uBeat * 0.8);
  if (dot(z, z) <= 4.0) color = uColor1 * 0.1;
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Burning Ship',
    category: 'Fractal',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float zoom = 2.0 - uBass * 0.3;
  vec2 c = uv * zoom + vec2(-0.4, -0.5);
  c.x += sin(uTime * 0.08) * 0.2;
  c.y += cos(uTime * 0.1) * 0.15;
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (float i = 0.0; i < 60.0; i++) {
    if (dot(z, z) > 4.0) break;
    z = abs(z);
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iter = i;
  }
  float f = iter / 60.0;
  vec3 color = uColor1 * pow(f, 0.8) + uColor2 * pow(f, 1.5) * 0.5;
  color += uColor3 * smoothstep(0.8, 1.0, fract(f * 5.0)) * 0.5;
  color *= 1.0 + uBeat * 0.6;
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Sierpinski',
    category: 'Fractal',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.3;
  float cs = cos(t * 0.2), sn = sin(t * 0.2);
  uv = vec2(uv.x*cs - uv.y*sn, uv.x*sn + uv.y*cs);
  float scale = 1.0 + uBass * 0.5;
  uv *= scale;
  float d = 1e10;
  for (int i = 0; i < 8; i++) {
    uv = abs(uv) - 0.5;
    if (uv.x < uv.y) uv = uv.yx;
    uv -= 0.5;
    uv *= 2.0;
    d = min(d, length(uv));
  }
  d = d / pow(2.0, 8.0);
  float f = 1.0 - smoothstep(0.0, 0.02, d);
  vec3 color = uColor1 * f + uColor2 * (1.0 - f) * 0.1;
  color += uColor3 * exp(-d * 200.0) * 0.5;
  color *= 1.0 + uBeat * 0.5;
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Spiral Zoom',
    category: 'Animation',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;
#define PI 3.14159265359

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float speed = 1.0 + uBass * 3.0;
  float spiral = sin(a * 5.0 + r * 20.0 - uTime * speed + uBeat * 2.0);
  spiral = smoothstep(0.0, 0.1, spiral);
  float rings = sin(r * 30.0 - uTime * speed * 2.0);
  rings = smoothstep(0.8, 1.0, rings);
  float pattern = max(spiral * 0.7, rings);
  float colorPhase = a / PI * 0.5 + uTime * 0.1 + r * 2.0;
  vec3 color = uColor1 * sin(colorPhase * 6.28) * 0.5 + 0.5;
  color += uColor2 * sin(colorPhase * 6.28 + 2.094) * 0.5;
  color += uColor3 * rings * 0.8;
  color *= pattern * (1.0 + uBeat * 0.5);
  color += mix(uColor1, uColor2, 0.5) * exp(-r * 4.0) * (0.2 + uBeat * 0.8);
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Kaleidoscope Fractal',
    category: 'Fractal',
    code: `precision highp float;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
varying vec2 vUv;
#define TAU 6.28318530718

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float t = uTime * 0.4;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float folds = floor(6.0 + uMid * 4.0);
  float fa = mod(a + t * 0.1, TAU / folds);
  if (fa > TAU / folds * 0.5) fa = TAU / folds - fa;
  vec2 p = vec2(cos(fa), sin(fa)) * r;
  // IFS fractal
  vec3 color = vec3(0.0);
  float scale = 1.0;
  for (int i = 0; i < 6; i++) {
    p = abs(p) - 0.5 - uBass * 0.1;
    float cs = cos(t * 0.1 + float(i)), sn = sin(t * 0.1 + float(i));
    p = vec2(p.x*cs - p.y*sn, p.x*sn + p.y*cs);
    p *= 1.5;
    scale *= 1.5;
    float d = length(p) / scale;
    vec3 c = (mod(float(i), 3.0) < 1.0) ? uColor1 : (mod(float(i), 3.0) < 2.0) ? uColor2 : uColor3;
    color += c * exp(-d * 10.0) * 0.3;
  }
  color *= 1.0 + uBeat * 0.6;
  color *= smoothstep(1.0, 0.2, r);
  gl_FragColor = vec4(color, 1.0);
}`,
  },
  {
    name: 'Empty Template',
    category: 'Template',
    code: `precision highp float;

// Audio uniforms (updated every frame)
uniform float uTime;       // elapsed seconds
uniform float uBass;       // 0-1 bass energy
uniform float uMid;        // 0-1 mid energy
uniform float uHigh;       // 0-1 high energy
uniform float uEnergy;     // 0-1 overall energy
uniform float uBeat;       // 1.0 on beat, decays to 0
uniform vec3 uColor1;      // palette color 1
uniform vec3 uColor2;      // palette color 2
uniform vec3 uColor3;      // palette color 3
uniform vec2 uResolution;  // viewport size

varying vec2 vUv;

void main() {
  // Normalized coords: center = (0,0), y range = -0.5..0.5
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Your code here
  vec3 color = vec3(0.0);
  color += uColor1 * (0.5 + 0.5 * sin(uTime + uv.x * 10.0));
  color += uColor2 * (0.5 + 0.5 * cos(uTime * 0.7 + uv.y * 8.0));
  color *= 0.5 + uBeat * 0.5;

  gl_FragColor = vec4(color, 1.0);
}`,
  },
]

export function ShaderEditor({ engine }: ShaderEditorProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [code, setCode] = useState(TEMPLATES[TEMPLATES.length - 1].code)
  const [error, setError] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const [lastApplied, setLastApplied] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<number>(0)

  // Apply shader to engine
  const applyShader = useCallback(() => {
    if (!engine) return
    setError(null)
    const ok = engine.setCustomShader(code)
    if (ok) {
      setLastApplied(code)
      engine.sendCustomShaderToOutput(code)
    } else {
      setError('Shader compilation failed — check console for details')
    }
  }, [engine, code])

  // Live mode: auto-apply on code change with debounce
  useEffect(() => {
    if (!liveMode || !engine || code === lastApplied) return
    clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setError(null)
      const ok = engine.setCustomShader(code)
      if (ok) {
        setLastApplied(code)
        engine.sendCustomShaderToOutput(code)
      } else {
        setError('Compile error')
      }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [code, liveMode, engine, lastApplied])

  // Load template
  const loadTemplate = useCallback((idx: number) => {
    setCode(TEMPLATES[idx].code)
    setError(null)
  }, [])

  // Handle tab key in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      // Restore cursor
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      }, 0)
    }
  }, [code])

  // Group templates by category
  const categories = TEMPLATES.reduce((acc, t, i) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push({ ...t, index: i })
    return acc
  }, {} as Record<string, (typeof TEMPLATES[0] & { index: number })[]>)

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Shader Editor</span>
        <span>{collapsed ? '+' : '-'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Templates */}
          <div>
            <div style={catLabel}>Templates</div>
            {Object.entries(categories).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '7px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                  {cat}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                  {items.map(t => (
                    <button
                      key={t.index}
                      onClick={() => loadTemplate(t.index)}
                      style={{
                        padding: '3px 6px', borderRadius: '3px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        fontSize: '9px', cursor: 'pointer',
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Code editor */}
          <div>
            <div style={catLabel}>GLSL Code</div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{
                width: '100%',
                height: '200px',
                padding: '6px',
                borderRadius: '4px',
                border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
                background: '#0a0a10',
                color: '#c8d0e0',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.4',
                resize: 'vertical',
                outline: 'none',
                tabSize: 2,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
              }}
            />
            <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {code.split('\n').length} lines
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div style={{
              padding: '4px 6px', borderRadius: '3px',
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.3)',
              fontSize: '9px', color: '#ff6666',
            }}>
              {error}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={applyShader}
              style={{ flex: 1 }}
            >
              Apply Shader
            </button>
            <button
              className={`btn btn-sm ${liveMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLiveMode(!liveMode)}
              title="Auto-apply while typing (with 500ms debounce)"
            >
              {liveMode ? 'Live ON' : 'Live'}
            </button>
          </div>

          {/* Save/Load */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                const blob = new Blob([code], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'custom-shader.frag'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export .frag
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.frag,.glsl,.txt'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  setCode(text)
                  setError(null)
                }
                input.click()
              }}
            >
              Import .frag
            </button>
          </div>

          {/* Uniforms reference */}
          <details style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '3px' }}>Available Uniforms</summary>
            <div style={{ fontFamily: 'var(--font-mono)', lineHeight: '1.6', paddingLeft: '8px' }}>
              <div><span style={{ color: 'var(--accent)' }}>uTime</span> — float, elapsed seconds</div>
              <div><span style={{ color: 'var(--accent)' }}>uBass</span> — float, 0-1 bass energy</div>
              <div><span style={{ color: 'var(--accent)' }}>uMid</span> — float, 0-1 mid energy</div>
              <div><span style={{ color: 'var(--accent)' }}>uHigh</span> — float, 0-1 high energy</div>
              <div><span style={{ color: 'var(--accent)' }}>uEnergy</span> — float, 0-1 overall energy</div>
              <div><span style={{ color: 'var(--accent)' }}>uBeat</span> — float, 1.0 on beat, decays</div>
              <div><span style={{ color: 'var(--accent)' }}>uColor1..3</span> — vec3, palette colors</div>
              <div><span style={{ color: 'var(--accent)' }}>uResolution</span> — vec2, viewport size</div>
              <div><span style={{ color: 'var(--accent)' }}>vUv</span> — vec2, 0..1 UV coords</div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

const catLabel: React.CSSProperties = {
  fontSize: '8px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1.2px',
  marginBottom: '3px',
}

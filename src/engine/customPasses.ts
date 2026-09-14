/**
 * A custom shader can be multi-pass too. Passes are separated in the SOURCE
 * itself, by marker lines, so the whole thing stays one string: presets, IPC
 * to the projector and the editor all keep working unchanged.
 *
 *   //!DJG_BUFFER A     <- everything under this writes buffer A
 *   //!DJG_MAIN         <- the visible pass (optional; end of file otherwise)
 *
 * Inside a pass, buffer A is read as `tBufferA` with size `uBufferASize`.
 * No marker at all means one pass, which is what every existing shader is.
 */
export function splitCustomPasses(src: string): { buffer: string; frag: string }[] {
  const re = /^[ \t]*\/\/!DJG_(BUFFER[ \t]+([A-Za-z_]\w*)|MAIN)[ \t]*$/gm
  const marks: { buffer: string; at: number; end: number }[] = []
  for (let m = re.exec(src); m; m = re.exec(src)) {
    marks.push({ buffer: m[2] ?? '', at: m.index, end: m.index + m[0].length })
  }
  if (marks.length === 0) return [{ buffer: '', frag: src }]

  const passes: { buffer: string; frag: string }[] = []
  // text before the first marker is shared by every pass (helpers, uniforms)
  const common = src.slice(0, marks[0].at)
  for (let i = 0; i < marks.length; i++) {
    const body = src.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].at : src.length)
    passes.push({ buffer: marks[i].buffer, frag: common + body })
  }
  // the visible pass is the last one; if the author only declared buffers,
  // add a blit so something reaches the screen
  const last = passes[passes.length - 1]
  if (last.buffer) {
    const n = last.buffer
    passes.push({
      buffer: '',
      frag: `precision highp float;\nvarying vec2 vUv;\nuniform sampler2D tBuffer${n};\n` +
            `void main() { gl_FragColor = texture2D(tBuffer${n}, vUv); }\n`,
    })
  }
  return passes
}

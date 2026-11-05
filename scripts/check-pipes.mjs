#!/usr/bin/env node
/** Pipes: conteggio tubi 2..7 per schermata, walk che scrive solo quei tubi.  node scripts/check-pipes.mjs */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const out = await build({ entryPoints: [join(REPO, 'src/engine/pipesWalk.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral' })
const W = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

for (let ep = 0; ep < 50; ep++) for (const d of [0.3, 1, 2, -5, 99, NaN]) {
  const n = W.pipesCount(d, ep)
  assert.ok(Number.isInteger(n) && n >= 2 && n <= W.PIPES_NPIPE, `count ${n} (d=${d}, ep=${ep})`)
}
const buf = new Float32Array(W.PIPES_TEX_WIDTH * 4)
const started = () => [...Array(W.PIPES_NPIPE).keys()].filter(i => buf[i * W.PIPES_PIPE_TEXELS * 4 + 3] > 0.5).length
W.pipesWalk(W.PIPES_EPOCH - 2, buf, 3)
assert.equal(started(), 3, 'solo i tubi richiesti')
W.pipesWalk(W.PIPES_EPOCH - 2, buf)
assert.equal(started(), W.PIPES_NPIPE, 'default: tutti')
console.log('check-pipes: ok')

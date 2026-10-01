#!/usr/bin/env node
/**
 * Scramble the renderer bundle after `electron-vite build`. The main process
 * and the preload are already V8 bytecode (bytecodePlugin); the renderer
 * cannot be (no node integration), so it gets javascript-obfuscator with the
 * light settings: renamed identifiers, strings (the GLSL included) in an
 * encoded array. No control-flow flattening and no dead code: those cost
 * frame time, and the engine runs at 60 fps.
 *
 * Only our chunks: `three-*.js` and `vendor-*.js` are public libraries.
 *
 *     node scripts/obfuscate.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JavaScriptObfuscator from 'javascript-obfuscator'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const dir = join(REPO, 'out/renderer/assets')
const SKIP = /^(three|vendor)-/

let n = 0, before = 0, after = 0
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.js') || SKIP.test(name)) continue
  const file = join(dir, name)
  const src = readFileSync(file, 'utf8')
  const out = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    target: 'browser',
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    splitStrings: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    sourceMap: false,
  }).getObfuscatedCode()
  writeFileSync(file, out)
  n++; before += src.length; after += out.length
}
console.log(`obfuscate: ${n} chunk, ${(before / 1024).toFixed(0)} → ${(after / 1024).toFixed(0)} kB`)
if (!n) { console.error('obfuscate: nessun chunk trovato in out/renderer/assets'); process.exit(1) }
void statSync

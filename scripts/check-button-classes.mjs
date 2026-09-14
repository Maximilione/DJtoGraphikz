#!/usr/bin/env node
/**
 * How many different ways does this app draw a button?
 *
 * The Rams audit counted ~30 distinct button and toggle treatments: `.btn`
 * existed as a system and almost nothing used it — nearly every button brought
 * its own standalone class. A4 folded them onto `.btn`, so twenty-five
 * standalone treatments became four.
 *
 * The four that remain are the named vocabulary, and they are deliberate:
 * `.panel-header` (a panel's fold bar, owned by Panel.tsx), `.pill`, `.tab`
 * and `.row-item`. Everything else is `.btn` plus a variant.
 *
 * A ratchet: this number may go down, never up.
 *
 *     node scripts/check-button-classes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const CAP = 4    // ratchet: lower it when a treatment is merged away

/** state/variant classes, not treatments of their own */
const MODIFIERS = new Set([
  'active', 'on', 'off', 'empty', 'danger', 'lg', 'sm', 'drag-over',
  'btn-sm', 'btn-primary', 'btn-secondary', 'btn-panic',
  'fx-thumb', 'fx-btn-lg', 'fx-btn-isf', 'toast-action',
])

function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
  })
}

const standalone = new Set()
const onBtn = new Set()
for (const file of walk(join(REPO, 'src/renderer'))) {
  const src = readFileSync(file, 'utf8')
  const re = /<button\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`\})/gs
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const raw = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, ' ')
    const toks = (raw.match(/[\w-]+/g) ?? []).filter(t => !MODIFIERS.has(t))
    if (toks.includes('btn')) toks.filter(t => t !== 'btn').forEach(t => onBtn.add(t))
    else toks.forEach(t => standalone.add(t))
  }
}

console.log(`trattamenti autonomi: ${standalone.size} (tetto ${CAP})`)
for (const c of [...standalone].sort()) console.log('  .' + c)
console.log(`\ncostruiti su .btn: ${onBtn.size}`)
for (const c of [...onBtn].sort()) console.log('  .btn + .' + c)

if (standalone.size > CAP) {
  console.error(`\nFALLITO: ${standalone.size} trattamenti, il tetto e' ${CAP}.`)
  console.error("Costruisci la variante su .btn, oppure abbassa il tetto se ne hai unito uno.")
  process.exit(1)
}
if (standalone.size < CAP) {
  console.log(`\nOK — e ora sono ${standalone.size}: abbassa CAP a ${standalone.size} in questo file.`)
} else {
  console.log('\nOK')
}

#!/usr/bin/env node
/**
 * WCAG contrast of the text tokens against the surfaces they actually land on.
 *
 * The audit found --text-muted at 2.63:1 on --bg3 and the focus ring at
 * 2.62:1 — both invisible in the room this app is used in, and both the kind
 * of thing you cannot judge by eye on a bright desk monitor. So it gets
 * arithmetic, in CI, instead of an opinion.
 *
 *     node scripts/check-contrast.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const css = readFileSync(join(REPO, 'src/renderer/styles/global.css'), 'utf8')

/** Read a token's literal value, following one level of var() aliasing */
function token(name) {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`token --${name} non trovato`)
  const v = m[1].trim()
  const alias = v.match(/^var\(--([\w-]+)\)$/)
  return alias ? token(alias[1]) : v
}

function parse(v) {
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(1)
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i)
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
  throw new Error(`colore non riconosciuto: ${v}`)
}

/** Flatten a translucent colour onto an opaque one */
const over = (fg, bg) => fg[3] >= 1 ? fg
  : [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1)

function luminance([r, g, b]) {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function ratio(fg, bg) {
  const a = luminance(over(fg, bg)), b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['bg0', 'bg1', 'bg2', 'bg3']
// Text tokens must clear 4.5:1: the whole type scale is 11-15px, so nothing in
// this interface qualifies as "large text" under WCAG.
const TEXT = ['text-primary', 'text-secondary', 'text-muted', 'accent', 'accent-dim', 'danger', 'warning']
// The focus ring is a component boundary, not text: 3:1 (WCAG 1.4.11).
const NON_TEXT = [['focus-ring', 3.0]]

let failures = 0
const pad = (s, n) => String(s).padEnd(n)

console.log(pad('token', 16) + SURFACES.map(s => pad(s, 9)).join(''))
for (const t of TEXT) {
  const fg = parse(token(t))
  let row = pad(t, 16)
  for (const s of SURFACES) {
    const r = ratio(fg, parse(token(s)))
    const ok = r >= 4.5
    if (!ok) failures++
    row += pad(`${r.toFixed(2)}${ok ? '' : ' ✗'}`, 9)
  }
  console.log(row)
}

console.log()
for (const [t, min] of NON_TEXT) {
  const fg = parse(token(t))
  for (const s of SURFACES) {
    const r = ratio(fg, parse(token(s)))
    const ok = r >= min
    if (!ok) failures++
    console.log(`${pad(t, 16)}su ${pad(s, 6)} ${r.toFixed(2)} (min ${min})${ok ? '' : ' ✗'}`)
  }
}

console.log()
if (failures) { console.error(`FALLITO: ${failures} coppie sotto la soglia`); process.exit(1) }
console.log('OK: ogni testo passa 4.5:1, ogni bordo 3:1')

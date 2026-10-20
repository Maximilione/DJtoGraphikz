import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'
import { stampSchemaVersion } from './storage'

// Anything that escapes React or a promise goes to the log file: a crash at
// 2 a.m. is diagnosed from that, not from devtools nobody had open.
const logGlobal = (tag: string, msg: string) => {
  try { window.api?.logToFile?.(tag, msg) } catch { /* plain browser, no bridge */ }
}
window.addEventListener('error', e => {
  const stack = e.error instanceof Error ? e.error.stack ?? '' : ''
  logGlobal('error', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}\n${stack}`)
})
window.addEventListener('unhandledrejection', e => {
  const r: unknown = e.reason
  logGlobal('unhandledrejection', r instanceof Error ? r.stack ?? r.message : String(r))
})

// Records which schema this build writes, before anything reads or saves.
stampSchemaVersion()

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

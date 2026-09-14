import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'
import { stampSchemaVersion } from './storage'

// Records which schema this build writes, before anything reads or saves.
stampSchemaVersion()

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

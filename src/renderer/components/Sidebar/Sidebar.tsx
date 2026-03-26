import React, { useState } from 'react'
import { AudioPanel } from '../AudioPanel/AudioPanel'
import { EffectPanel } from '../EffectPanel/EffectPanel'
import { OverlayPanel } from '../OverlayPanel/OverlayPanel'
import type { Engine } from '@engine/Engine'

interface SidebarProps {
  engine: Engine | null
}

export function Sidebar({ engine }: SidebarProps) {
  return (
    <div style={{
      width: '320px',
      minWidth: '320px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '8px',
      overflowY: 'auto',
      background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border)'
    }}>
      <AudioPanel engine={engine} />
      <EffectPanel engine={engine} />
      <OverlayPanel engine={engine} />
    </div>
  )
}

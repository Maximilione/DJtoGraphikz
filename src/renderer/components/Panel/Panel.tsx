import type { ReactNode } from 'react'
import { usePanelCollapsed } from '../usePanelCollapsed'

interface PanelProps {
  /** Stable key for the remembered collapsed state — never the visible title. */
  id: string
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
  /** Panels sharing a group behave as an accordion: opening one closes the others. */
  group?: string
  /** Dot next to the title when the panel's feature is live. */
  active?: boolean
}

/**
 * A panel that folds.
 *
 * There were three ways to fold one: `usePanelCollapsed` in six panels, a
 * local `useState` in three more, and a `<details>` inside two of those. The
 * local ones forgot their state on every restart, and only the hook ones took
 * part in the accordion — so the same header, clicked in two places, did two
 * different things. This is the one way.
 *
 * The rule, so a third way does not grow back: a *panel* folds with this
 * component; an inline hint inside a panel folds with a native `<details>`.
 * Nothing else folds.
 *
 * The body is not wrapped: each panel keeps its own layout element. It is also
 * not rendered while collapsed, which is why a folded panel costs nothing.
 */
export function Panel({ id, title, children, defaultCollapsed = false, group, active }: PanelProps) {
  const [collapsed, toggleCollapsed] = usePanelCollapsed(id, defaultCollapsed, group)

  return (
    <div className="panel">
      <button type="button"
        aria-expanded={!collapsed} className="panel-header"
        onClick={toggleCollapsed}
        title={collapsed ? `Espandi ${title}` : `Comprimi ${title}`}
      >
        <span>{title}{active ? ' ●' : ''}</span>
        <span>{collapsed ? '+' : '-'}</span>
      </button>
      {!collapsed && children}
    </div>
  )
}

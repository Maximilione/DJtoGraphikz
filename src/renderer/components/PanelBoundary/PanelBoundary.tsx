import React from 'react'

interface Props {
  /** Shown in the fallback and in the log line */
  name: string
  children: React.ReactNode
}
interface State { error: unknown }

/**
 * One boundary per panel, never around the root that owns the engine.
 *
 * With React 18 a throw in a panel's render or effect unmounts the whole
 * tree; App's cleanup then disposes the engine, so the preview, the audio
 * analysis and the Auto VJ all stop while the output window freezes on the
 * last state it got. A corrupt look, step or scene is a panel problem: it
 * is contained here, logged for the morning after, and retried on demand.
 */
export class PanelBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State { return { error } }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[panel] ${this.props.name}`, error, info.componentStack)
    const stack = error instanceof Error ? error.stack ?? error.message : String(error)
    try { window.api?.logToFile?.('panel', `[${this.props.name}] ${stack}${info.componentStack ?? ''}`) } catch { /* no bridge */ }
  }

  render() {
    if (!this.state.error) return this.props.children
    const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error)
    return (
      <div className="panel panel-error" role="alert">
        <div className="panel-header">{this.props.name} — pannello in errore</div>
        <div className="panel-error-body">
          <span className="panel-error-msg" title={msg}>{msg}</span>
          <button type="button" className="btn btn-secondary btn-sm" title="Rimonta il pannello" onClick={() => this.setState({ error: null })}>
            Riprova
          </button>
        </div>
      </div>
    )
  }
}

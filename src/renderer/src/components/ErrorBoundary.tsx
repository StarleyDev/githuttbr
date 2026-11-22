import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useT } from '../i18n'

interface Props {
  children: ReactNode
  /** Shown above the error message. */
  label?: string
  /** Called when the user dismisses (e.g. close the modal). */
  onReset?: () => void
}

interface State {
  error: Error | null
}

/** Catches render/runtime errors in its subtree so one broken view never blanks
 *  the whole app. Shows the error and a dismiss button. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface in the console for diagnosis.
    console.error('[gitcito] UI error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          label={this.props.label}
          message={this.state.error.message}
          onDismiss={() => {
            this.setState({ error: null })
            this.props.onReset?.()
          }}
        />
      )
    }
    return this.props.children
  }
}

// A function component so the fallback can use the reactive hook — a class
// render reading the non-reactive t() would keep the old language on a switch.
function ErrorFallback({
  label,
  message,
  onDismiss
}: {
  label?: string
  message: string
  onDismiss: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="error-boundary">
      <h3>{label ?? t('errorBoundary.title')}</h3>
      <pre className="error-boundary-msg">{message}</pre>
      <div className="modal-actions">
        <button className="btn primary" onClick={onDismiss}>
          {t('toast.dismiss')}
        </button>
      </div>
    </div>
  )
}

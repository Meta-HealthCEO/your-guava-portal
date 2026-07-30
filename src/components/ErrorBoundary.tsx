import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal render failed', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#0F0F0F] px-6 text-text flex items-center justify-center">
          <div className="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
            <h1 className="text-lg font-semibold">The portal could not finish loading</h1>
            <p className="mt-2 text-sm text-muted">
              Your data is safe. Reload the page to try again.
            </p>
            <Button className="mt-5" type="button" onClick={() => window.location.reload()}>
              Reload portal
            </Button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}

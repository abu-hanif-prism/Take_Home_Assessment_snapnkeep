import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

// Must be a class component — getDerivedStateFromError/componentDidCatch
// have no hook equivalent; React only invokes these two lifecycle methods
// on class components when an error is thrown during rendering.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-red-50 text-2xl">⚠</span>
          <h1 className="!text-2xl">Something went wrong</h1>
          <p className="max-w-sm text-sm text-[var(--text)]">
            An unexpected error broke this page. Your cart and login are untouched — reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

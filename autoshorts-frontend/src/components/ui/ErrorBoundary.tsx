'use client'
// src/components/ui/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-ink-1 mb-1">Something went wrong</h2>
          <p className="text-sm text-ink-4 max-w-sm mb-4">
            {this.state.error?.message ?? 'An unexpected error occurred in this section.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: undefined })
              window.location.reload()
            }}
          >
            <RefreshCw size={14} /> Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Lightweight section-level error fallback
export function SectionError({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <AlertTriangle size={14} className="flex-shrink-0" />
      {message ?? 'Failed to load this section. Try refreshing.'}
    </div>
  )
}

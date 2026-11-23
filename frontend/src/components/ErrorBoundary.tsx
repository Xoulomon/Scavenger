import React, { Component, ErrorInfo, ReactNode } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
  resetKeys?: unknown[]
}

interface State {
  hasError: boolean
  error: Error | null
}

function keysChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!prev || !next) return false
  if (prev.length !== next.length) return true
  return prev.some((value, index) => !Object.is(value, next[index]))
}

interface DefaultFallbackProps {
  error: Error | null
  onRetry: () => void
}

function DefaultFallback({ error, onRetry }: DefaultFallbackProps) {
  const { t } = useTranslation()
  return (
    <EmptyState
      role="alert"
      title={t('errorBoundary.title', 'Something went wrong.')}
      description={
        error?.message ?? t('errorBoundary.description', 'An unexpected error occurred.')
      }
      actionLabel={t('errorBoundary.tryAgain', 'Try again')}
      onAction={onRetry}
    />
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible feedback for users via the shared toast strategy.
    try {
      toast.error(error.message || 'Something went wrong.')
    } catch {
      // Toast may be unavailable (e.g. outside a Toaster); never throw from here.
    }

    // Development-only logging to keep production consoles clean.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }

    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && keysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultFallback error={this.state.error} onRetry={this.handleRetry} />
        )
      )
    }
    return this.props.children
  }
}

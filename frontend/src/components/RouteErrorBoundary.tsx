import { useEffect } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'

// Vite's dynamic import() rejects with messages like this when a route chunk
// fails to load (e.g. a stale chunk hash after a new deployment).
const CHUNK_LOAD_ERROR_RE = /fetch dynamically imported module|importing a module script failed/i

/**
 * Per-route error boundary, wired via React Router's `errorElement`. Each
 * route gets its own instance, so a crash on one page shows a fallback in
 * place of just that route — the rest of the app shell and other routes are
 * unaffected, and navigating away recovers automatically.
 *
 * Reporting goes through the shared toast strategy (no console.error-only
 * path); the fallback markup mirrors the unified ErrorBoundary.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { t } = useTranslation()

  const message = error instanceof Error ? error.message : String(error)
  const isChunkLoadError = error instanceof Error && CHUNK_LOAD_ERROR_RE.test(message)

  const description = isRouteErrorResponse(error)
    ? error.statusText || t('errors.route.status', { status: error.status })
    : message || t('errors.route.unexpected')

  useEffect(() => {
    console.error('[RouteErrorBoundary]', error)
  }, [error])

  useEffect(() => {
    toast({
      variant: 'destructive',
      title: isChunkLoadError ? 'Failed to load this page' : 'Something went wrong on this page',
      description: isChunkLoadError
        ? 'The page could not be loaded, possibly due to a network error or a new deployment.'
        : description
    })
  }, [toast, isChunkLoadError, description])

  if (isChunkLoadError) {
    return (
      <EmptyState
        role="alert"
        title={t('errors.chunkLoad.title')}
        description={t('errors.chunkLoad.description')}
        action={
          <Button onClick={() => window.location.reload()}>{t('errors.chunkLoad.reload')}</Button>
        }
      />
    )
  }

  return (
    <EmptyState
      role="alert"
      title={t('errors.route.title')}
      description={description}
      action={
        <>
          <Button variant="outline" onClick={() => navigate(0)}>
            {t('errors.route.tryAgain')}
          </Button>
          <Button onClick={() => navigate('/dashboard')}>{t('errors.route.goToDashboard')}</Button>
        </>
      }
    />
  )
}

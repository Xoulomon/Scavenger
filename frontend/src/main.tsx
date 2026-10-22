import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { Toaster, toast } from 'sonner'
import { App } from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { WalletProvider } from '@/context/WalletContext'
import { ContractProvider } from '@/context/ContractContext'
import { ThemeProvider, useTheme } from '@/context/ThemeProvider'
import { StoreProvider } from '@/store'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getErrorMessage } from '@/lib/contractErrors'
import { initWebVitals } from '@/lib/webVitals'
import { getDB, setQueryData } from '@/lib/indexedDB'
import { queryCachePolicy } from '@/lib/queryCachePolicy'
import '@/i18n/config'
import './index.css'

// Devtools are only needed in development; lazy-load them so the production
// bundle never contains the devtools module.
const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))
    )
  : null

// Initialize Web Vitals monitoring
initWebVitals((metric) => {
  // Optionally send to analytics endpoint in production
  if (!import.meta.env.DEV) {
    try {
      navigator.sendBeacon('/api/metrics', JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: new Date().toISOString(),
      }))
    } catch (error) {
      // Silently fail in production
    }
  }
})

// Create a client
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => toast.error(getErrorMessage(error))
  }),
  mutationCache: new MutationCache({
    onError: (error) => toast.error(getErrorMessage(error))
  }),
  defaultOptions: {
    queries: {
      ...queryCachePolicy,
    }
  }
})

// Set up persistence
persistQueryClient({
  queryClient,
  persister: {
    persistClient: async (client) => {
      const _db = await getDB()
      const queries = client.getQueryCache().getAll()
      
      for (const query of queries) {
        if (query.state.status === 'success' && query.state.data) {
          await setQueryData(
            JSON.stringify(query.queryKey),
            query.state.data,
            query.queryKey as string[]
          )
        }
      }
    },
    restoreClient: async () => {
      const _db = await getDB()
      const tx = _db.transaction('queries', 'readonly')
      const store = tx.objectStore('queries')
      
      const queries: Record<string, unknown> = {}
      
      for await (const cursor of store) {
        queries[cursor.key] = cursor.value
      }
      
      await tx.done
      return queries
    },
    removeClient: async () => {
      const db = await getDB()
      await db.clear('queries')
    },
  },
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
})

function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return <Toaster position="top-right" richColors closeButton theme={resolvedTheme} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <StoreProvider>
            <WalletProvider>
              <AuthProvider>
                <ContractProvider>
                  <App />
                  <ThemedToaster />
                </ContractProvider>
              </AuthProvider>
            </WalletProvider>
          </StoreProvider>
        </ErrorBoundary>
      </ThemeProvider>
      {ReactQueryDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </React.Suspense>
      )}
    </QueryClientProvider>
  </React.StrictMode>
)

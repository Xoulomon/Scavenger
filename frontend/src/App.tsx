import { lazy, Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { queryCachePolicy } from '@/lib/queryCachePolicy'
import '@/config';

const _LazyAppShell = lazy(() =>
  import('@/components/AppShell').then((m) => ({ default: m.AppShell })),
)

function AppFallback() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      Loading…
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: queryCachePolicy.staleTime,
      gcTime: queryCachePolicy.gcTime,
      retry: queryCachePolicy.retry,
      refetchOnWindowFocus: queryCachePolicy.refetchOnWindowFocus,
    },
    mutations: {
      retry: queryCachePolicy.mutationRetry,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<AppFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  )
}
import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </main>
  )
}

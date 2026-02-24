import { useAppTitle } from '@hooks/useAppTitle'

export function HomePage() {
  useAppTitle('Scavngr Dashboard')

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-700">Scavngr Frontend Initialized</h1>
      <p className="text-slate-600">
        React + TypeScript + Vite is configured with Tailwind, aliases, linting, and formatting.
      </p>
    </section>
  )
}

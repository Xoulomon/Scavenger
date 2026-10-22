import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ComplianceReportsPage } from '@/pages/ComplianceReportsPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: () => undefined }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ComplianceReportsPage />
    </QueryClientProvider>
  )
}

describe('ComplianceReportsPage — rendered shell', () => {
  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Compliance Reports' })).toBeTruthy()
  })

  it('offers the builder, history and scheduling tabs', () => {
    renderPage()
    expect(screen.getAllByText('Report Builder').length).toBeGreaterThan(0)
    expect(screen.getAllByText('History').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Scheduling').length).toBeGreaterThan(0)
  })

  it('switching to History shows the history search field', () => {
    renderPage()
    fireEvent.click(screen.getByText('History'))
    expect(screen.getByPlaceholderText('Search report history...')).toBeTruthy()
  })
})

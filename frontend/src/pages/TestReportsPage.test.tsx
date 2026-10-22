import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestReportsPage } from './TestReportsPage'

vi.mock('@/hooks/useAppTitle', () => ({
  useAppTitle: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TestReportsPage />
    </QueryClientProvider>
  )
}

describe('TestReportsPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Test Reports')).toBeInTheDocument()
  })

  it('renders tab navigation', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
  })

  it('renders stat cards in overview', () => {
    renderPage()
    expect(screen.getByText('Total Tests')).toBeInTheDocument()
    expect(screen.getByText('Passed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Pass Rate')).toBeInTheDocument()
  })

  it('switches to history tab when clicked', async () => {
    renderPage()
    const historyTab = screen.getByRole('tab', { name: 'History' })
    historyTab.click()
    expect(await screen.findByText('Test Pass Rate Trend (30 days)')).toBeInTheDocument()
  })

  it('switches to details tab when clicked', async () => {
    renderPage()
    const detailsTab = screen.getByRole('tab', { name: 'Details' })
    detailsTab.click()
    expect(await screen.findByPlaceholderText('Search tests...')).toBeInTheDocument()
  })
})

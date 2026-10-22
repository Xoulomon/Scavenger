import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ComplianceReportsPage } from './ComplianceReportsPage'

vi.mock('@/hooks/useAppTitle', () => ({
  useAppTitle: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ComplianceReportsPage />
    </QueryClientProvider>
  )
}

describe('ComplianceReportsPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Compliance Reports')).toBeInTheDocument()
  })

  it('renders tab navigation', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Report Builder' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Scheduling' })).toBeInTheDocument()
  })

  it('renders report builder form elements', () => {
    renderPage()
    expect(screen.getByText('Report Builder')).toBeInTheDocument()
    expect(screen.getByText('Report Template')).toBeInTheDocument()
    expect(screen.getByText('Date Range')).toBeInTheDocument()
    expect(screen.getByText('Participant Filter')).toBeInTheDocument()
    expect(screen.getByText('Export Format')).toBeInTheDocument()
  })

  it('renders preview panel', () => {
    renderPage()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('switches to history tab when clicked', async () => {
    renderPage()
    const historyTab = screen.getByRole('tab', { name: 'History' })
    historyTab.click()
    expect(await screen.findByText('Search report history...')).toBeInTheDocument()
  })

  it('switches to scheduling tab when clicked', async () => {
    renderPage()
    const schedulingTab = screen.getByRole('tab', { name: 'Scheduling' })
    schedulingTab.click()
    expect(await screen.findByText('Scheduled Reports')).toBeInTheDocument()
    expect(await screen.findByText('Add Schedule')).toBeInTheDocument()
  })
})

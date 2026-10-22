import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ParticipantSearchPage } from './ParticipantSearchPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

vi.mock('@/hooks/useSearch', () => ({
  useSearch: vi.fn(() => ({ results: [], isLoading: false })),
}))

describe('ParticipantSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Find Participants heading', () => {
    render(<ParticipantSearchPage />)
    expect(screen.getByText('Find Participants')).toBeInTheDocument()
  })

  it('renders search input with placeholder', () => {
    render(<ParticipantSearchPage />)
    expect(
      screen.getByPlaceholderText('Search by name, address, or location...')
    ).toBeInTheDocument()
  })

  it('shows empty message when no query', () => {
    render(<ParticipantSearchPage />)
    expect(
      screen.getByText('Enter a search query to find participants')
    ).toBeInTheDocument()
  })

  it('updates search query on input change', () => {
    render(<ParticipantSearchPage />)
    const input = screen.getByPlaceholderText('Search by name, address, or location...')
    fireEvent.change(input, { target: { value: 'Alice' } })
    expect(input).toHaveValue('Alice')
  })
})

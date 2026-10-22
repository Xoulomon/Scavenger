import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApiPlaygroundPage from './ApiPlaygroundPage'

vi.mock('@/api/httpClient', () => ({
  createApiClient: vi.fn(() => ({
    request: vi.fn(),
  })),
  ApiError: class extends Error {},
}))

describe('ApiPlaygroundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the API Playground heading', () => {
    render(<ApiPlaygroundPage />)
    expect(screen.getByText('API Playground')).toBeInTheDocument()
  })
})

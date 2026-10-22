import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApiPlaygroundPage from './ApiPlaygroundPage'

// ── MSW note (#1546) ────────────────────────────────────────────────────────
// ApiPlaygroundPage uses createApiClient from @/api/httpClient which calls
// the browser fetch() API.  The global test setup (src/test-utils/setup.tsx)
// starts an MSW server that intercepts those requests, so no vi.mock on the
// httpClient module is needed here.  Any API call made by this component
// during render will be intercepted by the handlers in
// src/test-utils/msw/handlers.ts.

describe('ApiPlaygroundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the API Playground heading', () => {
    render(<ApiPlaygroundPage />)
    expect(screen.getByText('API Playground')).toBeInTheDocument()
  })
})

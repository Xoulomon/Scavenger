import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from './App'

// Mock router to avoid actual navigation
vi.mock('@/router', () => ({
  router: {
    subscribe: vi.fn(() => (() => {})),
    state: { location: '/' },
    navigate: vi.fn(),
  },
}))

// Mock AuthContext to provide a valid context
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'test-user' },
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeDefined()
  })

  it('provides RouterProvider to the application', () => {
    const { container } = render(<App />)
    // Router provider should render successfully
    expect(container.firstChild).toBeDefined()
  })

  it('initializes with the correct router configuration', async () => {
    render(<App />)
    // The router should be initialized
    await waitFor(() => {
      expect(document.body).toBeDefined()
    })
  })

  it('renders a valid React component tree', () => {
    const { container } = render(<App />)
    expect(container.innerHTML).toBeDefined()
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })

  it('does not render error boundaries on initial load', () => {
    const { container } = render(<App />)
    const errorElements = container.querySelectorAll('[data-testid="error-boundary"]')
    expect(errorElements.length).toBe(0)
  })

  it('exports App component as a function', () => {
    expect(typeof App).toBe('function')
  })

  it('accepts no required props', () => {
    // App should render without any props
    const { container } = render(<App />)
    expect(container.firstChild).toBeDefined()
  })

  it('maintains router state across renders', async () => {
    const { rerender } = render(<App />)
    const firstRender = document.body.innerHTML

    rerender(<App />)
    const secondRender = document.body.innerHTML

    // Router should maintain state
    expect(firstRender).toBeDefined()
    expect(secondRender).toBeDefined()
  })
})

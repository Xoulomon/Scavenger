import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotFoundPage } from './NotFoundPage'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    render(<NotFoundPage />)
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders "Page not found" text', () => {
    render(<NotFoundPage />)
    expect(screen.getByText('Page not found.')).toBeInTheDocument()
  })

  it('renders a link to home', () => {
    render(<NotFoundPage />)
    expect(screen.getByText('Go home')).toBeInTheDocument()
  })
})

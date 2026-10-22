import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { HomePage } from './HomePage'

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}))

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

describe('HomePage', () => {
  it('renders without crashing', () => {
    const { container } = render(<HomePage />)
    // HomePage renders null (redirect-only component)
    expect(container).toBeTruthy()
  })
})

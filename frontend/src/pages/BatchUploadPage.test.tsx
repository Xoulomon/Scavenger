import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BatchUploadPage } from './BatchUploadPage'

vi.mock('@/hooks/useAppTitle', () => ({ useAppTitle: vi.fn() }))

describe('BatchUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // URL.createObjectURL is not implemented in jsdom
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
  })

  it('renders the Batch Upload heading', () => {
    render(<BatchUploadPage />)
    expect(screen.getByText('Batch Upload')).toBeInTheDocument()
  })

  it('renders the file drop zone', () => {
    render(<BatchUploadPage />)
    expect(
      screen.getByText('Drop your CSV here or click to browse')
    ).toBeInTheDocument()
  })

  it('renders the Download CSV Template button', () => {
    render(<BatchUploadPage />)
    expect(screen.getByText('Download CSV Template')).toBeInTheDocument()
  })
})

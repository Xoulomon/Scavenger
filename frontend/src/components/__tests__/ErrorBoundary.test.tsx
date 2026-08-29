import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../ErrorBoundary'

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('displays error message when error is thrown', () => {
    const ThrowError = () => {
      throw new Error('Test error message encountered.')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByText('Test error message encountered.')).toBeInTheDocument()
  })

  it('displays default fallback UI with error alert role', () => {
    const ThrowError = () => {
      throw new Error('An unexpected error occurred during the test.')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    const ThrowError = () => {
      throw new Error('A test error occurred in the component.')
    }

    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('displays "Try again" button that resets error state', async () => {
    const user = userEvent.setup()
    const ThrowError = () => {
      throw new Error('A test error occurred in the component.')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    const tryAgainButton = screen.getByText('Try again')
    expect(tryAgainButton).toBeInTheDocument()

    await user.click(tryAgainButton)
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument()
  })

  it('catches errors from nested components', () => {
    const NestedError = () => {
      throw new Error('Nested component error occurred.')
    }

    render(
      <ErrorBoundary>
        <div>
          <NestedError />
        </div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByText('Nested component error occurred.')).toBeInTheDocument()
  })

  it('logs error and component stack on error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error')
    const ThrowError = () => {
      throw new Error('A logged error occurred in the boundary.')
    }

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.any(String)
    )
  })

  it('maintains error state across re-renders', () => {
    const ThrowError = () => {
      throw new Error('A persistent error occurred during re-render.')
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
  })
})

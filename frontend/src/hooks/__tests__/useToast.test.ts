import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useToast } from '../useToast'
import * as sonner from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/contractErrors', () => ({
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message
    return 'Unknown error'
  }),
}))

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns toast object with success, error, and info methods', () => {
    const { result } = renderHook(() => useToast())

    expect(result.current).toHaveProperty('success')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('info')
    expect(typeof result.current.success).toBe('function')
    expect(typeof result.current.error).toBe('function')
    expect(typeof result.current.info).toBe('function')
  })

  it('calls sonner.toast.success with message', () => {
    const { result } = renderHook(() => useToast())

    result.current.success('Operation successful')

    expect(sonner.toast.success).toHaveBeenCalledWith('Operation successful')
    expect(sonner.toast.success).toHaveBeenCalledTimes(1)
  })

  it('calls sonner.toast.error with error message', () => {
    const { result } = renderHook(() => useToast())
    const error = new Error('An unexpected error occurred during the operation.')

    result.current.error(error)

    expect(sonner.toast.error).toHaveBeenCalled()
    expect(sonner.toast.error).toHaveBeenCalledTimes(1)
  })

  it('calls sonner.toast.info with message', () => {
    const { result } = renderHook(() => useToast())

    result.current.info('This is informational')

    expect(sonner.toast.info).toHaveBeenCalledWith('This is informational')
    expect(sonner.toast.info).toHaveBeenCalledTimes(1)
  })

  it('supports multiple success messages', () => {
    const { result } = renderHook(() => useToast())

    result.current.success('First message')
    result.current.success('Second message')
    result.current.success('Third message')

    expect(sonner.toast.success).toHaveBeenCalledTimes(3)
  })

  it('supports multiple error messages', () => {
    const { result } = renderHook(() => useToast())

    result.current.error(new Error('An error occurred during toast test 1.'))
    result.current.error(new Error('An error occurred during toast test 2.'))

    expect(sonner.toast.error).toHaveBeenCalledTimes(2)
  })

  it('supports multiple info messages', () => {
    const { result } = renderHook(() => useToast())

    result.current.info('Info 1')
    result.current.info('Info 2')
    result.current.info('Info 3')

    expect(sonner.toast.info).toHaveBeenCalledTimes(3)
  })

  it('handles mixed message types in sequence', () => {
    const { result } = renderHook(() => useToast())

    result.current.success('Success')
    result.current.error(new Error('An error occurred during the test.'))
    result.current.info('Info')

    expect(sonner.toast.success).toHaveBeenCalledTimes(1)
    expect(sonner.toast.error).toHaveBeenCalledTimes(1)
    expect(sonner.toast.info).toHaveBeenCalledTimes(1)
  })

  it('provides same toast instance across multiple calls', () => {
    const { result: result1 } = renderHook(() => useToast())
    const { result: result2 } = renderHook(() => useToast())

    result1.current.success('First hook call')
    result2.current.success('Second hook call')

    expect(sonner.toast.success).toHaveBeenCalledTimes(2)
  })
})

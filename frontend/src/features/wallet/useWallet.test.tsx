import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { StoreProvider } from '@/store'
import { WalletProvider } from '@/context/WalletContext'
import { useWallet } from './useWallet'
import * as service from './service'

vi.mock('./service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./service')>()
  return {
    ...actual,
    checkWalletInstalled: vi.fn(),
    getWalletPublicKey: vi.fn(),
    connectWallet: vi.fn(),
    getNetworkMismatchMessage: vi.fn(),
    watchWalletAccount: vi.fn(() => () => {}),
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>
    <WalletProvider>{children}</WalletProvider>
  </StoreProvider>
)

/** Renders the hook with the Freighter extension detected and no prior account. */
async function renderInstalledWallet() {
  vi.mocked(service.checkWalletInstalled).mockResolvedValue(true)
  vi.mocked(service.getWalletPublicKey).mockResolvedValue(undefined)
  const hook = renderHook(() => useWallet(), { wrapper })
  await waitFor(() => expect(hook.result.current.isInstalled).toBe(true))
  return hook
}

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('connects on the app network and exposes the address', async () => {
    const { result } = await renderInstalledWallet()
    vi.mocked(service.getNetworkMismatchMessage).mockResolvedValue(undefined)
    vi.mocked(service.connectWallet).mockResolvedValue('GCONNECTED')

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe('GCONNECTED')
    expect(result.current.error).toBeNull()
  })

  it('reports a network mismatch and does not request access', async () => {
    const { result } = await renderInstalledWallet()
    vi.mocked(service.getNetworkMismatchMessage).mockResolvedValue(
      service.NETWORK_MISMATCH_MESSAGE
    )

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toBe(service.NETWORK_MISMATCH_MESSAGE)
    expect(service.connectWallet).not.toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })

  it('disconnect clears the address and connection flag', async () => {
    const { result } = await renderInstalledWallet()
    vi.mocked(service.getNetworkMismatchMessage).mockResolvedValue(undefined)
    vi.mocked(service.connectWallet).mockResolvedValue('GCONNECTED')
    await act(async () => {
      await result.current.connect()
    })

    act(() => result.current.disconnect())

    expect(result.current.address).toBeNull()
    expect(result.current.isConnected).toBe(false)
  })

  it('follows an account switch reported by the wallet watcher', async () => {
    const { result } = await renderInstalledWallet()
    vi.mocked(service.getNetworkMismatchMessage).mockResolvedValue(undefined)
    vi.mocked(service.connectWallet).mockResolvedValue('GFIRST')
    await act(async () => {
      await result.current.connect()
    })

    const watcherCalls = vi.mocked(service.watchWalletAccount).mock.calls
    const onChange = watcherCalls[watcherCalls.length - 1][0]
    act(() => onChange('GSECOND'))

    expect(result.current.address).toBe('GSECOND')
    expect(result.current.isConnected).toBe(true)
  })

  it('disconnects when the wallet reports no account', async () => {
    const { result } = await renderInstalledWallet()
    vi.mocked(service.getNetworkMismatchMessage).mockResolvedValue(undefined)
    vi.mocked(service.connectWallet).mockResolvedValue('GFIRST')
    await act(async () => {
      await result.current.connect()
    })

    const watcherCalls = vi.mocked(service.watchWalletAccount).mock.calls
    const onChange = watcherCalls[watcherCalls.length - 1][0]
    act(() => onChange(undefined))

    expect(result.current.isConnected).toBe(false)
    expect(result.current.address).toBeNull()
  })
})

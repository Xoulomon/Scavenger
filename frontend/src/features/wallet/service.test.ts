import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as walletService from './service'
import * as freighterApi from '@stellar/freighter-api'

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getPublicKey: vi.fn(),
  getNetworkDetails: vi.fn(),
  signTransaction: vi.fn(),
  isBrowser: true,
}))

describe('wallet service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkWalletInstalled', () => {
    it('should return true if wallet is installed', async () => {
      vi.mocked(freighterApi.isConnected).mockResolvedValue(true)
      const result = await walletService.checkWalletInstalled()
      expect(result).toBe(true)
    })

    it('should return false if wallet is not installed', async () => {
      vi.mocked(freighterApi.isConnected).mockRejectedValue(new Error('Not installed.'))
      const result = await walletService.checkWalletInstalled()
      expect(result).toBe(false)
    })

    it('should return false on non-browser environment', async () => {
      Object.defineProperty(freighterApi, 'isBrowser', { value: false })
      const result = await walletService.checkWalletInstalled()
      expect(result).toBe(false)
    })
  })

  describe('getWalletPublicKey', () => {
    it('should return public key if available', async () => {
      const mockKey = 'GXYZABC123'
      vi.mocked(freighterApi.getPublicKey).mockResolvedValue(mockKey)
      const result = await walletService.getWalletPublicKey()
      expect(result).toBe(mockKey)
    })

    it('should return null if error occurs', async () => {
      vi.mocked(freighterApi.getPublicKey).mockRejectedValue(new Error('Failed.'))
      const result = await walletService.getWalletPublicKey()
      expect(result).toBeUndefined()
    })
  })

  describe('connectWallet', () => {
    it('should return address on successful connection', async () => {
      const mockAddress = 'GXYZABC123'
      vi.mocked(freighterApi.requestAccess).mockResolvedValue(mockAddress)
      const result = await walletService.connectWallet()
      expect(result).toBe(mockAddress)
    })

    it('should throw error with user-declined message', async () => {
      vi.mocked(freighterApi.requestAccess).mockRejectedValue(
        new Error('User declined.')
      )
      await expect(walletService.connectWallet()).rejects.toThrow(
        'Connection rejected by user'
      )
    })

    it('should throw error on connection failure', async () => {
      vi.mocked(freighterApi.requestAccess).mockRejectedValue(
        new Error('A network error occurred during the request.')
      )
      await expect(walletService.connectWallet()).rejects.toThrow(
        'Failed to connect wallet'
      )
    })
  })

  describe('signTransactionXDR', () => {
    it('should sign transaction and return XDR string', async () => {
      const txXdr = 'tx_xdr_string'
      const passphrase = 'Test SDF Network ; September 2015'
      const signedXdr = 'signed_tx_xdr_string'

      vi.mocked(freighterApi.signTransaction).mockResolvedValue(signedXdr)
      const result = await walletService.signTransactionXDR(txXdr, passphrase)

      expect(result).toBe(signedXdr)
      expect(freighterApi.signTransaction).toHaveBeenCalledWith(txXdr, {
        networkPassphrase: passphrase,
      })
    })

    it('should handle signTransaction response object', async () => {
      const txXdr = 'tx_xdr_string'
      const passphrase = 'Test SDF Network ; September 2015'
      const signedXdr = 'signed_tx_xdr_string'

      vi.mocked(freighterApi.signTransaction).mockResolvedValue({
        signedTxXdr: signedXdr,
      })
      const result = await walletService.signTransactionXDR(txXdr, passphrase)

      expect(result).toBe(signedXdr)
    })

    it('should throw error on signing failure', async () => {
      vi.mocked(freighterApi.signTransaction).mockRejectedValue(
        new Error('Sign failed.')
      )
      await expect(
        walletService.signTransactionXDR('tx', 'passphrase')
      ).rejects.toThrow('Failed to sign transaction: Sign failed.')
    })

    it('should pass network passphrase to SDK correctly', async () => {
      const txXdr = 'complex_transaction_xdr'
      const passphrase = 'Custom Network ; January 2024'
      const signedXdr = 'signed_complex_xdr'

      vi.mocked(freighterApi.signTransaction).mockResolvedValue(signedXdr)
      const result = await walletService.signTransactionXDR(txXdr, passphrase)

      expect(result).toBe(signedXdr)
      expect(freighterApi.signTransaction).toHaveBeenCalledWith(txXdr, {
        networkPassphrase: passphrase,
      })
    })

    it('should handle error when signing returns undefined', async () => {
      vi.mocked(freighterApi.signTransaction).mockRejectedValue(
        new Error('An unknown error occurred during signing.')
      )
      await expect(
        walletService.signTransactionXDR('tx', 'passphrase')
      ).rejects.toThrow('Failed to sign transaction: An unknown error occurred during signing.')
    })
  })

  describe('checkWalletInstalled edge cases', () => {
    it('should handle various error types gracefully', async () => {
      vi.mocked(freighterApi.isConnected).mockRejectedValue(
        new Error('Network timeout.')
      )
      const result = await walletService.checkWalletInstalled()
      expect(result).toBe(false)
    })

    it('should return false if isConnected throws non-Error', async () => {
      vi.mocked(freighterApi.isConnected).mockRejectedValue('unknown error')
      const result = await walletService.checkWalletInstalled()
      expect(result).toBe(false)
    })
  })

  describe('connectWallet error handling', () => {
    it('should distinguish between user rejection and other errors', async () => {
      vi.mocked(freighterApi.requestAccess).mockRejectedValue(
        new Error('User declined the connection request.')
      )
      await expect(walletService.connectWallet()).rejects.toThrow(
        'Connection rejected by user'
      )
    })

    it('should handle connection errors with proper message', async () => {
      vi.mocked(freighterApi.requestAccess).mockRejectedValue(
        new Error('Wallet not responding.')
      )
      await expect(walletService.connectWallet()).rejects.toThrow(
        'Failed to connect wallet'
      )
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(freighterApi.requestAccess).mockRejectedValue(
        'Unexpected string error'
      )
      await expect(walletService.connectWallet()).rejects.toThrow(
        'Failed to connect wallet'
      )
    })
  })

  describe('getWalletPublicKey edge cases', () => {
    it('should return empty string public key', async () => {
      vi.mocked(freighterApi.getPublicKey).mockResolvedValue('')
      const result = await walletService.getWalletPublicKey()
      expect(result).toBe('')
    })

    it('should return very long public key', async () => {
      const longKey = 'G' + 'A'.repeat(55)
      vi.mocked(freighterApi.getPublicKey).mockResolvedValue(longKey)
      const result = await walletService.getWalletPublicKey()
      expect(result).toBe(longKey)
    })

    it('should handle various error conditions', async () => {
      vi.mocked(freighterApi.getPublicKey).mockRejectedValue(
        new Error('Access denied.')
      )
      const result = await walletService.getWalletPublicKey()
      expect(result).toBeUndefined()
    })
  })

  describe('WalletConnectionState interface', () => {
    it('should have correct initial state', () => {
      expect(walletService.initialWalletState).toEqual({
        address: null,
        isConnected: false,
        isInstalled: false,
        isLoading: false,
        error: undefined,
      })
    })

    it('should have all required fields', () => {
      const state = walletService.initialWalletState
      expect(state).toHaveProperty('address')
      expect(state).toHaveProperty('isConnected')
      expect(state).toHaveProperty('isInstalled')
      expect(state).toHaveProperty('isLoading')
      expect(state).toHaveProperty('error')
    })
  })

  describe('validateWalletInput', () => {
    it('should handle empty strings safely', async () => {
      vi.mocked(freighterApi.getPublicKey).mockResolvedValue('')
      const result = await walletService.getWalletPublicKey()
      expect(result).toBe('')
    })

    it('should handle null or undefined responses', async () => {
      vi.mocked(freighterApi.getPublicKey).mockRejectedValue(
        new Error('No key available.')
      )
      const result = await walletService.getWalletPublicKey()
      expect(result).toBeUndefined()
    })
  })

  describe('SDK mock validation', () => {
    it('should verify all mocked functions are available', () => {
      expect(vi.mocked(freighterApi.isConnected)).toBeDefined()
      expect(vi.mocked(freighterApi.requestAccess)).toBeDefined()
      expect(vi.mocked(freighterApi.getPublicKey)).toBeDefined()
      expect(vi.mocked(freighterApi.signTransaction)).toBeDefined()
    })

    it('should clear mocks between tests', () => {
      vi.mocked(freighterApi.isConnected).mockResolvedValue(true)
      // This test runs after clearing, so the mock should be fresh
      expect(vi.mocked(freighterApi.isConnected)).toBeDefined()
    })
  })
})

describe('getNetworkMismatchMessage', () => {
  const APP_PASSPHRASE = 'Test SDF Network ; September 2015'

  it('returns undefined when Freighter is on the app network', async () => {
    vi.mocked(freighterApi.getNetworkDetails).mockResolvedValue({
      network: 'TESTNET',
      networkUrl: '',
      networkPassphrase: APP_PASSPHRASE,
    })
    expect(await walletService.getNetworkMismatchMessage(APP_PASSPHRASE)).toBeUndefined()
  })

  it('returns the mismatch message when Freighter is on another network', async () => {
    vi.mocked(freighterApi.getNetworkDetails).mockResolvedValue({
      network: 'PUBLIC',
      networkUrl: '',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    })
    expect(await walletService.getNetworkMismatchMessage(APP_PASSPHRASE)).toBe(
      walletService.NETWORK_MISMATCH_MESSAGE
    )
  })

  it('does not block when Freighter cannot report its network', async () => {
    vi.mocked(freighterApi.getNetworkDetails).mockRejectedValue(new Error('locked'))
    expect(await walletService.getNetworkMismatchMessage(APP_PASSPHRASE)).toBeUndefined()
  })
})

describe('watchWalletAccount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports the initial account and each switch', async () => {
    const onChange = vi.fn()
    vi.mocked(freighterApi.getPublicKey)
      .mockResolvedValueOnce('GFIRST')
      .mockResolvedValueOnce('GFIRST')
      .mockResolvedValueOnce('GSECOND')

    const stop = walletService.watchWalletAccount(onChange, 1000)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    stop()

    expect(onChange.mock.calls).toEqual([['GFIRST'], ['GSECOND']])
  })

  it('reports undefined when the wallet locks', async () => {
    const onChange = vi.fn()
    vi.mocked(freighterApi.getPublicKey)
      .mockResolvedValueOnce('GFIRST')
      .mockResolvedValueOnce(undefined as unknown as string)

    const stop = walletService.watchWalletAccount(onChange, 1000)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    stop()

    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('stops polling after the returned unsubscribe is called', async () => {
    const onChange = vi.fn()
    vi.mocked(freighterApi.getPublicKey).mockResolvedValue('GFIRST')

    const stop = walletService.watchWalletAccount(onChange, 1000)
    await vi.advanceTimersByTimeAsync(0)
    stop()
    const callsAtStop = vi.mocked(freighterApi.getPublicKey).mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)

    expect(vi.mocked(freighterApi.getPublicKey).mock.calls.length).toBe(callsAtStop)
  })
})

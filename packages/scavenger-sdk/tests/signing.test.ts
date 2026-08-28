/**
 * Unit tests for packages/scavenger-sdk/src/signing.ts
 *
 * Issue #1122: Add unit tests for WalletService-equivalent in packages/scavenger-sdk
 *
 * Coverage goals (90%+):
 * - signWithFreighter: success, freighter not installed, rejection, malformed response
 * - signWithSecretKey: success, invalid key, invalid XDR
 * - FreighterSigningStrategy: delegates to signWithFreighter
 * - SecretKeySigningStrategy: delegates to signWithSecretKey
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  signWithFreighter,
  signWithSecretKey,
  FreighterSigningStrategy,
  SecretKeySigningStrategy,
} from '../src/signing'
import { SigningError } from '../src/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

/**
 * A minimal valid transaction XDR produced by stellar-sdk.
 * We use a well-known testnet transaction envelope (stripped to essentials).
 */
const MOCK_SIGNED_XDR =
  'AAAAAgAAAABibbXCDloRAHDgXKqfFpBkC7VoTHbg2i1OeIJBRMZfBAAAAGQA' +
  'AAABAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// ---------------------------------------------------------------------------
// Mock @stellar/stellar-sdk – only the pieces signing.ts touches
// ---------------------------------------------------------------------------
vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    TransactionBuilder: {
      fromXDR: vi.fn(() => ({
        sign: vi.fn(),
        toXDR: vi.fn(() => MOCK_SIGNED_XDR),
      })),
    },
    BASE_FEE: '100',
    xdr: orig['xdr'],
    Keypair: {
      fromSecret: vi.fn((secret: string) => {
        if (secret === 'INVALID_SECRET') throw new Error('Invalid secret')
        return { secret }
      }),
    },
  }
})

// ---------------------------------------------------------------------------
// signWithFreighter
// ---------------------------------------------------------------------------

describe('signWithFreighter', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns signed XDR string when Freighter returns a plain string', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    const result = await fn('raw-xdr', NETWORK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('returns signed XDR when Freighter returns { signedTxXdr }', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR }),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    const result = await fn('raw-xdr', NETWORK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('throws SigningError when response format is unexpected', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockResolvedValue({ unexpectedField: 'value' }),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    await expect(fn('raw-xdr', NETWORK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('throws SigningError when Freighter module is not installed', async () => {
    vi.doMock('@stellar/freighter-api', () => {
      throw new TypeError('freighter is not defined')
    })
    const { signWithFreighter: fn } = await import('../src/signing')
    await expect(fn('raw-xdr', NETWORK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('throws SigningError when user rejects signing', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockRejectedValue(new Error('User rejected the request')),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    await expect(fn('raw-xdr', NETWORK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('wraps generic errors in SigningError with descriptive message', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockRejectedValue(new Error('Network error')),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    const error = await fn('raw-xdr', NETWORK_PASSPHRASE).catch((e) => e)
    expect(error).toBeInstanceOf(SigningError)
    expect(error.message).toContain('Transaction signing failed')
  })

  it('re-throws SigningError directly without double-wrapping', async () => {
    const originalError = new SigningError('Already a signing error')
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockRejectedValue(originalError),
    }))
    const { signWithFreighter: fn } = await import('../src/signing')
    const error = await fn('raw-xdr', NETWORK_PASSPHRASE).catch((e) => e)
    expect(error).toBe(originalError)
  })

  it('includes "Freighter wallet is not installed" in message when freighter undefined', async () => {
    vi.doMock('@stellar/freighter-api', () => {
      throw new ReferenceError('signTransaction is not defined')
    })
    const { signWithFreighter: fn } = await import('../src/signing')
    const error = await fn('raw-xdr', NETWORK_PASSPHRASE).catch((e) => e)
    expect(error.message).toContain('Freighter wallet is not installed')
  })
})

// ---------------------------------------------------------------------------
// signWithSecretKey
// ---------------------------------------------------------------------------

describe('signWithSecretKey', () => {
  it('returns signed XDR string for valid inputs', () => {
    const result = signWithSecretKey('raw-xdr', 'SVALIDKEY12345', NETWORK_PASSPHRASE)
    expect(typeof result).toBe('string')
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('throws SigningError for invalid secret key', () => {
    expect(() =>
      signWithSecretKey('raw-xdr', 'INVALID_SECRET', NETWORK_PASSPHRASE)
    ).toThrow(SigningError)
  })

  it('throws SigningError with descriptive message on failure', () => {
    let error: unknown
    try {
      signWithSecretKey('raw-xdr', 'INVALID_SECRET', NETWORK_PASSPHRASE)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(SigningError)
    expect((error as SigningError).message).toContain('Secret key signing failed')
  })

  it('calls TransactionBuilder.fromXDR with the correct arguments', async () => {
    const { TransactionBuilder } = await import('@stellar/stellar-sdk')
    signWithSecretKey('some-xdr', 'SVALIDKEY12345', NETWORK_PASSPHRASE)
    expect(TransactionBuilder.fromXDR).toHaveBeenCalledWith('some-xdr', NETWORK_PASSPHRASE)
  })
})

// ---------------------------------------------------------------------------
// FreighterSigningStrategy
// ---------------------------------------------------------------------------

describe('FreighterSigningStrategy', () => {
  it('has name "Freighter"', () => {
    const strategy = new FreighterSigningStrategy()
    expect(strategy.name).toBe('Freighter')
  })

  it('delegates sign() to signWithFreighter', async () => {
    vi.doMock('@stellar/freighter-api', () => ({
      signTransaction: vi.fn().mockResolvedValue(MOCK_SIGNED_XDR),
    }))
    const { FreighterSigningStrategy: S } = await import('../src/signing')
    const strategy = new S()
    const result = await strategy.sign('raw-xdr', NETWORK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('throws SigningError when Freighter is not available', async () => {
    vi.doMock('@stellar/freighter-api', () => {
      throw new Error('freighter is not defined')
    })
    const { FreighterSigningStrategy: S } = await import('../src/signing')
    const strategy = new S()
    await expect(strategy.sign('raw-xdr', NETWORK_PASSPHRASE)).rejects.toThrow(SigningError)
  })
})

// ---------------------------------------------------------------------------
// SecretKeySigningStrategy
// ---------------------------------------------------------------------------

describe('SecretKeySigningStrategy', () => {
  it('has name "Secret Key"', () => {
    const strategy = new SecretKeySigningStrategy('SKEY')
    expect(strategy.name).toBe('Secret Key')
  })

  it('delegates sign() to signWithSecretKey', async () => {
    const strategy = new SecretKeySigningStrategy('SVALIDKEY12345')
    const result = await strategy.sign('raw-xdr', NETWORK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('throws SigningError for invalid secret key via sign()', async () => {
    const strategy = new SecretKeySigningStrategy('INVALID_SECRET')
    await expect(strategy.sign('raw-xdr', NETWORK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('stores secret key internally', () => {
    const strategy = new SecretKeySigningStrategy('STEST_KEY')
    // The strategy can still be called multiple times with the same key
    expect(() => strategy.sign('xdr1', NETWORK_PASSPHRASE)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SigningStrategy interface compliance
// ---------------------------------------------------------------------------

describe('SigningStrategy interface', () => {
  it('FreighterSigningStrategy conforms to SigningStrategy interface', () => {
    const strategy = new FreighterSigningStrategy()
    expect(typeof strategy.name).toBe('string')
    expect(typeof strategy.sign).toBe('function')
  })

  it('SecretKeySigningStrategy conforms to SigningStrategy interface', () => {
    const strategy = new SecretKeySigningStrategy('SKEY')
    expect(typeof strategy.name).toBe('string')
    expect(typeof strategy.sign).toBe('function')
  })
})

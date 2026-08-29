import { describe, it, expect, vi } from 'vitest'
import { SigningError } from '../src/errors'

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: vi.fn(),
}))

const MOCK_SIGNED_XDR = 'AAAAAGsslkd...signed...'
const MOCK_TX_XDR = 'AAAAAGsslkd...unsigned...'
const MOCK_PASSPHRASE = 'Test SDF Network ; September 2025'
const MOCK_SECRET_KEY = 'SAUTOBOTO_NOT_A_REAL_KEY_FOR_TESTING_ONLY_PURPOSES1234567890'

async function importFreighter() {
  return await import('@stellar/freighter-api')
}

describe('signWithFreighter', () => {
  it('returns signed XDR string when Freighter returns a string', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockResolvedValue(MOCK_SIGNED_XDR as any)

    const { signWithFreighter } = await import('../src/signing')
    const result = await signWithFreighter(MOCK_TX_XDR, MOCK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('returns signed XDR when Freighter returns an object with signedTxXdr', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR } as any)

    const { signWithFreighter } = await import('../src/signing')
    const result = await signWithFreighter(MOCK_TX_XDR, MOCK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })

  it('throws SigningError for unexpected response format', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockResolvedValue({ unexpected: 'format' } as any)

    const { signWithFreighter } = await import('../src/signing')
    await expect(signWithFreighter(MOCK_TX_XDR, MOCK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('throws SigningError when Freighter is not installed', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockRejectedValue(
      new ReferenceError('signTransaction is not defined')
    )

    const { signWithFreighter } = await import('../src/signing')
    await expect(signWithFreighter(MOCK_TX_XDR, MOCK_PASSPHRASE)).rejects.toThrow(SigningError)
  })

  it('wraps generic errors in SigningError', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockRejectedValue(new Error('User rejected'))

    const { signWithFreighter } = await import('../src/signing')
    await expect(signWithFreighter(MOCK_TX_XDR, MOCK_PASSPHRASE)).rejects.toThrow(SigningError)
  })
})

describe('FreighterSigningStrategy', () => {
  it('has name "Freighter"', async () => {
    const { FreighterSigningStrategy } = await import('../src/signing')
    const strategy = new FreighterSigningStrategy()
    expect(strategy.name).toBe('Freighter')
  })

  it('delegates sign to signWithFreighter', async () => {
    const { signTransaction } = await importFreighter()
    vi.mocked(signTransaction).mockResolvedValue(MOCK_SIGNED_XDR as any)

    const { FreighterSigningStrategy } = await import('../src/signing')
    const strategy = new FreighterSigningStrategy()
    const result = await strategy.sign(MOCK_TX_XDR, MOCK_PASSPHRASE)
    expect(result).toBe(MOCK_SIGNED_XDR)
  })
})

describe('SecretKeySigningStrategy', () => {
  it('has name "Secret Key"', async () => {
    const { SecretKeySigningStrategy } = await import('../src/signing')
    const strategy = new SecretKeySigningStrategy(MOCK_SECRET_KEY)
    expect(strategy.name).toBe('Secret Key')
  })

  it('throws SigningError for invalid secret key', async () => {
    const { SecretKeySigningStrategy } = await import('../src/signing')
    const strategy = new SecretKeySigningStrategy('invalid-key')
    await expect(strategy.sign(MOCK_TX_XDR, MOCK_PASSPHRASE)).rejects.toThrow(SigningError)
  })
})

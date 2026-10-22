import {
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { SigningError } from './errors'

/**
 * Sign a transaction XDR using the Freighter browser wallet.
 *
 * @param txXdr - The assembled transaction XDR string to sign.
 * @param networkPassphrase - Stellar network passphrase.
 * @returns The signed transaction XDR string.
 * @throws {SigningError} If Freighter is not available or signing is rejected.
 *
 * @example
 * ```ts
 * const signed = await signWithFreighter(tx.toXDR(), 'Test SDF Network ; September 2025')
 * ```
 */
export async function signWithFreighter(
  txXdr: string,
  networkPassphrase: string
): Promise<string> {
  try {
    const { signTransaction } = await import('@stellar/freighter-api')
    const result = await signTransaction(txXdr, { networkPassphrase })

    if (typeof result === 'string') return result
    if (result && typeof result === 'object' && 'signedTxXdr' in result) {
      return (result as { signedTxXdr: string }).signedTxXdr
    }

    throw new SigningError('Unexpected signing response format')
  } catch (err) {
    if (err instanceof SigningError) throw err
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('is not defined') || message.includes('freighter')) {
      throw new SigningError('Freighter wallet is not installed. Please install the Freighter browser extension.')
    }
    throw new SigningError(`Transaction signing failed: ${message}`)
  }
}

/**
 * Sign a transaction XDR using a raw secret key (server-side use).
 *
 * @param txXdr - The assembled transaction XDR string to sign.
 * @param secretKey - Stellar secret key (S...).
 * @param networkPassphrase - Stellar network passphrase.
 * @returns The signed transaction XDR string.
 * @throws {SigningError} If the key is invalid or signing fails.
 *
 * @example
 * ```ts
 * const signed = signWithSecretKey(tx.toXDR(), 'S...', 'Test SDF Network ; September 2025')
 * ```
 */
export function signWithSecretKey(
  txXdr: string,
  secretKey: string,
  networkPassphrase: string
): string {
  try {
    const { Keypair } = require('@stellar/stellar-sdk')
    const keypair = Keypair.fromSecret(secretKey)
    const tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase)
    tx.sign(keypair)
    return tx.toXDR()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new SigningError(`Secret key signing failed: ${message}`)
  }
}

/**
 * Interface for pluggable signing strategies.
 * Implement this to support different wallets (Freighter, Albedo, WalletConnect, etc.).
 */
export interface SigningStrategy {
  /** Display name of the wallet/strategy. */
  name: string
  /**
   * Sign the given transaction XDR.
   * @param txXdr - Transaction XDR string to sign.
   * @param networkPassphrase - Stellar network passphrase.
   * @returns Signed transaction XDR string.
   */
  sign(txXdr: string, networkPassphrase: string): Promise<string>
}

/** Signing strategy using the Freighter browser wallet. */
export class FreighterSigningStrategy implements SigningStrategy {
  name = 'Freighter'

  async sign(txXdr: string, networkPassphrase: string): Promise<string> {
    return signWithFreighter(txXdr, networkPassphrase)
  }
}

/** Signing strategy using a raw secret key string. */
export class SecretKeySigningStrategy implements SigningStrategy {
  name = 'Secret Key'

  /** @param secretKey - Stellar secret key (S...). */
  constructor(private secretKey: string) {}

  async sign(txXdr: string, networkPassphrase: string): Promise<string> {
    return signWithSecretKey(txXdr, this.secretKey, networkPassphrase)
  }
}

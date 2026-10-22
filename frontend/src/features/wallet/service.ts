/**
 * features/wallet/service.ts
 *
 * The only module that talks to @stellar/freighter-api. Connection, network
 * checks and account tracking all go through here so the rest of the app
 * sees one wallet state. Components and hooks use useWallet() instead.
 */
import {
  isBrowser,
  isConnected as freighterIsConnected,
  getNetworkDetails,
  getPublicKey as freighterGetPublicKey,
  requestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api'
import { networkConfig } from '@/lib/stellar'

export const NETWORK_MISMATCH_MESSAGE =
  'Freighter is set to a different Stellar network. Switch Freighter to the network this app uses and try again.'

export interface WalletConnectionState {
  address: string | null
  isConnected: boolean
  isInstalled: boolean
  isLoading: boolean
  error: string | undefined
}

export const initialWalletState: WalletConnectionState = {
  address: null,
  isConnected: false,
  isInstalled: false,
  isLoading: false,
  error: undefined,
}

export function isWalletEnvironment(): boolean {
  return isBrowser
}

export async function checkWalletInstalled(): Promise<boolean> {
  if (!isBrowser) return false
  try {
    return await freighterIsConnected()
  } catch {
    return false
  }
}

export async function getWalletPublicKey(): Promise<string | undefined> {
  try {
    return await freighterGetPublicKey()
  } catch {
    return undefined
  }
}

/**
 * Returns NETWORK_MISMATCH_MESSAGE when Freighter's passphrase differs from the
 * app's, otherwise undefined. If Freighter cannot report its network, the
 * check passes so a wallet quirk does not block the user.
 */
export async function getNetworkMismatchMessage(
  expectedPassphrase: string = networkConfig.networkPassphrase
): Promise<string | undefined> {
  try {
    const { networkPassphrase } = await getNetworkDetails()
    if (!networkPassphrase || networkPassphrase === expectedPassphrase) return undefined
    return NETWORK_MISMATCH_MESSAGE
  } catch {
    return undefined
  }
}

export async function connectWallet(): Promise<string> {
  try {
    const address = await requestAccess()
    return address
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      message.includes('User declined')
        ? 'Connection rejected by user'
        : 'Failed to connect wallet'
    )
  }
}

export async function signTransactionXDR(
  transactionXDR: string,
  networkPassphrase: string
): Promise<string> {
  try {
    const signResult = await freighterSignTransaction(transactionXDR, {
      networkPassphrase,
    })
    return typeof signResult === 'string'
      ? signResult
      : (signResult as { signedTxXdr: string }).signedTxXdr
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to sign transaction: ${message}`)
  }
}

/**
 * Freighter exposes no account-change event, so the active account is polled.
 * `onChange` fires on the first poll and whenever the address changes,
 * including to undefined when the wallet locks or the account is removed.
 *
 * @returns a function that stops polling
 */
export function watchWalletAccount(
  onChange: (address: string | undefined) => void,
  intervalMs = 2_000
): () => void {
  let lastSeen: string | undefined | null = null
  let stopped = false

  const poll = async () => {
    const address = await getWalletPublicKey()
    if (stopped || address === lastSeen) return
    lastSeen = address
    onChange(address)
  }

  void poll()
  const timer = setInterval(() => void poll(), intervalMs)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

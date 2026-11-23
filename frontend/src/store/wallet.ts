/**
 * store/wallet.ts — Wallet slice
 *
 * Manages Freighter wallet connection state:
 *   address, connection status, install status, and errors.
 *
 * Persisted to localStorage under 'wallet_address'.
 */

export interface WalletState {
  address: string | null
  isConnected: boolean
  isInstalled: boolean
  isLoading: boolean
  error: string | null
}

export type WalletAction =
  | { type: 'WALLET_LOADING' }
  | { type: 'WALLET_INSTALLED'; payload: boolean }
  | { type: 'WALLET_CONNECTED'; payload: string }
  | { type: 'WALLET_DISCONNECTED' }
  | { type: 'WALLET_ERROR'; payload: string }
  | { type: 'WALLET_READY' }

const STORAGE_KEY = 'wallet_address'

export const walletInitialState: WalletState = {
  address: typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  isConnected: false,
  isInstalled: false,
  isLoading: true,
  error: null
}

export function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'WALLET_LOADING':
      return { ...state, isLoading: true, error: null }

    case 'WALLET_INSTALLED':
      return { ...state, isInstalled: action.payload }

    case 'WALLET_CONNECTED':
      return {
        ...state,
        address: action.payload,
        isConnected: true,
        isLoading: false,
        error: null
      }

    case 'WALLET_DISCONNECTED':
      return {
        ...state,
        address: null,
        isConnected: false,
        isLoading: false,
        error: null
      }

    case 'WALLET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'WALLET_READY':
      return { ...state, isLoading: false }

    default:
      return state
  }
}

/* ── Persistence helpers ─────────────────────────────────────── */

export function persistWalletAddress(address: string): void {
  localStorage.setItem(STORAGE_KEY, address)
}

export function clearPersistedWallet(): void {
  localStorage.removeItem(STORAGE_KEY)
}

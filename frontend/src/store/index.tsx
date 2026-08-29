/**
 * store/index.tsx — Root store provider
 *
 * Combines auth, wallet, and ui slices into a single React context.
 * Each slice has its own sub-context to prevent unnecessary re-renders
 * when an unrelated slice changes.
 *
 * Usage:
 *   // In your app root (or tests):
 *   <StoreProvider>...</StoreProvider>
 *
 *   // In any component:
 *   const { state, dispatch } = useAuthStore()
 *   const { state, dispatch } = useWalletStore()
 *   const { state, dispatch } = useUiStore()
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react'

import {
  authReducer,
  authInitialState,
  loadPersistedAuth,
  persistAuth,
  clearPersistedAuth,
  type AuthState,
  type AuthAction,
} from './auth'

import {
  walletReducer,
  walletInitialState,
  persistWalletAddress,
  clearPersistedWallet,
  type WalletState,
  type WalletAction,
} from './wallet'

import { uiReducer, uiInitialState, type UiState, type UiAction } from './ui'

/* ────────────────────────────────────────────────────────────────
   Slice context types
   ──────────────────────────────────────────────────────────────── */

interface AuthSlice {
  state: AuthState
  dispatch: React.Dispatch<AuthAction>
}

interface WalletSlice {
  state: WalletState
  dispatch: React.Dispatch<WalletAction>
}

interface UiSlice {
  state: UiState
  dispatch: React.Dispatch<UiAction>
}

/* ────────────────────────────────────────────────────────────────
   Contexts
   ──────────────────────────────────────────────────────────────── */

const AuthStoreContext = createContext<AuthSlice | undefined>(undefined)
const WalletStoreContext = createContext<WalletSlice | undefined>(undefined)
const UiStoreContext = createContext<UiSlice | undefined>(undefined)

/* ────────────────────────────────────────────────────────────────
   Provider
   ──────────────────────────────────────────────────────────────── */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authState, authDispatch] = useReducer(authReducer, authInitialState)
  const [walletState, walletDispatch] = useReducer(walletReducer, walletInitialState)
  const [uiState, uiDispatch] = useReducer(uiReducer, uiInitialState)

  // Hydrate auth from localStorage on mount
  useEffect(() => {
    const stored = loadPersistedAuth()
    if (stored) {
      authDispatch({ type: 'AUTH_LOGIN', payload: stored })
    } else {
      authDispatch({ type: 'AUTH_LOGOUT' })
    }
  }, [])

  // Persist auth side effects
  useEffect(() => {
    if (authState.user) {
      persistAuth(authState.user)
    } else if (!authState.isLoading) {
      clearPersistedAuth()
    }
  }, [authState.user, authState.isLoading])

  // Persist wallet address side effects
  useEffect(() => {
    if (walletState.address) {
      persistWalletAddress(walletState.address)
    } else if (!walletState.isLoading) {
      clearPersistedWallet()
    }
  }, [walletState.address, walletState.isLoading])

  return (
    <AuthStoreContext.Provider value={{ state: authState, dispatch: authDispatch }}>
      <WalletStoreContext.Provider value={{ state: walletState, dispatch: walletDispatch }}>
        <UiStoreContext.Provider value={{ state: uiState, dispatch: uiDispatch }}>
          {children}
        </UiStoreContext.Provider>
      </WalletStoreContext.Provider>
    </AuthStoreContext.Provider>
  )
}

/* ────────────────────────────────────────────────────────────────
   Hooks
   ──────────────────────────────────────────────────────────────── */

export function useAuthStore(): AuthSlice {
  const ctx = useContext(AuthStoreContext)
  if (!ctx) throw new Error('UseAuthStore must be used within StoreProvider.')
  return ctx
}

export function useWalletStore(): WalletSlice {
  const ctx = useContext(WalletStoreContext)
  if (!ctx) throw new Error('UseWalletStore must be used within StoreProvider.')
  return ctx
}

export function useUiStore(): UiSlice {
  const ctx = useContext(UiStoreContext)
  if (!ctx) throw new Error('UseUiStore must be used within StoreProvider.')
  return ctx
}

/* ────────────────────────────────────────────────────────────────
   Re-export slice types for consumers
   ──────────────────────────────────────────────────────────────── */

export type { AuthState, AuthAction, AuthUser } from './auth'
export type { WalletState, WalletAction } from './wallet'
export type { UiState, UiAction, ModalId } from './ui'

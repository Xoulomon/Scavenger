import { describe, it, expect } from 'vitest'
import {
  authReducer,
  authInitialState,
  loadPersistedAuth,
  persistAuth,
  clearPersistedAuth,
  type AuthState,
} from './auth'
import {
  walletReducer,
  walletInitialState,
  type WalletState,
} from './wallet'
import {
  uiReducer,
  uiInitialState,
  type UiState,
} from './ui'

/* ────────────────────────────────────────────────────────────────
   Auth slice
   ──────────────────────────────────────────────────────────────── */

describe('authReducer', () => {
  it('starts with isLoading=true and no user', () => {
    expect(authInitialState.isLoading).toBe(true)
    expect(authInitialState.user).toBeNull()
    expect(authInitialState.isAuthenticated).toBe(false)
  })

  it('AUTH_LOGIN sets user and isAuthenticated', () => {
    const user = { address: 'GABC', role: 'Recycler', name: 'Alice' }
    const state = authReducer(authInitialState, { type: 'AUTH_LOGIN', payload: user })
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('AUTH_LOGOUT clears user and isAuthenticated', () => {
    const loggedIn: AuthState = {
      user: { address: 'GABC' },
      isAuthenticated: true,
      isLoading: false,
    }
    const state = authReducer(loggedIn, { type: 'AUTH_LOGOUT' })
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('AUTH_LOADING sets isLoading=true', () => {
    const base: AuthState = { user: null, isAuthenticated: false, isLoading: false }
    const state = authReducer(base, { type: 'AUTH_LOADING' })
    expect(state.isLoading).toBe(true)
  })

  it('unknown action returns state unchanged', () => {
    // @ts-expect-error intentionally passing unknown action
    const state = authReducer(authInitialState, { type: 'UNKNOWN' })
    expect(state).toBe(authInitialState)
  })
})

describe('auth persistence helpers', () => {
  it('round-trips user through localStorage', () => {
    const user = { address: 'GABC', name: 'Alice' }
    persistAuth(user)
    expect(loadPersistedAuth()).toEqual(user)
    clearPersistedAuth()
    expect(loadPersistedAuth()).toBeNull()
  })
})

/* ────────────────────────────────────────────────────────────────
   Wallet slice
   ──────────────────────────────────────────────────────────────── */

describe('walletReducer', () => {
  it('starts with isLoading=true', () => {
    expect(walletInitialState.isLoading).toBe(true)
  })

  it('WALLET_CONNECTED sets address and isConnected', () => {
    const state = walletReducer(walletInitialState, {
      type: 'WALLET_CONNECTED',
      payload: 'GDEF1234',
    })
    expect(state.address).toBe('GDEF1234')
    expect(state.isConnected).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('WALLET_DISCONNECTED clears address and isConnected', () => {
    const connected: WalletState = {
      address: 'GDEF1234',
      isConnected: true,
      isInstalled: true,
      isLoading: false,
      error: null,
    }
    const state = walletReducer(connected, { type: 'WALLET_DISCONNECTED' })
    expect(state.address).toBeNull()
    expect(state.isConnected).toBe(false)
  })

  it('WALLET_ERROR stores error message and stops loading', () => {
    const state = walletReducer(walletInitialState, {
      type: 'WALLET_ERROR',
      payload: 'Connection rejected.',
    })
    expect(state.error).toBe('Connection rejected.')
    expect(state.isLoading).toBe(false)
  })

  it('WALLET_INSTALLED sets isInstalled flag', () => {
    const state = walletReducer(walletInitialState, {
      type: 'WALLET_INSTALLED',
      payload: true,
    })
    expect(state.isInstalled).toBe(true)
  })

  it('WALLET_LOADING sets isLoading and clears error', () => {
    const withError: WalletState = { ...walletInitialState, error: 'old error', isLoading: false }
    const state = walletReducer(withError, { type: 'WALLET_LOADING' })
    expect(state.isLoading).toBe(true)
    expect(state.error).toBeNull()
  })

  it('WALLET_READY stops loading without changing address', () => {
    const state = walletReducer(walletInitialState, { type: 'WALLET_READY' })
    expect(state.isLoading).toBe(false)
  })

  it('unknown action returns state unchanged', () => {
    // @ts-expect-error intentionally passing unknown action
    const state = walletReducer(walletInitialState, { type: 'UNKNOWN' })
    expect(state).toBe(walletInitialState)
  })
})

/* ────────────────────────────────────────────────────────────────
   UI slice
   ──────────────────────────────────────────────────────────────── */

describe('uiReducer', () => {
  it('starts with sidebarOpen=false, no modal, no globalLoading', () => {
    expect(uiInitialState.sidebarOpen).toBe(false)
    expect(uiInitialState.activeModal).toBeNull()
    expect(uiInitialState.globalLoading).toBe(false)
    expect(uiInitialState.loadingKeys.size).toBe(0)
  })

  it('UI_SIDEBAR_OPEN opens the sidebar', () => {
    const state = uiReducer(uiInitialState, { type: 'UI_SIDEBAR_OPEN' })
    expect(state.sidebarOpen).toBe(true)
  })

  it('UI_SIDEBAR_CLOSE closes the sidebar', () => {
    const open: UiState = { ...uiInitialState, sidebarOpen: true }
    const state = uiReducer(open, { type: 'UI_SIDEBAR_CLOSE' })
    expect(state.sidebarOpen).toBe(false)
  })

  it('UI_SIDEBAR_TOGGLE toggles the sidebar', () => {
    const state1 = uiReducer(uiInitialState, { type: 'UI_SIDEBAR_TOGGLE' })
    expect(state1.sidebarOpen).toBe(true)
    const state2 = uiReducer(state1, { type: 'UI_SIDEBAR_TOGGLE' })
    expect(state2.sidebarOpen).toBe(false)
  })

  it('UI_MODAL_OPEN sets activeModal', () => {
    const state = uiReducer(uiInitialState, { type: 'UI_MODAL_OPEN', payload: 'confirm-delete' })
    expect(state.activeModal).toBe('confirm-delete')
  })

  it('UI_MODAL_CLOSE clears activeModal', () => {
    const withModal: UiState = { ...uiInitialState, activeModal: 'confirm-delete' }
    const state = uiReducer(withModal, { type: 'UI_MODAL_CLOSE' })
    expect(state.activeModal).toBeNull()
  })

  it('UI_GLOBAL_LOADING sets globalLoading flag', () => {
    const on = uiReducer(uiInitialState, { type: 'UI_GLOBAL_LOADING', payload: true })
    expect(on.globalLoading).toBe(true)
    const off = uiReducer(on, { type: 'UI_GLOBAL_LOADING', payload: false })
    expect(off.globalLoading).toBe(false)
  })

  it('UI_LOADING_KEY_ADD adds a key to loadingKeys', () => {
    const state = uiReducer(uiInitialState, { type: 'UI_LOADING_KEY_ADD', payload: 'analytics' })
    expect(state.loadingKeys.has('analytics')).toBe(true)
  })

  it('UI_LOADING_KEY_REMOVE removes a key from loadingKeys', () => {
    const withKey: UiState = {
      ...uiInitialState,
      loadingKeys: new Set(['analytics']),
    }
    const state = uiReducer(withKey, { type: 'UI_LOADING_KEY_REMOVE', payload: 'analytics' })
    expect(state.loadingKeys.has('analytics')).toBe(false)
  })

  it('multiple loading keys are tracked independently', () => {
    const s1 = uiReducer(uiInitialState, { type: 'UI_LOADING_KEY_ADD', payload: 'a' })
    const s2 = uiReducer(s1, { type: 'UI_LOADING_KEY_ADD', payload: 'b' })
    expect(s2.loadingKeys.size).toBe(2)
    const s3 = uiReducer(s2, { type: 'UI_LOADING_KEY_REMOVE', payload: 'a' })
    expect(s3.loadingKeys.has('a')).toBe(false)
    expect(s3.loadingKeys.has('b')).toBe(true)
  })

  it('unknown action returns state unchanged', () => {
    // @ts-expect-error intentionally passing unknown action
    const state = uiReducer(uiInitialState, { type: 'UNKNOWN' })
    expect(state).toBe(uiInitialState)
  })
})

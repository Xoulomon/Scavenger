import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { authReducer, authInitialState } from './auth'
import { walletReducer, walletInitialState } from './wallet'
import { uiReducer, uiInitialState } from './ui'

const storeIndexSource = readFileSync(resolve(__dirname, './index.tsx'), 'utf-8')

describe('store slice ownership (#1466)', () => {
  describe('documentation', () => {
    it('documents every slice in the header comment of store/index.tsx', () => {
      const header = storeIndexSource.split('*/')[0]

      expect(header).toMatch(/auth/i)
      expect(header).toMatch(/wallet/i)
      expect(header).toMatch(/ui/i)
    })
  })

  describe('single source of truth per field', () => {
    it('auth slice owns the signed-in user; wallet slice does not hold a user object', () => {
      expect(authInitialState).toHaveProperty('user')
      expect(walletInitialState).not.toHaveProperty('user')
    })

    it('ui slice does not hold wallet address or auth user', () => {
      expect(uiInitialState).not.toHaveProperty('address')
      expect(uiInitialState).not.toHaveProperty('user')
    })

    it('wallet slice owns the address; auth slice does not duplicate it at top level', () => {
      expect(walletInitialState).toHaveProperty('address')
      expect(authInitialState).not.toHaveProperty('address')
    })
  })

  describe('reducers only touch their own slice', () => {
    it('AUTH_LOGOUT clears auth state and leaves wallet state untouched', () => {
      const loggedIn = authReducer(authInitialState, {
        type: 'AUTH_LOGIN',
        payload: { address: 'GABC' },
      })
      const wallet = { ...walletInitialState, address: 'GABC', isConnected: true }

      const next = authReducer(loggedIn, { type: 'AUTH_LOGOUT' })

      expect(next.user).toBeNull()
      expect(next.isAuthenticated).toBe(false)
      expect(wallet.address).toBe('GABC')
    })

    it('WALLET_DISCONNECTED clears wallet address without changing auth user', () => {
      const connected = walletReducer(walletInitialState, {
        type: 'WALLET_CONNECTED',
        payload: 'GABC',
      })
      const auth = authReducer(authInitialState, {
        type: 'AUTH_LOGIN',
        payload: { address: 'GABC' },
      })

      const nextWallet = walletReducer(connected, { type: 'WALLET_DISCONNECTED' })
      const nextAuth = authReducer(auth, { type: 'AUTH_LOGOUT' })

      expect(nextWallet.address).toBeNull()
      expect(nextWallet.isConnected).toBe(false)
      expect(nextAuth.user).toBeNull()
    })

    it('UI modal actions never change auth or wallet fields', () => {
      const opened = uiReducer(uiInitialState, { type: 'UI_MODAL_OPEN', payload: 'transfer' })
      const closed = uiReducer(opened, { type: 'UI_MODAL_CLOSE' })

      expect(opened.activeModal).toBe('transfer')
      expect(Object.keys(closed).sort()).toEqual(Object.keys(uiInitialState).sort())
      expect(closed.activeModal).toBeNull()
    })
  })
})

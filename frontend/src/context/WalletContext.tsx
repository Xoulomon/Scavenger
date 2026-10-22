/**
 * context/WalletContext.tsx
 *
 * WalletProvider performs the initial Freighter detection and writes the
 * result into the wallet store slice. useWallet lives in features/wallet and
 * is re-exported here so existing imports keep working.
 *
 * Freighter calls go through features/wallet/service.
 */
import React, { useEffect, type ReactNode } from 'react'
import { useWalletStore } from '@/store'
import {
  checkWalletInstalled,
  getWalletPublicKey,
  isWalletEnvironment,
  watchWalletAccount,
} from '@/features/wallet/service'

export { useWallet } from '@/features/wallet/useWallet'
export type { WalletContextType } from '@/features/wallet/useWallet'

/**
 * WalletProvider — detects the Freighter extension and restores an existing
 * connection into the wallet store slice.
 */
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { state, dispatch } = useWalletStore()
  const { address, isConnected } = state

  useEffect(() => {
    if (!isWalletEnvironment()) {
      dispatch({ type: 'WALLET_READY' })
      return
    }
    ;(async () => {
      try {
        const isInstalled = await checkWalletInstalled()
        dispatch({ type: 'WALLET_INSTALLED', payload: isInstalled })
        if (isInstalled) {
          const addr = await getWalletPublicKey()
          if (addr) dispatch({ type: 'WALLET_CONNECTED', payload: addr })
          else dispatch({ type: 'WALLET_READY' })
        } else {
          dispatch({ type: 'WALLET_READY' })
        }
      } catch {
        dispatch({ type: 'WALLET_INSTALLED', payload: false })
        dispatch({ type: 'WALLET_READY' })
      }
    })()
  }, [dispatch])

  // One account watcher for the whole app, started only while connected.
  // Follows account switches and lock/unlock.
  useEffect(() => {
    if (!isConnected) return
    return watchWalletAccount((next) => {
      if (!next) dispatch({ type: 'WALLET_DISCONNECTED' })
      else if (next !== address) dispatch({ type: 'WALLET_CONNECTED', payload: next })
    })
  }, [isConnected, address, dispatch])

  return <>{children}</>
}

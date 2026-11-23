import { useWalletStore } from '@/store'
import { connectWallet, getNetworkMismatchMessage, signTransactionXDR } from './service'

export interface WalletContextType {
  address: string | null
  isConnected: boolean
  isInstalled: boolean
  connect: () => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string, network?: string) => Promise<string>
  isLoading: boolean
  error: string | null
}

/**
 * Wallet state and actions for components. Reads the wallet store slice and
 * delegates every Freighter call to features/wallet/service.
 */
export function useWallet(): WalletContextType {
  const { state, dispatch } = useWalletStore()

  const connect = async () => {
    dispatch({ type: 'WALLET_LOADING' })
    if (!state.isInstalled) {
      dispatch({
        type: 'WALLET_ERROR',
        payload: 'Freighter extension is not installed. Please install it from freighter.app.'
      })
      return
    }
    try {
      const mismatch = await getNetworkMismatchMessage()
      if (mismatch) {
        dispatch({ type: 'WALLET_ERROR', payload: mismatch })
        return
      }
      const addr = await connectWallet()
      dispatch({ type: 'WALLET_CONNECTED', payload: addr })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'WALLET_ERROR', payload: msg })
    }
  }

  const disconnect = () => {
    dispatch({ type: 'WALLET_DISCONNECTED' })
  }

  const signTransaction = async (xdr: string, network?: string): Promise<string> => {
    if (!state.isConnected || !state.address) {
      const msg = 'Wallet is not connected. Please connect your wallet before signing.'
      dispatch({ type: 'WALLET_ERROR', payload: msg })
      throw new Error(msg)
    }
    try {
      return await signTransactionXDR(xdr, network)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'WALLET_ERROR', payload: msg })
      throw err instanceof Error ? err : new Error(msg)
    }
  }

  return {
    address: state.address,
    isConnected: state.isConnected,
    isInstalled: state.isInstalled,
    isLoading: state.isLoading,
    error: state.error,
    connect,
    disconnect,
    signTransaction
  }
}

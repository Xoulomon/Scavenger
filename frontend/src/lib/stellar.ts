import { Networks } from '@stellar/stellar-sdk'
import { config } from '../config'

export interface NetworkConfig {
  networkPassphrase: string
  rpcUrl: string
  horizonUrl: string
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  TESTNET: {
    networkPassphrase: Networks.TESTNET,
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org'
  },
  MAINNET: {
    networkPassphrase: Networks.PUBLIC,
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    horizonUrl: 'https://horizon.stellar.org'
  },
  FUTURENET: {
    networkPassphrase: Networks.FUTURENET,
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    horizonUrl: 'https://horizon-futurenet.stellar.org'
  },
  STANDALONE: {
    networkPassphrase: Networks.STANDALONE,
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    horizonUrl: 'http://localhost:8000'
  }
}

// Active network config — rpcUrl is overridden by VITE_RPC_URL if set
export const networkConfig: NetworkConfig = {
  ...NETWORK_CONFIGS[config.network],
  rpcUrl: config.rpcUrl
}

export function getNetworkPassphrase(network: string): string {
  return NETWORK_CONFIGS[network]?.networkPassphrase ?? Networks.TESTNET
}

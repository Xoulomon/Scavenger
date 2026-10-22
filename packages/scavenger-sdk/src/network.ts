import { Network, NetworkConfig } from './types'
import { NetworkError } from './errors'

/** Preset configurations for official Stellar networks. */
const NETWORK_PRESETS: Record<Network, NetworkConfig> = {
  [Network.Standalone]: {
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    networkPassphrase: 'Standalone Network ; June 2022',
    network: Network.Standalone,
  },
  [Network.Testnet]: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2025',
    network: Network.Testnet,
  },
  [Network.Futurenet]: {
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    networkPassphrase: 'Futurenet Network ; January 2025',
    network: Network.Futurenet,
  },
  [Network.Mainnet]: {
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2025',
    network: Network.Mainnet,
  },
}

/**
 * Resolve a network preset or custom config to a normalized NetworkConfig.
 *
 * @param network - Network preset name or a custom config object.
 * @returns A complete NetworkConfig with rpcUrl and networkPassphrase.
 * @throws {NetworkError} If a preset name is not recognized.
 *
 * @example
 * ```ts
 * const config = resolveNetwork(Network.Testnet)
 * // => { rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2025' }
 *
 * const custom = resolveNetwork({ rpcUrl: '...', networkPassphrase: '...' })
 * ```
 */
export function resolveNetwork(network: Network | NetworkConfig): NetworkConfig {
  if (typeof network === 'object') {
    if (!network.rpcUrl) throw new NetworkError('rpcUrl is required in custom network config')
    if (!network.networkPassphrase) throw new NetworkError('networkPassphrase is required in custom network config')
    return network
  }

  const preset = NETWORK_PRESETS[network]
  if (!preset) {
    throw new NetworkError(
      `Unknown network preset: "${network}". Available: ${Object.values(Network).join(', ')}`
    )
  }
  return preset
}

/**
 * Validate a Stellar public key address format (G...).
 *
 * @param address - Stellar public key to validate.
 * @returns `true` if the address is a valid Stellar public key.
 *
 * @example
 * ```ts
 * isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')
 * // => true
 * ```
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address)
}

/**
 * Get all available network presets.
 *
 * @returns Array of available network names.
 */
export function getAvailableNetworks(): Network[] {
  return Object.values(Network)
}

/**
 * Get the human-readable label for a network.
 *
 * @param network - Network preset.
 * @returns Display-friendly network name.
 */
export function getNetworkLabel(network: Network): string {
  const labels: Record<Network, string> = {
    [Network.Standalone]: 'Standalone (Local)',
    [Network.Testnet]: 'Testnet',
    [Network.Futurenet]: 'Futurenet',
    [Network.Mainnet]: 'Mainnet',
  }
  return labels[network] ?? network
}

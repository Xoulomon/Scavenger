import { describe, it, expect } from 'vitest'
import {
  resolveNetwork,
  isValidStellarAddress,
  getAvailableNetworks,
  getNetworkLabel
} from '../src/network'
import { Network } from '../src/types'

describe('resolveNetwork', () => {
  it('resolves testnet preset', () => {
    const config = resolveNetwork(Network.Testnet)
    expect(config.rpcUrl).toContain('testnet')
    expect(config.networkPassphrase).toContain('Test SDF Network')
  })

  it('resolves mainnet preset', () => {
    const config = resolveNetwork(Network.Mainnet)
    expect(config.rpcUrl).toContain('mainnet')
  })

  it('resolves standalone preset', () => {
    const config = resolveNetwork(Network.Standalone)
    expect(config.rpcUrl).toContain('localhost')
  })

  it('resolves futurenet preset', () => {
    const config = resolveNetwork(Network.Futurenet)
    expect(config.rpcUrl).toContain('futurenet')
  })

  it('accepts custom config object', () => {
    const config = resolveNetwork({
      rpcUrl: 'http://custom:8000',
      networkPassphrase: 'Custom Passphrase'
    })
    expect(config.rpcUrl).toBe('http://custom:8000')
    expect(config.networkPassphrase).toBe('Custom Passphrase')
  })

  it('throws on missing rpcUrl in custom config', () => {
    expect(() =>
      resolveNetwork({
        rpcUrl: '',
        networkPassphrase: 'test'
      })
    ).toThrow()
  })
})

describe('isValidStellarAddress', () => {
  it('validates correct G address', () => {
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBe(
      true
    )
  })

  it('rejects invalid addresses', () => {
    expect(isValidStellarAddress('invalid')).toBe(false)
    expect(isValidStellarAddress('SAAAAAAA...')).toBe(false)
    expect(isValidStellarAddress('')).toBe(false)
  })
})

describe('getAvailableNetworks', () => {
  it('returns all network presets', () => {
    const networks = getAvailableNetworks()
    expect(networks).toContain(Network.Testnet)
    expect(networks).toContain(Network.Mainnet)
    expect(networks).toContain(Network.Standalone)
    expect(networks).toContain(Network.Futurenet)
  })
})

describe('getNetworkLabel', () => {
  it('returns human-readable labels', () => {
    expect(getNetworkLabel(Network.Testnet)).toBe('Testnet')
    expect(getNetworkLabel(Network.Mainnet)).toBe('Mainnet')
    expect(getNetworkLabel(Network.Standalone)).toBe('Standalone (Local)')
  })
})

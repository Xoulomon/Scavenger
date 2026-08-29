import { describe, it, expect } from 'vitest'
import {
  ParticipantRole,
  WasteType,
  WasteStatus,
  CertificationLevel,
  StellarNetwork,
  WASTE_TYPE_MAP,
  ROLE_MAP,
  CERTIFICATION_MAP,
} from '../src/types'

describe('Enums', () => {
  describe('ParticipantRole', () => {
    it('has correct numeric values', () => {
      expect(ParticipantRole.Recycler).toBe(0)
      expect(ParticipantRole.Collector).toBe(1)
      expect(ParticipantRole.Manufacturer).toBe(2)
    })

    it('has exactly 3 members', () => {
      expect(Object.keys(ParticipantRole)).toHaveLength(6)
    })
  })

  describe('WasteType', () => {
    it('has correct numeric values', () => {
      expect(WasteType.Paper).toBe(0)
      expect(WasteType.PetPlastic).toBe(1)
      expect(WasteType.Plastic).toBe(2)
      expect(WasteType.Metal).toBe(3)
      expect(WasteType.Glass).toBe(4)
      expect(WasteType.Organic).toBe(5)
      expect(WasteType.Electronic).toBe(6)
    })

    it('has exactly 7 members', () => {
      expect(Object.keys(WasteType)).toHaveLength(14)
    })
  })

  describe('WasteStatus', () => {
    it('has correct string values', () => {
      expect(WasteStatus.Submitted).toBe('submitted')
      expect(WasteStatus.Verified).toBe('verified')
      expect(WasteStatus.Transferred).toBe('transferred')
      expect(WasteStatus.Deactivated).toBe('deactivated')
    })
  })

  describe('CertificationLevel', () => {
    it('has correct numeric values', () => {
      expect(CertificationLevel.Beginner).toBe(0)
      expect(CertificationLevel.Intermediate).toBe(1)
      expect(CertificationLevel.Advanced).toBe(2)
      expect(CertificationLevel.Expert).toBe(3)
    })
  })

  describe('StellarNetwork', () => {
    it('has correct string values', () => {
      expect(StellarNetwork.Standalone).toBe('STANDALONE')
      expect(StellarNetwork.Testnet).toBe('TESTNET')
      expect(StellarNetwork.Futurenet).toBe('FUTURENET')
      expect(StellarNetwork.Mainnet).toBe('MAINNET')
    })
  })
})

describe('Mapping constants', () => {
  describe('WASTE_TYPE_MAP', () => {
    it('maps all waste type indices to names', () => {
      expect(WASTE_TYPE_MAP[0]).toBe('Paper')
      expect(WASTE_TYPE_MAP[1]).toBe('PetPlastic')
      expect(WASTE_TYPE_MAP[2]).toBe('Plastic')
      expect(WASTE_TYPE_MAP[3]).toBe('Metal')
      expect(WASTE_TYPE_MAP[4]).toBe('Glass')
      expect(WASTE_TYPE_MAP[5]).toBe('Organic')
      expect(WASTE_TYPE_MAP[6]).toBe('Electronic')
    })

    it('has exactly 7 entries', () => {
      expect(Object.keys(WASTE_TYPE_MAP)).toHaveLength(7)
    })
  })

  describe('ROLE_MAP', () => {
    it('maps all role indices to names', () => {
      expect(ROLE_MAP[0]).toBe('Recycler')
      expect(ROLE_MAP[1]).toBe('Collector')
      expect(ROLE_MAP[2]).toBe('Manufacturer')
    })

    it('has exactly 3 entries', () => {
      expect(Object.keys(ROLE_MAP)).toHaveLength(3)
    })
  })

  describe('CERTIFICATION_MAP', () => {
    it('maps all certification indices to names', () => {
      expect(CERTIFICATION_MAP[0]).toBe('Beginner')
      expect(CERTIFICATION_MAP[1]).toBe('Intermediate')
      expect(CERTIFICATION_MAP[2]).toBe('Advanced')
      expect(CERTIFICATION_MAP[3]).toBe('Expert')
    })

    it('has exactly 4 entries', () => {
      expect(Object.keys(CERTIFICATION_MAP)).toHaveLength(4)
    })
  })
})

describe('SDK-specific types', () => {
  it('exports SimulationResult shape', () => {
    const result: import('../src/types').SimulationResult = {
      success: true,
      cost: { cpuInstructions: 100, memoryBytes: 200 },
    }
    expect(result.success).toBe(true)
    expect(result.cost.cpuInstructions).toBe(100)
  })

  it('exports TransactionResult shape', () => {
    const result: import('../src/types').TransactionResult = {
      success: true,
      transactionHash: 'abc',
    }
    expect(result.success).toBe(true)
  })

  it('exports SdkClientOptions shape', () => {
    const opts: import('../src/types').SdkClientOptions = {
      contractId: 'C...',
      network: StellarNetwork.Testnet,
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2025',
      enableRetry: true,
      maxRetries: 3,
      enableLogging: false,
      userAgent: 'test',
    }
    expect(opts.enableRetry).toBe(true)
    expect(opts.maxRetries).toBe(3)
  })
})

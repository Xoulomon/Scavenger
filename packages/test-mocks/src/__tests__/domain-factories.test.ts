import { describe, it, expect, beforeEach } from 'vitest'
import {
  createParticipant,
  createRecycler,
  createCollector,
  createWaste,
  createConfirmedWaste,
  createWasteTransfer,
  createTransferChain,
  createIncentive,
  createTokenReward,
  generateSeedData,
  resetFactoryCounters,
  ParticipantRole,
  WasteType,
  TEST_ADDRESSES
} from '../domain-factories'

describe('Domain Factories', () => {
  beforeEach(() => {
    resetFactoryCounters()
  })

  describe('Participant Factories', () => {
    it('creates a participant with defaults', () => {
      const participant = createParticipant()

      expect(participant.address).toBeTruthy()
      expect(participant.name).toBeTruthy()
      expect(participant.role).toBe(ParticipantRole.Recycler)
      expect(participant.is_active).toBe(true)
    })

    it('creates a participant with custom options', () => {
      const participant = createParticipant({
        name: 'Custom Name',
        role: ParticipantRole.Collector
      })

      expect(participant.name).toBe('Custom Name')
      expect(participant.role).toBe(ParticipantRole.Collector)
    })

    it('creates a recycler', () => {
      const recycler = createRecycler()
      expect(recycler.role).toBe(ParticipantRole.Recycler)
    })

    it('creates a collector', () => {
      const collector = createCollector()
      expect(collector.role).toBe(ParticipantRole.Collector)
    })

    it('creates unique addresses when requested', () => {
      const p1 = createParticipant({ uniqueAddress: true })
      const p2 = createParticipant({ uniqueAddress: true })

      expect(p1.address).not.toBe(p2.address)
    })
  })

  describe('Waste Factories', () => {
    it('creates a waste record with defaults', () => {
      const waste = createWaste()

      expect(waste.waste_id).toBeGreaterThan(0)
      expect(waste.waste_type).toBe(WasteType.Plastic)
      expect(waste.weight).toBeGreaterThan(0)
      expect(waste.is_active).toBe(true)
      expect(waste.is_confirmed).toBe(false)
    })

    it('creates a confirmed waste record', () => {
      const waste = createConfirmedWaste()

      expect(waste.is_confirmed).toBe(true)
      expect(waste.confirmer).toBeTruthy()
    })

    it('creates waste with custom options', () => {
      const waste = createWaste({
        weight: 5000,
        waste_type: WasteType.Metal
      })

      expect(waste.weight).toBe(5000)
      expect(waste.waste_type).toBe(WasteType.Metal)
    })

    it('creates sequential waste IDs', () => {
      const w1 = createWaste()
      const w2 = createWaste()

      expect(w2.waste_id).toBe(w1.waste_id + 1)
    })
  })

  describe('Waste Transfer Factories', () => {
    it('creates a transfer with defaults', () => {
      const transfer = createWasteTransfer()

      expect(transfer.transfer_id).toBeGreaterThan(0)
      expect(transfer.waste_id).toBeTruthy()
      expect(transfer.from_address).toBeTruthy()
      expect(transfer.to_address).toBeTruthy()
      expect(transfer.transfer_type).toBeTruthy()
    })

    it('creates a transfer chain', () => {
      const addresses = [
        TEST_ADDRESSES.RECYCLER_1,
        TEST_ADDRESSES.COLLECTOR,
        TEST_ADDRESSES.PROCESSOR
      ]

      const chain = createTransferChain(1, addresses)

      expect(chain).toHaveLength(2)
      expect(chain[0].from_address).toBe(TEST_ADDRESSES.RECYCLER_1)
      expect(chain[0].to_address).toBe(TEST_ADDRESSES.COLLECTOR)
      expect(chain[1].from_address).toBe(TEST_ADDRESSES.COLLECTOR)
      expect(chain[1].to_address).toBe(TEST_ADDRESSES.PROCESSOR)
    })
  })

  describe('Incentive Factories', () => {
    it('creates an incentive with defaults', () => {
      const incentive = createIncentive()

      expect(incentive.incentive_id).toBeGreaterThan(0)
      expect(incentive.rewarder).toBeTruthy()
      expect(incentive.is_active).toBe(true)
      expect(incentive.initial_reward).toBeGreaterThan(0)
    })

    it('creates an incentive with custom waste type', () => {
      const incentive = createIncentive({ waste_type: WasteType.Glass })

      expect(incentive.waste_type).toBe(WasteType.Glass)
    })
  })

  describe('Token Reward Factories', () => {
    it('creates a reward with defaults', () => {
      const reward = createTokenReward()

      expect(reward.recipient).toBeTruthy()
      expect(reward.amount).toBeGreaterThan(0)
      expect(reward.waste_id).toBeGreaterThan(0)
      expect(reward.awarded_at).toBeGreaterThan(0)
    })
  })

  describe('Seed Data Generator', () => {
    it('generates complete seed data', () => {
      const seed = generateSeedData()

      expect(seed.participants).toHaveLength(5)
      expect(seed.recyclers).toHaveLength(2)
      expect(seed.wastes).toHaveLength(3)
      expect(seed.transfers).toHaveLength(2)
      expect(seed.incentives).toHaveLength(2)
      expect(seed.rewards).toHaveLength(2)
    })

    it('seed data has valid relationships', () => {
      const seed = generateSeedData()

      const recyclerAddresses = seed.recyclers.map((r) => r.address)
      const wasteOwners = seed.wastes.map((w) => w.current_owner)

      expect(wasteOwners.some((owner) => recyclerAddresses.includes(owner))).toBe(true)
    })
  })

  describe('Factory Counter Reset', () => {
    it('resets counters', () => {
      createWaste()
      createWaste()

      resetFactoryCounters()

      const waste = createWaste()
      expect(waste.waste_id).toBe(1)
    })
  })
})

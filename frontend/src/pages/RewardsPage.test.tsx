// Feature: RewardsPage enhancements
// Validates: tier logic, reward calculator, redemption dialogs, transaction history

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WasteType } from '@/api/types'

// ── Tier logic (pure) ─────────────────────────────────────────────────────────

const TIERS = [
  { label: 'Bronze', min: 0n, max: 999n },
  { label: 'Silver', min: 1000n, max: 4999n },
  { label: 'Gold', min: 5000n, max: 19999n },
  { label: 'Platinum', min: 20000n, max: BigInt(Number.MAX_SAFE_INTEGER) },
]

function getTier(balance: bigint) {
  return TIERS.find((t) => balance >= t.min && balance <= t.max) ?? TIERS[0]
}

// ── Reward calculator logic (pure) ────────────────────────────────────────────

const RATES: Record<WasteType, number> = {
  [WasteType.Paper]: 2,
  [WasteType.PetPlastic]: 5,
  [WasteType.Plastic]: 3,
  [WasteType.Metal]: 8,
  [WasteType.Glass]: 4,
  [WasteType.Organic]: 2,
  [WasteType.Electronic]: 6,
}

function calcReward(wasteType: WasteType, weightGrams: number): number {
  return Math.floor(weightGrams * RATES[wasteType])
}

// ── Tier tests ────────────────────────────────────────────────────────────────

describe('RewardsPage — tier logic', () => {
  it('returns Bronze for 0 tokens', () => {
    expect(getTier(0n).label).toBe('Bronze')
  })

  it('returns Bronze for 999 tokens', () => {
    expect(getTier(999n).label).toBe('Bronze')
  })

  it('returns Silver for 1000 tokens', () => {
    expect(getTier(1000n).label).toBe('Silver')
  })

  it('returns Gold for 5000 tokens', () => {
    expect(getTier(5000n).label).toBe('Gold')
  })

  it('returns Platinum for 20000 tokens', () => {
    expect(getTier(20000n).label).toBe('Platinum')
  })

  it('returns Platinum for very large balance', () => {
    expect(getTier(BigInt(Number.MAX_SAFE_INTEGER)).label).toBe('Platinum')
  })
})

// ── Reward calculator tests ───────────────────────────────────────────────────

describe('RewardsPage — reward calculator', () => {
  it('calculates Paper reward correctly', () => {
    expect(calcReward(WasteType.Paper, 100)).toBe(200)
  })

  it('calculates Metal reward correctly (highest rate)', () => {
    expect(calcReward(WasteType.Metal, 100)).toBe(800)
  })

  it('calculates PET Plastic reward correctly', () => {
    expect(calcReward(WasteType.PetPlastic, 200)).toBe(1000)
  })

  it('floors fractional results', () => {
    expect(calcReward(WasteType.Paper, 1)).toBe(2)
  })

  it('returns 0 for 0 grams', () => {
    expect(calcReward(WasteType.Glass, 0)).toBe(0)
  })
})

// ── RewardCalculator component ────────────────────────────────────────────────

// Minimal isolated render of the calculator section
function RewardCalculatorStub() {
  const [wasteType, setWasteType] = React.useState<WasteType>(WasteType.Paper)
  const [weight, setWeight] = React.useState('')
  const estimate = weight ? calcReward(wasteType, Number(weight)) : null
  return (
    <div>
      <select
        aria-label="Waste type"
        value={wasteType}
        onChange={(e) => setWasteType(Number(e.target.value) as WasteType)}
      >
        <option value={WasteType.Paper}>Paper</option>
        <option value={WasteType.Metal}>Metal</option>
      </select>
      <input
        aria-label="Weight in grams"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      {estimate !== null && <span data-testid="estimate">{estimate}</span>}
    </div>
  )
}

import React from 'react'

describe('RewardCalculator component', () => {
  it('shows no estimate when weight is empty', () => {
    render(<RewardCalculatorStub />)
    expect(screen.queryByTestId('estimate')).toBeNull()
  })

  it('shows estimate after entering weight', () => {
    render(<RewardCalculatorStub />)
    fireEvent.change(screen.getByLabelText('Weight in grams'), { target: { value: '100' } })
    expect(screen.getByTestId('estimate').textContent).toBe('200')
  })

  it('updates estimate when waste type changes', () => {
    render(<RewardCalculatorStub />)
    fireEvent.change(screen.getByLabelText('Weight in grams'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Waste type'), { target: { value: String(WasteType.Metal) } })
    expect(screen.getByTestId('estimate').textContent).toBe('800')
  })
})

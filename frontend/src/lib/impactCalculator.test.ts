import { describe, it, expect } from 'vitest'
import { WasteType } from '@/api/types'
import { calculateImpact, calculateEquivalents, buildShareText } from '@/lib/impactCalculator'

describe('calculateImpact', () => {
  it('returns zeros for empty input', () => {
    const result = calculateImpact([])
    expect(result.co2Kg).toBe(0)
    expect(result.energyKwh).toBe(0)
    expect(result.waterLitres).toBe(0)
    expect(result.treesEquivalent).toBe(0)
  })

  it('calculates CO2 correctly for 1 kg of paper (0.9 kg CO2/kg)', () => {
    const result = calculateImpact([{ waste_type: WasteType.Paper, weight: 1000 }])
    expect(result.co2Kg).toBe(0.9)
  })

  it('calculates CO2 correctly for 1 kg of metal (4.0 kg CO2/kg)', () => {
    const result = calculateImpact([{ waste_type: WasteType.Metal, weight: 1000 }])
    expect(result.co2Kg).toBe(4.0)
  })

  it('calculates energy correctly for 1 kg of PET plastic (5.8 kWh/kg)', () => {
    const result = calculateImpact([{ waste_type: WasteType.PetPlastic, weight: 1000 }])
    expect(result.energyKwh).toBe(5.8)
  })

  it('calculates water correctly for 1 kg of glass (1.5 L/kg)', () => {
    const result = calculateImpact([{ waste_type: WasteType.Glass, weight: 1000 }])
    expect(result.waterLitres).toBe(1.5)
  })

  it('accumulates values across multiple waste items', () => {
    const result = calculateImpact([
      { waste_type: WasteType.Paper, weight: 1000 }, // 0.9 kg CO2
      { waste_type: WasteType.Metal, weight: 1000 } // 4.0 kg CO2
    ])
    expect(result.co2Kg).toBe(4.9)
  })

  it('accepts bigint weights', () => {
    const result = calculateImpact([{ waste_type: WasteType.Plastic, weight: 2000n }])
    expect(result.co2Kg).toBe(2.4) // 2 kg * 1.2
  })

  it('treesEquivalent = co2Kg / 21', () => {
    const result = calculateImpact([{ waste_type: WasteType.Metal, weight: 21000 }]) // 21 kg * 4 = 84 kg CO2
    expect(result.treesEquivalent).toBe(4) // 84 / 21 = 4
  })
})

describe('calculateEquivalents', () => {
  it('calculates car km from CO2 (0.21 kg/km)', () => {
    const eq = calculateEquivalents({ co2Kg: 21, energyKwh: 0, waterLitres: 0, treesEquivalent: 0 })
    expect(eq.carKm).toBe(100)
  })

  it('calculates smartphone charges from energy (0.005 kWh each)', () => {
    const eq = calculateEquivalents({ co2Kg: 0, energyKwh: 1, waterLitres: 0, treesEquivalent: 0 })
    expect(eq.smartphoneCharges).toBe(200)
  })

  it('calculates shower minutes from water (8 L/min)', () => {
    const eq = calculateEquivalents({ co2Kg: 0, energyKwh: 0, waterLitres: 80, treesEquivalent: 0 })
    expect(eq.showerMinutes).toBe(10)
  })

  it('calculates lightbulb hours from energy (0.01 kWh/h)', () => {
    const eq = calculateEquivalents({ co2Kg: 0, energyKwh: 1, waterLitres: 0, treesEquivalent: 0 })
    expect(eq.lightbulbHours).toBe(100)
  })
})

describe('buildShareText', () => {
  it('includes CO2, car km, trees, and water in the share text', () => {
    const impact = { co2Kg: 10, energyKwh: 50, waterLitres: 200, treesEquivalent: 0.48 }
    const eq = calculateEquivalents(impact)
    const text = buildShareText(impact, eq)
    expect(text).toContain('10 kg')
    expect(text).toContain('km not driven')
    expect(text).toContain('trees')
    expect(text).toContain('200 litres')
    expect(text).toContain('#Scavngr')
  })
})

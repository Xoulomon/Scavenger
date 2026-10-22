import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WasteComparison, buildRows, cellClass, numericValues } from './WasteComparison'
import { Waste } from '@/api/types'

const mockWastes: Waste[] = [
  {
    waste_id: 1n,
    waste_type: 'Plastic',
    weight: 5000n,
    is_active: true,
    is_confirmed: true,
    recycled_timestamp: 1000000n,
    owner: 'addr1',
    current_holder: 'addr1',
    confirmer: null,
  },
  {
    waste_id: 2n,
    waste_type: 'Metal',
    weight: 10000n,
    is_active: true,
    is_confirmed: false,
    recycled_timestamp: 2000000n,
    owner: 'addr2',
    current_holder: 'addr2',
    confirmer: null,
  },
]

describe('WasteComparison', () => {
  it('renders comparison table', () => {
    render(<WasteComparison wastes={mockWastes} />)
    expect(screen.getByText(/Comparing 2 waste items/)).toBeInTheDocument()
  })

  it('exports CSV', () => {
    const { getByRole } = render(<WasteComparison wastes={mockWastes} />)
    const exportBtn = getByRole('button', { name: /Export CSV/ })
    expect(exportBtn).toBeInTheDocument()
  })

  it('returns null for empty wastes', () => {
    const { container } = render(<WasteComparison wastes={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('buildRows', () => {
  it('builds comparison rows', () => {
    const rows = buildRows(mockWastes)
    expect(rows).toHaveLength(5)
    expect(rows[0].label).toBe('Waste Type')
    expect(rows[1].label).toBe('Weight (kg)')
  })
})

describe('cellClass', () => {
  it('highlights max value', () => {
    const values = [5, 10, 3]
    const cls = cellClass(10, values, true)
    expect(cls).toContain('green')
  })

  it('highlights min value', () => {
    const values = [5, 10, 3]
    const cls = cellClass(3, values, true)
    expect(cls).toContain('red')
  })
})

describe('numericValues', () => {
  it('converts values to numbers', () => {
    const result = numericValues([5, '10', 3])
    expect(result).toEqual([5, 10, 3])
  })
})

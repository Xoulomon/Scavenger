import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { WasteListPage } from '@/pages/WasteListPage'
import { WasteType } from '@/api/types'
import type { Material } from '@/api/types'

const hookState = {
  wastes: [] as Material[],
  isLoading: false,
  error: null as string | null,
  isAdmin: false,
  confirmWaste: vi.fn(),
  transferWaste: vi.fn(),
  batchConfirmWastes: vi.fn(),
  batchVerifyWastes: vi.fn(),
  batchTransferWastes: vi.fn(),
  batchDeactivateWastes: vi.fn(),
}

vi.mock('@/hooks/useWasteList', () => ({
  useWasteList: () => hookState,
}))

function makeWaste(id: number, waste_type: WasteType, is_confirmed = false): Material {
  return {
    id,
    waste_type,
    weight: 2,
    recycled_timestamp: 1_700_000_000,
    is_active: true,
    is_confirmed,
    owner: 'GOWNER',
  } as unknown as Material
}

describe('WasteListPage — rendered list', () => {
  beforeEach(() => {
    hookState.wastes = [
      makeWaste(1, WasteType.Plastic),
      makeWaste(2, WasteType.Metal, true),
      makeWaste(3, WasteType.Paper),
    ]
    hookState.isLoading = false
    hookState.error = null
  })

  it('renders one row per waste returned by the hook', () => {
    render(<WasteListPage />)
    const rows = screen.getAllByRole('row')
    // header row + one row per waste
    expect(rows.length).toBe(hookState.wastes.length + 1)
  })

  it('shows the empty state when there are no wastes', () => {
    hookState.wastes = []
    render(<WasteListPage />)
    expect(screen.getByText('No wastes yet')).toBeTruthy()
  })

  it('narrows the rendered rows when a search term is typed', () => {
    render(<WasteListPage />)
    const search = screen.getByPlaceholderText(/search/i)
    fireEvent.change(search, { target: { value: '99999' } })
    expect(screen.getByText('No wastes match your filters')).toBeTruthy()
  })

  it('selecting a row checkbox toggles that row selection', () => {
    render(<WasteListPage />)
    const firstRow = screen.getAllByRole('row')[1]
    const checkbox = within(firstRow).getByRole('checkbox')
    const before = checkbox.getAttribute('data-state') ?? checkbox.getAttribute('aria-checked')
    fireEvent.click(checkbox)
    const after = checkbox.getAttribute('data-state') ?? checkbox.getAttribute('aria-checked')
    expect(after).not.toBe(before)
  })
})

import { fireEvent,render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Material } from '@/api/types'
import { WasteType } from '@/api/types'

import { BulkVerificationPanel } from './BulkVerificationPanel'
import { FilterBar } from './FilterBar'
import { GradeSelector } from './GradeSelector'
import { ResultsList } from './ResultsList'
import { VerificationForm } from './VerificationForm'
import { WasteListItem } from './WasteListItem'

const material = (overrides: Partial<Material> = {}): Material =>
  ({
    id: 7,
    submitter: 'GSUBMITTER',
    current_owner: 'GOWNER',
    waste_type: WasteType.Paper,
    weight: 1500,
    submitted_at: 1_700_000_000,
    verified: false,
    is_active: true,
    is_confirmed: false,
    confirmer: undefined,
    ...overrides,
  }) as Material

describe('GradeSelector', () => {
  it('marks the current grade as pressed and reports the chosen grade', () => {
    const onChange = vi.fn()
    render(<GradeSelector value="B" onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Grade B' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Grade A' }))
    expect(onChange).toHaveBeenCalledWith('A')
  })
})

describe('FilterBar', () => {
  it('hides the filter selects until expanded', () => {
    const { rerender } = render(
      <FilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusChange={vi.fn()}
        wasteTypeFilter="all"
        onWasteTypeChange={vi.fn()}
        dateFrom=""
        dateTo=""
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        showFilters={false}
        onToggleFilters={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Filter by status')).not.toBeInTheDocument()

    rerender(
      <FilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusChange={vi.fn()}
        wasteTypeFilter="all"
        onWasteTypeChange={vi.fn()}
        dateFrom=""
        dateTo=""
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        showFilters
        onToggleFilters={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
  })

  it('forwards search input and filter toggle events', () => {
    const onSearchChange = vi.fn()
    const onToggleFilters = vi.fn()
    render(
      <FilterBar
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusChange={vi.fn()}
        wasteTypeFilter="all"
        onWasteTypeChange={vi.fn()}
        dateFrom=""
        dateTo=""
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        showFilters={false}
        onToggleFilters={onToggleFilters}
      />
    )
    fireEvent.change(screen.getByLabelText('Search waste items'), { target: { value: '42' } })
    expect(onSearchChange).toHaveBeenCalledWith('42')
    fireEvent.click(screen.getByLabelText('Toggle filters'))
    expect(onToggleFilters).toHaveBeenCalledTimes(1)
  })
})

describe('WasteListItem', () => {
  it('selects on click and checks without selecting', () => {
    const onSelect = vi.fn()
    const onCheck = vi.fn()
    render(
      <WasteListItem
        material={material()}
        isSelected={false}
        isChecked={false}
        onSelect={onSelect}
        onCheck={onCheck}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Material 7, .*pending/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Select material 7 for bulk action'))
    expect(onCheck).toHaveBeenCalledWith(true)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('ResultsList', () => {
  const baseProps = {
    selectedId: null,
    checkedIds: new Set<number>(),
    onSelect: vi.fn(),
    onCheck: vi.fn(),
    onSelectAll: vi.fn(),
    sortField: 'date' as const,
    sortDir: 'desc' as const,
    onSort: vi.fn(),
    onClearFilters: vi.fn(),
  }

  it('shows the empty state with a clear action only when filters are active', () => {
    const { rerender } = render(
      <ResultsList {...baseProps} materials={[]} isLoading={false} hasActiveFilters={false} />
    )
    expect(screen.getByText('No materials match your filters.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument()

    rerender(<ResultsList {...baseProps} materials={[]} isLoading={false} hasActiveFilters />)
    fireEvent.click(screen.getByLabelText('Clear all filters'))
    expect(baseProps.onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('renders items and forwards sort clicks', () => {
    const onSort = vi.fn()
    render(
      <ResultsList
        {...baseProps}
        onSort={onSort}
        materials={[material()]}
        isLoading={false}
        hasActiveFilters={false}
      />
    )
    expect(screen.getByText('1 item')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Sort by Weight'))
    expect(onSort).toHaveBeenCalledWith('weight')
  })
})

describe('BulkVerificationPanel', () => {
  it('renders nothing when no items are selected', () => {
    const { container } = render(
      <BulkVerificationPanel
        selectedIds={new Set()}
        materials={[material()]}
        onBulkAction={vi.fn()}
        onClearSelection={vi.fn()}
        isPending={false}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('counts selected and pending items and sends pending ids on bulk approve', () => {
    const onBulkAction = vi.fn()
    const materials = [material({ id: 1 }), material({ id: 2, verified: true })]
    render(
      <BulkVerificationPanel
        selectedIds={new Set([1, 2])}
        materials={materials}
        onBulkAction={onBulkAction}
        onClearSelection={vi.fn()}
        isPending={false}
      />
    )
    expect(screen.getByText('2 selected (1 pending)')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand bulk actions'))
    fireEvent.click(screen.getByLabelText('Bulk approve selected materials'))
    expect(onBulkAction).toHaveBeenCalledWith([1], 'approved', {
      grade: 'B',
      contaminated: false,
      notes: '',
    })
  })
})

describe('VerificationForm', () => {
  it('submits the default grade for approval', () => {
    const onComplete = vi.fn()
    render(<VerificationForm material={material()} onComplete={onComplete} isPending={false} />)

    fireEvent.click(screen.getByLabelText('Approve material'))
    expect(onComplete).toHaveBeenCalledWith(7, 'approved', {
      grade: 'B',
      contaminated: false,
      notes: '',
    })
  })

  it('disables decisions while a verification is pending', () => {
    render(<VerificationForm material={material()} onComplete={vi.fn()} isPending />)
    expect(screen.getByLabelText('Reject material')).toBeDisabled()
  })
})

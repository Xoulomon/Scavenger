import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WasteMapFilters } from './WasteMapFilters'
import { WasteType } from '@/api/types'
import type { MapFilters } from '@/hooks/useMapData'

describe('WasteMapFilters', () => {
  const defaultFilters: MapFilters = { showParticipants: true }

  it('renders all filter controls', () => {
    render(<WasteMapFilters filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Radius')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    expect(screen.getByText('Participants')).toBeInTheDocument()
  })

  it('calls onChange with waste type filter', () => {
    const onChange = vi.fn()
    render(<WasteMapFilters filters={defaultFilters} onChange={onChange} />)
    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: String(WasteType.Plastic) } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wasteType: WasteType.Plastic }))
  })

  it('calls onChange with status filter', () => {
    const onChange = vi.fn()
    render(<WasteMapFilters filters={defaultFilters} onChange={onChange} />)
    const statusSelect = screen.getAllByRole('combobox')[1]
    fireEvent.change(statusSelect, { target: { value: 'confirmed' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }))
  })

  it('calls onChange with location search', () => {
    const onChange = vi.fn()
    render(<WasteMapFilters filters={defaultFilters} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: '40.7128,-74.0060' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locationQuery: '40.7128,-74.0060' }))
  })

  it('calls onChange with radius search', () => {
    const onChange = vi.fn()
    render(<WasteMapFilters filters={defaultFilters} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '50' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ radiusKm: 50 }))
  })

  it('clears waste type when "All types" selected', () => {
    const onChange = vi.fn()
    render(<WasteMapFilters filters={{ ...defaultFilters, wasteType: WasteType.Metal }} onChange={onChange} />)
    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wasteType: undefined }))
  })
})

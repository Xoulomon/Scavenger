import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WasteFilterManager, WasteFilter } from './wasteFilterManager';

describe('WasteFilterManager', () => {
  it('initializes with empty filters', () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange })
    );

    expect(result.current.filters).toEqual({});
    expect(result.current.isFilterActive).toBe(false);
  });

  it('updates filters correctly', () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange })
    );

    act(() => {
      result.current.updateFilter({ wasteType: ['Plastic'] });
    });

    expect(result.current.filters.wasteType).toEqual(['Plastic']);
    expect(result.current.isFilterActive).toBe(true);
    expect(onFilterChange).toHaveBeenCalledWith({ wasteType: ['Plastic'] });
  });

  it('clears all filters', () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange })
    );

    act(() => {
      result.current.updateFilter({ wasteType: ['Plastic'] });
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({});
    expect(result.current.isFilterActive).toBe(false);
  });

  it('applies preset filters', () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange })
    );

    act(() => {
      result.current.applyPreset('recent');
    });

    expect(result.current.filters.dateRange).toBeDefined();
    expect(onFilterChange).toHaveBeenCalled();
  });

  it('saves current filters as preset', () => {
    const onSavePreset = vi.fn();
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange, onSavePreset })
    );

    act(() => {
      result.current.updateFilter({ wasteType: ['Metal'] });
    });

    act(() => {
      result.current.saveCurrentAsPreset('My Preset');
    });

    expect(result.current.presets.length).toBeGreaterThan(3);
    expect(onSavePreset).toHaveBeenCalled();
  });

  it('includes default presets', () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() =>
      WasteFilterManager({ onFilterChange })
    );

    expect(result.current.presets.length).toBe(3);
    expect(result.current.presets.map((p) => p.id)).toContain('recent');
    expect(result.current.presets.map((p) => p.id)).toContain('high-weight');
    expect(result.current.presets.map((p) => p.id)).toContain('verified');
  });
});

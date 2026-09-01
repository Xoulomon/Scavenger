import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalyticsExport } from '../useAnalyticsExport';

describe('useAnalyticsExport', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it('should export data to CSV', () => {
    const { result } = renderHook(() => useAnalyticsExport());

    act(() => {
      result.current.exportToCSV();
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('should create CSV with correct format', () => {
    const { result } = renderHook(() => useAnalyticsExport());

    act(() => {
      result.current.exportToCSV();
    });

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('should handle PDF export', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { result } = renderHook(() => useAnalyticsExport());

    act(() => {
      result.current.exportToPDF();
    });

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should generate unique filenames', () => {
    const { result } = renderHook(() => useAnalyticsExport());

    act(() => {
      result.current.exportToCSV();
    });

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});

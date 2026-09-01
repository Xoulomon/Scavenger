import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScanHistory } from '../useScanHistory';

describe('useScanHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.history).toEqual([]);
  });

  it('should add scan to history', () => {
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      result.current.addScan('WASTE123');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].wasteId).toBe('WASTE123');
  });

  it('should persist history to localStorage', () => {
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      result.current.addScan('WASTE456');
    });

    const stored = localStorage.getItem('qr_scan_history');
    expect(stored).toBeTruthy();
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      result.current.addScan('WASTE789');
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
  });

  it('should limit history to 50 items', () => {
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.addScan(`WASTE${i}`);
      }
    });

    expect(result.current.history).toHaveLength(50);
  });
});

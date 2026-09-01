/**
 * Tests for useImport — issue #1072
 *
 * Verifies that:
 *  - only CSV and JSON are supported (dead XML/XLS branches removed)
 *  - CSV is parsed into keyed record objects using the header row
 *  - JSON is parsed into the expected data shape
 *  - empty CSV produces an error state
 *  - invalid JSON produces an error state
 *  - state lifecycle (isLoading → data/error) is correct
 *  - no unreachable "dry-run preview" branch exists
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImport } from '../useImport';

// ── FileReader mock ───────────────────────────────────────────────────────

function mockFileReader(content: string, shouldFail = false) {
  vi.stubGlobal(
    'FileReader',
    class {
      result: string | null = null;
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
      onerror: (() => void) | null = null;

      readAsText(_file: File, _encoding?: string) {
        setTimeout(() => {
          if (shouldFail) {
            this.onerror?.();
          } else {
            this.result = content;
            this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
          }
        }, 0);
      }
    }
  );
}

function makeFile(content: string, name = 'test.csv', type = 'text/csv'): File {
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ── CSV import ────────────────────────────────────────────────────────────

describe('useImport — importFromCSV', () => {
  it('parses a CSV file into keyed records', async () => {
    const csv = 'Waste Type,Quantity,Status\nPlastic,150,Recycled\nMetal,200,Processed';
    mockFileReader(csv);

    const { result } = renderHook(() => useImport<Record<string, string>[]>());

    let records: Record<string, string>[] = [];
    await act(async () => {
      records = await result.current.importFromCSV(makeFile(csv));
    });

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      'Waste Type': 'Plastic',
      Quantity: '150',
      Status: 'Recycled',
    });
    expect(records[1]).toEqual({
      'Waste Type': 'Metal',
      Quantity: '200',
      Status: 'Processed',
    });
  });

  it('sets state.data on success', async () => {
    const csv = 'Col\nVal';
    mockFileReader(csv);

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.importFromCSV(makeFile(csv));
    });

    expect(result.current.state.data).not.toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
  });

  it('sets state.error and throws on empty CSV', async () => {
    mockFileReader('');

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await expect(result.current.importFromCSV(makeFile(''))).rejects.toThrow(
        'CSV file is empty'
      );
    });

    expect(result.current.state.error).toBe('CSV file is empty');
    expect(result.current.state.data).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
  });

  it('sets state.isLoading true then false', async () => {
    const csv = 'H\n1';
    mockFileReader(csv);

    const { result } = renderHook(() => useImport());

    const loadingValues: boolean[] = [];
    // Snapshot isLoading just after calling importFromCSV (before await settles)
    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.importFromCSV(makeFile(csv));
      loadingValues.push(result.current.state.isLoading);
    });
    // isLoading should be true immediately after the call
    expect(loadingValues[0]).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.state.isLoading).toBe(false);
  });

  it('sets state.error when FileReader fails', async () => {
    mockFileReader('', /* shouldFail */ true);

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await expect(
        result.current.importFromCSV(makeFile('ignored'))
      ).rejects.toThrow();
    });

    expect(result.current.state.error).not.toBeNull();
  });

  it('handles CSV with only a header row (no data rows)', async () => {
    const csv = 'Date,Type,Qty';
    mockFileReader(csv);

    const { result } = renderHook(() => useImport<Record<string, string>[]>());

    let records: Record<string, string>[] = [];
    await act(async () => {
      records = await result.current.importFromCSV(makeFile(csv));
    });

    expect(records).toHaveLength(0);
  });

  it('skips blank lines in the CSV body', async () => {
    const csv = 'Name,Qty\n\nPlastic,10\n\nMetal,20\n';
    mockFileReader(csv);

    const { result } = renderHook(() => useImport<Record<string, string>[]>());

    let records: Record<string, string>[] = [];
    await act(async () => {
      records = await result.current.importFromCSV(makeFile(csv));
    });

    expect(records).toHaveLength(2);
  });
});

// ── JSON import ───────────────────────────────────────────────────────────

describe('useImport — importFromJSON', () => {
  it('parses a valid JSON file into the expected shape', async () => {
    const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    mockFileReader(JSON.stringify(data));

    const { result } = renderHook(() => useImport<{ id: number; name: string }[]>());

    let parsed: { id: number; name: string }[] = [];
    await act(async () => {
      parsed = await result.current.importFromJSON(
        makeFile(JSON.stringify(data), 'participants.json', 'application/json')
      );
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ id: 1, name: 'Alice' });
  });

  it('sets state.data on success', async () => {
    const json = '{"total": 5}';
    mockFileReader(json);

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.importFromJSON(makeFile(json, 'data.json', 'application/json'));
    });

    expect(result.current.state.data).toEqual({ total: 5 });
    expect(result.current.state.error).toBeNull();
  });

  it('sets state.error and throws on invalid JSON', async () => {
    mockFileReader('{ not valid json }');

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await expect(
        result.current.importFromJSON(makeFile('bad', 'bad.json', 'application/json'))
      ).rejects.toThrow();
    });

    expect(result.current.state.error).not.toBeNull();
    expect(result.current.state.data).toBeNull();
  });

  it('handles JSON arrays', async () => {
    const json = '[1, 2, 3]';
    mockFileReader(json);

    const { result } = renderHook(() => useImport<number[]>());

    let parsed: number[] = [];
    await act(async () => {
      parsed = await result.current.importFromJSON(
        makeFile(json, 'nums.json', 'application/json')
      );
    });

    expect(parsed).toEqual([1, 2, 3]);
  });
});

// ── Dead format branches are absent ───────────────────────────────────────

describe('useImport — only CSV and JSON are exposed', () => {
  it('does not expose an XML import function', () => {
    const { result } = renderHook(() => useImport());
    expect((result.current as Record<string, unknown>).importFromXML).toBeUndefined();
  });

  it('does not expose an XLS import function', () => {
    const { result } = renderHook(() => useImport());
    expect((result.current as Record<string, unknown>).importFromXLS).toBeUndefined();
    expect((result.current as Record<string, unknown>).importFromXLSX).toBeUndefined();
  });

  it('does not expose a dry-run preview function', () => {
    const { result } = renderHook(() => useImport());
    expect((result.current as Record<string, unknown>).dryRunPreview).toBeUndefined();
    expect((result.current as Record<string, unknown>).previewImport).toBeUndefined();
  });
});

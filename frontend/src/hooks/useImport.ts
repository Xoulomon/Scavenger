/**
 * useImport — issue #1072
 *
 * Replaces the combined `useExportImport` hook.  Only the two formats
 * actively used in the Scavenger frontend are kept:
 *
 *   - CSV   — bulk-import waste records from a spreadsheet
 *   - JSON  — import participant or incentive records from a JSON file
 *
 * Removed dead branches from the original combined hook:
 *   - XML import (no call sites)
 *   - Binary/XLS import (no call sites)
 *   - "dry-run" preview branch that was never wired to any UI component
 */
import { useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

/** State returned while an import is in progress or has finished. */
export interface ImportState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/** A single parsed CSV row: header field name → cell value. */
export type CsvRecord = Record<string, string>;

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Provides `importFromCSV` and `importFromJSON` functions plus the
 * current `state` of the most recent import operation.
 *
 * Both import functions read from a `File` object (typically from an
 * `<input type="file">` element).
 */
export function useImport<T = unknown>() {
  const [state, setState] = useState<ImportState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  /**
   * Parse a CSV `File` into an array of header-keyed record objects.
   *
   * The first row is treated as the header; subsequent rows are mapped
   * to `{ headerField: cellValue }` objects.  Empty rows are silently
   * skipped.
   *
   * @param file  - A `File` object with MIME type `text/csv` (or any
   *                text-based file the user has provided).
   * @returns The parsed records, also available via `state.data`.
   */
  const importFromCSV = useCallback(
    async (file: File): Promise<CsvRecord[]> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const text = await readFileAsText(file);
        const rows = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (rows.length === 0) {
          throw new Error('CSV file is empty');
        }

        const headers = rows[0].split(',').map((h) => h.trim());
        const records: CsvRecord[] = rows.slice(1).map((row) => {
          const cells = row.split(',').map((c) => c.trim());
          return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
        });

        setState({ data: records as unknown as T, error: null, isLoading: false });
        return records;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'CSV import failed';
        setState({ data: null, error: message, isLoading: false });
        throw err;
      }
    },
    []
  );

  /**
   * Parse a JSON `File` into a typed value.
   *
   * @param file  - A `File` object with MIME type `application/json`.
   * @returns The parsed value, also available via `state.data`.
   */
  const importFromJSON = useCallback(
    async (file: File): Promise<T> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const text = await readFileAsText(file);
        const parsed = JSON.parse(text) as T;
        setState({ data: parsed, error: null, isLoading: false });
        return parsed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'JSON import failed';
        setState({ data: null, error: message, isLoading: false });
        throw err;
      }
    },
    []
  );

  return { importFromCSV, importFromJSON, state };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string ?? '');
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

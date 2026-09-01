/**
 * useExport — issue #1072
 *
 * Replaces the combined `useExportImport` hook.  Only the two formats
 * actively used in the Scavenger frontend are kept:
 *
 *   - CSV   — waste-list and analytics tabular data
 *   - JSON  — full structured record export (participants, incentives)
 *
 * Removed dead branches from the original combined hook:
 *   - XML format handler (no call sites found)
 *   - XLS/XLSX format handler (no call sites found)
 *   - "legacy-csv" branch with a different column order (superseded by
 *     the current CSV path in useAnalyticsExport)
 */
import { useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export type CsvRow = string[];

export interface ExportOptions {
  /** File name without extension. Defaults to `"export-<timestamp>"`. */
  filename?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Provides `exportToCSV` and `exportToJSON` functions.
 *
 * Both functions are stable (wrapped in `useCallback`) so they can be
 * safely used as `useEffect` or event-handler dependencies.
 */
export function useExport() {
  /**
   * Serialises a 2D string array to CSV and triggers a browser download.
   *
   * @param rows  - Array of rows; each row is an array of cell strings.
   *               The first row is treated as the header.
   * @param options - Optional filename override.
   *
   * @example
   * exportToCSV(
   *   [['Waste Type', 'Quantity'], ['Plastic', '150']],
   *   { filename: 'waste-report' }
   * )
   */
  const exportToCSV = useCallback((rows: CsvRow[], options: ExportOptions = {}) => {
    if (rows.length === 0) return;

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, buildFilename(options.filename, 'csv'));
  }, []);

  /**
   * Serialises an arbitrary value to pretty-printed JSON and triggers a
   * browser download.
   *
   * @param data    - The value to serialise (must be JSON-serialisable).
   * @param options - Optional filename override.
   *
   * @example
   * exportToJSON(participants, { filename: 'participants' })
   */
  const exportToJSON = useCallback(<T>(data: T, options: ExportOptions = {}) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    triggerDownload(blob, buildFilename(options.filename, 'json'));
  }, []);

  return { exportToCSV, exportToJSON };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildFilename(base: string | undefined, ext: string): string {
  return `${base ?? `export-${Date.now()}`}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

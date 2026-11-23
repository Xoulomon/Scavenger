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
 *
 * Issue #1693 — consolidated duplicated hooks.  The loading/error state
 * machine now lives in `useAsync` (see `./useAsync`); this hook only
 * supplies the format-specific parsing logic.  The public API
 * (`importFromCSV`, `importFromJSON`, `state`) is unchanged, so existing
 * callers keep working without modification.
 */
import { useCallback } from 'react'
import { useAsync, type AsyncState } from './useAsync'

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * State returned while an import is in progress or has finished.
 *
 * @deprecated Kept for backwards compatibility; identical to
 * `AsyncState<T>` from `./useAsync`.
 */
export type ImportState<T> = AsyncState<T>

/** A single parsed CSV row: header field name → cell value. */
export type CsvRecord = Record<string, string>

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Provides `importFromCSV` and `importFromJSON` functions plus the
 * current `state` of the most recent import operation.
 *
 * Contract:
 *   - Both import functions read from a `File` object (typically from an
 *     `<input type="file">` element).
 *   - `state.isLoading` is `true` while an import is in flight.
 *   - On success `state.data` holds the parsed value and `state.error` is
 *     `null`; on failure `state.data` is `null` and `state.error` holds a
 *     human-readable message.
 *   - Both functions re-throw the underlying error so callers can react
 *     locally (e.g. show a toast) in addition to reading `state.error`.
 *   - `state` is shared: the most recent operation wins.
 */
export function useImport<T = unknown>() {
  const { state, run } = useAsync<T>()

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
      const records = await run(async () => {
        const text = await readFileAsText(file)
        const rows = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        if (rows.length === 0) {
          throw new Error('CSV file is empty')
        }

        const headers = rows[0].split(',').map((h) => h.trim())
        return rows.slice(1).map((row) => {
          const cells = row.split(',').map((c) => c.trim())
          return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
        })
      })
      return records as CsvRecord[]
    },
    [run]
  )

  /**
   * Parse a JSON `File` into a typed value.
   *
   * @param file  - A `File` object with MIME type `application/json`.
   * @returns The parsed value, also available via `state.data`.
   */
  const importFromJSON = useCallback(
    async (file: File): Promise<T> => {
      return run(async () => {
        const text = await readFileAsText(file)
        return JSON.parse(text) as T
      })
    },
    [run]
  )

  return { importFromCSV, importFromJSON, state }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) ?? '')
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file, 'utf-8')
  })
}

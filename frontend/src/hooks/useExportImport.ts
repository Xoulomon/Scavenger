/**
 * useExportImport
 *
 * Convenience hook that exposes all export/import utilities from
 * the unified lib/exportImport module so components can consume them
 * without importing from the lib directly.
 *
 * Compatibility contract:
 * - This module is a thin re-export layer over `@/lib/exportImport`.
 * - All previously exported functions, classes, and types are preserved
 *   for backwards compatibility; existing callers do not need to change.
 * - New code should prefer importing directly from `@/lib/exportImport`
 *   or from the consolidated hooks in `frontend/src/hooks`.
 * - This file intentionally contains no runtime logic; it only re-exports.
 */
export {
  exportWasteToCSV,
  exportWasteToJSON,
  exportAnalyticsToCSV,
  exportParticipantStatsToPDF,
  PDFExporter,
  parseWasteCSV,
  generateWasteTemplateCSV,
  triggerDownload,
  type AnalyticsMonthlyRow,
  type ImportWasteRow,
  type ParsedImportResult,
  type ImportPreviewRow,
  type WasteExportData,
  type PDFExportOptions
} from '@/lib/exportImport'

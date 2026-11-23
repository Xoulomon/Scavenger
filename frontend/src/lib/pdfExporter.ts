/**
 * @deprecated Import directly from '@/lib/exportImport' instead.
 * This file is kept for backward compatibility and re-exports the
 * unified PDFExporter from the consolidated export/import utility.
 */
export {
  PDFExporter,
  type WasteExportData as WasteData,
  type PDFExportOptions
} from './exportImport'
export { PDFExporter as default } from './exportImport'

import { useCallback } from 'react'
import {
  exportAnalyticsToCSV,
  PDFExporter,
  triggerDownload,
  type AnalyticsMonthlyRow
} from '@/lib/exportImport'

const MONTHLY_DATA: AnalyticsMonthlyRow[] = [
  { month: 'Jan', plastic: 45, metal: 30, glass: 25 },
  { month: 'Feb', plastic: 52, metal: 35, glass: 28 },
  { month: 'Mar', plastic: 61, metal: 42, glass: 33 },
  { month: 'Apr', plastic: 58, metal: 38, glass: 31 },
  { month: 'May', plastic: 67, metal: 45, glass: 36 },
  { month: 'Jun', plastic: 73, metal: 51, glass: 42 }
]

export function useAnalyticsExport() {
  const exportToCSV = useCallback(() => {
    const blob = exportAnalyticsToCSV(MONTHLY_DATA)
    triggerDownload(blob, `analytics-${Date.now()}.csv`)
  }, [])

  const exportToPDF = useCallback(() => {
    const exporter = new PDFExporter()
    exporter.exportAnalyticsMonthly(MONTHLY_DATA, { title: 'Analytics Report' })
    exporter.save(`analytics-${Date.now()}.pdf`)
  }, [])

  return { exportToCSV, exportToPDF }
}

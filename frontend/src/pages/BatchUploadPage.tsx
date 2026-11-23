import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2
} from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { WasteType } from '@/api/types'
import { SubmissionStatus } from '@/constants/statuses'

// CSV column order: waste_type, weight, latitude, longitude
const CSV_TEMPLATE = `waste_type,weight,latitude,longitude
${WasteType.Paper},10.5,40.7128,-74.0060
${WasteType.PetPlastic},5.0,40.7128,-74.0060
${WasteType.Plastic},8.3,40.7128,-74.0060
${WasteType.Metal},15.0,40.7128,-74.0060
${WasteType.Glass},6.2,40.7128,-74.0060
${WasteType.Organic},12.0,40.7128,-74.0060
${WasteType.Electronic},3.5,40.7128,-74.0060`

const WASTE_TYPE_MAP: Record<string, WasteType> = {
  [WasteType.Paper]: WasteType.Paper,
  [WasteType.PetPlastic]: WasteType.PetPlastic,
  [WasteType.Plastic]: WasteType.Plastic,
  [WasteType.Metal]: WasteType.Metal,
  [WasteType.Glass]: WasteType.Glass,
  [WasteType.Organic]: WasteType.Organic,
  [WasteType.Electronic]: WasteType.Electronic
}

interface ParsedRow {
  rowIndex: number
  waste_type: string
  weight: string
  latitude: string
  longitude: string
  errors: string[]
  valid: boolean
}

interface RowResult {
  rowIndex: number
  success: boolean
  message: string
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string

function parseCSV(text: string, t: TranslateFn): ParsedRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const rows = lines.slice(1) // skip header

  return rows.map((line, idx) => {
    const [waste_type = '', weight = '', latitude = '', longitude = ''] = line
      .split(',')
      .map((v) => v.trim())

    const errors: string[] = []
    if (!WASTE_TYPE_MAP[waste_type]) {
      errors.push(t('batchUpload.errors.unknownWasteType', { wasteType: waste_type }))
    }
    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0) errors.push(t('batchUpload.errors.invalidWeight'))
    const lat = parseFloat(latitude)
    if (isNaN(lat) || lat < -90 || lat > 90) errors.push(t('batchUpload.errors.invalidLatitude'))
    const lon = parseFloat(longitude)
    if (isNaN(lon) || lon < -180 || lon > 180) errors.push(t('batchUpload.errors.invalidLongitude'))

    return {
      rowIndex: idx + 2,
      waste_type,
      weight,
      latitude,
      longitude,
      errors,
      valid: errors.length === 0
    }
  })
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batch_upload_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function BatchUploadPage() {
  const { t } = useTranslation()
  useAppTitle(t('batchUpload.title'))
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<SubmissionStatus>(SubmissionStatus.Idle)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RowResult[]>([])
  const [dragOver, setDragOver] = useState(false)

  const validRows = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name)
      setStatus(SubmissionStatus.Idle)
      setResults([])
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        setRows(parseCSV(text, t))
      }
      reader.readAsText(file)
    },
    [t]
  )

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFile(file)
  }

  async function handleSubmit() {
    if (validRows.length === 0) return
    setStatus(SubmissionStatus.Uploading)
    setProgress(0)
    const res: RowResult[] = []

    for (let i = 0; i < validRows.length; i++) {
      // Simulated submission — replace with actual contract call
      await new Promise((r) => setTimeout(r, 200))
      res.push({
        rowIndex: validRows[i].rowIndex,
        success: true,
        message: t('batchUpload.results.submitted')
      })
      setProgress(Math.round(((i + 1) / validRows.length) * 100))
    }

    setResults(res)
    setStatus(SubmissionStatus.Done)
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('batchUpload.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('batchUpload.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <Card>
            <CardContent className="pt-6">
              <div
                role="button"
                tabIndex={0}
                aria-label={t('batchUpload.dropZone.ariaLabel')}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 xs:p-6 sm:p-10 text-center cursor-pointer transition-colors',
                  dragOver
                    ? 'border-primary bg-accent'
                    : 'border-muted-foreground/30 hover:border-primary hover:bg-accent/30'
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="min-w-0 max-w-full">
                  <p className="font-medium break-words">
                    {fileName || t('batchUpload.dropZone.prompt')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('batchUpload.dropZone.hint')}
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileChange}
                  aria-label={t('batchUpload.dropZone.uploadAriaLabel')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview table */}
          {rows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
                  <span>{t('batchUpload.preview.title', { count: rows.length })}</span>
                  <div className="flex gap-2 text-xs font-normal">
                    <span className="text-success">
                      {t('batchUpload.preview.valid', { count: validRows.length })}
                    </span>
                    {invalidRows.length > 0 && (
                      <span className="text-destructive">
                        {t('batchUpload.preview.invalid', { count: invalidRows.length })}
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.row')}
                        </th>
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.type')}
                        </th>
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.weight')}
                        </th>
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.lat')}
                        </th>
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.lon')}
                        </th>
                        <th className="px-2 xs:px-3 sm:px-4 py-2 text-left font-medium text-muted-foreground">
                          {t('batchUpload.table.status')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={cn('border-b last:border-0', !row.valid && 'bg-destructive/5')}
                        >
                          <td className="px-2 xs:px-3 sm:px-4 py-2 text-muted-foreground">
                            {row.rowIndex}
                          </td>
                          <td className="px-2 xs:px-3 sm:px-4 py-2">{row.waste_type}</td>
                          <td className="px-2 xs:px-3 sm:px-4 py-2">{row.weight}</td>
                          <td className="px-2 xs:px-3 sm:px-4 py-2">{row.latitude}</td>
                          <td className="px-2 xs:px-3 sm:px-4 py-2">{row.longitude}</td>
                          <td className="px-2 xs:px-3 sm:px-4 py-2">
                            {row.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <span className="flex items-center gap-1 text-destructive text-xs">
                                <XCircle className="h-4 w-4 shrink-0" />
                                {row.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          {status === SubmissionStatus.Uploading && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">
                    {t('batchUpload.progress.submitting', { progress })}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {status === SubmissionStatus.Done && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  {failed === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  <span className="font-medium text-sm">
                    {t('batchUpload.results.summary', { succeeded, failed })}
                  </span>
                </div>
                {failed > 0 && (
                  <ul className="text-xs text-destructive space-y-1">
                    {results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.rowIndex}>
                          {t('batchUpload.results.rowError', {
                            row: r.rowIndex,
                            message: r.message
                          })}
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('batchUpload.actions.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{t('batchUpload.actions.downloadTemplate')}</span>
              </Button>
              <Button
                className="w-full"
                disabled={validRows.length === 0 || status === SubmissionStatus.Uploading}
                onClick={() => void handleSubmit()}
              >
                {status === SubmissionStatus.Uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 shrink-0 animate-spin" />
                    {t('batchUpload.actions.uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2 shrink-0" />
                    {t('batchUpload.actions.submit', { count: validRows.length })}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {t('batchUpload.format.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">
                {t('batchUpload.format.requiredColumns')}
              </p>
              {['waste_type', 'weight', 'latitude', 'longitude'].map((col) => (
                <div key={col} className="flex flex-wrap items-center justify-between gap-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{col}</code>
                  {col === 'waste_type' && (
                    <span className="text-xs text-muted-foreground">
                      {t('batchUpload.format.types.string')}
                    </span>
                  )}
                  {col === 'weight' && (
                    <span className="text-xs text-muted-foreground">
                      {t('batchUpload.format.types.kg')}
                    </span>
                  )}
                  {(col === 'latitude' || col === 'longitude') && (
                    <span className="text-xs text-muted-foreground">
                      {t('batchUpload.format.types.decimal')}
                    </span>
                  )}
                </div>
              ))}
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1.5">
                  {t('batchUpload.format.validWasteTypes')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(WASTE_TYPE_MAP).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { QrCode, History, X, ScanLine } from 'lucide-react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useScanHistory } from '@/hooks/useScanHistory'
import { QRScanner } from '@/components/qr/QRScanner'
import { QRGenerator } from '@/components/qr/QRGenerator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

function formatTs(ts: number) {
  return new Date(ts).toLocaleString()
}

export function QRCodePage() {
  useAppTitle('QR Code Scanner')
  const { history, addScan, clearHistory } = useScanHistory()
  const [showScanner, setShowScanner] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [generateId, setGenerateId] = useState('')

  const handleScan = (wasteId: string) => {
    addScan(wasteId)
    setLastScanned(wasteId)
    setShowScanner(false)
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <QrCode className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">QR Code Scanner</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="h-4 w-4" /> Scan Waste QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lastScanned && (
                <div className="rounded-md bg-green-50 px-4 py-3 text-sm dark:bg-green-900/20">
                  <p className="font-medium text-green-700 dark:text-green-400">Last scanned</p>
                  <p className="font-mono text-green-600 dark:text-green-300">{lastScanned}</p>
                </div>
              )}
              {showScanner ? (
                <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
              ) : (
                <Button className="w-full" onClick={() => setShowScanner(true)}>
                  <ScanLine className="mr-2 h-4 w-4" /> Open Scanner
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Scan history */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Scan History
                  {history.length > 0 && <Badge variant="secondary">{history.length}</Badge>}
                </CardTitle>
                {history.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearHistory}>
                    <X className="mr-1 h-3 w-3" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-mono font-medium">{record.wasteId}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTs(record.timestamp)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setGenerateId(record.wasteId)}
                      >
                        View QR
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Generator section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4" /> Generate QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Enter waste ID…"
                  value={generateId}
                  onChange={(e) => setGenerateId(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={!generateId.trim()}
                  onClick={() => setGenerateId(generateId.trim())}
                >
                  Generate
                </Button>
              </div>
              {generateId.trim() && (
                <QRGenerator wasteId={generateId.trim()} wasteName={`Waste ${generateId.trim()}`} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

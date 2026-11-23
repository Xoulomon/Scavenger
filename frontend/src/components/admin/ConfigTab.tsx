import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function ConfigTab() {
  const [collectorPct, setCollectorPct] = useState('50')
  const [ownerPct, setOwnerPct] = useState('50')

  const total = Number(collectorPct) + Number(ownerPct)
  const isValid = total === 100

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reward Split Percentages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Collector %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={collectorPct}
                onChange={(e) => setCollectorPct(e.target.value)}
                aria-label="Collector percentage"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Owner %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={ownerPct}
                onChange={(e) => setOwnerPct(e.target.value)}
                aria-label="Owner percentage"
              />
            </div>
          </div>
          {!isValid && (
            <p className="text-xs text-destructive">
              Percentages must sum to 100 (currently {total}).
            </p>
          )}
          <Button disabled={!isValid} aria-label="Save configuration">
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

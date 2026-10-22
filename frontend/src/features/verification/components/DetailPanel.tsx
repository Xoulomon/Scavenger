import { CheckCircle2, Clock } from 'lucide-react'
import { useState } from 'react'

import type { Material } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useMaterialTransfers } from '@/hooks/useVerificationDashboard'
import { formatAddress,formatDate, wasteTypeLabel } from '@/lib/helpers'
import { cn } from '@/lib/utils'

import { formatWeight } from '../format'
import type { VerificationFormData } from '../types'
import { ImageComparison } from './ImageComparison'
import { VerificationForm } from './VerificationForm'
import { WasteTimeline } from './WasteTimeline'

export function DetailPanel({
  material,
  onVerify,
  isVerifying,
}: {
  material: Material
  onVerify: (materialId: number, decision: 'approved' | 'rejected', form: VerificationFormData) => void
  isVerifying: boolean
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details')
  const { data: transfers = [], isLoading: transfersLoading } = useMaterialTransfers(material.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Material #{material.id}</h2>
        {material.verified ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1" role="tablist" aria-label="Detail sections">
        <button
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'details'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Details
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'timeline'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="space-y-4">
          {/* Material details grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">{wasteTypeLabel(material.waste_type)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Weight</span>
              <p className="font-medium">{formatWeight(material.weight)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Submitter</span>
              <p className="font-mono text-xs">{formatAddress(material.submitter)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Current Owner</span>
              <p className="font-mono text-xs">{formatAddress(material.current_owner)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Submitted</span>
              <p className="font-medium">{formatDate(material.submitted_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium">
                {!material.is_active
                  ? 'Inactive'
                  : material.is_confirmed
                    ? 'Confirmed'
                    : material.verified
                      ? 'Verified'
                      : 'Pending'}
              </p>
            </div>
            {material.confirmer && material.confirmer !== 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Confirmer</span>
                <p className="font-mono text-xs">{formatAddress(material.confirmer)}</p>
              </div>
            )}
          </div>

          {/* Image comparison */}
          <ImageComparison materialId={material.id} />

          {/* Verification form */}
          {!material.verified && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <VerificationForm
                  material={material}
                  onComplete={onVerify}
                  isPending={isVerifying}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <WasteTimeline
          material={material}
          transfers={transfers}
          isLoading={transfersLoading}
        />
      )}
    </div>
  )
}

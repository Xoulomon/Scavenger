import { Recycle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export interface WasteSubmissionSummaryProps {
  onDone: () => void
  title?: string
  description?: string
}

export function WasteSubmissionSummary({
  onDone,
  title = 'Waste Submitted Successfully',
  description = 'Your waste submission has been recorded.',
}: WasteSubmissionSummaryProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <div className="rounded-full bg-green-100 p-3">
          <Recycle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
      </CardContent>
    </Card>
  )
}

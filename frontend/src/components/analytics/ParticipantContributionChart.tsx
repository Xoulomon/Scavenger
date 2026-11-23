import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  PARTICIPANT_CONTRIBUTIONS,
  ROLE_COLORS,
  roleColor,
  type ParticipantContribution
} from '@/lib/analytics'

interface ParticipantContributionChartProps {
  contributions?: ParticipantContribution[]
}

export function ParticipantContributionChart({
  contributions = PARTICIPANT_CONTRIBUTIONS
}: ParticipantContributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Participant Contributions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contributions.map(({ address, role, items, pct }) => (
          <div key={address} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs">{address}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{role}</span>
                <span className="font-medium text-xs">{items} items</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${roleColor(role)} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          {Object.entries(ROLE_COLORS).map(([role, color]) => (
            <span key={role} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              {role}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

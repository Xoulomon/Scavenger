import { AlertCircle } from 'lucide-react'

import type { Role } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

import { ROLE_CARDS } from '../constants'

export function RoleStep({
  selectedRole,
  onSelect,
  error,
}: {
  selectedRole: Role | null
  onSelect: (role: Role) => void
  error?: string
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Choose Your Role</h2>
        <p className="text-sm text-muted-foreground">
          Select the role that best describes your participation in the waste management
          ecosystem.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLE_CARDS.map(({ role, icon: Icon, title, description }) => {
          const selected = selectedRole === role
          return (
            <button
              key={role}
              type="button"
              aria-pressed={selected}
              aria-label={`Select ${title} role`}
              onClick={() => onSelect(role)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-lg border-2 p-5 text-center transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-7 w-7" aria-hidden="true" />
              </div>
              <span className="text-base font-semibold">{title}</span>
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
              {selected && (
                <Badge variant="default" className="mt-1">
                  Selected
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="flex items-center justify-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

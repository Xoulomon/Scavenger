import { AlertCircle } from 'lucide-react'
import { Button } from '../Button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function ErrorState({ title, message, action, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12', className)}>
      <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-destructive">{title}</h3>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}

import { CheckCircle2, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import type { Role } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { roleLabel } from '@/lib/helpers'
import { cn } from '@/lib/utils'

/** Shown after a successful registration. */
export function RegistrationSuccess({
  displayName,
  role,
}: {
  displayName: string
  role: Role | null
}) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2
              className="h-10 w-10 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
          </div>
          <CardTitle className="text-2xl">Registration Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Welcome to Scavngr, <span className="font-semibold">{displayName}</span>! Your
            account has been created as a{' '}
            <Badge variant="secondary">{role ? roleLabel(role) : ''}</Badge>.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <div className="mx-auto grid grid-cols-3 gap-1.5" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full',
                    i % 3 === 0 && 'bg-green-400',
                    i % 3 === 1 && 'bg-primary',
                    i % 3 === 2 && 'bg-yellow-400'
                  )}
                  style={{
                    animation: `pulse ${1 + i * 0.15}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <Button size="lg" onClick={() => navigate('/dashboard', { replace: true })}>
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Shown when no wallet is connected yet. */
export function ConnectWalletPrompt({
  onConnect,
  isLoading,
  error,
}: {
  onConnect: () => void
  isLoading: boolean
  error: string | null | undefined
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>Connect Your Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Freighter wallet to begin the registration process.
          </p>
          <Button className="w-full" size="lg" onClick={onConnect} disabled={isLoading}>
            <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

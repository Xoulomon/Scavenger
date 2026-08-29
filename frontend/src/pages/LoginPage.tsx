import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Recycle, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useRegisterParticipant } from '@/hooks/useRegisterParticipant'
import { ScavengerClient } from '@/lib/contract'
import { Role } from '@/api/types'
import { config } from '@/config'
import { networkConfig } from '@/lib/stellar'

const client = new ScavengerClient({
  rpcUrl: networkConfig.rpcUrl,
  networkPassphrase: networkConfig.networkPassphrase,
  contractId: config.contractId,
})

const ROLES = [
  { value: Role.Recycler, label: 'Recycler' },
  { value: Role.Collector, label: 'Collector' },
  { value: Role.Manufacturer, label: 'Manufacturer' },
]

export function LoginPage() {
  useAppTitle('Scavngr — Sign In')

  const navigate = useNavigate()
  const { address, isConnected, connect, isLoading: walletLoading, error: walletError } = useWallet()
  const { login } = useAuth()
  const registerMutation = useRegisterParticipant()

  const [checking, setChecking] = useState(false)
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)

  // Registration form state
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>(Role.Recycler)

  // Once wallet connects, check registration status
  useEffect(() => {
    if (!address) return
    setChecking(true)
    client
      .isParticipantRegistered(address)
      .then((registered) => {
        if (registered) {
          client.getParticipant(address).then((p) => {
            login({ role: p?.role, name: p?.name })
            navigate('/dashboard', { replace: true })
          })
        } else {
          setIsRegistered(false)
        }
      })
      .catch(() => setIsRegistered(false))
      .finally(() => setChecking(false))
  }, [address, login, navigate])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!address || !name.trim()) return
    registerMutation.mutate(
      { address, role, name: name.trim() },
      {
        onSuccess: (participant) => {
          login({ role: participant.role, name: participant.name })
          navigate('/dashboard', { replace: true })
        },
      }
    )
  }

  const isbusy = walletLoading || checking

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Recycle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Scavngr</h1>
          <p className="text-sm text-muted-foreground">
            Connect your Freighter wallet to get started.
          </p>
        </div>

        {/* Step 1: Connect wallet */}
        {!isConnected && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" onClick={connect} disabled={isbusy}>
              <Wallet className="mr-2 h-4 w-4" />
              {walletLoading ? 'Connecting…' : 'Connect Wallet'}
            </Button>
            {walletError && (
              <p role="alert" aria-live="assertive" className="text-center text-sm text-destructive">
                {walletError}
              </p>
            )}
          </div>
        )}

        {/* Checking registration */}
        {isConnected && checking && (
          <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
            Checking registration…
          </p>
        )}

        {/* Step 2: Registration form (not yet registered) */}
        {isConnected && !checking && isRegistered === false && (
          <form onSubmit={handleRegister} className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              You're not registered yet. Fill in your details to join.
            </p>

            <div className="space-y-1">
              <label htmlFor="display-name-input" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="display-name-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="role-select-trigger" className="text-sm font-medium">
                Role
              </label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role-select-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {registerMutation.isError && (
              <p role="alert" aria-live="assertive" className="text-sm text-destructive">
                {registerMutation.error?.message ?? 'Registration failed. Please try again.'}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={registerMutation.isPending || !name.trim()}>
              {registerMutation.isPending ? 'Registering…' : 'Create Account'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

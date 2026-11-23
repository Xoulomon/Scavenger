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
  SelectValue
} from '@/components/ui/Select'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useRegisterParticipant } from '@/hooks/useRegisterParticipant'
import { ScavengerClient } from '@/lib/contract'
import { Role } from '@/api/types'
import { config } from '@/config'
import { networkConfig } from '@/lib/stellar'
import { useTranslation } from '@/i18n/useTranslation'

const client = new ScavengerClient({
  rpcUrl: networkConfig.rpcUrl,
  networkPassphrase: networkConfig.networkPassphrase,
  contractId: config.contractId
})

const ROLES = [
  { value: Role.Recycler, labelKey: 'login.roles.recycler' },
  { value: Role.Collector, labelKey: 'login.roles.collector' },
  { value: Role.Manufacturer, labelKey: 'login.roles.manufacturer' }
]

export function LoginPage() {
  const { t } = useTranslation()
  useAppTitle(t('login.title'))

  const navigate = useNavigate()
  const {
    address,
    isConnected,
    connect,
    isLoading: walletLoading,
    error: walletError
  } = useWallet()
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
        }
      }
    )
  }

  const isbusy = walletLoading || checking

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 xs:px-4 sm:px-6">
      <div className="w-full max-w-sm space-y-5 xs:space-y-6 tablet:max-w-md tablet:space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 xs:h-12 xs:w-12">
            <Recycle className="h-5 w-5 text-primary xs:h-6 xs:w-6" />
          </div>
          <h1 className="text-xl font-bold xs:text-2xl tablet:text-3xl">{t('login.welcome')}</h1>
          <p className="text-xs text-muted-foreground xs:text-sm">{t('login.connectPrompt')}</p>
        </div>

        {/* Step 1: Connect wallet */}
        {!isConnected && (
          <div className="space-y-3">
            <Button className="w-full" size="lg" onClick={connect} disabled={isbusy}>
              <Wallet className="mr-2 h-4 w-4" />
              {walletLoading ? t('login.connecting') : t('login.connectWallet')}
            </Button>
            {walletError && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-center text-xs text-destructive xs:text-sm"
              >
                {walletError}
              </p>
            )}
          </div>
        )}

        {/* Checking registration */}
        {isConnected && checking && (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-xs text-muted-foreground xs:text-sm"
          >
            {t('login.checkingRegistration')}
          </p>
        )}

        {/* Step 2: Registration form (not yet registered) */}
        {isConnected && !checking && isRegistered === false && (
          <form onSubmit={handleRegister} className="space-y-3 xs:space-y-4 tablet:space-y-5">
            <p className="text-center text-xs text-muted-foreground xs:text-sm">
              {t('login.notRegistered')}
            </p>

            <div className="space-y-1">
              <label htmlFor="display-name-input" className="text-sm font-medium">
                {t('login.displayName')}
              </label>
              <Input
                id="display-name-input"
                placeholder={t('login.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="role-select-trigger" className="text-sm font-medium">
                {t('login.role')}
              </label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role-select-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {t(r.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {registerMutation.isError && (
              <p role="alert" aria-live="assertive" className="text-xs text-destructive xs:text-sm">
                {registerMutation.error?.message ?? t('login.registrationFailed')}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending || !name.trim()}
            >
              {registerMutation.isPending ? t('login.registering') : t('login.createAccount')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

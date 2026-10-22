import { ChevronLeft, ChevronRight, Loader2,Recycle } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import {
  ConnectWalletPrompt,
  RegistrationSuccess,
} from '@/features/participants/components/RegistrationStates'
import { RegistrationStepIndicator } from '@/features/participants/components/RegistrationStepIndicator'
import { STEP_LABELS, TOTAL_STEPS } from '@/features/participants/constants'
import { ConfirmStep } from '@/features/participants/steps/ConfirmStep'
import { KycStep } from '@/features/participants/steps/KycStep'
import { ProfileStep } from '@/features/participants/steps/ProfileStep'
import { RoleStep } from '@/features/participants/steps/RoleStep'
import { useRegistrationForm } from '@/features/participants/useRegistrationForm'
import { useAppTitle } from '@/hooks/useAppTitle'
import { formatAddress } from '@/lib/helpers'

export function ParticipantRegistrationPage() {
  useAppTitle('Register')
  const f = useRegistrationForm()

  if (f.isSuccess) {
    return <RegistrationSuccess displayName={f.draft.displayName} role={f.draft.role} />
  }

  if (!f.isConnected) {
    return (
      <ConnectWalletPrompt
        onConnect={f.connect}
        isLoading={f.walletLoading}
        error={f.walletError}
      />
    )
  }

  const isLastStep = f.step === TOTAL_STEPS

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Recycle className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Join Scavngr</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connected as{' '}
            <span className="font-mono text-xs">{f.address ? formatAddress(f.address) : ''}</span>
          </p>
        </div>

        <RegistrationStepIndicator current={f.step} total={TOTAL_STEPS} />

        {/* Step content */}
        <div
          ref={f.stepContainerRef}
          tabIndex={-1}
          className="outline-none"
          aria-label={`Step ${f.step}: ${STEP_LABELS[f.step - 1]}`}
        >
          {f.step === 1 && (
            <RoleStep
              selectedRole={f.draft.role}
              onSelect={(role) => f.updateDraft('role', role)}
              error={f.validationErrors.role}
            />
          )}

          {f.step === 2 && (
            <ProfileStep
              draft={f.draft}
              errors={f.validationErrors}
              onChange={f.updateDraft}
            />
          )}

          {f.step === 3 && (
            <KycStep
              identityDoc={f.draft.identityDoc}
              identityFile={f.identityFile}
              selfieDoc={f.draft.selfiePhoto}
              selfieFile={f.selfieFile}
              docDropzone={f.docDropzone}
              selfieDropzone={f.selfieDropzone}
              onRemoveIdentity={f.removeIdentityDoc}
              onRemoveSelfie={f.removeSelfie}
              errors={f.validationErrors}
            />
          )}

          {f.step === 4 && (
            <ConfirmStep
              draft={f.draft}
              address={f.address}
              errors={f.validationErrors}
              summaryItems={f.summaryItems}
              geo={{
                loading: f.geoLoading,
                error: f.geoError,
                onDetect: f.requestGeolocation,
              }}
              submitError={
                f.registerMutation.isError
                  ? (f.registerMutation.error?.message ?? 'Registration failed. Please try again.')
                  : null
              }
              onChange={f.updateDraft}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={f.goBack}
            disabled={f.step === 1 || f.registerMutation.isPending}
            aria-label="Go to previous step"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Back
          </Button>

          {!isLastStep ? (
            <Button type="button" onClick={f.goNext} aria-label="Go to next step">
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={f.handleSubmit}
              disabled={f.registerMutation.isPending}
              aria-label="Submit registration"
            >
              {f.registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting...
                </>
              ) : (
                'Submit Registration'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

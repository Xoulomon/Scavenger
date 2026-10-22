import { AlertCircle, CheckCircle2, Loader2, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatAddress } from '@/lib/helpers'

import type { FormDraft, ValidationErrors } from '../types'

export function ConfirmStep({
  draft,
  address,
  errors,
  summaryItems,
  geo,
  submitError,
  onChange,
}: {
  draft: FormDraft
  address: string | null
  errors: ValidationErrors
  summaryItems: { label: string; value: string }[]
  geo: { loading: boolean; error: string | null; onDetect: () => void }
  submitError?: string | null
  onChange: <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => void
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Location & Confirmation</h2>
        <p className="text-sm text-muted-foreground">
          Verify your location and review your information before submitting.
        </p>
      </div>

      {/* Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="reg-latitude" className="text-sm font-medium">
                Latitude (microdegrees) <span className="text-destructive">*</span>
              </label>
              <Input
                id="reg-latitude"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 37774929"
                value={draft.latitude}
                onChange={(e) => onChange('latitude', e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.latitude}
                aria-describedby={errors.latitude ? 'err-latitude' : undefined}
              />
              {errors.latitude && (
                <p id="err-latitude" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {errors.latitude}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reg-longitude" className="text-sm font-medium">
                Longitude (microdegrees) <span className="text-destructive">*</span>
              </label>
              <Input
                id="reg-longitude"
                type="text"
                inputMode="numeric"
                placeholder="e.g. -122419418"
                value={draft.longitude}
                onChange={(e) => onChange('longitude', e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.longitude}
                aria-describedby={errors.longitude ? 'err-longitude' : undefined}
              />
              {errors.longitude && (
                <p id="err-longitude" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {errors.longitude}
                </p>
              )}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={geo.onDetect} disabled={geo.loading}>
            {geo.loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Detecting...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
                Detect My Location
              </>
            )}
          </Button>

          {geo.error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {geo.error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Registration Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {summaryItems.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="max-w-[60%] truncate font-medium text-right">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-muted-foreground">Wallet</dt>
              <dd className="font-mono text-xs font-medium">
                {address ? formatAddress(address) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-mono text-xs font-medium">
                {draft.latitude && draft.longitude
                  ? `${draft.latitude}, ${draft.longitude}`
                  : '-'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Terms & conditions */}
      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.agreedToTerms}
            onChange={(e) => onChange('agreedToTerms', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-describedby={errors.agreedToTerms ? 'err-terms' : undefined}
          />
          <span className="text-sm text-muted-foreground">
            I agree to the{' '}
            <span className="font-medium text-foreground underline underline-offset-2">
              Terms of Service
            </span>{' '}
            and{' '}
            <span className="font-medium text-foreground underline underline-offset-2">
              Privacy Policy
            </span>
            . I understand that my registration will be recorded on the Stellar blockchain.
          </span>
        </label>
        {errors.agreedToTerms && (
          <p id="err-terms" role="alert" aria-live="assertive" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {errors.agreedToTerms}
          </p>
        )}
      </div>

      {/* Registration error */}
      {submitError && (
        <p role="alert" aria-live="assertive" className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {submitError}
        </p>
      )}
    </div>
  )
}

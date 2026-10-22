import { AlertCircle, User } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

import type { FormDraft, ValidationErrors } from '../types'

export function ProfileStep({
  draft,
  errors,
  onChange,
}: {
  draft: FormDraft
  errors: ValidationErrors
  onChange: <K extends keyof FormDraft>(key: K, value: FormDraft[K]) => void
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Profile Information</h2>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about yourself. Only the display name is required.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="reg-display-name" className="text-sm font-medium">
              Display Name <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="reg-display-name"
                placeholder="Your display name"
                value={draft.displayName}
                onChange={(e) => onChange('displayName', e.target.value)}
                className="pl-10"
                autoFocus
                aria-required="true"
                aria-invalid={!!errors.displayName}
                aria-describedby={errors.displayName ? 'err-display-name' : undefined}
              />
            </div>
            {errors.displayName && (
              <p
                id="err-display-name"
                role="alert"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.displayName}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-sm font-medium">
              Email <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={draft.email}
              onChange={(e) => onChange('email', e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'err-email' : undefined}
            />
            {errors.email && (
              <p
                id="err-email"
                role="alert"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="reg-phone" className="text-sm font-medium">
              Phone <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="reg-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={draft.phone}
              onChange={(e) => onChange('phone', e.target.value)}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label htmlFor="reg-bio" className="text-sm font-medium">
              Bio{' '}
              <span className="text-xs text-muted-foreground">
                (optional, {200 - draft.bio.length} chars remaining)
              </span>
            </label>
            <textarea
              id="reg-bio"
              placeholder="Tell others what you do..."
              value={draft.bio}
              onChange={(e) => {
                if (e.target.value.length <= 200) onChange('bio', e.target.value)
              }}
              maxLength={200}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
